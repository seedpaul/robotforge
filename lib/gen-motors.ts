import type { Project } from './robot-model';
const q=JSON.stringify;
export function javaMotor(p:Project){const types=[...new Set(p.motors.map(m=>m.type))];return `package frc.robot;
import edu.wpi.first.wpilibj.*;
import java.util.function.*;
public final class MotorIO {
 private DoubleSupplier readPosition=()->0,readVelocity=()->0; private DoubleConsumer write=v->{};
 private final double sign; private final DigitalInput limit; private boolean configured=false;
 public MotorIO(String kind,int can,boolean inverted,double encoderSign,int amps,int dio,String bus,String motorKind){
  sign=encoderSign;limit=dio>=0?new DigitalInput(dio):null;
  switch(kind){
${types.map(type=>{
 if(type==='SparkMax'||type==='SparkFlex')return `case ${q(type)} -> {
   var motor=new com.revrobotics.spark.${type}(can,motorKind.equals("brushed")?com.revrobotics.spark.SparkLowLevel.MotorType.kBrushed:com.revrobotics.spark.SparkLowLevel.MotorType.kBrushless);
   var config=new com.revrobotics.spark.config.${type}Config();
   config.inverted(inverted).idleMode(com.revrobotics.spark.config.SparkBaseConfig.IdleMode.kBrake).smartCurrentLimit(amps);
   for(int i=0;i<3&&!configured;i++)configured=motor.configure(config,com.revrobotics.ResetMode.kResetSafeParameters,com.revrobotics.PersistMode.kPersistParameters)==com.revrobotics.REVLibError.kOk;
   if(!motorKind.equals("brushed")){readPosition=()->motor.getEncoder().getPosition();readVelocity=()->motor.getEncoder().getVelocity()/60.0;}
   write=motor::setVoltage;
  }`;
 if(type==='TalonFX'||type==='TalonFXS')return `case ${q(type)} -> {
   var motor=new com.ctre.phoenix6.hardware.${type}(can,new com.ctre.phoenix6.CANBus(bus));
   var config=new com.ctre.phoenix6.configs.${type}Configuration();
   config.MotorOutput.Inverted=inverted?com.ctre.phoenix6.signals.InvertedValue.Clockwise_Positive:com.ctre.phoenix6.signals.InvertedValue.CounterClockwise_Positive;
   config.MotorOutput.NeutralMode=com.ctre.phoenix6.signals.NeutralModeValue.Brake;
   config.CurrentLimits.StatorCurrentLimitEnable=true;config.CurrentLimits.StatorCurrentLimit=amps;
   ${type==='TalonFXS'?`config.Commutation.MotorArrangement=motorKind.equals("brushed")?com.ctre.phoenix6.signals.MotorArrangementValue.Brushed_DC:motorKind.equals("neo")?com.ctre.phoenix6.signals.MotorArrangementValue.NEO_JST:com.ctre.phoenix6.signals.MotorArrangementValue.Minion_JST;
   config.Commutation.BrushedMotorWiring=com.ctre.phoenix6.signals.BrushedMotorWiringValue.Leads_A_and_B;`:''}
   for(int i=0;i<3&&!configured;i++)configured=motor.getConfigurator().apply(config).isOK();
   readPosition=()->motor.getPosition().getValueAsDouble();readVelocity=()->motor.getVelocity().getValueAsDouble();write=motor::setVoltage;
  }`;
 if(type==='TalonSRX'||type==='VictorSPX')return `case ${q(type)} -> {
   var motor=new com.ctre.phoenix.motorcontrol.can.WPI_${type}(can);
   var config=new com.ctre.phoenix.motorcontrol.can.${type}Configuration();
   ${type==='TalonSRX'?'config.continuousCurrentLimit=amps;config.peakCurrentLimit=amps;config.peakCurrentDuration=0;':''}
   for(int i=0;i<3&&!configured;i++)configured=motor.configAllSettings(config,100)==com.ctre.phoenix.ErrorCode.OK;
   motor.setInverted(inverted);motor.setNeutralMode(com.ctre.phoenix.motorcontrol.NeutralMode.Brake);${type==='TalonSRX'?'motor.enableCurrentLimit(true);':''}
   write=motor::setVoltage;
  }`;
 if(type==='ThriftyNova')return `case "ThriftyNova" -> {
   var motor=new com.thethriftybot.devices.ThriftyNova(can,motorKind.equals("brushed")?com.thethriftybot.devices.ThriftyNova.MotorType.BRUSHED:motorKind.equals("minion")?com.thethriftybot.devices.ThriftyNova.MotorType.MINION:com.thethriftybot.devices.ThriftyNova.MotorType.NEO);
   motor.setInverted(inverted);motor.setBrakeMode(true);motor.setMaxCurrent(com.thethriftybot.devices.ThriftyNova.CurrentType.STATOR,amps);
   configured=motor.getErrors().isEmpty();write=motor::setVoltage;
  }`;
 return `case ${q(type)} -> {var motor=new edu.wpi.first.wpilibj.motorcontrol.${type==='PWMSpark'?'Spark':type==='PWMVictor'?'VictorSP':type}(can);motor.setInverted(inverted);write=motor::setVoltage;configured=true;}`;
}).join('\n')}
   default -> throw new IllegalArgumentException("Unknown motor controller: "+kind);
  }
  if(!configured)DriverStation.reportError("Motor configuration failed; output inhibited: "+bus+":"+can,false);
 }
 public double position(){return sign*readPosition.getAsDouble();}
 public double velocity(){return sign*readVelocity.getAsDouble();}
 public boolean ready(){return configured;}
 public void voltage(double value){if(!configured||!DriverStation.isEnabled()||!Double.isFinite(value))value=0;if(limit!=null&&!limit.get()&&value>0)value=0;write.accept(Math.max(-12,Math.min(12,value)));}
 public void stop(){voltage(0);}
}
`;}

