import type { Project,Motor } from './robot-model';
import { orderedModules,driveType } from './drivetrain';
import { navxPort } from './gen-devices';
const q=JSON.stringify;
export const javaMotorConstructor=(m:Motor)=>`new MotorIO(${q(m.type)},${m.can},${m.inverted},${m.sensorSign},${m.current},${m.limit},${q(m.bus||'rio')},${q(m.motorKind||'default')})`;
export function javaHolonomicDrive(p:Project){
 const d=p.drive,s=driveType(p)==='swerve',mods=orderedModules(p),corners=['frontLeft','frontRight','backLeft','backRight'] as const;
 const motor=(id:string)=>javaMotorConstructor(p.motors.find(m=>m.id===id)!);
 const encoders=s?[]:corners.flatMap((c,i)=>d.tractionEncoders?.[c]?[{i,id:d.tractionEncoders[c]!}]:[]);
 const feedback=(method:'read'|'rate',fallback:string)=>encoders.reduceRight((value,e)=>`(i==${e.i}?hardware.${method}_${e.id}():${value})`,fallback);
 const locations=corners.map((_,i)=>`new Translation2d(${(i<2?1:-1)*(d.wheelbase??.6)/2},${(i%2===0?1:-1)*d.trackWidth/2})`).join(',');
 const start=p.auto.waypoints[0],end=p.auto.waypoints.at(-1)!,heading=Math.atan2(p.auto.waypoints[1].y-start.y,p.auto.waypoints[1].x-start.x),last=p.auto.waypoints.at(-2)!,endHeading=Math.atan2(end.y-last.y,end.x-last.x);
 return `package frc.robot;
import edu.wpi.first.wpilibj.*;
import edu.wpi.first.wpilibj.smartdashboard.*;
import edu.wpi.first.wpilibj2.command.*;
import edu.wpi.first.math.MathUtil;
import edu.wpi.first.math.geometry.*;
import edu.wpi.first.math.kinematics.*;
import edu.wpi.first.math.controller.*;
import edu.wpi.first.math.trajectory.*;
import edu.wpi.first.math.trajectory.constraint.MecanumDriveKinematicsConstraint;
import java.util.List;
import com.pathplanner.lib.auto.AutoBuilder;
import com.pathplanner.lib.config.*;
import com.pathplanner.lib.controllers.PPHolonomicDriveController;
/** Wheel order is always front-left, front-right, back-left, back-right. */
public final class Drive extends SubsystemBase {
 private final HardwareIO hardware;
 private final MotorIO[] wheels={${(s?mods.map(m=>m.driveMotor):corners.map(c=>d.wheels![c])).map(motor).join(',')}};
 ${s?`private final MotorIO[] steer={${mods.map(m=>motor(m.steerMotor)).join(',')}};
 private final PIDController[] steering={${mods.map(()=>`new PIDController(${d.steerKP??4},0,0)`).join(',')}};
 private final Rotation2d[] angles={new Rotation2d(),new Rotation2d(),new Rotation2d(),new Rotation2d()};`:''}
 private final PIDController[] velocityPID={${corners.map(()=>`new PIDController(${d.kP},0,0)`).join(',')}};
 private final ${d.gyro==='Pigeon2'?`com.ctre.phoenix6.hardware.Pigeon2 gyro=new com.ctre.phoenix6.hardware.Pigeon2(${d.gyroCan},new com.ctre.phoenix6.CANBus(${q(d.gyroBus||'rio')}))`:d.gyro==='NavX'?`com.studica.frc.AHRS gyro=new com.studica.frc.AHRS(com.studica.frc.AHRS.NavXComType.${navxPort(d.navxInterface)})`:'ADXRS450_Gyro gyro=new ADXRS450_Gyro()'};
 private final ${s?'SwerveDriveKinematics':'MecanumDriveKinematics'} kinematics=new ${s?'SwerveDriveKinematics':'MecanumDriveKinematics'}(${locations});
 private final ${s?'SwerveDriveOdometry':'MecanumDriveOdometry'} odometry;
 private final Field2d field=new Field2d();
 private final double conversion=Math.PI*${d.wheelDiameter}/${d.gearing};
 private double last=0;private boolean autoReady=false,wasHealthy=false;
 ${s?'':`private Trajectory trajectory;
 private final ProfiledPIDController theta=new ProfiledPIDController(${d.rotationKP??3},0,0,new TrapezoidProfile.Constraints(${d.maxAngularSpeed??4},${d.maxAngularSpeed??4}));
 private final HolonomicDriveController follower=new HolonomicDriveController(new PIDController(${d.translationKP??3},0,0),new PIDController(${d.translationKP??3},0,0),theta);`}
 public Drive(HardwareIO hardware) {
  this.hardware=hardware;
  ${s?'for(var pid:steering)pid.enableContinuousInput(-Math.PI,Math.PI);':'theta.enableContinuousInput(-Math.PI,Math.PI);'}
  ${d.gyro==='ADXRS450'?'if(RobotBase.isReal())gyro.calibrate();':''}
  healthy();odometry=new ${s?'SwerveDriveOdometry':'MecanumDriveOdometry'}(kinematics,heading(),positions());
  SmartDashboard.putData("Robot pose",field);
  try {${s?`AutoBuilder.configure(this::pose,this::resetPose,this::speeds,(speeds,ff)->driveSpeeds(speeds),new PPHolonomicDriveController(new PIDConstants(${d.translationKP??3},0,0),new PIDConstants(${d.rotationKP??3},0,0)),RobotConfig.fromGUISettings(),()->DriverStation.getAlliance().orElse(DriverStation.Alliance.Blue)==DriverStation.Alliance.Red,this);`:`trajectory=TrajectoryGenerator.generateTrajectory(new Pose2d(${start.x},${start.y},new Rotation2d(${heading})),List.of(${p.auto.waypoints.slice(1,-1).map(w=>`new Translation2d(${w.x},${w.y})`).join(',')}),new Pose2d(${end.x},${end.y},new Rotation2d(${endHeading})),new TrajectoryConfig(${p.auto.maxSpeed},${p.auto.maxAcceleration}).addConstraint(new MecanumDriveKinematicsConstraint(kinematics,${d.maxSpeed})));if(trajectory.getTotalTimeSeconds()<=0)throw new IllegalStateException("Empty trajectory");`}autoReady=true; }
  catch(Exception e){DriverStation.reportError("Autonomous configuration failed: "+e.getMessage(),false);}
 }
 private Rotation2d heading(){return gyro.getRotation2d();}
 private boolean healthy(){boolean ok=${d.gyro==='Pigeon2'?'gyro.getYaw().getStatus().isOK() && gyro.getYaw().getTimestamp().getLatency()<0.25':d.gyro==='NavX'?'gyro.isConnected()&&!gyro.isCalibrating()':'gyro.isConnected()'}&&Double.isFinite(heading().getRadians());
  for(var m:wheels)ok&=m.ready()&&Double.isFinite(m.position())&&Double.isFinite(m.velocity());
  ${s?`for(var m:steer)ok&=m.ready();double[] readings={${mods.map(m=>`hardware.read_${m.encoder}()-(${m.offset})`).join(',')}};for(int i=0;i<4;i++){ok&=Double.isFinite(readings[i]);if(Double.isFinite(readings[i]))angles[i]=Rotation2d.fromRotations(readings[i]);}`:''}
  ${encoders.map(e=>`ok&=Double.isFinite(hardware.read_${e.id}())&&Double.isFinite(hardware.rate_${e.id}());`).join('')}
  return ok;
 }
 private double distance(int i){double value=${feedback('read','wheels[i].position()*conversion')};return Double.isFinite(value)?value:0;}
 private double velocity(int i){double value=${feedback('rate','wheels[i].velocity()*conversion')};return Double.isFinite(value)?value:0;}
 private ${s?'SwerveModulePosition[]':'MecanumDriveWheelPositions'} positions(){return ${s?'new SwerveModulePosition[]{'+corners.map((_,i)=>`new SwerveModulePosition(distance(${i}),angles[${i}])`).join(',')+'}':'new MecanumDriveWheelPositions(distance(0),distance(1),distance(2),distance(3))'};}
 public Pose2d pose(){return odometry.getPoseMeters();}
 public void resetPose(Pose2d pose){if(!healthy()){stop();return;}odometry.resetPosition(heading(),positions(),pose);for(var pid:velocityPID)pid.reset();}
 public ChassisSpeeds speeds(){return kinematics.toChassisSpeeds(${s?corners.map((_,i)=>`new SwerveModuleState(velocity(${i}),angles[${i}])`).join(','):'new MecanumDriveWheelSpeeds(velocity(0),velocity(1),velocity(2),velocity(3))'});}
 public boolean autoReady(){return autoReady;}
 public void stop(){for(var m:wheels)m.stop();${s?'for(var m:steer)m.stop();for(var pid:steering)pid.reset();':''}for(var pid:velocityPID)pid.reset();}
 public void teleop(double forward,double strafe,double turn){if(!DriverStation.isTeleopEnabled()){stop();return;}double norm=Math.max(1,Math.hypot(forward,strafe)),cap=${p.controls.maxOutput};double vx=forward/norm*${d.maxSpeed}*cap,vy=strafe/norm*${d.maxSpeed}*cap,omega=turn*${d.maxAngularSpeed??4}*cap;driveSpeeds(${p.controls.fieldRelative?'ChassisSpeeds.fromFieldRelativeSpeeds(vx,vy,omega,pose().getRotation())':'new ChassisSpeeds(vx,vy,omega)'});}
 private double ff(double speed){return Math.abs(speed)<.001?0:Math.copySign(${d.kS},speed)+${d.kV}*speed;}
 private void driveSpeeds(ChassisSpeeds requested){if(!healthy()||!DriverStation.isEnabled()){stop();return;}last=Timer.getFPGATimestamp();double voltageCap=DriverStation.isTeleopEnabled()?12*${p.controls.maxOutput}:12;var speeds=ChassisSpeeds.discretize(requested,.02);
  ${s?`var states=kinematics.toSwerveModuleStates(speeds);SwerveDriveKinematics.desaturateWheelSpeeds(states,${d.maxSpeed});
  for(int i=0;i<4;i++){var state=states[i];if(Math.abs(state.speedMetersPerSecond)<.001){wheels[i].stop();steer[i].stop();velocityPID[i].reset();steering[i].reset();continue;}state.optimize(angles[i]);double speed=state.speedMetersPerSecond*state.angle.minus(angles[i]).getCos();wheels[i].voltage(MathUtil.clamp(ff(speed)+velocityPID[i].calculate(velocity(i),speed),-voltageCap,voltageCap));steer[i].voltage(MathUtil.clamp(steering[i].calculate(angles[i].getRadians(),state.angle.getRadians()),-Math.min(6,voltageCap),Math.min(6,voltageCap)));}`:`var ws=kinematics.toWheelSpeeds(speeds);ws.desaturate(${d.maxSpeed});double[] targets={ws.frontLeftMetersPerSecond,ws.frontRightMetersPerSecond,ws.rearLeftMetersPerSecond,ws.rearRightMetersPerSecond};for(int i=0;i<4;i++)wheels[i].voltage(MathUtil.clamp(ff(targets[i])+velocityPID[i].calculate(velocity(i),targets[i]),-voltageCap,voltageCap));`}
 }
 ${s?'':`/** Fixed blue-origin route, no automatic alliance transform. */
 public Command followPath(){var timer=new Timer();return new FunctionalCommand(()->{timer.restart();resetPose(new Pose2d(${start.x},${start.y},new Rotation2d(${heading})));theta.reset(pose().getRotation().getRadians());},()->{if(trajectory!=null)driveSpeeds(follower.calculate(pose(),trajectory.sample(timer.get()),new Rotation2d(${heading})));},interrupted->{timer.stop();stop();},()->trajectory==null||!healthy()||timer.hasElapsed(trajectory.getTotalTimeSeconds()),this);}`}
 @Override public void periodic(){boolean good=healthy();if(!good||DriverStation.isDisabled()||Timer.getFPGATimestamp()-last>.1)stop();if(good){if(!wasHealthy)odometry.resetPosition(heading(),positions(),pose());else odometry.update(heading(),positions());}wasHealthy=good;field.setRobotPose(pose());SmartDashboard.putBoolean("Drive/feedback healthy",good);SmartDashboard.putBoolean("Drive/auto configured",autoReady);}
}
`;
}
