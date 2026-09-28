import type { Project } from './robot-model';
import { productById,isActuator,isSensor,type Device } from './hardware-catalog';
type Triple=[string,string,string];
type Fragment={fields:Triple;init:Triple;read:Triple;extra:Triple;set:Triple;stop:Triple};
const q=JSON.stringify;
const blank=():Triple=>['','',''];
export const navxPort=(s?:string)=>({mxp:'kMXP_SPI',onboard:'kI2C',usb1:'kUSB1',usb2:'kUSB2'}[s||'mxp']||'kMXP_SPI');
function fragment(d:Device,p:Project):Fragment{
 const a=productById(d.product)?.adapter,n='d_'+d.id,py='self.'+n,ch=d.channel,id=d.address;
 const f:Fragment={fields:blank(),init:blank(),read:['Double.NaN','NAN',"float('nan')"],extra:blank(),set:blank(),stop:blank()};
 const declare=(jt:string,jv:string,ct:string,cv:string,pv:string)=>{f.fields=[`private final ${jt} ${n}=${jv};`,`${ct} ${n}${cv};`,`${py} = ${pv}`];};
 const calibrated=(r:Triple)=>{f.read=r.map(x=>`(${d.inverted?-1:1} * (${x}) * ${d.scale} + ${d.offset})`) as Triple;};
 if(['cancoder','canrange','candi','pigeon'].includes(a||'')){
  const cls={cancoder:'CANcoder',canrange:'CANrange',candi:'CANdi',pigeon:'Pigeon2'}[a as 'cancoder']!;
  declare(`com.ctre.phoenix6.hardware.${cls}`,`new com.ctre.phoenix6.hardware.${cls}(${id},new com.ctre.phoenix6.CANBus(${q(d.bus)}))`,`ctre::phoenix6::hardware::${cls}`,`{${id},ctre::phoenix6::CANBus{${q(d.bus)}}}`,`phoenix6.hardware.${cls}(${id}, phoenix6.CANBus(${q(d.bus)}))`);
  const method={cancoder:['getAbsolutePosition','GetAbsolutePosition','get_absolute_position'],canrange:['getDistance','GetDistance','get_distance'],candi:['getS1Closed','GetS1Closed','get_s1_closed'],pigeon:['getYaw','GetYaw','get_yaw']}[a as 'cancoder']!;
  const sig=[`${n}.${method[0]}()`,`${n}.${method[1]}()`,`${py}.${method[2]}()`];
  const value=a==='candi'?[`${sig[0]}.getValue()?1.0:0.0`,`${sig[1]}.GetValue()?1.0:0.0`,`1.0 if ${sig[2]}.value else 0.0`]:[`${sig[0]}.getValueAsDouble()`,`${sig[1]}.GetValueAsDouble()`,`${sig[2]}.value_as_double`];
  calibrated([`(${sig[0]}.getStatus().isOK() && ${sig[0]}.getTimestamp().getLatency()<0.25 ? (${value[0]}) : Double.NaN)`,`(${sig[1]}.GetStatus().IsOK() && ${sig[1]}.GetTimestamp().GetLatency().value()<0.25 ? (${value[1]}) : NAN)`,`((${value[2]}) if ${sig[2]}.status.is_ok() and ${sig[2]}.timestamp.get_latency()<0.25 else float('nan'))`]);
  if(a==='candi')f.extra=[`SmartDashboard.putBoolean(${q(d.name+'/S2 closed')},${n}.getS2Closed().getValue());SmartDashboard.putNumber(${q(d.name+'/quadrature rotations')},${n}.getQuadraturePosition().getValueAsDouble());`,`frc::SmartDashboard::PutBoolean(${q(d.name+'/S2 closed')},${n}.GetS2Closed().GetValue());frc::SmartDashboard::PutNumber(${q(d.name+'/quadrature rotations')},${n}.GetQuadraturePosition().GetValueAsDouble());`,`wpilib.SmartDashboard.putBoolean(${q(d.name+'/S2 closed')}, ${py}.get_s2_closed().value)\nwpilib.SmartDashboard.putNumber(${q(d.name+'/quadrature rotations')}, ${py}.get_quadrature_position().value_as_double)`];
 }
 if(a==='encoderLegacy'||a==='pigeonLegacy'){
  const cls=a==='encoderLegacy'?'CANCoder':'PigeonIMU';
  declare(`com.ctre.phoenix.sensors.${cls}`,`new com.ctre.phoenix.sensors.${cls}(${id})`,`ctre::phoenix::sensors::${cls}`,`{${id}}`,`phoenix5.sensors.${cls}(${id})`);
  const m=a==='encoderLegacy'?['getAbsolutePosition','GetAbsolutePosition','getAbsolutePosition']:['getFusedHeading','GetFusedHeading','getFusedHeading'];const scale=a==='encoderLegacy'?'/360.0':'';
  f.fields[0]+=`\nprivate double legacyRead_${d.id}(){double value=${n}.${m[0]}()${scale};return ${n}.getLastError()==com.ctre.phoenix.ErrorCode.OK?value:Double.NaN;}`;
  f.fields[1]+=`\ndouble legacyRead_${d.id}(){double value=${n}.${m[1]}()${scale};return ${n}.GetLastError()==ctre::phoenix::ErrorCode::OK?value:NAN;}`;
  calibrated([`legacyRead_${d.id}()`,`legacyRead_${d.id}()`,`(lambda value: value if ${py}.getLastError()==phoenix5.ErrorCode.OK else float('nan'))(${py}.${m[2]}()${scale})`]);
 }
 if(a==='navx'){
  declare('com.studica.frc.AHRS',`new com.studica.frc.AHRS(com.studica.frc.AHRS.NavXComType.${navxPort(d.interface)})`,'studica::AHRS',`{studica::AHRS::NavXComType::${navxPort(d.interface)}}`,`navx.AHRS(navx.AHRS.NavXComType.${navxPort(d.interface)})`);
  calibrated([`(${n}.isConnected()&&!${n}.isCalibrating()?${n}.getRotation2d().getDegrees():Double.NaN)`,`(${n}.IsConnected()&&!${n}.IsCalibrating()?${n}.GetRotation2d().Degrees().value():NAN)`,`(${py}.getRotation2d().degrees() if ${py}.isConnected() and not ${py}.isCalibrating() else float('nan'))`]);
 }
 if(a==='digital'||a==='digitalOut'){
  const cls=a==='digital'?'DigitalInput':'DigitalOutput';declare(cls,`new ${cls}(${ch})`,`frc::${cls}`,`{${ch}}`,`wpilib.${cls}(${ch})`);
  f.read=[`(${d.inverted?'':'!'}${n}.get()?1.0:0.0)`,`(${d.inverted?'':'!'}${n}.Get()?1.0:0.0)`,`1.0 if ${d.inverted?'':'not '}${py}.get() else 0.0`];
  if(a==='digitalOut'){f.set=[`${n}.set(value>0);`,`${n}.Set(value>0);`,`${py}.set(value > 0)`];f.stop=[`${n}.set(false);`,`${n}.Set(false);`,`${py}.set(False)`];}
 }
 if(a==='duty'||a==='analogEncoder'){
  const cls=a==='duty'?'DutyCycleEncoder':'AnalogEncoder';declare(cls,`new ${cls}(${ch})`,`frc::${cls}`,`{${ch}}`,`wpilib.${cls}(${ch})`);
  const read:Triple=[`${n}.get()`,`${n}.Get()`,`${py}.get()`];
  calibrated(a==='duty'?[`(${n}.isConnected()?${read[0]}:Double.NaN)`,`(${n}.IsConnected()?${read[1]}:NAN)`,`(${read[2]} if ${py}.isConnected() else float('nan'))`]:read);
 }
 if(a==='quadrature'){
  declare('Encoder',`new Encoder(${ch},${d.channelB},${d.inverted})`,'frc::Encoder',`{${ch},${d.channelB},${d.inverted}}`,`wpilib.Encoder(${ch}, ${d.channelB}, ${d.inverted?'True':'False'})`);
  f.init=[`${n}.setDistancePerPulse(${d.scale});`,`${n}.SetDistancePerPulse(${d.scale});`,`${py}.setDistancePerPulse(${d.scale})`];f.read=[`${n}.getDistance()+${d.offset}`,`${n}.GetDistance()+${d.offset}`,`${py}.getDistance()+${d.offset}`];
 }
 if(a==='analog'){
  declare('AnalogInput',`new AnalogInput(${ch})`,'frc::AnalogInput',`{${ch}}`,`wpilib.AnalogInput(${ch})`);calibrated([`${n}.getVoltage()`,`${n}.GetVoltage()`,`${py}.getVoltage()`]);
 }
 if(a==='ultrasonic'){
  declare('Ultrasonic',`new Ultrasonic(${ch},${d.channelB})`,'frc::Ultrasonic',`{${ch},${d.channelB}}`,`wpilib.Ultrasonic(${ch}, ${d.channelB})`);
  f.init=['Ultrasonic.setAutomaticMode(true);','frc::Ultrasonic::SetAutomaticMode(true);','wpilib.Ultrasonic.setAutomaticMode(True)'];calibrated([`(${n}.isRangeValid()?${n}.getRangeMM()/1000.0:Double.NaN)`,`(${n}.IsRangeValid()?${n}.GetRange().value():NAN)`,`(${py}.getRangeMM()/1000.0 if ${py}.isRangeValid() else float('nan'))`]);
 }
 if(a==='pdh'||a==='pdp'){
  const type=a==='pdh'?'kRev':'kCTRE';declare('PowerDistribution',`new PowerDistribution(${id},PowerDistribution.ModuleType.${type})`,'frc::PowerDistribution',`{${id},frc::PowerDistribution::ModuleType::${type}}`,`wpilib.PowerDistribution(${id}, wpilib.PowerDistribution.ModuleType.${type})`);
  f.read=[`${n}.getVoltage()`,`${n}.GetVoltage()`,`${py}.getVoltage()`];
  f.extra=[`SmartDashboard.putNumber(${q(d.name+'/total amps')},${n}.getTotalCurrent());SmartDashboard.putNumber(${q(d.name+'/temperature C')},${n}.getTemperature());for(int ch=0;ch<${a==='pdh'?24:16};ch++)SmartDashboard.putNumber(${q(d.name+'/channel ')}+ch+" amps",${n}.getCurrent(ch));`,`frc::SmartDashboard::PutNumber(${q(d.name+'/total amps')},${n}.GetTotalCurrent());frc::SmartDashboard::PutNumber(${q(d.name+'/temperature C')},${n}.GetTemperature());for(int ch=0;ch<${a==='pdh'?24:16};ch++)frc::SmartDashboard::PutNumber(${q(d.name+'/channel ')}+std::to_string(ch)+" amps",${n}.GetCurrent(ch));`,`wpilib.SmartDashboard.putNumber(${q(d.name+'/total amps')}, ${py}.getTotalCurrent())\nwpilib.SmartDashboard.putNumber(${q(d.name+'/temperature C')}, ${py}.getTemperature())\nfor ch in range(${a==='pdh'?24:16}): wpilib.SmartDashboard.putNumber(${q(d.name+'/channel ')} + str(ch) + ' amps', ${py}.getCurrent(ch))`];
 }
 if(a==='ph'||a==='pcm'){
  const type=a==='ph'?'REVPH':'CTREPCM';declare('Compressor',`new Compressor(${id},PneumaticsModuleType.${type})`,'frc::Compressor',`{${id},frc::PneumaticsModuleType::${type}}`,`wpilib.Compressor(${id}, wpilib.PneumaticsModuleType.${type})`);
  f.stop=[`${n}.disable();`,`${n}.Disable();`,`${py}.disable()`];
  // The loop turns closed-loop compression off while disabled.
  f.extra=[`if(DriverStation.isEnabled()&&${d.compressor})${n}.enableDigital();else ${n}.disable();`,`if(frc::DriverStation::IsEnabled()&&${d.compressor})${n}.EnableDigital();else ${n}.Disable();`,`${py}.enableDigital() if wpilib.DriverStation.isEnabled() and ${d.compressor?'True':'False'} else ${py}.disable()`];
  f.read=[`${n}.getPressureSwitchValue()?1.0:0.0`,`${n}.GetPressureSwitchValue()?1.0:0.0`,`1.0 if ${py}.getPressureSwitchValue() else 0.0`];
 }
 if(['solenoidRev','solenoidCtre','doubleRev','doubleCtre'].includes(a||'')){
  const hub=p.devices?.find(h=>h.id===d.module);const type=a!.endsWith('Rev')?'REVPH':'CTREPCM',dbl=a!.startsWith('double'),cls=dbl?'DoubleSolenoid':'Solenoid';const args=`${hub?.address??0},PneumaticsModuleType.${type},${ch}${dbl?','+d.channelB:''}`;
  declare(cls,`new ${cls}(${args})`,`frc::${cls}`,`{${args.replace('PneumaticsModuleType.','frc::PneumaticsModuleType::')}}`,`wpilib.${cls}(${args.replace('PneumaticsModuleType.','wpilib.PneumaticsModuleType.')})`);
  f.set=dbl?[`${n}.set(value>0?DoubleSolenoid.Value.kForward:value<0?DoubleSolenoid.Value.kReverse:DoubleSolenoid.Value.kOff);`,`${n}.Set(value>0?frc::DoubleSolenoid::kForward:value<0?frc::DoubleSolenoid::kReverse:frc::DoubleSolenoid::kOff);`,`${py}.set(wpilib.DoubleSolenoid.Value.kForward if value>0 else wpilib.DoubleSolenoid.Value.kReverse if value<0 else wpilib.DoubleSolenoid.Value.kOff)`]:[`${n}.set(value>0);`,`${n}.Set(value>0);`,`${py}.set(value>0)`];
  f.stop=dbl?[`${n}.set(DoubleSolenoid.Value.kOff);`,`${n}.Set(frc::DoubleSolenoid::kOff);`,`${py}.set(wpilib.DoubleSolenoid.Value.kOff)`]:[`${n}.set(false);`,`${n}.Set(false);`,`${py}.set(False)`];
 }
 if(a==='servo'||a==='blinkin'){
  const cls=a==='servo'?'Servo':'Spark';declare(cls,`new ${cls}(${ch})`,a==='servo'?'frc::Servo':'frc::Spark',`{${ch}}`,`wpilib.${a==='servo'?'Servo':'Spark'}(${ch})`);
  if(a==='servo'){
   f.init=[`${n}.setBoundsMicroseconds(${d.pulseMax},${Math.round((d.pulseMin+d.pulseMax)/2)},${(d.pulseMin+d.pulseMax)/2},${(d.pulseMin+d.pulseMax)/2},${d.pulseMin});`,`${n}.SetBounds(units::microsecond_t{${d.pulseMax}},units::microsecond_t{${Math.round((d.pulseMin+d.pulseMax)/2)}},units::microsecond_t{${Math.round((d.pulseMin+d.pulseMax)/2)}},units::microsecond_t{${Math.round((d.pulseMin+d.pulseMax)/2)}},units::microsecond_t{${d.pulseMin}});`,`${py}.setBounds(${d.pulseMax}, ${Math.round((d.pulseMin+d.pulseMax)/2)}, ${Math.round((d.pulseMin+d.pulseMax)/2)}, ${Math.round((d.pulseMin+d.pulseMax)/2)}, ${d.pulseMin})`];
   f.set=[`${n}.set(Math.max(0,Math.min(1,value)));`,`${n}.Set(std::clamp(value,0.0,1.0));`,`${py}.set(max(0.0,min(1.0,value)))`];f.stop=[`${n}.setDisabled();`,`${n}.SetDisabled();`,`${py}.setDisabled()`];
  }else{f.set=[`${n}.set(value);`,`${n}.Set(value);`,`${py}.set(value)`];f.stop=[`${n}.set(0.99);`,`${n}.Set(0.99);`,`${py}.set(0.99)`];}
 }
 if(a==='color'){
  const port=d.interface==='onboard'?'kOnboard':'kMXP';declare('com.revrobotics.ColorSensorV3',`new com.revrobotics.ColorSensorV3(I2C.Port.${port})`,'rev::ColorSensorV3',`{frc::I2C::Port::${port}}`,`rev.ColorSensorV3(wpilib.I2C.Port.${port})`);
  f.read=[`(${n}.isConnected()?${n}.getProximity():Double.NaN)`,`(${n}.IsConnected()?${n}.GetProximity():NAN)`,`(${py}.getProximity() if ${py}.isConnected() else float('nan'))`];
  f.extra=[['Red','Green','Blue','IR'].map(k=>`SmartDashboard.putNumber(${q(d.name+'/'+k)},${n}.get${k}());`).join(''),['Red','Green','Blue','IR'].map(k=>`frc::SmartDashboard::PutNumber(${q(d.name+'/'+k)},${k==='IR'?`${n}.GetIR()`:`${n}.GetRawColor().${k.toLowerCase()}`});`).join(''),['Red','Green','Blue','IR'].map(k=>`wpilib.SmartDashboard.putNumber(${q(d.name+'/'+k)}, ${k==='IR'?`${py}.getIR()`:`${py}.getRawColor().${k.toLowerCase()}`})`).join('\n')];
 }
 if(a==='tof'){
  declare('com.playingwithfusion.TimeOfFlight',`new com.playingwithfusion.TimeOfFlight(${id})`,'pwf::TimeOfFlight',`{${id}}`,`playingwithfusion.TimeOfFlight(${id})`);
  f.init=[`${n}.setRangingMode(com.playingwithfusion.TimeOfFlight.RangingMode.Short,24);`,`${n}.SetRangingMode(pwf::TimeOfFlight::RangingMode::kShort,24);`,`${py}.setRangingMode(playingwithfusion.TimeOfFlight.RangingMode.kShort,24)`];
  calibrated([`(${n}.isRangeValid()?${n}.getRange()/1000.0:Double.NaN)`,`(${n}.IsRangeValid()?${n}.GetRange()/1000.0:NAN)`,`(${py}.getRange()/1000.0 if ${py}.isRangeValid() else float('nan'))`]);
 }
 if(a==='limelight'){
  declare('edu.wpi.first.networktables.NetworkTable',`edu.wpi.first.networktables.NetworkTableInstance.getDefault().getTable(${q(d.table)})`,'std::shared_ptr<nt::NetworkTable>',`=nt::NetworkTableInstance::GetDefault().GetTable(${q(d.table)})`,`ntcore.NetworkTableInstance.getDefault().getTable(${q(d.table)})`);
  f.fields[0]+=`\nprivate double hb_${d.id}=-1,seen_${d.id}=-100;`;f.fields[1]+=`\ndouble hb_${d.id}=-1,seen_${d.id}=-100;`;f.fields[2]+=`\nself.hb_${d.id} = -1\nself.seen_${d.id} = -100`;
  f.extra=[`double hb=${n}.getEntry("hb").getDouble(-1);if(hb>=0&&hb!=hb_${d.id}){hb_${d.id}=hb;seen_${d.id}=Timer.getFPGATimestamp();}`,`double hb=${n}->GetNumber("hb",-1);if(hb>=0&&hb!=hb_${d.id}){hb_${d.id}=hb;seen_${d.id}=frc::Timer::GetFPGATimestamp().value();}`,`hb = ${py}.getNumber('hb', -1)\nif hb >= 0 and hb != self.hb_${d.id}:\n    self.hb_${d.id} = hb\n    self.seen_${d.id} = wpilib.Timer.getFPGATimestamp()`];
  f.read=[`(Timer.getFPGATimestamp()-seen_${d.id}<0.25?${n}.getEntry("tv").getDouble(0):Double.NaN)`,`(frc::Timer::GetFPGATimestamp().value()-seen_${d.id}<0.25?${n}->GetNumber("tv",0):NAN)`,`(${py}.getNumber('tv',0) if wpilib.Timer.getFPGATimestamp()-self.seen_${d.id}<0.25 else float('nan'))`];
  for(const key of ['tx','ty','ta','tl','cl']){f.extra[0]+=`SmartDashboard.putNumber(${q(d.name+'/'+key)},${n}.getEntry(${q(key)}).getDouble(0));`;f.extra[1]+=`frc::SmartDashboard::PutNumber(${q(d.name+'/'+key)},${n}->GetNumber(${q(key)},0));`;f.extra[2]+=`\nwpilib.SmartDashboard.putNumber(${q(d.name+'/'+key)}, ${py}.getNumber(${q(key)},0))`;}
  f.extra[0]+=`SmartDashboard.putNumberArray(${q(d.name+'/blue pose')},${n}.getEntry("botpose_wpiblue").getDoubleArray(new double[0]));`;
  f.extra[1]+=`frc::SmartDashboard::PutNumberArray(${q(d.name+'/blue pose')},${n}->GetNumberArray("botpose_wpiblue",{}));`;
  f.extra[2]+=`\nwpilib.SmartDashboard.putNumberArray(${q(d.name+'/blue pose')}, ${py}.getNumberArray('botpose_wpiblue',[]))`;
 }
 if(a==='canbus'){
  declare('com.ctre.phoenix6.CANBus',`new com.ctre.phoenix6.CANBus(${q(d.bus)})`,'ctre::phoenix6::CANBus',`{${q(d.bus)}}`,`phoenix6.CANBus(${q(d.bus)})`);
  f.read=[`${n}.getStatus().BusUtilization`,`${n}.GetStatus().BusUtilization`,`${py}.get_status().bus_utilization`];
 }
 if(a==='candle'){
  declare('com.ctre.phoenix6.hardware.CANdle',`new com.ctre.phoenix6.hardware.CANdle(${id},new com.ctre.phoenix6.CANBus(${q(d.bus)}))`,'ctre::phoenix6::hardware::CANdle',`{${id},ctre::phoenix6::CANBus{${q(d.bus)}}}`,`phoenix6.hardware.CANdle(${id}, phoenix6.CANBus(${q(d.bus)}))`);
  f.set=[`${n}.setControl(new com.ctre.phoenix6.controls.SolidColor(0,${d.count-1}).withColor(new com.ctre.phoenix6.signals.RGBWColor(value>0?${d.red}:0,value>0?${d.green}:0,value>0?${d.blue}:0)));`,`${n}.SetControl(ctre::phoenix6::controls::SolidColor{0,${d.count-1}}.WithColor(ctre::phoenix6::signals::RGBWColor{static_cast<uint8_t>(value>0?${d.red}:0),static_cast<uint8_t>(value>0?${d.green}:0),static_cast<uint8_t>(value>0?${d.blue}:0)}));`,`${py}.set_control(phoenix6.controls.SolidColor(0, ${d.count-1}, phoenix6.signals.RGBWColor(${d.red} if value>0 else 0, ${d.green} if value>0 else 0, ${d.blue} if value>0 else 0)))`];
  f.stop=f.set.map(x=>x.replaceAll('value>0','false')) as Triple;f.stop[2]=f.set[2].replaceAll('value>0','False');
  f.init=[`// Configure the physical LED strip type in Phoenix Tuner before use.\nfor(int slot=0;slot<8;slot++)${n}.setControl(new com.ctre.phoenix6.controls.EmptyAnimation(slot));`,`for(int slot=0;slot<8;slot++)${n}.SetControl(ctre::phoenix6::controls::EmptyAnimation{slot});`,`# Configure the physical LED strip type in Phoenix Tuner before use.\nfor slot in range(8): ${py}.set_control(phoenix6.controls.EmptyAnimation(slot))`];
 }
 if(a==='servoHub'){
  declare('com.revrobotics.servohub.ServoHub',`new com.revrobotics.servohub.ServoHub(${id})`,'rev::servohub::ServoHub',`{${id}}`,`rev.ServoHub(${id})`);
  const cj=`${n}.getServoChannel(com.revrobotics.servohub.ServoChannel.ChannelId.kChannelId${ch})`,cc=`${n}.GetServoChannel(rev::servohub::ServoChannel::ChannelId::kChannelId${ch})`,cp=`${py}.getServoChannel(rev.ServoChannel.ChannelId.kChannelId${ch})`;
  f.fields[0]+=`\nprivate boolean ok_${d.id}=false;`;f.fields[1]+=`\nbool ok_${d.id}=false;`;f.fields[2]+=`\nself.ok_${d.id} = False`;
  f.init=[`var config_${d.id}=new com.revrobotics.servohub.config.ServoHubConfig();\nconfig_${d.id}.channel${ch}.pulseRange(${d.pulseMin},${Math.round((d.pulseMin+d.pulseMax)/2)},${d.pulseMax}).disableBehavior(com.revrobotics.servohub.config.ServoChannelConfig.BehaviorWhenDisabled.kDoNotSupplyPower);\nfor(int i=0;i<3&&!ok_${d.id};i++)ok_${d.id}=${n}.configure(config_${d.id},com.revrobotics.ResetMode.kResetSafeParameters)==com.revrobotics.REVLibError.kOk;`,
   `rev::servohub::ServoHubConfig config_${d.id};config_${d.id}.channel${ch}.PulseRange(${d.pulseMin},${Math.round((d.pulseMin+d.pulseMax)/2)},${d.pulseMax}).DisableBehavior(rev::servohub::ServoChannelConfig::BehaviorWhenDisabled::kDoNotSupplyPower);for(int i=0;i<3&&!ok_${d.id};i++)ok_${d.id}=${n}.Configure(config_${d.id},rev::ResetMode::kResetSafeParameters)==rev::REVLibError::kOk;`,
   `config_${d.id} = rev.ServoHubConfig()\nconfig_${d.id}.channel${ch}.pulseRange(${d.pulseMin},${Math.round((d.pulseMin+d.pulseMax)/2)},${d.pulseMax}).disableBehavior(rev.ServoChannelConfig.BehaviorWhenDisabled.kDoNotSupplyPower)\nfor _ in range(3):\n    self.ok_${d.id} = ${py}.configure(config_${d.id}, rev.ResetMode.kResetSafeParameters) == rev.REVLibError.kOk\n    if self.ok_${d.id}: break`];
  for(let channel=0;channel<6;channel++){
   f.init[0]+=`\n${n}.getServoChannel(com.revrobotics.servohub.ServoChannel.ChannelId.kChannelId${channel}).setEnabled(false);${n}.getServoChannel(com.revrobotics.servohub.ServoChannel.ChannelId.kChannelId${channel}).setPowered(false);`;
   f.init[1]+=`\n${n}.GetServoChannel(rev::servohub::ServoChannel::ChannelId::kChannelId${channel}).SetEnabled(false);${n}.GetServoChannel(rev::servohub::ServoChannel::ChannelId::kChannelId${channel}).SetPowered(false);`;
   f.init[2]+=`\n${py}.getServoChannel(rev.ServoChannel.ChannelId.kChannelId${channel}).setEnabled(False)\n${py}.getServoChannel(rev.ServoChannel.ChannelId.kChannelId${channel}).setPowered(False)`;
  }
  f.set=[`if(!ok_${d.id})return;${cj}.setPulseWidth((int)(${d.pulseMin}+Math.max(0,Math.min(1,value))*${d.pulseMax-d.pulseMin}));${cj}.setPowered(true);${cj}.setEnabled(true);`,`if(!ok_${d.id})return;${cc}.SetPulseWidth(static_cast<int>(${d.pulseMin}+std::clamp(value,0.0,1.0)*${d.pulseMax-d.pulseMin}));${cc}.SetPowered(true);${cc}.SetEnabled(true);`,`if not self.ok_${d.id}: return\n${cp}.setPulseWidth(int(${d.pulseMin}+max(0.0,min(1.0,value))*${d.pulseMax-d.pulseMin}))\n${cp}.setPowered(True)\n${cp}.setEnabled(True)`];
  f.stop=[`${cj}.setEnabled(false);${cj}.setPowered(false);`,`${cc}.SetEnabled(false);${cc}.SetPowered(false);`,`${cp}.setEnabled(False)\n${cp}.setPowered(False)`];
 }
 return f;
}

