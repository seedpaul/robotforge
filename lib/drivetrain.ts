import { z } from 'zod';
import type { Project, Motor, Issue } from './robot-model';
import { productById } from './hardware-catalog';

export const corners = ['frontLeft', 'frontRight', 'backLeft', 'backRight'] as const;
export const cornerNames = ['Front left', 'Front right', 'Back left', 'Back right'];
export const driveTypes = [
  { value: 'differential', label: 'Differential / kit chassis', description: 'Left and right wheel groups. Arcade or tank controls.' },
  { value: 'westCoast', label: 'West Coast', description: 'Traction wheels driven together on each side. Arcade or tank controls.' },
  { value: 'tank', label: 'Tank', description: 'Left and right wheel groups with independent stick controls by default.' },
  { value: 'mecanum', label: 'Mecanum', description: 'Four fixed roller wheels. Drive forward, strafe, and turn.' },
  { value: 'swerve', label: 'Swerve', description: 'Four independently steered modules, each with drive, steering, and absolute feedback.' },
] as const;
export type DriveType = typeof driveTypes[number]['value'];
const ref = z.string().max(40);
export const moduleSchema = z.object({ corner:z.enum(corners), driveMotor:ref, steerMotor:ref, encoder:ref, offset:z.number().finite().min(-1).max(1) }).strict();
export const drivetrainFields = {
  type:z.enum(['differential','westCoast','tank','mecanum','swerve']).optional(),
  wheelbase:z.number().finite().min(.2).max(2).optional(),
  maxAngularSpeed:z.number().finite().min(.1).max(15).optional(),
  steerKP:z.number().finite().min(.1).max(30).optional(),
  translationKP:z.number().finite().min(.1).max(20).optional(),
  rotationKP:z.number().finite().min(.1).max(20).optional(),
  wheelCOF:z.number().finite().min(.1).max(3).optional(),
  wheels:z.object({frontLeft:ref,frontRight:ref,backLeft:ref,backRight:ref}).strict().optional(),
  modules:z.array(moduleSchema).max(4).optional(),
};
export const driveType = (p:Project):DriveType => p.drive.type || 'differential';
export const isHolonomic = (p:Project) => ['swerve','mecanum'].includes(driveType(p));
export const driveLabel = (p:Project) => driveTypes.find(t=>t.value===driveType(p))!.label;
export const controlStyle = (p:Project) => isHolonomic(p) ? 'holonomic' : p.controls.driveStyle || (driveType(p)==='tank'?'tank':'arcade');
export const orderedModules = (p:Project) => corners.map(c=>p.drive.modules?.find(m=>m.corner===c)).filter((m):m is NonNullable<typeof m>=>!!m);
export const tractionMotors = (p:Project) => p.motors.filter(m=>m.subsystem==='drive' && (driveType(p)!=='swerve' || p.drive.modules?.some(s=>s.driveMotor===m.id)));
export function motorRoles(p:Project) { return isHolonomic(p) ? [{value:'wheel',label:'Wheel / drive motor'},...(driveType(p)==='swerve'?[{value:'steer',label:'Steering motor'}]:[])] : [{value:'left',label:'Left side'},{value:'right',label:'Right side'}]; }

