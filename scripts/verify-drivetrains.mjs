import { rolldown } from 'rolldown';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const bundle=await rolldown({input:'scripts/library-test-entry.mjs',platform:'node',external:[/^node:/]});
await bundle.write({file:'.verification/drivetrain-test.mjs',format:'esm'});await bundle.close();
const {initialProject,selectDrivetrain,driveTypes,controlStyle,corners,newDevice,validate,parseProject,assembleProject,drivetrainUnits,addDriveComponent,assignDriveComponent,existingDriveOptions,compatibleDriveProfile,captureCheckpoint,restoreCheckpoint}=await import('../.verification/drivetrain-test.mjs');
const base=()=>({...structuredClone(initialProject),team:9999});
const errors=p=>validate(p).filter(i=>i.level==='error');
const fixture=type=>{
 let p=base();p={...p,...selectDrivetrain(p,type)};if(['swerve','mecanum'].includes(type))p.controls.fieldRelative=true;
 if(type==='swerve'){
  p.devices=[];
  for(const [i,m] of p.drive.modules.entries()){
   const steer={...p.motors[0],id:'steer'+i,name:'Steering '+i,can:10+i,type:i%2?'TalonFXS':'SparkMax',role:'steer',inverted:false};
   p.motors.push(steer);m.steerMotor=steer.id;m.encoder='absolute'+i;m.offset=i===2?-.2:i===1?.125:0;
   p.devices.push({...newDevice(i%2?'duty':'cancoder',m.encoder,'drive'),channel:i,address:20+i});
  }
 }
 return p;
};
// Old backups remain differential; switching layouts does not delete unrelated work.
assert.equal(controlStyle(parseProject(JSON.stringify(initialProject))),'arcade');
for(const type of driveTypes.map(t=>t.value)){
 const p=fixture(type);assert.deepEqual(errors(p),[],type);assert.deepEqual(p.commands,initialProject.commands);assert.deepEqual(p.bindings,initialProject.bindings);
 assert.deepEqual(p.motors.filter(m=>m.subsystem!=='drive'),initialProject.motors.filter(m=>m.subsystem!=='drive'));
 assert.deepEqual(parseProject(JSON.stringify(p)),p);
}
for(const count of [1,3,4]){const p=base();p.motors=p.motors.filter(m=>m.subsystem!=='drive');for(const role of ['left','right'])for(let i=0;i<count;i++)p.motors.push({...initialProject.motors[0],id:role+i,role,can:(role==='left'?10:20)+i});assert.deepEqual(errors(p),[],`differential ${count} motors per side`);}
for(const [name,change] of [
 ['missing steering',p=>p.drive.modules[0].steerMotor=''],
 ['duplicate motor',p=>p.drive.modules[1].driveMotor=p.drive.modules[0].driveMotor],
 ['missing encoder',p=>p.devices.pop()],
 ['duplicate encoder',p=>p.drive.modules[1].encoder=p.drive.modules[0].encoder],
 ['invalid encoder units',p=>p.devices[0].scale=360],
 ['missing corner',p=>p.drive.modules[0].corner='backRight'],
 ['non-finite offset',p=>p.drive.modules[0].offset=NaN],
 ['overlapping axes',p=>p.controls.strafeAxis=p.controls.forwardAxis],
 ['unassigned motor',p=>p.motors.push({...p.motors[0],id:'orphan',can:50})],
]){const p=fixture('swerve');change(p);assert.ok(errors(p).length,name);await assert.rejects(()=>assembleProject(p,async()=>new Uint8Array()));}
const badMecanum=fixture('mecanum');badMecanum.drive.wheels.frontLeft=badMecanum.drive.wheels.frontRight;assert.ok(errors(badMecanum).length);
const assets=async name=>new Uint8Array(await fs.readFile('public'+name));
for(const type of driveTypes.map(t=>t.value))for(const language of ['Java','C++','Python']){
 const p=fixture(type);p.language=language;const files=await assembleProject(p,assets);
 assert.ok(!files['Configuration.txt'],type+' '+language);assert.ok(files['DRIVETRAIN.md']);
 const settings=JSON.parse(files[(language==='Python'?'deploy/':'src/main/deploy/')+'pathplanner/settings.json']);
 assert.equal(settings.holonomicMode,['swerve','mecanum'].includes(type));
 const sources=Object.entries(files).filter(([name])=>/\.(java|cpp|py)$/.test(name)).map(([,v])=>v).join('\n');
 if(type==='swerve'){assert.match(sources,/SwerveDrive/);assert.match(sources,/PPHolonomicDriveController/);assert.match(sources,/read_absolute0/);assert.equal(settings.flModuleY,-settings.frModuleY);}
 if(type==='mecanum'){assert.match(sources,/MecanumDrive/);assert.match(sources,/HolonomicDriveController/);assert.match(sources,/follow_path|FollowPath|followPath/);}
 if(type==='tank')assert.match(sources,/drive\.(tank|Tank)\(/);
 if(['swerve','mecanum','tank'].includes(type)){
  const dir='.verification/drive-'+type+'-'+(language==='C++'?'cpp':language.toLowerCase());
  for(const [name,value] of Object.entries(files)){const target=dir+'/'+name;await fs.mkdir(target.slice(0,target.lastIndexOf('/')),{recursive:true});await fs.writeFile(target,value);}
 }
}
// Build actual projects through the same physical-unit operations used by the wizard.
const unitFixture=type=>{
 let p=base();p.motors=p.motors.filter(m=>m.subsystem!=='drive');p.devices=[];p={...p,...selectDrivetrain(p,type)};
 const untouched=JSON.stringify(p),original=p;
 assert.equal(drivetrainUnits(p).length,['swerve','mecanum'].includes(type)?4:2);
 for(const unit of drivetrainUnits(p)){
  assert.equal(unit.complete,false);
  p={...p,...addDriveComponent(p,unit.id,'drive','motor-SparkMax','drive_'+unit.id)};
  if(type==='swerve'){
   p={...p,...addDriveComponent(p,unit.id,'steer','motor-TalonFXS','steer_'+unit.id)};
   p={...p,...addDriveComponent(p,unit.id,'encoder','cancoder','encoder_'+unit.id)};
  }else{
   p={...p,...addDriveComponent(p,unit.id,'encoder','quad','encoder_'+unit.id)};
   if(unit.kind==='side')p={...p,...addDriveComponent(p,unit.id,'drive','motor-SparkMax','second_'+unit.id)};
  }
 }
 assert.equal(JSON.stringify(original),untouched,'assembly must not mutate prior project/checkpoint');
 const pending=[...p.motors.filter(m=>m.subsystem==='drive'),...p.devices.filter(d=>d.product==='cancoder')];
 assert.ok(pending.every(c=>('can' in c?c.can:c.address)===null),'new drivetrain CAN addresses start blank');
 assert.ok(errors(p).some(i=>i.message.includes('enter the actual CAN ID')));
 const entered=[31,12,48,9,27,44,2,57,19,35,41,53];
 pending.forEach((c,i)=>{if('can' in c)c.can=entered[i];else c.address=entered[i];});
 assert.ok(drivetrainUnits(p).every(u=>u.complete));
 assert.deepEqual(errors(p),[],type+' unit assembly');
 assert.deepEqual(p.commands,initialProject.commands);assert.deepEqual(p.bindings,initialProject.bindings);
 assert.deepEqual(parseProject(JSON.stringify(p)),p);
 const restored=restoreCheckpoint(captureCheckpoint(p,'Unit assembly','All corners'));
 assert.deepEqual(restored.drive,p.drive,'checkpoint preserves physical assignments');
 assert.throws(()=>addDriveComponent(p,drivetrainUnits(p)[0].id,'encoder',type==='swerve'?'cancoder':'quad','duplicate'),/filled/);
 assert.throws(()=>assignDriveComponent(p,drivetrainUnits(p)[1].id,'encoder',drivetrainUnits(p)[0].encoder.id),/another drive unit/);
 return p;
};
for(const type of driveTypes.map(t=>t.value))unitFixture(type);
let swerve=unitFixture('swerve');
assert.throws(()=>assignDriveComponent(swerve,'frontLeft','steer','drive_frontLeft'),/separate motors/);
swerve={...swerve,...assignDriveComponent(swerve,'frontLeft','drive','')};
assert.ok(existingDriveOptions(swerve,'drive').some(o=>o.id==='drive_frontLeft'));
swerve={...swerve,...assignDriveComponent(swerve,'frontLeft','drive','drive_frontLeft')};
assert.ok(drivetrainUnits(swerve)[0].complete);
assert.equal(compatibleDriveProfile(swerve,'quad','encoder'),false);
assert.equal(compatibleDriveProfile(swerve,'motor-TalonFXS','drive'),false);
assert.equal(compatibleDriveProfile(swerve,'motor-TalonFXS','steer'),true);
let tank=unitFixture('tank');const motorCount=tank.motors.length;
tank={...tank,...assignDriveComponent(tank,'right','drive','drive_left')};
assert.equal(tank.motors.length,motorCount);assert.equal(drivetrainUnits(tank)[1].motors.length,3);
tank={...tank,...addDriveComponent(tank,'right','drive','motor-SparkMax','fourthRight')};
assert.throws(()=>addDriveComponent(tank,'right','drive','motor-SparkMax','fifthRight'),/four motors/);
assert.equal(compatibleDriveProfile(tank,'cancoder','encoder'),false);
for(const change of [p=>p.drive.tractionEncoders.left='missing',p=>p.drive.tractionEncoders.right=p.drive.tractionEncoders.left,p=>p.devices[0].subsystem='intake',p=>p.devices[0].product='duty']){
 const p=unitFixture('differential');change(p);assert.ok(errors(p).length);await assert.rejects(()=>assembleProject(p,assets));
}
for(const type of ['differential','mecanum'])for(const language of ['Java','C++','Python']){
 const p=unitFixture(type);p.language=language;
 p.devices.forEach(d=>{d.scale=.01;d.offset=.25;});
 const files=await assembleProject(p,assets),sources=Object.entries(files).filter(([n])=>/\.(java|cpp|py)$/.test(n)).map(([,v])=>v).join('\n');
 const keys=type==='mecanum'?corners:['left','right'];
 for(const key of keys){assert.match(sources,new RegExp('read_encoder_'+key));assert.match(sources,new RegExp('rate_encoder_'+key));}
 const dir='.verification/units-'+type+'-'+(language==='C++'?'cpp':language.toLowerCase());
 for(const [name,value] of Object.entries(files)){const target=dir+'/'+name;await fs.mkdir(target.slice(0,target.lastIndexOf('/')),{recursive:true});await fs.writeFile(target,value);}
}
console.log('PASS: 21 drivetrain/language exports; physical module/side/wheel assembly, unique assignments, incremental hardware reuse, optional encoder validation/feedback, checkpoint round trips, legacy backups, invalid-export blocking.');
