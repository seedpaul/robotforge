import { routineSource } from './routines';
import { pythonMotor } from './gen-motors';
import { navxPort } from './gen-devices';
import type { Project } from './robot-model';
import { pythonProjectFile } from './library-project';
export function pythonSources(p:Project):Record<string,string>{return {
'robot.py':`import math
import commands2
import wpilib
from wpimath import applyDeadband
from commands2.button import Trigger
from pathplannerlib.auto import NamedCommands, PathPlannerAuto
from config import CONFIG
from hardware import MotorIO, Mechanism
from drive import Drive
from peripherals import HardwareIO

class Robot(wpilib.TimedRobot):
    def robotInit(self):
        wpilib.DataLogManager.start()
        wpilib.DriverStation.startDataLog(wpilib.DataLogManager.getLog())
        self.drive = Drive()
        self.hardware = HardwareIO()
        self.driver = wpilib.Joystick(CONFIG['controls']['driverPort'])
        self.operator = wpilib.Joystick(CONFIG['controls']['operatorPort'])
        self.mechanisms = {s['id']: Mechanism(s['name'], [MotorIO(m) for m in CONFIG['motors'] if m['subsystem'] == s['id']]) for s in CONFIG['subsystems'] if s['id'] != 'drive'}
        self.drive.setDefaultCommand(self.drive.runEnd(self.teleop_drive, self.drive.stop))
        for command in CONFIG['commands'] + CONFIG.get('routines', []):
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

    ${(p.routines||[]).map(r=>routineSource(r,'Python').replaceAll('\n','\n    ')).join('\n\n    ')}

    def action(self, command_id):
        ${(p.routines||[]).map(r=>`if command_id == ${JSON.stringify(r.id)}: return self.routine_${r.id}()`).join('\n        ')}
        c = next(c for c in CONFIG['commands'] if c['id'] == command_id)
        owner = self.mechanisms[c['subsystem']]
        stop = getattr(self.hardware, 'stop_' + c['device']) if c.get('device') else owner.stop
        setter = getattr(self.hardware, 'set_' + c['device']) if c.get('device') else owner.set
        def should_stop():
            if not c.get('untilDevice'): return False
            value = getattr(self.hardware, 'read_' + c['untilDevice'])()
            return not math.isfinite(value) or (value <= c.get('threshold', 0.5) if c.get('condition') == 'below' else value >= c.get('threshold', 0.5))
        def execute():
            if should_stop(): stop()
            else: setter(c['output'])
        command = owner.runEnd(execute, stop).withTimeout(c['timeout'])
        if c.get('untilDevice'): command = command.until(should_stop)
        return command.withName(c['name'])

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
        self.hardware.stop_all()
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

${pythonMotor(p)}
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
from phoenix6 import CANBus
from phoenix6.hardware import Pigeon2
${p.drive.gyro==='NavX'?'import navx':''}
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
        self.gyro = Pigeon2(self.d['gyroCan'], CANBus(self.d.get('gyroBus','rio'))) if self.d['gyro'] == 'Pigeon2' else ${p.drive.gyro==='NavX'?`navx.AHRS(navx.AHRS.NavXComType.${navxPort(p.drive.navxInterface)})`:'wpilib.ADXRS450_Gyro()'}
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
