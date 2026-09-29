import { z } from 'zod';
import type { Project } from './robot-model';
import { driveType, selectDrivetrain, type DriveType } from './drivetrain';

export const subsystemKinds = ['swerve','differential','westCoast','tank','mecanum','turret','shooter','indexer','intake','arm','elevator','climber','custom'] as const;
export type SubsystemKind = typeof subsystemKinds[number];
export const subsystemLayoutSchema = z.object({kind:z.enum(subsystemKinds),x:z.number().finite().min(0).max(1),y:z.number().finite().min(0).max(1)}).strict();
export type LayoutPoint = { x:number; y:number };
export const subsystemTemplates: {kind:SubsystemKind;name:string;description:string;drive?:DriveType}[] = [
  {kind:'swerve',name:'Swerve drive',description:'Four drive and steering modules.',drive:'swerve'},
  {kind:'differential',name:'Differential drive',description:'Left and right wheel groups.',drive:'differential'},
  {kind:'westCoast',name:'West Coast drive',description:'Linked traction wheels on each side.',drive:'westCoast'},
  {kind:'tank',name:'Tank drive',description:'Independent left and right stick controls.',drive:'tank'},
  {kind:'mecanum',name:'Mecanum drive',description:'Four fixed roller wheels.',drive:'mecanum'},
  {kind:'turret',name:'Turret',description:'Rotate a mechanism to aim.'},
  {kind:'shooter',name:'Shooter',description:'Launch game pieces with flywheels.'},
  {kind:'indexer',name:'Indexer',description:'Move and stage game pieces.'},
  {kind:'intake',name:'Intake',description:'Collect game pieces with rollers.'},
  {kind:'arm',name:'Arm',description:'Pivot a mechanism to reach a target.'},
  {kind:'elevator',name:'Elevator',description:'Raise and lower a carriage.'},
  {kind:'climber',name:'Climber',description:'Lift the robot using a hook or winch.'},
  {kind:'custom',name:'Custom mechanism',description:'Define another mechanism on your robot.'},
];
export function subsystemKind(project:Project, subsystem:Project['subsystems'][number]):SubsystemKind {
  if(subsystem.id==='drive')return driveType(project);
  if(subsystem.layout)return subsystem.layout.kind;
  const name=subsystem.name.toLowerCase();
  return subsystemTemplates.find(t=>!t.drive&&name.includes(t.kind))?.kind || 'custom';
}
export function clampPlacement(point:LayoutPoint):LayoutPoint {
  return {x:Math.max(.14,Math.min(.86,Number.isFinite(point.x)?point.x:.5)),y:Math.max(.18,Math.min(.76,Number.isFinite(point.y)?point.y:.45))};
}
export function subsystemPlacement(project:Project, subsystem:Project['subsystems'][number]):LayoutPoint {
  if(subsystem.layout)return clampPlacement(subsystem.layout);
  const index=project.subsystems.filter(s=>s.id!=='drive').findIndex(s=>s.id===subsystem.id);
  return {x:[.3,.7,.5][Math.max(0,index)%3],y:.25+Math.floor(Math.max(0,index)/3)%3*.21};
}
/** Visual placement never invents hardware or changes existing device/command identifiers. */
export function placeSubsystem(project:Project, kind:SubsystemKind, point:LayoutPoint, id:string):{patch:Partial<Project>;subsystemId:string} {
  const template=subsystemTemplates.find(t=>t.kind===kind);
  if(!template)throw Error('Choose a subsystem from the parts tray.');
  if(template.drive){
    const patch=driveType(project)===template.drive?{}:selectDrivetrain(project,template.drive);
    const subsystems=project.subsystems.some(s=>s.id==='drive')?project.subsystems:[{id:'drive',name:'Drivetrain',description:''},...project.subsystems];
    if(subsystems.length>20)throw Error('A robot can contain up to 20 subsystems.');
    return {patch:{...patch,subsystems:subsystems.map(s=>s.id==='drive'?{...s,layout:{kind,x:.5,y:.88}}:s)},subsystemId:'drive'};
  }
  if(project.subsystems.length>=20)throw Error('A robot can contain up to 20 subsystems.');
  if(!/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(id)||project.subsystems.some(s=>s.id===id))throw Error('Choose a new subsystem identifier.');
  let name=template.name,number=2;
  while(project.subsystems.some(s=>s.name.toLowerCase()===name.toLowerCase()))name=template.name+' '+number++;
  return {patch:{subsystems:[...project.subsystems,{id,name,description:template.description,layout:{kind,...clampPlacement(point)}}]},subsystemId:id};
}
export function moveSubsystem(project:Project,id:string,point:LayoutPoint):Partial<Project> {
  return {subsystems:project.subsystems.map(s=>s.id===id&&id!=='drive'?{...s,layout:{kind:subsystemKind(project,s),...clampPlacement(point)}}:s),checks:project.checks};
}