/** Changing layout preserves every hardware record, command, and mechanism. Assignments remain editable. */
export function selectDrivetrain(p:Project,type:DriveType):Partial<Project> {
  const holonomic=type==='swerve'||type==='mecanum';
  const motors=p.motors.map(m=>m.subsystem!=='drive'?m:{...m,role:(holonomic?(type==='swerve'&&(m.role==='steer'||p.drive.modules?.some(s=>s.steerMotor===m.id))?'steer':'wheel'):m.role==='right'?'right':'left') as Motor['role']});
  const left=p.motors.filter(m=>m.subsystem==='drive'&&m.role==='left'),right=p.motors.filter(m=>m.subsystem==='drive'&&m.role==='right');
  const sorted=[left[0],right[0],left[1],right[1]];
  const wheels=p.drive.wheels || Object.fromEntries(corners.map((corner,i)=>[corner,sorted[i]?.id||''])) as NonNullable<Project['drive']['wheels']>;
  const modules=p.drive.modules?.length?p.drive.modules:corners.map(corner=>({corner,driveMotor:wheels[corner],steerMotor:'',encoder:'',offset:0}));
  // Restore differential side assignments from corner mappings when leaving a holonomic layout.
  if(!holonomic&&isHolonomic(p))for(const m of motors){if(m.subsystem!=='drive')continue;const corner=corners.find(c=>wheels[c]===m.id)||p.drive.modules?.find(s=>s.driveMotor===m.id)?.corner;m.role=corner?.endsWith('Right')?'right':'left';}
  return {motors,drive:{...p.drive,type,wheelbase:p.drive.wheelbase??.6,maxAngularSpeed:p.drive.maxAngularSpeed??4,steerKP:p.drive.steerKP??4,translationKP:p.drive.translationKP??3,rotationKP:p.drive.rotationKP??3,wheelCOF:p.drive.wheelCOF??1.2,wheels,modules},controls:{...p.controls,driveStyle:type==='tank'?'tank':'arcade',strafeAxis:p.controls.strafeAxis??0,strafeSign:p.controls.strafeSign??-1,rightAxis:p.controls.rightAxis??5,rightSign:p.controls.rightSign??-1,fieldRelative:p.controls.fieldRelative??false},checks:{}};
}
export function validateDrivetrain(p:Project):Issue[] {
  const issues:Issue[]=[];const error=(message:string)=>issues.push({level:'error',area:'Hardware',message,subsystems:['drive']});
  const drive=p.motors.filter(m=>m.subsystem==='drive'),type=driveType(p),traction=tractionMotors(p);
  if(!p.subsystems.some(s=>s.id==='drive'))error('The drivetrain subsystem is required.');
  if(new Set(traction.map(m=>`${m.type}:${m.motorKind||'default'}`)).size>1)error('Use the same controller and physical motor model for all traction motors. Steering motors may differ.');
  if(drive.some(m=>m.limit>=0))error('Drive and steering motors cannot use mechanism forward-limit inputs.');
  if(!isHolonomic(p)) {
    for(const side of ['left','right']) {const count=drive.filter(m=>m.role===side).length;if(count<1||count>4)error(`Assign 1–4 ${side} drivetrain motors.`);}
    if(drive.filter(m=>m.role==='left').length!==drive.filter(m=>m.role==='right').length)error('Use equal motor counts on the left and right drive sides.');
    if(drive.some(m=>!['left','right'].includes(m.role)))error('Differential, West Coast, and tank motors need left/right roles.');
  } else {
    if(!p.drive.wheelbase)error('Enter the distance between front and rear wheel centers.');
    const used=new Set<string>();
    const motor=(id:string,description:string,role:'wheel'|'steer')=>{const m=drive.find(m=>m.id===id);if(!m)error(`${description}: assign a motor from the Drivetrain subsystem.`);else if(m.role!==role)error(`${description}: select the ${role==='steer'?'steering':'wheel / drive'} motor role.`);if(id&&used.has(id))error(`${description}: each wheel and steering position needs its own motor.`);if(id)used.add(id);};
    if(type==='mecanum')corners.forEach((c,i)=>motor(p.drive.wheels?.[c]||'',cornerNames[i],'wheel'));
    else {
      const encoders=new Set<string>();
      if(p.drive.modules?.length!==4||new Set(p.drive.modules.map(m=>m.corner)).size!==4)error('Swerve requires one module at each of the four corners.');
      for(const [i,c] of corners.entries()) {
        const m=p.drive.modules?.find(m=>m.corner===c);if(!m)continue;
        motor(m.driveMotor,cornerNames[i]+' drive','wheel');motor(m.steerMotor,cornerNames[i]+' steering','steer');
        const e=p.devices?.find(d=>d.id===m.encoder);
        if(!e||!['cancoder','duty'].includes(productById(e.product)?.adapter||'')||e.subsystem!=='drive')error(`${cornerNames[i]}: assign a CANcoder or roboRIO duty-cycle absolute encoder in the Drivetrain subsystem.`);
        if(e&&e.scale!==1)error(`${cornerNames[i]}: the absolute encoder scale must be 1 (rotations).`);
        if(e&&encoders.has(e.id))error('Each swerve module needs its own absolute encoder.');if(e)encoders.add(e.id);
      }
    }
    if(drive.some(m=>!used.has(m.id)))error('Assign every drivetrain motor to a wheel or module, or move unused motors to another subsystem.');
  }
  const axes=controlStyle(p)==='tank'?[p.controls.forwardAxis,p.controls.rightAxis??5]:isHolonomic(p)?[p.controls.forwardAxis,p.controls.strafeAxis??0,p.controls.turnAxis]:[p.controls.forwardAxis,p.controls.turnAxis];
  if(new Set(axes).size!==axes.length)issues.push({level:'error',area:'Controls',subsystems:['drive'],message:'Each active drive function must use a different controller axis.'});
  return issues;
}
