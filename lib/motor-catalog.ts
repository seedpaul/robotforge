import type { Motor } from './robot-model';
export const motorOptions=[{value:'SparkMax',label:'REV SPARK MAX'},{value:'SparkFlex',label:'REV SPARK Flex'},{value:'TalonFX',label:'CTRE / WCP Talon FX (Kraken / Falcon)'},{value:'TalonFXS',label:'CTRE Talon FXS'},{value:'TalonSRX',label:'CTRE Talon SRX · CAN'},{value:'VictorSPX',label:'CTRE Victor SPX · CAN'},{value:'ThriftyNova',label:'Thrifty Nova · Java'},{value:'PWMSparkMax',label:'SPARK MAX · PWM / brushed'},{value:'PWMSpark',label:'REV SPARK · PWM'},{value:'PWMTalonSRX',label:'Talon SRX · PWM'},{value:'PWMVictorSPX',label:'Victor SPX · PWM'},{value:'PWMVictor',label:'VEXpro Victor SP · PWM'}];
export function motorKinds(type:Motor['type']){
 if(type==='TalonFX')return [{value:'default',label:'Kraken X60'},{value:'falcon',label:'Falcon 500'}];
 if(type==='TalonFXS')return [{value:'default',label:'Minion · JST'},{value:'neo',label:'NEO · JST'},{value:'brushed',label:'Brushed · leads A and B'}];
 if(type==='ThriftyNova')return [{value:'default',label:'NEO'},{value:'minion',label:'Minion'},{value:'brushed',label:'Brushed DC'}];
 if(type==='SparkMax')return [{value:'default',label:'NEO brushless'},{value:'brushed',label:'Brushed DC'}];
 if(type==='SparkFlex')return [{value:'default',label:'NEO Vortex brushless'},{value:'brushed',label:'Brushed DC'}];
 return [{value:'default',label:'Brushed DC (CIM, 775, BAG, etc.)'}];
}
