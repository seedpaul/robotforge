import { javaMotor } from './gen-motors';
import { javaAction } from './gen-actions';
import { navxPort } from './gen-devices';
import type { Project,Motor } from './robot-model';
const q=JSON.stringify;
export function javaSources(p:Project):Record<string,string>{const d=p.drive,c=p.controls;const motor=(m:Motor)=>`new MotorIO(${q(m.type)}, ${m.can}, ${m.inverted}, ${m.sensorSign}, ${m.current}, ${m.limit}, ${q(m.bus||'rio')}, ${q(m.motorKind||'default')})`;const driveMotors=(side:string)=>p.motors.filter(m=>m.role===side).map(motor).join(', ');const mechanisms=p.subsystems.filter(s=>s.id!=='drive');return {
'src/main/java/frc/robot/Robot.java':`package frc.robot;
import edu.wpi.first.wpilibj.TimedRobot;
import edu.wpi.first.wpilibj.DataLogManager;
import edu.wpi.first.wpilibj.DriverStation;
import edu.wpi.first.wpilibj2.command.Command;
import edu.wpi.first.wpilibj2.command.CommandScheduler;
public class Robot extends TimedRobot {
  private RobotContainer container;
  private Command autonomous;
  @Override public void robotInit() { DataLogManager.start(); DriverStation.startDataLog(DataLogManager.getLog()); container = new RobotContainer(); }
  @Override public void robotPeriodic() { CommandScheduler.getInstance().run(); }
  @Override public void autonomousInit() { container.stopAll(); autonomous = container.autonomous(); if (autonomous != null) CommandScheduler.getInstance().schedule(autonomous); }
  @Override public void teleopInit() { if (autonomous != null) autonomous.cancel(); container.stopAll(); }
  @Override public void disabledInit() { CommandScheduler.getInstance().cancelAll(); if (container != null) container.stopAll(); }
  @Override public void testInit() { CommandScheduler.getInstance().cancelAll(); container.stopAll(); }
}
`,
'src/main/java/frc/robot/Main.java':`package frc.robot;
import edu.wpi.first.wpilibj.RobotBase;
public final class Main { private Main() {} public static void main(String... args) { RobotBase.startRobot(Robot::new); } }
`,
'src/main/java/frc/robot/MotorIO.java':javaMotor(p),
'src/main/java/frc/robot/Mechanism.java':`package frc.robot;
import edu.wpi.first.wpilibj.*;
import edu.wpi.first.wpilibj2.command.*;
/** Owns every motor in one mechanism and supplies bounded commands. */
public final class Mechanism extends SubsystemBase {
  private final MotorIO[] motors; private double last=0;
  public Mechanism(String name, MotorIO... motors) { setName(name); this.motors=motors; }
  public void set(double output) { last=Timer.getFPGATimestamp(); for(var motor:motors) motor.voltage(output*12.0); }
  public void stop() { for(var motor:motors) motor.stop(); }
  public Command action(double output,double timeout) { return runEnd(()->set(output),this::stop).withTimeout(timeout); }
  @Override public void periodic() { if(DriverStation.isDisabled()||Timer.getFPGATimestamp()-last>0.1) stop(); }
}
`,
'src/main/java/frc/robot/Drive.java':`package frc.robot;
import edu.wpi.first.wpilibj.*;
import edu.wpi.first.wpilibj.smartdashboard.*;
import edu.wpi.first.wpilibj2.command.SubsystemBase;
import edu.wpi.first.math.MathUtil;
import edu.wpi.first.math.geometry.*;
import edu.wpi.first.math.kinematics.*;
import edu.wpi.first.math.controller.PIDController;
import com.ctre.phoenix6.hardware.Pigeon2;
import com.pathplanner.lib.auto.AutoBuilder;
import com.pathplanner.lib.config.RobotConfig;
import com.pathplanner.lib.controllers.PPLTVController;
public final class Drive extends SubsystemBase {
  private final MotorIO[] left={${driveMotors('left')}};
  private final MotorIO[] right={${driveMotors('right')}};
  private final ${d.gyro==='Pigeon2'?`Pigeon2 gyro=new Pigeon2(${d.gyroCan},new com.ctre.phoenix6.CANBus(${q(d.gyroBus||'rio')}))`:d.gyro==='NavX'?`com.studica.frc.AHRS gyro=new com.studica.frc.AHRS(com.studica.frc.AHRS.NavXComType.${navxPort(d.navxInterface)})`:'ADXRS450_Gyro gyro=new ADXRS450_Gyro()'};
  private final double metersPerRotation=Math.PI*${d.wheelDiameter}/${d.gearing};
  private final DifferentialDriveKinematics kinematics=new DifferentialDriveKinematics(${d.trackWidth});
  private final DifferentialDriveOdometry odometry;
  private final PIDController leftPID=new PIDController(${d.kP},0,0),rightPID=new PIDController(${d.kP},0,0);
  private final Field2d field=new Field2d();
  private double last=0; private boolean autoReady=false;
  public Drive() {
    ${d.gyro==='ADXRS450'?'gyro.calibrate();':''}
    odometry=new DifferentialDriveOdometry(heading(),distance(left),distance(right));
    SmartDashboard.putData("Robot pose",field);
    try { AutoBuilder.configure(this::pose,this::resetPose,this::speeds,(speeds,feedforwards)->driveSpeeds(speeds),new PPLTVController(0.02),RobotConfig.fromGUISettings(),()->DriverStation.getAlliance().orElse(DriverStation.Alliance.Blue)==DriverStation.Alliance.Red,this);autoReady=true; }
    catch(Exception e) { DriverStation.reportError("Autonomous configuration failed: "+e.getMessage(),false); }
  }
  private Rotation2d heading() { return gyro.getRotation2d(); }
  private double distance(MotorIO[] motors) { double sum=0;for(var m:motors)sum+=m.position();return motors.length==0?0:sum/motors.length*metersPerRotation; }
  private double velocity(MotorIO[] motors) { double sum=0;for(var m:motors)sum+=m.velocity();return motors.length==0?0:sum/motors.length*metersPerRotation; }
  public Pose2d pose() { return odometry.getPoseMeters(); }
  public void resetPose(Pose2d pose) { odometry.resetPosition(heading(),distance(left),distance(right),pose);leftPID.reset();rightPID.reset(); }
  public ChassisSpeeds speeds() { return kinematics.toChassisSpeeds(new DifferentialDriveWheelSpeeds(velocity(left),velocity(right))); }
  public boolean autoReady() { return autoReady; }
  private void voltage(double l,double r) { last=Timer.getFPGATimestamp();for(var m:left)if(!m.ready())l=r=0;for(var m:right)if(!m.ready())l=r=0;for(var m:left)m.voltage(l);for(var m:right)m.voltage(r); }
  public void stop() { voltage(0,0);leftPID.reset();rightPID.reset(); }
  public void arcade(double forward,double turn) {
    if(!DriverStation.isTeleopEnabled()) { stop();return; }
    double l=forward-turn,r=forward+turn,scale=Math.max(1,Math.max(Math.abs(l),Math.abs(r)));
    voltage(l/scale*12*${c.maxOutput},r/scale*12*${c.maxOutput});
  }
  private double ff(double velocity) { return Math.abs(velocity)<0.001?0:Math.copySign(${d.kS},velocity)+${d.kV}*velocity; }
  private void driveSpeeds(ChassisSpeeds speeds) {
    var wheels=kinematics.toWheelSpeeds(speeds);wheels.desaturate(${d.maxSpeed});
    voltage(ff(wheels.leftMetersPerSecond)+leftPID.calculate(velocity(left),wheels.leftMetersPerSecond),ff(wheels.rightMetersPerSecond)+rightPID.calculate(velocity(right),wheels.rightMetersPerSecond));
  }
  @Override public void periodic() {
    if(DriverStation.isDisabled()||Timer.getFPGATimestamp()-last>0.1)stop();
    odometry.update(heading(),distance(left),distance(right));field.setRobotPose(pose());
    SmartDashboard.putNumber("Drive/left meters",distance(left));SmartDashboard.putNumber("Drive/right meters",distance(right));SmartDashboard.putBoolean("Drive/auto configured",autoReady);
  }
}
`,
'src/main/java/frc/robot/RobotContainer.java':`package frc.robot;
import edu.wpi.first.wpilibj.*;
import edu.wpi.first.wpilibj.smartdashboard.*;
import edu.wpi.first.math.MathUtil;
import edu.wpi.first.wpilibj2.command.*;
import edu.wpi.first.wpilibj2.command.button.Trigger;
import com.pathplanner.lib.auto.NamedCommands;
import com.pathplanner.lib.commands.PathPlannerAuto;
public final class RobotContainer {
  private final Drive drive=new Drive();
  private final HardwareIO hardware=new HardwareIO();
  private final GenericHID driver=new GenericHID(${c.driverPort}),operator=new GenericHID(${c.operatorPort});
  ${mechanisms.map(s=>`private final Mechanism mechanism_${s.id}=new Mechanism(${q(s.name)}${p.motors.filter(m=>m.subsystem===s.id).map(m=>', '+motor(m)).join('')});`).join('\n  ')}
  private final SendableChooser<Command> chooser=new SendableChooser<>();
  public RobotContainer() {
    drive.setDefaultCommand(drive.runEnd(()->drive.arcade(${c.forwardSign}*MathUtil.applyDeadband(driver.getRawAxis(${c.forwardAxis}),${c.deadband}),${c.turnSign}*MathUtil.applyDeadband(driver.getRawAxis(${c.turnAxis}),${c.deadband})),drive::stop));
    ${p.commands.map(x=>`NamedCommands.registerCommand(${q(x.id)},action_${x.id}());`).join('\n    ')}
    ${p.bindings.map(b=>`new Trigger(()->DriverStation.isTeleopEnabled() && ${b.controller}.getRawButton(${b.button})).${b.behavior==='whileHeld'?'whileTrue':b.behavior==='onPress'?'onTrue':'toggleOnTrue'}(action_${b.command}());`).join('\n    ')}
    chooser.setDefaultOption("Do nothing",Commands.none());
    if(drive.autoReady()) try { chooser.addOption(${q(p.auto.name)},new PathPlannerAuto(${q(p.auto.name)}).withTimeout(15).finallyDo(interrupted->stopAll())); } catch(Exception e) { DriverStation.reportError("Auto failed to load: "+e.getMessage(),false); }
    SmartDashboard.putData("Auto chooser",chooser);
  }
  ${p.commands.map(javaAction).join('\n  ')}
  public Command autonomous() { return chooser.getSelected(); }
  public void stopAll() { drive.stop(); hardware.stopAll(); ${mechanisms.map(s=>`mechanism_${s.id}.stop();`).join(' ')} }
}
`};}


