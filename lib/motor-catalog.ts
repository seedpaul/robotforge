import { isHolonomic,driveType } from './drivetrain';
import type { Motor, Project } from './robot-model';
import { productById } from './hardware-catalog';

type MotorProfile = { type: Motor['type']; name: string; brand: string; brands?: string[]; connection: 'CAN'|'PWM'; description: string; docs: string; javaOnly?: boolean };
const rev = 'https://docs.revrobotics.com/';
const ctre = 'https://v6.docs.ctr-electronics.com/en/stable/docs/hardware-reference/';
const legacy = 'https://docs.ctre-phoenix.com/en/stable/ch13_MC.html';
export const motorCatalog: MotorProfile[] = [
 { type:'SparkMax', name:'SPARK MAX', brand:'REV Robotics', connection:'CAN', description:'REVLib motor control for NEO brushless or brushed DC motors. Configure CAN ID, motor model, current limit, direction, and subsystem.', docs:rev+'brushless/spark-max/overview' },
 { type:'SparkFlex', name:'SPARK Flex', brand:'REV Robotics', connection:'CAN', description:'REVLib motor control with NEO Vortex brushless or brushed motor settings. Includes integrated encoder feedback for the supported brushless drivetrain.', docs:rev+'brushless/spark-flex/overview' },
 { type:'TalonFX', name:'Talon FX · Kraken X60 / Falcon 500', brand:'CTRE', brands:['CTRE','WCP','VEXpro'], connection:'CAN', description:'Phoenix 6 control for the integrated Talon FX in WCP Kraken X60 and Falcon 500 motors. Select roboRIO CAN or a configured CANivore bus.', docs:ctre+'talonfx/index.html' },
 { type:'TalonFXS', name:'Talon FXS', brand:'CTRE', connection:'CAN', description:'Phoenix 6 mechanism control, plus brushless swerve steering with an external absolute encoder. Supports roboRIO CAN and CANivore; traction odometry is not generated for this controller.', docs:ctre+'talonfxs/index.html' },
 { type:'TalonSRX', name:'Talon SRX', brand:'CTRE', connection:'CAN', description:'Phoenix 5 brushed mechanism control with current limiting. Use roboRIO CAN. Generated drivetrain odometry is not supported.', docs:legacy },
 { type:'VictorSPX', name:'Victor SPX', brand:'CTRE', brands:['CTRE','VEXpro'], connection:'CAN', description:'Phoenix 5 brushed mechanism control on roboRIO CAN. No software current limiting or generated drivetrain odometry.', docs:legacy },
 { type:'ThriftyNova', name:'Thrifty Nova', brand:'The Thrifty Bot', connection:'CAN', javaOnly:true, description:'ThriftyLib mechanism control for NEO, Minion, or brushed DC motors. The generated adapter is Java only; drivetrain odometry is not supported.', docs:'https://docs.thethriftybot.com/' },
 { type:'PWMSparkMax', name:'SPARK MAX · PWM / brushed', brand:'REV Robotics', connection:'PWM', description:'WPILib PWM mechanism output. Configure SPARK MAX for brushed operation in REV Hardware Client first. No CAN feedback or software current limiting.', docs:rev+'brushless/spark-max/overview' },
 { type:'PWMSpark', name:'SPARK · PWM', brand:'REV Robotics', connection:'PWM', description:'Original SPARK brushed motor controller using a roboRIO PWM channel. Supports mechanism commands; no software current limiting.', docs:rev+'brushless/legacy/og-spark' },
 { type:'PWMTalonSRX', name:'Talon SRX · PWM', brand:'CTRE', connection:'PWM', description:'WPILib PWM brushed mechanism output for Talon SRX. No CAN feedback or software current limiting in this mode.', docs:legacy },
 { type:'PWMVictorSPX', name:'Victor SPX · PWM', brand:'CTRE', brands:['CTRE','VEXpro'], connection:'PWM', description:'WPILib PWM brushed mechanism output for Victor SPX. No CAN feedback or software current limiting.', docs:legacy },
 { type:'PWMVictor', name:'Victor SP · PWM', brand:'VEXpro', connection:'PWM', description:'WPILib PWM control for the Victor SP brushed motor controller. Supports mechanism commands; no software current limiting.', docs:'https://docs.wpilib.org/en/stable/docs/controls-overviews/control-system-hardware.html' },
];
export const motorOptions = motorCatalog.map(m => ({value:m.type, label:`${m.brand} ${m.name}${m.javaOnly?' · Java':''}`}));