const indent=(s:string,n=8)=>s.split('\n').filter(x=>x.trim()).map(x=>' '.repeat(n)+x).join('\n');
export function deviceSources(p:Project):Record<string,string>{
 const ds=(p.devices||[]).filter(d=>!['passive','custom'].includes(productById(d.product)?.adapter||'custom'));const fs=ds.map(d=>({d,f:fragment(d,p)}));const actuators=fs.filter(x=>isActuator(productById(x.d.product)!.adapter));const compressors=fs.filter(x=>['ph','pcm'].includes(productById(x.d.product)!.adapter));
 const java=`package frc.robot;
import edu.wpi.first.wpilibj.*;
import edu.wpi.first.wpilibj.motorcontrol.*;
import edu.wpi.first.wpilibj.smartdashboard.SmartDashboard;
import edu.wpi.first.wpilibj2.command.SubsystemBase;
/** Peripheral ownership, telemetry and guarded outputs. Each action uses its assigned mechanism's requirement. */
public final class HardwareIO extends SubsystemBase {
${fs.map(x=>x.f.fields[0]).join('\n')}
${actuators.map(({d})=>`private double last_${d.id}=-100;`).join('\n')}
public HardwareIO(){${fs.map(x=>x.f.init[0]).join('\n')}stopAll();}
public void stopAll(){${actuators.map(({d})=>`stop_${d.id}();`).join('')}${compressors.map(x=>x.f.stop[0]).join('')}}
${fs.map(({d,f})=>`public double read_${d.id}(){return ${f.read[0]};}`).join('\n')}
${actuators.map(({d,f})=>`public void set_${d.id}(double value){if(!DriverStation.isEnabled()||!Double.isFinite(value)){stop_${d.id}();return;}last_${d.id}=Timer.getFPGATimestamp();${f.set[0]}}\npublic void stop_${d.id}(){${f.stop[0]}}`).join('\n')}
@Override public void periodic(){
${actuators.map(({d})=>`if(DriverStation.isDisabled()||Timer.getFPGATimestamp()-last_${d.id}>0.1)stop_${d.id}();`).join('\n')}
${fs.map(({d,f})=>`{${f.extra[0]}double value=read_${d.id}();${isSensor(productById(d.product)!.adapter)?`SmartDashboard.putBoolean(${q(d.name+'/valid')},Double.isFinite(value));`:''}if(Double.isFinite(value))SmartDashboard.putNumber(${q(d.name+'/value')},value);}`).join('\n')}
}
}
`;
 const adapters=new Set(ds.map(d=>productById(d.product)!.adapter));
 const headers=['frc/DigitalInput.h','frc/DigitalOutput.h','frc/DutyCycleEncoder.h','frc/AnalogEncoder.h','frc/Encoder.h','frc/AnalogInput.h','frc/Ultrasonic.h','frc/PowerDistribution.h','frc/Compressor.h','frc/Solenoid.h','frc/DoubleSolenoid.h','frc/Servo.h','frc/I2C.h','frc/motorcontrol/Spark.h','frc/Timer.h','frc/DriverStation.h','frc/smartdashboard/SmartDashboard.h','frc2/command/SubsystemBase.h','ctre/phoenix6/CANBus.hpp'];
 for(const [a,h] of Object.entries({cancoder:'ctre/phoenix6/CANcoder.hpp',canrange:'ctre/phoenix6/CANrange.hpp',candi:'ctre/phoenix6/CANdi.hpp',candle:'ctre/phoenix6/CANdle.hpp',pigeon:'ctre/phoenix6/Pigeon2.hpp',pigeonLegacy:'ctre/phoenix/sensors/PigeonIMU.h',encoderLegacy:'ctre/phoenix/sensors/CANCoder.h',navx:'studica/AHRS.h',color:'rev/ColorSensorV3.h',tof:'TimeOfFlight.h',limelight:'networktables/NetworkTableInstance.h',servoHub:'rev/ServoHub.h'}))if(adapters.has(a as never))headers.push(h);
 if(adapters.has('servoHub'))headers.push('rev/config/ServoHubConfig.h');
 const cpp=`#pragma once
#include <cmath>
#include <algorithm>
#include <memory>
#include <string>
${headers.map(h=>'#include <'+h+'>').join('\n')}
class HardwareIO:public frc2::SubsystemBase {
${fs.map(x=>x.f.fields[1]).join('\n')}
${actuators.map(({d})=>`double last_${d.id}=-100;`).join('\n')}
public:
HardwareIO(){${fs.map(x=>x.f.init[1]).join('\n')}StopAll();}
void StopAll(){${actuators.map(({d})=>`stop_${d.id}();`).join('')}${compressors.map(x=>x.f.stop[1]).join('')}}
${fs.map(({d,f})=>`double read_${d.id}(){return ${f.read[1]};}`).join('\n')}
${actuators.map(({d,f})=>`void set_${d.id}(double value){if(!frc::DriverStation::IsEnabled()||!std::isfinite(value)){stop_${d.id}();return;}last_${d.id}=frc::Timer::GetFPGATimestamp().value();${f.set[1]}}\nvoid stop_${d.id}(){${f.stop[1]}}`).join('\n')}
void Periodic() override {
${actuators.map(({d})=>`if(frc::DriverStation::IsDisabled()||frc::Timer::GetFPGATimestamp().value()-last_${d.id}>0.1)stop_${d.id}();`).join('\n')}
${fs.map(({d,f})=>`{${f.extra[1]}double value=read_${d.id}();${isSensor(productById(d.product)!.adapter)?`frc::SmartDashboard::PutBoolean(${q(d.name+'/valid')},std::isfinite(value));`:''}if(std::isfinite(value))frc::SmartDashboard::PutNumber(${q(d.name+'/value')},value);}`).join('\n')}
}
};
`;
 const python=`import math
import commands2
import wpilib
import rev
import phoenix6
import phoenix6.hardware
import phoenix6.controls
import phoenix6.signals
${adapters.has('navx')?'import navx':''}
${adapters.has('tof')?'import playingwithfusion':''}
${adapters.has('limelight')?'import ntcore':''}
${adapters.has('pigeonLegacy')||adapters.has('encoderLegacy')?'import phoenix5\nimport phoenix5.sensors':''}

class HardwareIO(commands2.Subsystem):
    def __init__(self):
        super().__init__()
${fs.map(x=>indent(x.f.fields[2])).join('\n')}
${actuators.map(({d})=>`        self.last_${d.id} = -100`).join('\n')}
${fs.map(x=>indent(x.f.init[2])).join('\n')}
        self.stop_all()

    def stop_all(self):
${actuators.length?actuators.map(({d})=>`        self.stop_${d.id}()`).join('\n'):'        pass'}
${compressors.map(x=>indent(x.f.stop[2])).join('\n')}
${fs.map(({d,f})=>`\n    def read_${d.id}(self):\n        return ${f.read[2]}`).join('\n')}
${actuators.map(({d,f})=>`\n    def set_${d.id}(self, value):\n        if not wpilib.DriverStation.isEnabled() or not math.isfinite(value):\n            self.stop_${d.id}()\n            return\n        self.last_${d.id} = wpilib.Timer.getFPGATimestamp()\n${indent(f.set[2])}\n\n    def stop_${d.id}(self):\n${indent(f.stop[2])}`).join('\n')}

    def periodic(self):
${actuators.map(({d})=>`        if wpilib.DriverStation.isDisabled() or wpilib.Timer.getFPGATimestamp()-self.last_${d.id}>0.1: self.stop_${d.id}()`).join('\n')}
${fs.length?fs.map(({d,f})=>`${indent(f.extra[2])}\n        value = self.read_${d.id}()\n${isSensor(productById(d.product)!.adapter)?`        wpilib.SmartDashboard.putBoolean(${q(d.name+'/valid')}, math.isfinite(value))`:''}\n        if math.isfinite(value): wpilib.SmartDashboard.putNumber(${q(d.name+'/value')}, value)`).join('\n'):'        pass'}
`;
 return p.language==='Java'?{'src/main/java/frc/robot/HardwareIO.java':java}:p.language==='C++'?{'src/main/include/HardwareIO.h':cpp}:{'peripherals.py':python};
}
