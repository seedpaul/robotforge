import { productById,isActuator,isSensor } from './hardware-catalog';
import type { Project,Issue } from './robot-model';
export function validateHardware(p:Project):Issue[]{
 const issues:Issue[]=[];const error=(message:string)=>issues.push({level:'error',area:'Hardware',message});
 const used=new Map<string,string>();const claim=(key:string,name:string)=>{if(used.has(key))error(`${key} is shared by ${used.get(key)} and ${name}.`);else used.set(key,name);};

 const devices=p.devices||[];const buses=new Set(['rio']);
 for(const d of devices.filter(d=>productById(d.product)?.adapter==='canbus')){if(buses.has(d.bus))error(`CANivore bus names must be unique and cannot be rio (${d.name}).`);buses.add(d.bus);}
 const can=(bus:string,id:number,name:string,ctre=false)=>{if(!buses.has(bus))error(`${name}: add CANivore “${bus}” first.`);if(bus!=='rio'&&!ctre)error(`${name} must use roboRIO CAN; its API does not support CANivore.`);claim(`CAN ${bus}:${id}`,name);};
 for(const m of p.motors){
  if(m.type.startsWith('PWM')){if(m.can>19)error(`${m.name}: PWM channel must be 0–19.`);claim(`PWM ${m.can}`,m.name);}else can(m.bus||'rio',m.can,m.name,['TalonFX','TalonFXS'].includes(m.type));
  if(m.limit>=0)claim(`DIO ${m.limit}`,m.name+' forward limit');
  const allowed=m.type==='TalonFX'?['default','falcon']:m.type==='TalonFXS'?['default','minion','neo','brushed']:m.type==='ThriftyNova'?['default','neo','minion','brushed']:m.type.startsWith('Spark')?['default','brushed']:['default'];
  if(!allowed.includes(m.motorKind||'default'))error(m.name+': choose a motor model supported by this controller.');
  if(m.subsystem==='drive'&&m.motorKind==='brushed')error(m.name+': integrated drivetrain feedback requires a brushless motor.');
  if(m.type==='ThriftyNova'&&p.language!=='Java')error(`${m.name}: ThriftyLib provides a Java adapter only. Select Java or another controller.`);
  if(m.subsystem==='drive'&&!(m.role==='steer'?['SparkMax','SparkFlex','TalonFX','TalonFXS']:['SparkMax','SparkFlex','TalonFX']).includes(m.type))error(`${m.name}: this controller is supported for mechanism commands; drivetrain odometry currently requires SPARK MAX, Flex, or Talon FX.`);
 }
 if(p.drive.gyro==='Pigeon2')can(p.drive.gyroBus||'rio',p.drive.gyroCan,'Drive Pigeon 2',true);
 if(p.drive.gyro==='NavX')claim(`navx ${p.drive.navxInterface||'mxp'}`,'Drive navX');
 for(const d of devices){const product=productById(d.product);if(!product){error(`${d.name}: unknown hardware product.`);continue;}const a=product.adapter;
  if(!p.subsystems.some(s=>s.id===d.subsystem))error(`${d.name}: choose an existing subsystem.`);
  if(a==='custom')error(`${d.name}: a verified ${p.language} adapter is not available. Remove this device before export; see its integration guide.`);
  if(product.connection==='CAN')can(d.bus,d.address,d.name,['cancoder','canrange','candi','candle','pigeon'].includes(a));
  if(a==='navx')claim(`navx ${d.interface}`,d.name);
  if(['digital','digitalOut','duty','quadrature','ultrasonic'].includes(a)){claim(`DIO ${d.channel}`,d.name);if(d.channel>25)error(`${d.name}: invalid DIO channel.`);}
  if(['quadrature','ultrasonic'].includes(a))claim(`DIO ${d.channelB}`,d.name);
  if(['analog','analogEncoder'].includes(a)){claim(`Analog ${d.channel}`,d.name);if(d.channel>7)error(`${d.name}: analog channel must be 0–7.`);}
  if(['servo','blinkin'].includes(a)){claim(`PWM ${d.channel}`,d.name);if(d.channel>19)error(`${d.name}: PWM channel must be 0–19.`);}
  if(a==='servoHub'&&d.channel>5)error(`${d.name}: Servo Hub channel must be 0–5.`);
  if(['servo','servoHub'].includes(a)&&d.pulseMin>=d.pulseMax)error(`${d.name}: minimum pulse must be below maximum pulse.`);
  if(a==='candle'&&d.count>400)error(`${d.name}: CANdle supports LED indexes 0–399.`);
  if(a==='color'){if(!['onboard','mxp'].includes(d.interface))error(`${d.name}: choose an I2C port.`);claim(`I2C ${d.interface}:0x52`,d.name);}
  if(a==='limelight')claim(`NetworkTables ${d.table}`,d.name);
  if(['solenoidRev','solenoidCtre','doubleRev','doubleCtre'].includes(a)){
   const hub=devices.find(h=>h.id===d.module);const expected=a.endsWith('Rev')?'ph':'pcm';
   if(!hub||productById(hub.product)?.adapter!==expected)error(`${d.name}: select the matching ${expected==='ph'?'REV Pneumatic Hub':'CTRE PCM'} in this project.`);
   const max=expected==='ph'?15:7;const channels=a.startsWith('double')?[d.channel,d.channelB]:[d.channel];
   channels.forEach(ch=>{if(ch>max)error(`${d.name}: valve channel must be 0–${max}.`);claim(`Valve ${d.module}:${ch}`,d.name);});
  }
 }
 if(new Set(devices.map(d=>d.id)).size!==devices.length)error('Duplicate hardware identifiers.');
 for(const c of p.commands){
  if(c.device){const d=devices.find(d=>d.id===c.device);if(!d||!isActuator(productById(d.product)?.adapter||'passive'))error(`${c.name}: choose an output device.`);else{if(d.subsystem!==c.subsystem)error(`${c.name}: output device must belong to the command’s subsystem.`);if(['servo','servoHub'].includes(productById(d.product)!.adapter)&&c.output<0)error(`${c.name}: servo position must be between 0 and 1.`);}}
  if(c.untilDevice){const d=devices.find(d=>d.id===c.untilDevice);if(!d||!isSensor(productById(d.product)?.adapter||'passive'))error(`${c.name}: choose a valid stop sensor.`);}
 }
 return issues;
}
