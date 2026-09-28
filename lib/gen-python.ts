import type { Project } from './robot-model';
import { pythonProjectFile } from './library-project';
export function pythonSources(p:Project):Record<string,string>{return {
'robot.py':`import commands2
import wpilib
from wpimath import applyDeadband
from commands2.button import Trigger
from pathplannerlib.auto import NamedCommands, PathPlannerAuto
from config import CONFIG
from hardware import MotorIO, Mechanism
from drive import Drive

class Robot(wpilib.TimedRobot):
    def robotInit(self):
        wpilib.DataLogManager.start()
        wpilib.DriverStation.startDataLog(wpilib.DataLogManager.getLog())
        self.drive = Drive()
        self.driver = wpilib.Joystick(CONFIG['controls']['driverPort'])
        self.operator = wpilib.Joystick(CONFIG['controls']['operatorPort'])
        self.mechanisms = {s['id']: Mechanism(s['name'], [MotorIO(m) for m in CONFIG['motors'] if m['subsystem'] == s['id']]) for s in CONFIG['subsystems'] if s['id'] != 'drive'}
        self.drive.setDefaultCommand(self.drive.runEnd(self.teleop_drive, self.drive.stop))
        for command in CONFIG['commands']:
            NamedCommands.registerCommand(command['id'], self.action(command['id']))
        self.triggers = []
        for binding in CONFIG['bindings']:
            controller = self.driver if binding['controller'] == 'driver' else self.operator
            trigger = Trigger(lambda controller=controller, button=binding['button']: wpilib.DriverStation.isTeleopEnabled() and controller.getRawButton(button))
            getattr(trigger, {'whileHeld': 'whileTrue', 'onPress': 'onTrue', 'toggle': 'toggleOnTrue'}[binding['behavior']])(self.action(binding['command']))
            self.triggers.append(trigger)
        self.chooser = wpilib.SendableChooser()
        self.chooser.setDefaultOption('Do nothing', commands2.cmd.none())
        if self.drive.auto_ready:
            try:
                auto = PathPlannerAuto(CONFIG['auto']['name']).withTimeout(15).finallyDo(lambda interrupted: self.stop_all())
                self.chooser.addOption(CONFIG['auto']['name'], auto)
            except Exception as error:
                wpilib.reportError('Autonomous failed to load: ' + str(error))
        wpilib.SmartDashboard.putData('Auto chooser', self.chooser)
        self.autonomous = None

    def action(self, command_id):
        c = next(c for c in CONFIG['commands'] if c['id'] == command_id)
        return self.mechanisms[c['subsystem']].action(c['output'], c['timeout']).withName(c['name'])

    def teleop_drive(self):
        c = CONFIG['controls']
        self.drive.arcade(c['forwardSign'] * applyDeadband(self.driver.getRawAxis(c['forwardAxis']), c['deadband']), c['turnSign'] * applyDeadband(self.driver.getRawAxis(c['turnAxis']), c['deadband']))

    def robotPeriodic(self):
        commands2.CommandScheduler.getInstance().run()

    def autonomousInit(self):
        self.stop_all()
        self.autonomous = self.chooser.getSelected()
        if self.autonomous is not None:
            self.autonomous.schedule()

    def teleopInit(self):
        if self.autonomous is not None:
            self.autonomous.cancel()
        self.stop_all()

    def disabledInit(self):
        commands2.CommandScheduler.getInstance().cancelAll()
        self.stop_all()

    def testInit(self):
        commands2.CommandScheduler.getInstance().cancelAll()
        self.stop_all()

    def stop_all(self):
        self.drive.stop()
        for mechanism in self.mechanisms.values():
            mechanism.stop()
`,
'config.py':`# Generated configuration. Edit the project in RobotForge and re-export.\nimport json\nCONFIG = json.loads(${JSON.stringify(JSON.stringify(p))})\n`,
'hardware.py':`import math
import commands2
import wpilib
import rev
from phoenix6.hardware import TalonFX
from phoenix6.configs import TalonFXConfiguration
from phoenix6.controls import VoltageOut
from phoenix6.signals import InvertedValue, NeutralModeValue

class MotorIO:
    def __init__(self, config):
        self.sign = config['sensorSign']
        self.limit = wpilib.DigitalInput(config['limit']) if config['limit'] >= 0 else None
        self.spark = config['type'] != 'TalonFX'
        self.configured = False
        if self.spark:
            self.motor = (rev.SparkFlex if config['type'] == 'SparkFlex' else rev.SparkMax)(config['can'], rev.SparkLowLevel.MotorType.kBrushless)
            settings = rev.SparkFlexConfig() if config['type'] == 'SparkFlex' else rev.SparkMaxConfig()
            settings.inverted(config['inverted']).setIdleMode(rev.SparkBaseConfig.IdleMode.kBrake).smartCurrentLimit(config['current'])
            for _ in range(3):
                self.configured = self.motor.configure(settings, rev.ResetMode.kResetSafeParameters, rev.PersistMode.kPersistParameters) == rev.REVLibError.kOk
                if self.configured:
                    break
            self.encoder = self.motor.getEncoder()
        else:
            self.motor = TalonFX(config['can'])
            settings = TalonFXConfiguration()
            settings.motor_output.inverted = InvertedValue.CLOCKWISE_POSITIVE if config['inverted'] else InvertedValue.COUNTER_CLOCKWISE_POSITIVE
            settings.motor_output.neutral_mode = NeutralModeValue.BRAKE
            settings.current_limits.stator_current_limit_enable = True
            settings.current_limits.stator_current_limit = config['current']
            for _ in range(3):
                self.configured = self.motor.configurator.apply(settings).is_ok()
                if self.configured:
                    break
        if not self.configured:
            wpilib.reportError('Motor configuration failed, output inhibited: CAN ' + str(config['can']))

    def position(self):
        return self.sign * (self.encoder.getPosition() if self.spark else self.motor.get_position().value_as_double)

    def velocity(self):
        return self.sign * (self.encoder.getVelocity() / 60.0 if self.spark else self.motor.get_velocity().value_as_double)

    def voltage(self, volts):
        if not self.configured or not wpilib.DriverStation.isEnabled() or not math.isfinite(volts):
            volts = 0.0
        if self.limit is not None and not self.limit.get() and volts > 0:
            volts = 0.0
        volts = max(-12.0, min(12.0, volts))
        if self.spark:
            self.motor.setVoltage(volts)
        else:
            self.motor.set_control(VoltageOut(volts))

    def stop(self):
        self.voltage(0)

class Mechanism(commands2.Subsystem):
    def __init__(self, name, motors):
        super().__init__()
        self.setName(name)
        self.motors = motors
        self.last = 0.0

    def set(self, output):
        self.last = wpilib.Timer.getFPGATimestamp()
        for motor in self.motors:
            motor.voltage(output * 12.0)

    def stop(self):
        for motor in self.motors:
            motor.stop()

    def action(self, output, timeout):
        return self.runEnd(lambda: self.set(output), self.stop).withTimeout(timeout)

    def periodic(self):
        if wpilib.DriverStation.isDisabled() or wpilib.Timer.getFPGATimestamp() - self.last > 0.1:
            self.stop()
`,
'drive.py':`import math
import commands2
import wpilib
from wpimath.kinematics import DifferentialDriveKinematics, DifferentialDriveOdometry, DifferentialDriveWheelSpeeds
from wpimath.controller import PIDController
from phoenix6.hardware import Pigeon2
from pathplannerlib.auto import AutoBuilder
from pathplannerlib.config import RobotConfig
from pathplannerlib.controller import PPLTVController
from hardware import MotorIO
from config import CONFIG

class Drive(commands2.Subsystem):
    def __init__(self):
        super().__init__()
        self.d = CONFIG['drive']
        self.left = [MotorIO(m) for m in CONFIG['motors'] if m['role'] == 'left']
        self.right = [MotorIO(m) for m in CONFIG['motors'] if m['role'] == 'right']
        self.gyro = Pigeon2(self.d['gyroCan']) if self.d['gyro'] == 'Pigeon2' else wpilib.ADXRS450_Gyro()
        if self.d['gyro'] == 'ADXRS450' and wpilib.RobotBase.isReal():
            self.gyro.calibrate()
        self.meters_per_rotation = math.pi * self.d['wheelDiameter'] / self.d['gearing']
        self.kinematics = DifferentialDriveKinematics(self.d['trackWidth'])
        self.odometry = DifferentialDriveOdometry(self.heading(), self.distance(self.left), self.distance(self.right))
        self.left_pid = PIDController(self.d['kP'], 0, 0)
        self.right_pid = PIDController(self.d['kP'], 0, 0)
        self.field = wpilib.Field2d()
        self.last = 0.0
        self.auto_ready = False
        wpilib.SmartDashboard.putData('Robot pose', self.field)
        try:
            AutoBuilder.configure(self.pose, self.reset_pose, self.speeds, lambda speeds, ff: self.drive_speeds(speeds), PPLTVController(0.02), RobotConfig.fromGUISettings(), lambda: wpilib.DriverStation.getAlliance() == wpilib.DriverStation.Alliance.kRed, self)
            self.auto_ready = True
        except Exception as error:
            wpilib.reportError('Autonomous configuration failed: ' + str(error))

    def heading(self):
        return self.gyro.getRotation2d() if self.d['gyro'] == 'ADXRS450' else self.gyro.getRotation2d()

    def distance(self, motors):
        return sum(m.position() for m in motors) / max(1, len(motors)) * self.meters_per_rotation

    def velocity(self, motors):
        return sum(m.velocity() for m in motors) / max(1, len(motors)) * self.meters_per_rotation

    def pose(self):
        return self.odometry.getPose()

    def reset_pose(self, pose):
        self.odometry.resetPosition(self.heading(), self.distance(self.left), self.distance(self.right), pose)
        self.left_pid.reset()
        self.right_pid.reset()

    def speeds(self):
        return self.kinematics.toChassisSpeeds(DifferentialDriveWheelSpeeds(self.velocity(self.left), self.velocity(self.right)))

    def voltage(self, left, right):
        self.last = wpilib.Timer.getFPGATimestamp()
        if not all(m.configured for m in self.left + self.right):
            left = right = 0.0
        for motor in self.left:
            motor.voltage(left)
        for motor in self.right:
            motor.voltage(right)

    def stop(self):
        self.voltage(0, 0)
        self.left_pid.reset()
        self.right_pid.reset()

    def arcade(self, forward, turn):
        if not wpilib.DriverStation.isTeleopEnabled():
            self.stop()
            return
        left, right = forward - turn, forward + turn
        scale = max(1, abs(left), abs(right))
        cap = CONFIG['controls']['maxOutput'] * 12
        self.voltage(left / scale * cap, right / scale * cap)

    def feedforward(self, speed):
        return 0 if abs(speed) < 0.001 else math.copysign(self.d['kS'], speed) + self.d['kV'] * speed

    def drive_speeds(self, speeds):
        wheels = self.kinematics.toWheelSpeeds(speeds)
        wheels.desaturate(self.d['maxSpeed'])
        self.voltage(self.feedforward(wheels.left) + self.left_pid.calculate(self.velocity(self.left), wheels.left), self.feedforward(wheels.right) + self.right_pid.calculate(self.velocity(self.right), wheels.right))

    def periodic(self):
        if wpilib.DriverStation.isDisabled() or wpilib.Timer.getFPGATimestamp() - self.last > 0.1:
            self.stop()
        self.odometry.update(self.heading(), self.distance(self.left), self.distance(self.right))
        self.field.setRobotPose(self.pose())
        wpilib.SmartDashboard.putNumber('Drive/left meters', self.distance(self.left))
        wpilib.SmartDashboard.putNumber('Drive/right meters', self.distance(self.right))
        wpilib.SmartDashboard.putBoolean('Drive/auto configured', self.auto_ready)
`,
'pyproject.toml':pythonProjectFile(p),
};}
