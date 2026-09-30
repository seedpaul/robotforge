import { routineSource } from './routines';
import { cppMotor } from './gen-motors';
import { cppAction } from './gen-actions';
import { navxPort } from './gen-devices';
import type { Project,Motor } from './robot-model';
const q=JSON.stringify;
export function cppSources(p:Project):Record<string,string>{const d=p.drive,c=p.controls;const motor=(m:Motor)=>`std::make_shared<MotorIO>(${q(m.type)},${m.can},${m.inverted},${m.sensorSign},${m.current},${m.limit},${q(m.bus||'rio')},${q(m.motorKind||'default')})`;const side=(role:string)=>p.motors.filter(m=>m.role===role).map(motor).join(',');const mechanisms=p.subsystems.filter(s=>s.id!=='drive');return {'src/main/cpp/Robot.cpp':`#include "HardwareIO.h"
${d.gyro==='NavX'?'#include <studica/AHRS.h>':''}
#include <algorithm>
#include <cmath>
#include <memory>
#include <optional>
#include <string>
#include <vector>
#include <frc/TimedRobot.h>
#include <frc/RobotBase.h>
#include <frc/DriverStation.h>
#include <frc/Errors.h>
#include <frc/Timer.h>
#include <frc/DataLogManager.h>
#include <frc/GenericHID.h>
#include <frc/DigitalInput.h>
#include <frc/ADXRS450_Gyro.h>
#include <frc/geometry/Pose2d.h>
#include <frc/kinematics/DifferentialDriveKinematics.h>
#include <frc/kinematics/DifferentialDriveOdometry.h>
#include <frc/controller/PIDController.h>
#include <frc/smartdashboard/SmartDashboard.h>
#include <frc/smartdashboard/Field2d.h>
#include <frc/smartdashboard/SendableChooser.h>
#include <frc2/command/SubsystemBase.h>
#include <frc2/command/CommandScheduler.h>
#include <frc2/command/Commands.h>
#include <frc2/command/button/Trigger.h>
#include <rev/SparkMax.h>
#include <rev/SparkFlex.h>
#include <rev/config/SparkMaxConfig.h>
#include <rev/config/SparkFlexConfig.h>
#include <ctre/phoenix6/TalonFX.hpp>
#include <ctre/phoenix6/Pigeon2.hpp>
#include <pathplanner/lib/auto/AutoBuilder.h>
#include <pathplanner/lib/auto/NamedCommands.h>
#include <pathplanner/lib/commands/PathPlannerAuto.h>
#include <pathplanner/lib/config/RobotConfig.h>
#include <pathplanner/lib/controllers/PPLTVController.h>
using namespace units::literals;

${cppMotor(p)}
using Motors=std::vector<std::shared_ptr<MotorIO>>;
class Mechanism:public frc2::SubsystemBase {
  Motors motors; double last=0;
public:
  Mechanism(std::string name,Motors configured):motors(std::move(configured)){SetName(name);}
  void Set(double output){last=frc::Timer::GetFPGATimestamp().value();for(auto&m:motors)m->Voltage(output*12);}
  void Stop(){for(auto&m:motors)m->Stop();}
  frc2::CommandPtr Action(double output,double timeout){return RunEnd([this,output]{Set(output);},[this]{Stop();}).WithTimeout(units::second_t{timeout});}
  void Periodic() override {if(frc::DriverStation::IsDisabled()||frc::Timer::GetFPGATimestamp().value()-last>0.1)Stop();}
};
class Drive:public frc2::SubsystemBase {
  HardwareIO& hardware;
  Motors left{${side('left')}},right{${side('right')}};
  ${d.gyro==='Pigeon2'?`ctre::phoenix6::hardware::Pigeon2 gyro{${d.gyroCan},ctre::phoenix6::CANBus{${q(d.gyroBus||'rio')}}};`:d.gyro==='NavX'?`studica::AHRS gyro{studica::AHRS::NavXComType::${navxPort(d.navxInterface)}};`:'frc::ADXRS450_Gyro gyro;'}
  double conversion=3.141592653589793*${d.wheelDiameter}/${d.gearing};
  frc::DifferentialDriveKinematics kinematics{units::meter_t{${d.trackWidth}}};
  frc::DifferentialDriveOdometry odometry{gyro.GetRotation2d(),units::meter_t{Distance(left)},units::meter_t{Distance(right)}};
  frc::PIDController leftPID{${d.kP},0,0},rightPID{${d.kP},0,0};
  frc::Field2d field;double last=0;
  double Distance(const Motors& motors){${(['left','right'] as const).filter(side=>d.tractionEncoders?.[side]).map(side=>`if(&motors==&${side})return hardware.read_${d.tractionEncoders![side]}();`).join('')}double sum=0;for(auto&m:motors)sum+=m->Position();return motors.empty()?0:sum/motors.size()*conversion;}
  double Velocity(const Motors& motors){${(['left','right'] as const).filter(side=>d.tractionEncoders?.[side]).map(side=>`if(&motors==&${side})return hardware.rate_${d.tractionEncoders![side]}();`).join('')}double sum=0;for(auto&m:motors)sum+=m->Velocity();return motors.empty()?0:sum/motors.size()*conversion;}
  bool FeedbackHealthy(){return std::isfinite(Distance(left))&&std::isfinite(Distance(right))&&std::isfinite(Velocity(left))&&std::isfinite(Velocity(right));}
  void Voltage(double l,double r){if(!FeedbackHealthy())l=r=0;last=frc::Timer::GetFPGATimestamp().value();for(auto&m:left)if(!m->Ready())l=r=0;for(auto&m:right)if(!m->Ready())l=r=0;for(auto&m:left)m->Voltage(l);for(auto&m:right)m->Voltage(r);}
  double FF(double v){return std::abs(v)<0.001?0:std::copysign(${d.kS},v)+${d.kV}*v;}
public:
  bool autoReady=false;
  explicit Drive(HardwareIO& hw):hardware(hw){
    ${d.gyro==='ADXRS450'?'gyro.Calibrate();':''}
    frc::SmartDashboard::PutData("Robot pose",&field);
    try {pathplanner::AutoBuilder::configure([this]{return Pose();},[this](frc::Pose2d pose){ResetPose(pose);},[this]{return Speeds();},[this](auto speeds,auto feedforwards){DriveSpeeds(speeds);},std::make_shared<pathplanner::PPLTVController>(0.02_s),pathplanner::RobotConfig::fromGUISettings(),[]{return frc::DriverStation::GetAlliance()==frc::DriverStation::Alliance::kRed;},this);autoReady=true;}
    catch(const std::exception&e){FRC_ReportError(frc::err::Error, "{}", std::string("Autonomous configuration failed: ")+e.what());}
  }
  frc::Pose2d Pose(){return odometry.GetPose();}
  void ResetPose(frc::Pose2d pose){if(!FeedbackHealthy()){Stop();return;}odometry.ResetPosition(gyro.GetRotation2d(),units::meter_t{Distance(left)},units::meter_t{Distance(right)},pose);leftPID.Reset();rightPID.Reset();}
  frc::ChassisSpeeds Speeds(){return kinematics.ToChassisSpeeds({units::meters_per_second_t{Velocity(left)},units::meters_per_second_t{Velocity(right)}});}
  void Stop(){Voltage(0,0);leftPID.Reset();rightPID.Reset();}
  void Arcade(double forward,double turn){if(!frc::DriverStation::IsTeleopEnabled()){Stop();return;}double l=forward-turn,r=forward+turn,scale=std::max({1.0,std::abs(l),std::abs(r)});Voltage(l/scale*12*${c.maxOutput},r/scale*12*${c.maxOutput});}
  void DriveSpeeds(frc::ChassisSpeeds speeds){auto wheels=kinematics.ToWheelSpeeds(speeds);wheels.Desaturate(units::meters_per_second_t{${d.maxSpeed}});Voltage(FF(wheels.left.value())+leftPID.Calculate(Velocity(left),wheels.left.value()),FF(wheels.right.value())+rightPID.Calculate(Velocity(right),wheels.right.value()));}
  void Periodic() override {if(frc::DriverStation::IsDisabled()||frc::Timer::GetFPGATimestamp().value()-last>0.1)Stop();if(FeedbackHealthy())odometry.Update(gyro.GetRotation2d(),units::meter_t{Distance(left)},units::meter_t{Distance(right)});else Stop();field.SetRobotPose(Pose());frc::SmartDashboard::PutNumber("Drive/left meters",Distance(left));frc::SmartDashboard::PutNumber("Drive/right meters",Distance(right));frc::SmartDashboard::PutBoolean("Drive/auto configured",autoReady);}
};
class Robot:public frc::TimedRobot {
  HardwareIO hardware;
  Drive drive{hardware};
  frc::GenericHID driver{${c.driverPort}},operatorController{${c.operatorPort}};
  ${mechanisms.map(s=>`Mechanism mechanism_${s.id}{${q(s.name)},Motors{${p.motors.filter(m=>m.subsystem===s.id).map(motor).join(',')}}};`).join('\n  ')}
  frc::SendableChooser<frc2::Command*> chooser;
  frc2::CommandPtr none=frc2::cmd::None();
  std::optional<frc2::CommandPtr> autoCommand;
  frc2::Command* selected=nullptr;
  double Deadband(double value){return std::abs(value)<=${c.deadband}?0:std::copysign((std::abs(value)-${c.deadband})/(1-${c.deadband}),value);}
  ${p.commands.map(cppAction).join('\n  ')}
  ${(p.routines||[]).map(r=>routineSource(r,'C++')).join('\n  ')}
  void StopAll(){drive.Stop();hardware.StopAll();${mechanisms.map(s=>`mechanism_${s.id}.Stop();`).join('')}}
public:
  void RobotInit() override {
    frc::DataLogManager::Start();frc::DriverStation::StartDataLog(frc::DataLogManager::GetLog());
    drive.SetDefaultCommand(drive.RunEnd([this]{drive.Arcade(${c.forwardSign}*Deadband(driver.GetRawAxis(${c.forwardAxis})),${c.turnSign}*Deadband(driver.GetRawAxis(${c.turnAxis})));},[this]{drive.Stop();}));
    ${[...p.commands,...(p.routines||[])].map(x=>`pathplanner::NamedCommands::registerCommand(${q(x.id)},Action_${x.id}());`).join('\n    ')}
    ${p.bindings.map(b=>`frc2::Trigger([this]{return frc::DriverStation::IsTeleopEnabled()&&${b.controller==='driver'?'driver':'operatorController'}.GetRawButton(${b.button});}).${b.behavior==='whileHeld'?'WhileTrue':b.behavior==='onPress'?'OnTrue':'ToggleOnTrue'}(Action_${b.command}());`).join('\n    ')}
    chooser.SetDefaultOption("Do nothing",none.get());
    if(drive.autoReady)try{autoCommand.emplace(pathplanner::PathPlannerAuto(${q(p.auto.name)}).ToPtr().WithTimeout(15_s).FinallyDo([this](bool){StopAll();}));chooser.AddOption(${q(p.auto.name)},autoCommand->get());}catch(const std::exception&e){FRC_ReportError(frc::err::Error, "{}", std::string("Auto failed to load: ")+e.what());}
    frc::SmartDashboard::PutData("Auto chooser",&chooser);
  }
  void RobotPeriodic() override {frc2::CommandScheduler::GetInstance().Run();}
  void AutonomousInit() override {StopAll();selected=chooser.GetSelected();if(selected)frc2::CommandScheduler::GetInstance().Schedule(selected);}
  void TeleopInit() override {if(selected)selected->Cancel();StopAll();}
  void DisabledInit() override {frc2::CommandScheduler::GetInstance().CancelAll();StopAll();}
  void TestInit() override {frc2::CommandScheduler::GetInstance().CancelAll();StopAll();}
};
#ifndef RUNNING_FRC_TESTS
int main(){return frc::StartRobot<Robot>();}
#endif
`};}

