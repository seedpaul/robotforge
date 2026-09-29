import type { Project,Motor } from './robot-model';
import { orderedModules,driveType } from './drivetrain';
import { navxPort } from './gen-devices';
const q=JSON.stringify;
const motorConstructor=(m:Motor)=>`std::make_shared<MotorIO>(${q(m.type)},${m.can},${m.inverted},${m.sensorSign},${m.current},${m.limit},${q(m.bus||'rio')},${q(m.motorKind||'default')})`;
export const cppHolonomicIncludes=`#include <array>
#include <frc/kinematics/SwerveDriveKinematics.h>
#include <frc/kinematics/SwerveDriveOdometry.h>
#include <frc/kinematics/MecanumDriveKinematics.h>
#include <frc/kinematics/MecanumDriveOdometry.h>
#include <frc/controller/HolonomicDriveController.h>
#include <frc/controller/ProfiledPIDController.h>
#include <frc/trajectory/TrajectoryGenerator.h>
#include <frc/trajectory/TrajectoryConfig.h>
#include <frc/trajectory/constraint/MecanumDriveKinematicsConstraint.h>
#include <frc2/command/FunctionalCommand.h>
#include <pathplanner/lib/controllers/PPHolonomicDriveController.h>
#include <pathplanner/lib/config/PIDConstants.h>
`;
export function cppHolonomicDrive(p:Project){
 const d=p.drive,s=driveType(p)==='swerve',mods=orderedModules(p),corners=['frontLeft','frontRight','backLeft','backRight'] as const;
 const motor=(id:string)=>motorConstructor(p.motors.find(m=>m.id===id)!);
 const locations=corners.map((_,i)=>`frc::Translation2d{units::meter_t{${(i<2?1:-1)*(d.wheelbase??.6)/2}},units::meter_t{${(i%2===0?1:-1)*d.trackWidth/2}}}`).join(',');
 const start=p.auto.waypoints[0],end=p.auto.waypoints.at(-1)!,heading=Math.atan2(p.auto.waypoints[1].y-start.y,p.auto.waypoints[1].x-start.x),last=p.auto.waypoints.at(-2)!,endHeading=Math.atan2(end.y-last.y,end.x-last.x);
 const pose=(x:number,y:number,h:number)=>`frc::Pose2d{units::meter_t{${x}},units::meter_t{${y}},frc::Rotation2d{units::radian_t{${h}}}}`;
 return `class Drive:public frc2::SubsystemBase {
 // Wheel order: front-left, front-right, back-left, back-right.
 Motors wheels{${(s?mods.map(m=>m.driveMotor):corners.map(c=>d.wheels![c])).map(motor).join(',')}};
 ${s?`Motors steer{${mods.map(m=>motor(m.steerMotor)).join(',')}};
 HardwareIO& hardware;
 std::array<frc::PIDController,4> steering{${corners.map(()=>`frc::PIDController{${d.steerKP??4},0,0}`).join(',')}};
 std::array<frc::Rotation2d,4> angles{};`:''}
 std::array<frc::PIDController,4> velocityPID{${corners.map(()=>`frc::PIDController{${d.kP},0,0}`).join(',')}};
 ${d.gyro==='Pigeon2'?`ctre::phoenix6::hardware::Pigeon2 gyro{${d.gyroCan},ctre::phoenix6::CANBus{${q(d.gyroBus||'rio')}}};`:d.gyro==='NavX'?`studica::AHRS gyro{studica::AHRS::NavXComType::${navxPort(d.navxInterface)}};`:'frc::ADXRS450_Gyro gyro;'}
 double conversion=3.141592653589793*${d.wheelDiameter}/${d.gearing};
 ${s?'frc::SwerveDriveKinematics<4>':'frc::MecanumDriveKinematics'} kinematics{${locations}};
 std::unique_ptr<${s?'frc::SwerveDriveOdometry<4>':'frc::MecanumDriveOdometry'}> odometry;
 frc::Field2d field;double last=0;bool wasHealthy=false;
 ${s?'':`frc::Trajectory trajectory;
 frc::ProfiledPIDController<units::radians> theta{${d.rotationKP??3},0,0,{units::radians_per_second_t{${d.maxAngularSpeed??4}},units::radians_per_second_squared_t{${d.maxAngularSpeed??4}}}};
 frc::HolonomicDriveController follower{frc::PIDController{${d.translationKP??3},0,0},frc::PIDController{${d.translationKP??3},0,0},theta};`}
 bool Healthy(){bool ok=${d.gyro==='Pigeon2'?'gyro.GetYaw().GetStatus().IsOK()&&gyro.GetYaw().GetTimestamp().GetLatency().value()<.25':d.gyro==='NavX'?'gyro.IsConnected()&&!gyro.IsCalibrating()':'gyro.IsConnected()'}&&std::isfinite(gyro.GetRotation2d().Radians().value());for(auto&m:wheels)ok&=m->Ready()&&std::isfinite(m->Position())&&std::isfinite(m->Velocity());
 ${s?`for(auto&m:steer){ok&=m->Ready();}std::array<double,4> readings{${mods.map(m=>`hardware.read_${m.encoder}()-(${m.offset})`).join(',')}};for(int i=0;i<4;i++){ok&=std::isfinite(readings[i]);if(std::isfinite(readings[i]))angles[i]=frc::Rotation2d{units::radian_t{readings[i]*2*3.141592653589793}};}`:''}return ok;}
 double Distance(int i){double value=wheels[i]->Position()*conversion;return std::isfinite(value)?value:0;}
 double Velocity(int i){double value=wheels[i]->Velocity()*conversion;return std::isfinite(value)?value:0;}
 ${s?'wpi::array<frc::SwerveModulePosition,4>':'frc::MecanumDriveWheelPositions'} Positions(){return ${s?'{'+corners.map((_,i)=>`frc::SwerveModulePosition{units::meter_t{Distance(${i})},angles[${i}]}`).join(',')+'}':'{units::meter_t{Distance(0)},units::meter_t{Distance(1)},units::meter_t{Distance(2)},units::meter_t{Distance(3)}}'};}
 double FF(double speed){return std::abs(speed)<.001?0:std::copysign(${d.kS},speed)+${d.kV}*speed;}
public:
 bool autoReady=false;
 explicit Drive(HardwareIO& hw)${s?':hardware(hw)':''}{
  ${s?'for(auto&pid:steering)pid.EnableContinuousInput(-3.141592653589793,3.141592653589793);':'follower.GetThetaController().EnableContinuousInput(units::radian_t{-3.141592653589793},units::radian_t{3.141592653589793});'}
  ${d.gyro==='ADXRS450'?'if(frc::RobotBase::IsReal())gyro.Calibrate();':''}
  Healthy();odometry=std::make_unique<${s?'frc::SwerveDriveOdometry<4>':'frc::MecanumDriveOdometry'}>(kinematics,gyro.GetRotation2d(),Positions());
  frc::SmartDashboard::PutData("Robot pose",&field);
  try{${s?`pathplanner::AutoBuilder::configure([this]{return Pose();},[this](auto pose){ResetPose(pose);},[this]{return Speeds();},[this](auto speeds,auto ff){DriveSpeeds(speeds);},std::make_shared<pathplanner::PPHolonomicDriveController>(pathplanner::PIDConstants{${d.translationKP??3},0,0},pathplanner::PIDConstants{${d.rotationKP??3},0,0}),pathplanner::RobotConfig::fromGUISettings(),[]{return frc::DriverStation::GetAlliance()==frc::DriverStation::Alliance::kRed;},this);`:`frc::TrajectoryConfig config{units::meters_per_second_t{${p.auto.maxSpeed}},units::meters_per_second_squared_t{${p.auto.maxAcceleration}}};config.AddConstraint(frc::MecanumDriveKinematicsConstraint{kinematics,units::meters_per_second_t{${d.maxSpeed}}});trajectory=frc::TrajectoryGenerator::GenerateTrajectory(${pose(start.x,start.y,heading)},std::vector<frc::Translation2d>{${p.auto.waypoints.slice(1,-1).map(w=>`frc::Translation2d{units::meter_t{${w.x}},units::meter_t{${w.y}}}`).join(',')}},${pose(end.x,end.y,endHeading)},config);if(trajectory.TotalTime()<=0_s)throw std::runtime_error("Empty trajectory");`}autoReady=true;}
  catch(const std::exception&e){FRC_ReportError(frc::err::Error,"{}",std::string("Autonomous configuration failed: ")+e.what());}
 }
 frc::Pose2d Pose(){return odometry->GetPose();}
 void ResetPose(frc::Pose2d pose){if(!Healthy()){Stop();return;}odometry->ResetPosition(gyro.GetRotation2d(),Positions(),pose);for(auto&pid:velocityPID)pid.Reset();}
 frc::ChassisSpeeds Speeds(){return kinematics.ToChassisSpeeds(${s?'wpi::array<frc::SwerveModuleState,4>{'+corners.map((_,i)=>`frc::SwerveModuleState{units::meters_per_second_t{Velocity(${i})},angles[${i}]}`).join(',')+'}':'frc::MecanumDriveWheelSpeeds{units::meters_per_second_t{Velocity(0)},units::meters_per_second_t{Velocity(1)},units::meters_per_second_t{Velocity(2)},units::meters_per_second_t{Velocity(3)}}'});}
 void Stop(){for(auto&m:wheels)m->Stop();${s?'for(auto&m:steer)m->Stop();for(auto&pid:steering)pid.Reset();':''}for(auto&pid:velocityPID)pid.Reset();}
 void Teleop(double forward,double strafe,double turn){if(!frc::DriverStation::IsTeleopEnabled()){Stop();return;}double norm=std::max(1.0,std::hypot(forward,strafe)),cap=${p.controls.maxOutput};auto vx=units::meters_per_second_t{forward/norm*${d.maxSpeed}*cap},vy=units::meters_per_second_t{strafe/norm*${d.maxSpeed}*cap};auto omega=units::radians_per_second_t{turn*${d.maxAngularSpeed??4}*cap};DriveSpeeds(${p.controls.fieldRelative?'frc::ChassisSpeeds::FromFieldRelativeSpeeds(vx,vy,omega,Pose().Rotation())':'frc::ChassisSpeeds{vx,vy,omega}'});}
 void DriveSpeeds(frc::ChassisSpeeds requested){if(!Healthy()||!frc::DriverStation::IsEnabled()){Stop();return;}last=frc::Timer::GetFPGATimestamp().value();double voltageCap=frc::DriverStation::IsTeleopEnabled()?12*${p.controls.maxOutput}:12;auto speeds=frc::ChassisSpeeds::Discretize(requested,20_ms);
 ${s?`auto states=kinematics.ToSwerveModuleStates(speeds);kinematics.DesaturateWheelSpeeds(&states,units::meters_per_second_t{${d.maxSpeed}});for(int i=0;i<4;i++){auto& state=states[i];if(std::abs(state.speed.value())<.001){wheels[i]->Stop();steer[i]->Stop();velocityPID[i].Reset();steering[i].Reset();continue;}state.Optimize(angles[i]);double target=state.speed.value()*(state.angle-angles[i]).Cos();wheels[i]->Voltage(std::clamp(FF(target)+velocityPID[i].Calculate(Velocity(i),target),-voltageCap,voltageCap));steer[i]->Voltage(std::clamp(steering[i].Calculate(angles[i].Radians().value(),state.angle.Radians().value()),-std::min(6.0,voltageCap),std::min(6.0,voltageCap)));}`:`auto ws=kinematics.ToWheelSpeeds(speeds);ws.Desaturate(units::meters_per_second_t{${d.maxSpeed}});std::array<double,4> targets{ws.frontLeft.value(),ws.frontRight.value(),ws.rearLeft.value(),ws.rearRight.value()};for(int i=0;i<4;i++)wheels[i]->Voltage(std::clamp(FF(targets[i])+velocityPID[i].Calculate(Velocity(i),targets[i]),-voltageCap,voltageCap));`}}
 ${s?'':`frc2::CommandPtr FollowPath(){auto timer=std::make_shared<frc::Timer>();return frc2::FunctionalCommand([this,timer]{timer->Restart();ResetPose(${pose(start.x,start.y,heading)});follower.GetThetaController().Reset(Pose().Rotation().Radians());},[this,timer]{DriveSpeeds(follower.Calculate(Pose(),trajectory.Sample(timer->Get()),frc::Rotation2d{units::radian_t{${heading}}}));},[this,timer](bool){timer->Stop();Stop();},[this,timer]{return !Healthy()||timer->HasElapsed(trajectory.TotalTime());},{this}).ToPtr();}`}
 void Periodic() override {bool good=Healthy();if(!good||frc::DriverStation::IsDisabled()||frc::Timer::GetFPGATimestamp().value()-last>.1)Stop();if(good){if(!wasHealthy)odometry->ResetPosition(gyro.GetRotation2d(),Positions(),Pose());else odometry->Update(gyro.GetRotation2d(),Positions());}wasHealthy=good;field.SetRobotPose(Pose());frc::SmartDashboard::PutBoolean("Drive/feedback healthy",good);frc::SmartDashboard::PutBoolean("Drive/auto configured",autoReady);}
};
`;
}
