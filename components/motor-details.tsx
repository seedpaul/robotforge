"use client";
import { Trash2 } from 'lucide-react';
import type { Motor, Project } from '@/lib/robot-model';
import { motorCatalog, motorKinds } from '@/lib/motor-catalog';
import { motorRoles } from '@/lib/drivetrain';
import { busOptions } from './hardware-devices';

export default function MotorDetails({project,update,motor:m}:{project:Project;update:(patch:Partial<Project>)=>void;motor:Motor}) {
  const change=(patch:Partial<Motor>)=>update({motors:project.motors.map(x=>x.id===m.id?{...x,...patch}:x)});
  const profile=motorCatalog.find(c=>c.type===m.type)!;
  const pick=(label:string,value:string,options:{value:string;label:string}[],onChange:(v:string)=>void)=><label className="form-field"><span>{label}</span><select aria-label={label} value={value} onChange={e=>onChange(e.target.value)}>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>;
  const number=(label:string,value:number,min:number,max:number,onChange:(v:number)=>void)=><label className="form-field"><span>{label}</span><input aria-label={label} type="number" min={min} max={max} value={Number.isFinite(value)?value:''} onChange={e=>onChange(e.target.valueAsNumber)}/></label>;
  const pwm=m.type.startsWith('PWM');
  return <div className="motor-details"><p className="device-guidance">{profile.description}</p><div className="form-grid two">
    <label className="form-field"><span>Component name</span><input aria-label="Component name" maxLength={60} value={m.name} onChange={e=>change({name:e.target.value})}/></label>
    {number(pwm?'PWM channel':'CAN ID',m.can,0,pwm?19:62,can=>change({can}))}
    {pick('Motor model',m.motorKind||'default',motorKinds(m.type),motorKind=>change({motorKind:motorKind as Motor['motorKind']}))}
    {['TalonFX','TalonFXS'].includes(m.type)&&pick('CAN bus',m.bus||'rio',busOptions(project),bus=>change({bus}))}
    {m.subsystem==='drive'&&<>{pick('Drive role',m.role,motorRoles(project),role=>change({role:role as Motor['role']}))}{pick('Encoder direction',String(m.sensorSign),[{value:'1',label:'+1'},{value:'-1',label:'−1'}],sign=>change({sensorSign:Number(sign) as 1|-1}))}</>}
    {!pwm&&m.type!=='VictorSPX'&&number('Current limit (A)',m.current,1,80,current=>change({current}))}
    {m.role==='mechanism'&&pick('Forward limit switch',String(m.limit),[{value:'-1',label:'No limit switch'},...Array.from({length:10},(_,i)=>({value:String(i),label:'DIO '+i}))],limit=>change({limit:Number(limit)}))}
    <label className="motor-direction"><input type="checkbox" aria-label="Invert motor output" checked={m.inverted} onChange={e=>change({inverted:e.target.checked})}/><span>Invert motor output</span></label>
  </div><p className="component-help">Match the controller&apos;s actual address. Verify motor direction and current limits on the robot.{m.role==='mechanism'?' All motors in this subsystem run together; use separate subsystems for independent movement.':''}</p>
  <div className="device-detail-footer"><a href={profile.docs} target="_blank" rel="noreferrer">Manufacturer setup guide</a><button className="button danger" onClick={()=>update({motors:project.motors.filter(x=>x.id!==m.id)})}><Trash2 size={16}/>Remove controller</button></div></div>;
}
