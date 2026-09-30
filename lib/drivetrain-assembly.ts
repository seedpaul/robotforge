import type { Project, Motor } from './robot-model';
import { corners, cornerNames, driveType, isHolonomic } from './drivetrain';
import { componentCatalog } from './component-catalog';
import { newProjectDevice } from './component-layout';
import { newMotor } from './motor-catalog';

export type DriveUnitId=typeof corners[number]|'left'|'right';
export type DriveSlot='drive'|'steer'|'encoder';
export function drivetrainUnits(p:Project){
  const type=driveType(p),swerve=type==='swerve',holo=isHolonomic(p);
  const ids:DriveUnitId[]=holo?[...corners]:['left','right'];
  return ids.map((id,i)=>{
    const config=p.drive.modules?.find(m=>m.corner===id);
    const driveIds=swerve?[config?.driveMotor]:holo?[p.drive.wheels?.[id as typeof corners[number]]]:p.motors.filter(m=>m.subsystem==='drive'&&m.role===id).map(m=>m.id);
    const motors=driveIds.map(id=>p.motors.find(m=>m.id===id&&m.subsystem==='drive')).filter((m):m is Motor=>!!m);
    const steer=swerve?p.motors.find(m=>m.subsystem==='drive'&&m.id===config?.steerMotor):undefined;
    const encoderId=swerve?config?.encoder:p.drive.tractionEncoders?.[id];
    const encoder=p.devices?.find(d=>d.subsystem==='drive'&&d.id===encoderId);
    const label=holo?cornerNames[i]:(id==='left'?'Left side':'Right side');
    const kind=swerve?'module':holo?'wheel':'side';
    const missing=[...(!motors.length?['drive motor']:[]),...(swerve&&!steer?['steering motor']:[]),...(swerve&&!encoder?['absolute encoder']:[])];
    return {id,label,kind,motors,steer,encoder,encoderId,offset:config?.offset??0,missing,complete:missing.length===0};
  });
}
export type DriveUnit=ReturnType<typeof drivetrainUnits>[number];
export function compatibleDriveProfile(p:Project,profileId:string,slot:DriveSlot){
  const profile=componentCatalog.find(c=>c.id===profileId);
  if(!profile)return false;
  if(slot==='encoder')return profile.kind==='device'&&(driveType(p)==='swerve'?['cancoder','duty']:['quadrature']).includes(profile.adapter);
  if(slot==='steer'&&driveType(p)!=='swerve')return false;
  return profile.kind==='motor'&&(slot==='steer'?['SparkMax','SparkFlex','TalonFX','TalonFXS']:['SparkMax','SparkFlex','TalonFX']).includes(profile.type);
}
export function assignedDriveKeys(p:Project){return new Set(drivetrainUnits(p).flatMap(u=>[...u.motors.map(m=>'motor:'+m.id),...(u.steer?['motor:'+u.steer.id]:[]),...(u.encoder?['device:'+u.encoder.id]:[])]));}