export function cppMotor(p:Project){const types=[...new Set(p.motors.map(m=>m.type))];return `#include <functional>
${types.map(t=>t.startsWith('PWM')?`#include <frc/motorcontrol/${t==='PWMSpark'?'Spark':t==='PWMVictor'?'VictorSP':t}.h>`:t==='TalonFXS'?`#include <ctre/phoenix6/TalonFXS.hpp>`:['TalonSRX','VictorSPX'].includes(t)?`#include <ctre/phoenix/motorcontrol/can/WPI_${t}.h>`:'').join('\n')}
class MotorIO {
 std::function<double()> readPosition=[]{return 0.0;},readVelocity=[]{return 0.0;};std::function<void(double)> write=[](double){};
 std::unique_ptr<frc::DigitalInput> limit;double sign;bool configured=false;
public:
 MotorIO(std::string kind,int can,bool inverted,double encoderSign,int amps,int dio,std::string bus,std::string motorKind):sign(encoderSign){
  if(dio>=0)limit=std::make_unique<frc::DigitalInput>(dio);
${types.map((type,i)=>{
 const pre=`${i?'else ':''}if(kind==${q(type)})`;
 if(type==='SparkMax'||type==='SparkFlex')return `${pre}{
   auto motor=std::make_shared<rev::spark::${type}>(can,motorKind=="brushed"?rev::spark::SparkLowLevel::MotorType::kBrushed:rev::spark::SparkLowLevel::MotorType::kBrushless);
   rev::spark::${type}Config config;config.Inverted(inverted).SetIdleMode(rev::spark::SparkBaseConfig::IdleMode::kBrake).SmartCurrentLimit(amps);
   for(int i=0;i<3&&!configured;i++)configured=motor->Configure(config,rev::ResetMode::kResetSafeParameters,rev::PersistMode::kPersistParameters)==rev::REVLibError::kOk;
   if(motorKind!="brushed"){readPosition=[motor]{return motor->GetEncoder().GetPosition();};readVelocity=[motor]{return motor->GetEncoder().GetVelocity()/60.0;};}
   write=[motor](double v){motor->SetVoltage(units::volt_t{v});};
  }`;
 if(type==='TalonFX'||type==='TalonFXS')return `${pre}{
   auto motor=std::make_shared<ctre::phoenix6::hardware::${type}>(can,ctre::phoenix6::CANBus{bus});ctre::phoenix6::configs::${type}Configuration config;
   config.MotorOutput.Inverted=inverted?ctre::phoenix6::signals::InvertedValue::Clockwise_Positive:ctre::phoenix6::signals::InvertedValue::CounterClockwise_Positive;
   config.MotorOutput.NeutralMode=ctre::phoenix6::signals::NeutralModeValue::Brake;
   config.CurrentLimits.StatorCurrentLimitEnable=true;config.CurrentLimits.StatorCurrentLimit=units::ampere_t{static_cast<double>(amps)};
   ${type==='TalonFXS'?`config.Commutation.MotorArrangement=motorKind=="brushed"?ctre::phoenix6::signals::MotorArrangementValue::Brushed_DC:motorKind=="neo"?ctre::phoenix6::signals::MotorArrangementValue::NEO_JST:ctre::phoenix6::signals::MotorArrangementValue::Minion_JST;
   config.Commutation.BrushedMotorWiring=ctre::phoenix6::signals::BrushedMotorWiringValue::Leads_A_and_B;`:''}
   for(int i=0;i<3&&!configured;i++)configured=motor->GetConfigurator().Apply(config).IsOK();
   readPosition=[motor]{return motor->GetPosition().GetValueAsDouble();};readVelocity=[motor]{return motor->GetVelocity().GetValueAsDouble();};write=[motor](double v){motor->SetVoltage(units::volt_t{v});};
  }`;
 if(type==='TalonSRX'||type==='VictorSPX')return `${pre}{
   auto motor=std::make_shared<ctre::phoenix::motorcontrol::can::WPI_${type}>(can);ctre::phoenix::motorcontrol::can::${type}Configuration config;
   ${type==='TalonSRX'?'config.continuousCurrentLimit=amps;config.peakCurrentLimit=amps;config.peakCurrentDuration=0;':''}
   for(int i=0;i<3&&!configured;i++)configured=motor->ConfigAllSettings(config,100)==ctre::phoenix::ErrorCode::OK;
   motor->SetInverted(inverted);motor->SetNeutralMode(ctre::phoenix::motorcontrol::NeutralMode::Brake);${type==='TalonSRX'?'motor->EnableCurrentLimit(true);':''}write=[motor](double v){motor->SetVoltage(units::volt_t{v});};
  }`;
 if(type==='ThriftyNova')return `${pre}{throw std::runtime_error("Thrifty Nova requires Java");}`;
 return `${pre}{auto motor=std::make_shared<frc::${type==='PWMSpark'?'Spark':type==='PWMVictor'?'VictorSP':type}>(can);motor->SetInverted(inverted);write=[motor](double v){motor->SetVoltage(units::volt_t{v});};configured=true;}`;
}).join('\n')}
  else throw std::runtime_error("Unknown motor controller");
  if(!configured)FRC_ReportError(frc::err::Error,"{}","Motor configuration failed; output inhibited at "+bus+":"+std::to_string(can));
 }
 bool Ready(){return configured;}double Position(){return sign*readPosition();}double Velocity(){return sign*readVelocity();}
 void Voltage(double value){if(!configured||!frc::DriverStation::IsEnabled()||!std::isfinite(value))value=0;if(limit&&!limit->Get()&&value>0)value=0;write(std::clamp(value,-12.0,12.0));}
 void Stop(){Voltage(0);}
};
`;}

export function pythonMotor(p:Project){const types=[...new Set(p.motors.map(m=>m.type))];return `from phoenix6 import CANBus
from phoenix6.hardware import TalonFX, TalonFXS
from phoenix6.configs import TalonFXConfiguration, TalonFXSConfiguration
from phoenix6.signals import MotorArrangementValue, BrushedMotorWiringValue
${types.some(t=>['TalonSRX','VictorSPX'].includes(t))?'import phoenix5':''}
class MotorIO:
    def __init__(self, config):
        self.sign = config['sensorSign']
        self.limit = wpilib.DigitalInput(config['limit']) if config['limit'] >= 0 else None
        self.configured = False
        self.read_position = lambda: 0.0
        self.read_velocity = lambda: 0.0
        kind, motor_kind = config['type'], config.get('motorKind', 'default')
        can, amps, inverted = config['can'], config['current'], config['inverted']
        if kind in ('SparkMax', 'SparkFlex'):
            motor = (rev.SparkFlex if kind == 'SparkFlex' else rev.SparkMax)(can, rev.SparkLowLevel.MotorType.kBrushed if motor_kind == 'brushed' else rev.SparkLowLevel.MotorType.kBrushless)
            settings = rev.SparkFlexConfig() if kind == 'SparkFlex' else rev.SparkMaxConfig()
            settings.inverted(inverted).setIdleMode(rev.SparkBaseConfig.IdleMode.kBrake).smartCurrentLimit(amps)
            for _ in range(3):
                self.configured = motor.configure(settings, rev.ResetMode.kResetSafeParameters, rev.PersistMode.kPersistParameters) == rev.REVLibError.kOk
                if self.configured: break
            if motor_kind != 'brushed':
                self.read_position = lambda: motor.getEncoder().getPosition()
                self.read_velocity = lambda: motor.getEncoder().getVelocity() / 60.0
            self.write = motor.setVoltage
        elif kind in ('TalonFX', 'TalonFXS'):
            motor = (TalonFXS if kind == 'TalonFXS' else TalonFX)(can, CANBus(config.get('bus', 'rio')))
            settings = TalonFXSConfiguration() if kind == 'TalonFXS' else TalonFXConfiguration()
            settings.motor_output.inverted = InvertedValue.CLOCKWISE_POSITIVE if inverted else InvertedValue.COUNTER_CLOCKWISE_POSITIVE
            settings.motor_output.neutral_mode = NeutralModeValue.BRAKE
            settings.current_limits.stator_current_limit_enable = True
            settings.current_limits.stator_current_limit = amps
            if kind == 'TalonFXS':
                settings.commutation.motor_arrangement = MotorArrangementValue.BRUSHED_DC if motor_kind == 'brushed' else MotorArrangementValue.NEO_JST if motor_kind == 'neo' else MotorArrangementValue.MINION_JST
                settings.commutation.brushed_motor_wiring = BrushedMotorWiringValue.LEADS_A_AND_B
            for _ in range(3):
                self.configured = motor.configurator.apply(settings).is_ok()
                if self.configured: break
            self.read_position = lambda: motor.get_position().value_as_double
            self.read_velocity = lambda: motor.get_velocity().value_as_double
            self.write = lambda v: motor.set_control(VoltageOut(v))
${types.some(t=>['TalonSRX','VictorSPX'].includes(t))?`        elif kind in ('TalonSRX', 'VictorSPX'):
            motor = (phoenix5.WPI_TalonSRX if kind == 'TalonSRX' else phoenix5.WPI_VictorSPX)(can)
            settings = phoenix5.TalonSRXConfiguration() if kind == 'TalonSRX' else phoenix5.VictorSPXConfiguration()
            if kind == 'TalonSRX':
                settings.continuousCurrentLimit = amps
                settings.peakCurrentLimit = amps
                settings.peakCurrentDuration = 0
            for _ in range(3):
                self.configured = motor.configAllSettings(settings, 100) == phoenix5.ErrorCode.OK
                if self.configured: break
            motor.setInverted(inverted)
            motor.setNeutralMode(phoenix5.NeutralMode.Brake)
            if kind == 'TalonSRX': motor.enableCurrentLimit(True)
            self.write = motor.setVoltage
`:''}        elif kind.startswith('PWM'):
            cls = {'PWMSparkMax': wpilib.PWMSparkMax, 'PWMTalonSRX': wpilib.PWMTalonSRX, 'PWMVictorSPX': wpilib.PWMVictorSPX, 'PWMSpark': wpilib.Spark, 'PWMVictor': wpilib.VictorSP}[kind]
            motor = cls(can)
            motor.setInverted(inverted)
            self.write = motor.setVoltage
            self.configured = True
        else:
            raise ValueError('No supported motor adapter for ' + kind)
        self.motor = motor
        if not self.configured: wpilib.reportError('Motor configuration failed; output inhibited: ' + str(can))

    def position(self): return self.sign * self.read_position()
    def velocity(self): return self.sign * self.read_velocity()
    def voltage(self, volts):
        if not self.configured or not wpilib.DriverStation.isEnabled() or not math.isfinite(volts): volts = 0.0
        if self.limit is not None and not self.limit.get() and volts > 0: volts = 0.0
        self.write(max(-12.0, min(12.0, volts)))
    def stop(self): self.voltage(0)

`;}
