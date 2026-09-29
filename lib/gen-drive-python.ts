import type { Project } from './robot-model';
import { orderedModules,driveType } from './drivetrain';
import { navxPort } from './gen-devices';
export function pythonHolonomicDrive(p:Project){
 const d=p.drive,s=driveType(p)==='swerve',mods=orderedModules(p),corners=['frontLeft','frontRight','backLeft','backRight'] as const;
 const locations=corners.map((_,i)=>`Translation2d(${(i<2?1:-1)*(d.wheelbase??.6)/2},${(i%2===0?1:-1)*d.trackWidth/2})`).join(',');
 const start=p.auto.waypoints[0],end=p.auto.waypoints.at(-1)!,heading=Math.atan2(p.auto.waypoints[1].y-start.y,p.auto.waypoints[1].x-start.x),last=p.auto.waypoints.at(-2)!,endHeading=Math.atan2(end.y-last.y,end.x-last.x);
 return `import math
import commands2
import wpilib
from wpimath.geometry import Pose2d, Rotation2d, Translation2d
from wpimath.kinematics import ChassisSpeeds, ${s?'SwerveDrive4Kinematics, SwerveDrive4Odometry, SwerveModulePosition, SwerveModuleState':'MecanumDriveKinematics, MecanumDriveOdometry, MecanumDriveWheelPositions, MecanumDriveWheelSpeeds'}
from wpimath.controller import PIDController, ProfiledPIDControllerRadians, HolonomicDriveController
from wpimath.trajectory import TrajectoryGenerator, TrajectoryConfig, TrapezoidProfileRadians
from wpimath.trajectory.constraint import MecanumDriveKinematicsConstraint
from phoenix6 import CANBus
from phoenix6.hardware import Pigeon2
${d.gyro==='NavX'?'import navx':''}
from pathplannerlib.auto import AutoBuilder
from pathplannerlib.config import RobotConfig, PIDConstants
from pathplannerlib.controller import PPHolonomicDriveController
from config import CONFIG
from hardware import MotorIO

class Drive(commands2.Subsystem):
    # All wheel arrays use front-left, front-right, back-left, back-right order.
    def __init__(self, hardware):
        super().__init__()
        self.hardware = hardware
        self.wheels = [MotorIO(next(m for m in CONFIG['motors'] if m['id'] == name)) for name in ${JSON.stringify(s?mods.map(m=>m.driveMotor):corners.map(c=>d.wheels![c]))}]
        ${s?`self.steer = [MotorIO(next(m for m in CONFIG['motors'] if m['id'] == name)) for name in ${JSON.stringify(mods.map(m=>m.steerMotor))}]
        self.steering = [PIDController(${d.steerKP??4},0,0) for _ in range(4)]
        for pid in self.steering: pid.enableContinuousInput(-math.pi, math.pi)
        self.angles = [Rotation2d() for _ in range(4)]`:''}
        self.velocity_pid = [PIDController(${d.kP},0,0) for _ in range(4)]
        self.gyro = ${d.gyro==='Pigeon2'?`Pigeon2(${d.gyroCan}, CANBus(${JSON.stringify(d.gyroBus||'rio')}))`:d.gyro==='NavX'?`navx.AHRS(navx.AHRS.NavXComType.${navxPort(d.navxInterface)})`:'wpilib.ADXRS450_Gyro()'}
        ${d.gyro==='ADXRS450'?'if wpilib.RobotBase.isReal(): self.gyro.calibrate()':''}
        self.conversion = math.pi * ${d.wheelDiameter} / ${d.gearing}
        self.kinematics = ${s?'SwerveDrive4Kinematics':'MecanumDriveKinematics'}(${locations})
        self.healthy()
        self.odometry = ${s?'SwerveDrive4Odometry':'MecanumDriveOdometry'}(self.kinematics, self.heading(), self.positions())
        self.last = 0.0
        self.was_healthy = False
        self.auto_ready = False
        self.field = wpilib.Field2d()
        wpilib.SmartDashboard.putData('Robot pose', self.field)
        ${s?'':`self.trajectory = None
        self.theta = ProfiledPIDControllerRadians(${d.rotationKP??3},0,0,TrapezoidProfileRadians.Constraints(${d.maxAngularSpeed??4},${d.maxAngularSpeed??4}))
        self.theta.enableContinuousInput(-math.pi, math.pi)
        self.follower = HolonomicDriveController(PIDController(${d.translationKP??3},0,0),PIDController(${d.translationKP??3},0,0),self.theta)`}
        try:
            ${s?`AutoBuilder.configure(self.pose,self.reset_pose,self.speeds,lambda speeds, ff:self.drive_speeds(speeds),PPHolonomicDriveController(PIDConstants(${d.translationKP??3},0,0),PIDConstants(${d.rotationKP??3},0,0)),RobotConfig.fromGUISettings(),lambda:wpilib.DriverStation.getAlliance()==wpilib.DriverStation.Alliance.kRed,self)`:`config = TrajectoryConfig(${p.auto.maxSpeed},${p.auto.maxAcceleration})
            config.addConstraint(MecanumDriveKinematicsConstraint(self.kinematics, ${d.maxSpeed}))
            self.trajectory = TrajectoryGenerator.generateTrajectory(Pose2d(${start.x},${start.y},Rotation2d(${heading})),[${p.auto.waypoints.slice(1,-1).map(w=>`Translation2d(${w.x},${w.y})`).join(',')}],Pose2d(${end.x},${end.y},Rotation2d(${endHeading})),config)
            if self.trajectory.totalTime() <= 0: raise ValueError('Empty trajectory')`}
            self.auto_ready = True
        except Exception as error:
            wpilib.reportError('Autonomous configuration failed: ' + str(error))

    def heading(self): return self.gyro.getRotation2d()
    def healthy(self):
        ok = ${d.gyro==='Pigeon2'?'self.gyro.get_yaw().status.is_ok() and self.gyro.get_yaw().timestamp.get_latency() < 0.25':d.gyro==='NavX'?'self.gyro.isConnected() and not self.gyro.isCalibrating()':'self.gyro.isConnected()'} and math.isfinite(self.heading().radians())
        ok = ok and all(m.configured and math.isfinite(m.position()) and math.isfinite(m.velocity()) for m in self.wheels)
        ${s?`ok = ok and all(m.configured for m in self.steer)
        readings = [${mods.map(m=>`self.hardware.read_${m.encoder}()-(${m.offset})`).join(',')}]
        for i, reading in enumerate(readings):
            if math.isfinite(reading): self.angles[i] = Rotation2d.fromRotations(reading)
            else: ok = False`:''}
        return ok
    def distance(self, i):
        value = self.wheels[i].position()*self.conversion
        return value if math.isfinite(value) else 0
    def velocity(self, i):
        value = self.wheels[i].velocity()*self.conversion
        return value if math.isfinite(value) else 0
    def positions(self): return ${s?'tuple(SwerveModulePosition(self.distance(i),self.angles[i]) for i in range(4))':'self.wheel_positions()'}
    ${s?'':`def wheel_positions(self):
        positions = MecanumDriveWheelPositions()
        positions.frontLeft,positions.frontRight,positions.rearLeft,positions.rearRight = (self.distance(i) for i in range(4))
        return positions
    `}
    def pose(self): return self.odometry.getPose()
    def reset_pose(self, pose):
        if not self.healthy():
            self.stop()
            return
        self.odometry.resetPosition(self.heading(),self.positions(),pose)
        for pid in self.velocity_pid: pid.reset()
    def speeds(self): return self.kinematics.toChassisSpeeds(${s?'tuple(SwerveModuleState(self.velocity(i),self.angles[i]) for i in range(4))':'MecanumDriveWheelSpeeds(*(self.velocity(i) for i in range(4)))'})
    def stop(self):
        for m in self.wheels${s?' + self.steer':''}: m.stop()
        for pid in self.velocity_pid${s?' + self.steering':''}: pid.reset()
    def teleop(self, forward, strafe, turn):
        if not wpilib.DriverStation.isTeleopEnabled():
            self.stop()
            return
        scale = max(1,math.hypot(forward,strafe))
        cap = CONFIG['controls']['maxOutput']
        vx,vy,omega = forward/scale*${d.maxSpeed}*cap,strafe/scale*${d.maxSpeed}*cap,turn*${d.maxAngularSpeed??4}*cap
        self.drive_speeds(${p.controls.fieldRelative?'ChassisSpeeds.fromFieldRelativeSpeeds(vx,vy,omega,self.pose().rotation())':'ChassisSpeeds(vx,vy,omega)'})
    def feedforward(self, speed): return 0 if abs(speed)<.001 else math.copysign(${d.kS},speed)+${d.kV}*speed
    def drive_speeds(self, requested):
        if not self.healthy() or not wpilib.DriverStation.isEnabled():
            self.stop()
            return
        self.last = wpilib.Timer.getFPGATimestamp()
        voltage_cap = 12*CONFIG['controls']['maxOutput'] if wpilib.DriverStation.isTeleopEnabled() else 12
        speeds = ChassisSpeeds.discretize(requested,.02)
        ${s?`states = self.kinematics.desaturateWheelSpeeds(self.kinematics.toSwerveModuleStates(speeds),${d.maxSpeed})
        for i, state in enumerate(states):
            if abs(state.speed)<.001:
                self.wheels[i].stop()
                self.steer[i].stop()
                self.velocity_pid[i].reset()
                self.steering[i].reset()
                continue
            state.optimize(self.angles[i])
            speed = state.speed * (state.angle-self.angles[i]).cos()
            self.wheels[i].voltage(max(-voltage_cap,min(voltage_cap,self.feedforward(speed)+self.velocity_pid[i].calculate(self.velocity(i),speed))))
            self.steer[i].voltage(max(-min(6,voltage_cap),min(min(6,voltage_cap),self.steering[i].calculate(self.angles[i].radians(),state.angle.radians()))))`:`wheels = self.kinematics.toWheelSpeeds(speeds)
        wheels.desaturate(${d.maxSpeed})
        for i, target in enumerate([wheels.frontLeft,wheels.frontRight,wheels.rearLeft,wheels.rearRight]):
            self.wheels[i].voltage(max(-voltage_cap,min(voltage_cap,self.feedforward(target)+self.velocity_pid[i].calculate(self.velocity(i),target))))`}
    ${s?'':`def follow_path(self):
        # Fixed blue-origin route. No automatic alliance transform.
        timer = wpilib.Timer()
        def start():
            timer.restart()
            self.reset_pose(Pose2d(${start.x},${start.y},Rotation2d(${heading})))
            self.follower.getThetaController().reset(self.pose().rotation().radians())
        def execute():
            if self.trajectory is not None:
                self.drive_speeds(self.follower.calculate(self.pose(),self.trajectory.sample(timer.get()),Rotation2d(${heading})))
        def end(interrupted):
            timer.stop()
            self.stop()
        return commands2.FunctionalCommand(start,execute,end,lambda:self.trajectory is None or not self.healthy() or timer.hasElapsed(self.trajectory.totalTime()),self)
    `}
    def periodic(self):
        good = self.healthy()
        if not good or wpilib.DriverStation.isDisabled() or wpilib.Timer.getFPGATimestamp()-self.last>.1: self.stop()
        if good:
            if not self.was_healthy: self.odometry.resetPosition(self.heading(),self.positions(),self.pose())
            else: self.odometry.update(self.heading(),self.positions())
        self.was_healthy = good
        self.field.setRobotPose(self.pose())
        wpilib.SmartDashboard.putBoolean('Drive/feedback healthy',good)
        wpilib.SmartDashboard.putBoolean('Drive/auto configured',self.auto_ready)
`;
}