/** These assignments are the same ones consumed by the code generators. */
export function assignDriveComponent(p:Project,unitId:DriveUnitId,slot:DriveSlot,id:string):Partial<Project>{
  const unit=drivetrainUnits(p).find(u=>u.id===unitId);
  if(!unit)throw Error('Choose a unit in the current drivetrain.');
  const motor=p.motors.find(m=>m.id===id&&m.subsystem==='drive'),device=p.devices?.find(d=>d.id===id&&d.subsystem==='drive');
  const profile=slot==='encoder'?device?.product:motor?'motor-'+motor.type:undefined;
  if(id&&(!profile||!compatibleDriveProfile(p,profile,slot)))throw Error('Choose compatible drivetrain hardware for this slot.');
  const key=(slot==='encoder'?'device:':'motor:')+id;
  const existingKeys=[...unit.motors.map(m=>'motor:'+m.id),...(unit.steer?['motor:'+unit.steer.id]:[]),...(unit.encoder?['device:'+unit.encoder.id]:[])];
  if(id&&assignedDriveKeys(p).has(key)&&!existingKeys.includes(key)&&(unit.kind!=='side'||slot==='encoder'))throw Error('This component belongs to another drive unit. Unassign it there first.');
  if(id&&((slot==='steer'&&unit.motors.some(m=>m.id===id))||(slot==='drive'&&unit.steer?.id===id)))throw Error('Drive and steering require separate motors.');
  let drive={...p.drive},motors=p.motors;
  if(slot!=='encoder'&&id)motors=p.motors.map(m=>m.id===id?{...m,role:(slot==='steer'?'steer':isHolonomic(p)?'wheel':unitId) as Motor['role']}:m);
  if(driveType(p)==='swerve')drive={...drive,modules:corners.map(c=>{const old=drive.modules?.find(m=>m.corner===c)||{corner:c,driveMotor:'',steerMotor:'',encoder:'',offset:0};return c===unitId?{...old,[slot==='drive'?'driveMotor':slot==='steer'?'steerMotor':'encoder']:id}:old;})};
  else if(slot==='encoder')drive={...drive,tractionEncoders:{...drive.tractionEncoders,[unitId]:id}};
  else if(isHolonomic(p))drive={...drive,wheels:{frontLeft:'',frontRight:'',backLeft:'',backRight:'',...drive.wheels,[unitId]:id}};
  else if(!id)throw Error('Remove a side motor using its component settings.');
  else if(unit.motors.length>=4&&!unit.motors.some(m=>m.id===id))throw Error('Each drive side supports up to four motors.');
  return {drive,motors,checks:{}};
}
export function addDriveComponent(p:Project,unitId:DriveUnitId,slot:DriveSlot,profileId:string,id:string):Partial<Project>{
  const unit=drivetrainUnits(p).find(u=>u.id===unitId),profile=componentCatalog.find(c=>c.id===profileId);
  if(!unit||!profile||!compatibleDriveProfile(p,profileId,slot))throw Error('Choose compatible hardware for this slot.');
  if(!/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(id)||p.motors.some(m=>m.id===id)||p.devices?.some(d=>d.id===id))throw Error('Choose a new component identifier.');
  if((slot==='drive'&&unit.kind!=='side'&&unit.motors.length)||(slot==='steer'&&unit.steer)||(slot==='encoder'&&unit.encoder))throw Error('This slot is filled. Open the component to edit it, or unassign it first.');
  const prefix=unit.label+(slot==='encoder'?(driveType(p)==='swerve'?' absolute encoder':' distance encoder'):slot==='steer'?' steering':' drive');
  let name=prefix,n=2;while([...p.motors,...p.devices||[]].some(c=>c.name===name))name=prefix+' '+n++;
  const patch:Partial<Project>=profile.kind==='motor'?{motors:[...p.motors,{...newMotor(p,profile.type,id,'drive'),name,role:(slot==='steer'?'steer':isHolonomic(p)?'wheel':unitId) as Motor['role']}]}:{devices:[...p.devices||[],{...newProjectDevice(p,profileId,id,'drive'),name}]};
  // Side motors become members by their role, so enforce the limit before creating one.
  if(unit.kind==='side'&&slot==='drive'&&unit.motors.length>=4)throw Error('Each drive side supports up to four motors.');
  return {...patch,...assignDriveComponent({...p,...patch},unitId,slot,id),checks:{}};
}
export function existingDriveOptions(p:Project,slot:DriveSlot){
  const keys=assignedDriveKeys(p);
  const candidates=slot==='encoder'?(p.devices||[]).filter(d=>d.subsystem==='drive').map(d=>({id:d.id,name:d.name,profile:d.product,key:'device:'+d.id})):p.motors.filter(m=>m.subsystem==='drive').map(m=>({id:m.id,name:m.name,profile:'motor-'+m.type,key:'motor:'+m.id}));
  return candidates.filter(c=>!keys.has(c.key)&&compatibleDriveProfile(p,c.profile,slot));
}