/** Allocate only within the selected connection, including other configured devices. */
export function newMotor(p: Project, type: Motor['type'], id: string, subsystemId?:string): Motor {
 const profile = motorCatalog.find(m => m.type === type);
 if (!profile) throw Error('Choose a supported motor controller.');
 if (p.motors.length >= 40) throw Error('This project supports up to 40 motor controllers.');
 if (profile.javaOnly && p.language !== 'Java') throw Error('Thrifty Nova currently requires a Java project.');
 const pwm = profile.connection === 'PWM';
 const used = new Set(p.motors.filter(m => pwm ? m.type.startsWith('PWM') : !m.type.startsWith('PWM') && (m.bus || 'rio') === 'rio').map(m => m.can));
 for (const device of p.devices || []) {
  const product = productById(device.product);
  if (pwm && product?.connection === 'PWM') used.add(device.channel);
  if (!pwm && product?.connection === 'CAN' && device.bus === 'rio') used.add(device.address);
 }
 if (!pwm && p.drive.gyro === 'Pigeon2' && (p.drive.gyroBus || 'rio') === 'rio') used.add(p.drive.gyroCan);
 const addresses = pwm ? Array.from({length:20},(_,i)=>i) : [...Array.from({length:62},(_,i)=>i+1),0];
 const address = addresses.find(n => !used.has(n));
 if (address === undefined) throw Error(pwm ? 'No free PWM channels. Review your configured hardware first.' : 'No free CAN IDs on roboRIO CAN. Review your configured hardware first.');
 const subsystem = subsystemId || p.subsystems.find(s => s.id !== 'drive')?.id || 'drive';
 if (!p.subsystems.some(s=>s.id===subsystem)) throw Error('Choose an existing subsystem first.');
 if (subsystem === 'drive' && !['SparkMax','SparkFlex','TalonFX'].includes(type) && !(type==='TalonFXS'&&driveType(p)==='swerve')) throw Error('Add a mechanism in Subsystems first. This controller does not support generated drivetrain odometry.');
 let number = 1;
 while (p.motors.some(m => m.name === `${profile.name} ${number}`)) number++;
 return {id, name:`${profile.name} ${number}`, type, can:address, bus:'rio', motorKind:'default', subsystem, role:subsystem === 'drive' ? (type==='TalonFXS'&&driveType(p)==='swerve'?'steer':isHolonomic(p)?'wheel':'left') : 'mechanism', inverted:false, sensorSign:1, current:30, limit:-1};
}
export function motorKinds(type:Motor['type']){
 if(type==='TalonFX')return [{value:'default',label:'Kraken X60'},{value:'falcon',label:'Falcon 500'}];
 if(type==='TalonFXS')return [{value:'default',label:'Minion · JST'},{value:'neo',label:'NEO · JST'},{value:'brushed',label:'Brushed · leads A and B'}];
 if(type==='ThriftyNova')return [{value:'default',label:'NEO'},{value:'minion',label:'Minion'},{value:'brushed',label:'Brushed DC'}];
 if(type==='SparkMax')return [{value:'default',label:'NEO brushless'},{value:'brushed',label:'Brushed DC'}];
 if(type==='SparkFlex')return [{value:'default',label:'NEO Vortex brushless'},{value:'brushed',label:'Brushed DC'}];
 return [{value:'default',label:'Brushed DC (CIM, 775, BAG, etc.)'}];
}
