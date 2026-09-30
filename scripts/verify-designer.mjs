import { rolldown } from 'rolldown';
import assert from 'node:assert/strict';
const bundle=await rolldown({input:'scripts/library-test-entry.mjs',platform:'node',external:[/^node:/]});
await bundle.write({file:'.verification/designer-test.mjs',format:'esm'});await bundle.close();
const {initialProject,createDraft,placeSubsystem,moveSubsystem,subsystemKind,subsystemPlacement,subsystemTemplates,parseProject,wizardProgress,captureCheckpoint,restoreCheckpoint,generateSources,compareProjects}=await import('../.verification/designer-test.mjs');
const base={...structuredClone(initialProject),team:9999,checks:{mechanical:true}};
const original=JSON.stringify(base);
assert.equal(subsystemKind(base,base.subsystems[1]),'intake','legacy subsystems receive an appropriate icon');
const addition=placeSubsystem(base,'turret',{x:.8,y:.35},'turretOne');
const robot={...base,...addition.patch};
assert.equal(addition.subsystemId,'turretOne');
assert.equal(robot.subsystems.at(-1).layout.kind,'turret');
assert.equal(robot.subsystems.at(-1).layout.x,.8);
assert.deepEqual(robot.motors,base.motors,'placing an icon must not invent hardware');
assert.deepEqual(robot.commands,base.commands);
assert.deepEqual(robot.bindings,base.bindings);
assert.deepEqual(robot.auto,base.auto);
assert.equal(wizardProgress(robot).subsystems.at(-1).complete,false);
const duplicate={...robot,...placeSubsystem(robot,'turret',{x:.2,y:.5},'turretTwo').patch};
assert.equal(duplicate.subsystems.at(-1).name,'Turret 2');
assert.throws(()=>placeSubsystem(robot,'turret',{x:.5,y:.5},'turretOne'));
const moved={...robot,...moveSubsystem(robot,'turretOne',{x:4,y:-3})};
assert.deepEqual(subsystemPlacement(moved,moved.subsystems.at(-1)),{x:.86,y:.18},'dragging is bounded by the chassis');
assert.deepEqual(moved.checks,robot.checks,'moving a diagram node preserves physical check confirmations');
assert.deepEqual(parseProject(JSON.stringify(moved)),moved,'layout survives project export/import');
const restored=restoreCheckpoint(captureCheckpoint(moved,'Turret placed'));
assert.deepEqual(restored.subsystems,moved.subsystems,'checkpoints retain positions and icon types');
assert.equal(compareProjects(robot,moved).filter(c=>c.area==='Subsystems').length,1);
for(const language of ['Java','C++','Python']) {
  const before=generateSources({...robot,language}),after=generateSources({...moved,language});
  // Python embeds the project as data; layout fields are ignored by the control logic.
  for(const key of Object.keys(before)){if(before[key].includes('CONFIG = json.loads'))continue;assert.equal(before[key],after[key],language+': '+key+' is unchanged by visual movement');}
  assert.deepEqual(robot.drive,moved.drive);assert.deepEqual(robot.motors,moved.motors);assert.deepEqual(robot.controls,moved.controls);
}
let changed={...robot,...placeSubsystem(robot,'swerve',{x:.3,y:.5},'ignoredDriveId').patch};
assert.equal(changed.subsystems.filter(s=>s.id==='drive').length,1,'dropping a drive replaces the chassis type, not its subsystem');
assert.equal(changed.drive.type,'swerve');
assert.deepEqual(changed.motors.filter(m=>m.subsystem!=='drive'),robot.motors.filter(m=>m.subsystem!=='drive'));
assert.deepEqual(changed.commands,robot.commands);
assert.equal(wizardProgress(changed).subsystems.find(s=>s.id==='drive').hardwareReady,false,'swerve must be wired and assigned before it is complete');
changed={...changed,...placeSubsystem(changed,'differential',{x:.5,y:.5},'ignoredAgain').patch};
assert.equal(changed.subsystems.filter(s=>s.id==='drive').length,1);
for(const template of subsystemTemplates){const r={...createDraft(),...placeSubsystem(createDraft(),template.kind,{x:.5,y:.4},'aMechanism').patch};assert.doesNotThrow(()=>parseProject(JSON.stringify(r)),template.kind);}
assert.throws(()=>parseProject(JSON.stringify({...robot,subsystems:robot.subsystems.map(s=>s.id==='turretOne'?{...s,layout:{kind:'unknown',x:0,y:0}}:s)})));
assert.throws(()=>parseProject(JSON.stringify({...robot,subsystems:robot.subsystems.map(s=>s.id==='turretOne'?{...s,layout:{kind:'turret',x:5,y:0}}:s)})));
const full={...base,subsystems:[...base.subsystems,...Array.from({length:17},(_,i)=>({id:'part'+i,name:'Part '+i,description:''}))]};
assert.throws(()=>placeSubsystem(full,'intake',{x:.5,y:.5},'tooMany'));
assert.doesNotThrow(()=>placeSubsystem(full,'tank',{x:.5,y:.5},'stillOneDrive'));
assert.equal(JSON.stringify(base),original,'existing projects are not mutated');
console.log('PASS: subsystem placement, unique IDs/names, drive replacement, safe bounds, legacy icons, import/checkpoint persistence, and unchanged code across Java/C++/Python.');

const {hasChosenDrivetrain,placeComponent,moveComponent,subsystemComponents,componentPosition,newProjectDevice,hardwareCatalog,projectSchema}=await import('../.verification/designer-test.mjs');
assert.equal(hasChosenDrivetrain(createDraft()),false);
assert.equal(hasChosenDrivetrain(base),true,'legacy robot keeps its drivetrain');
const chosen={...createDraft(),...placeSubsystem(createDraft(),'differential',{x:.5,y:.5},'ignored').patch};
assert.equal(chosen.drive.type,'differential','the first differential choice must be explicit');
assert.ok(hasChosenDrivetrain(chosen));
assert.equal(wizardProgress({...chosen,team:54321}).setupReady,true,'five-digit team numbers are supported');
let assembled={...robot,team:54321};
assembled={...assembled,...placeComponent(assembled,'turretOne','motor-SparkMax','turretController',{x:.2,y:.2})};
const motor=assembled.motors.at(-1);
assert.equal(motor.subsystem,'turretOne');
assert.equal(motor.can,null,'new CAN controllers require the actual hardware ID');
assert.deepEqual(parseProject(JSON.stringify(assembled)).motors.at(-1).can,null);
motor.can=42; // Team-entered address; visual-layout comparisons below need an exportable project.
assert.deepEqual(assembled.checks,{},'adding hardware resets commissioning confirmations');
const dio=hardwareCatalog.find(d=>d.adapter==='digital').id;
const quad=hardwareCatalog.find(d=>d.adapter==='quadrature').id;
assembled={...assembled,...placeComponent(assembled,'turretOne',dio,'limitOne',{x:.5,y:.5})};
assembled={...assembled,...placeComponent(assembled,'intake',quad,'otherEncoder',{x:.5,y:.5})};
assert.equal(assembled.devices[0].channel,0);
assert.equal(assembled.devices[1].channel,1);
assert.equal(assembled.devices[1].channelB,2,'two-port feedback gets two unoccupied DIO channels');
const limit=newProjectDevice(assembled,dio,'limitTwo','turretOne');
assert.equal(limit.channel,3);assert.notEqual(limit.name,assembled.devices[0].name);
const pwmMotor={...assembled,...placeComponent(assembled,'turretOne','motor-PWMSpark','pwmMotor',{x:.3,y:.7})};
const servo=newProjectDevice(pwmMotor,hardwareCatalog.find(d=>d.adapter==='servo').id,'servoOne','turretOne');
assert.equal(servo.channel,1,'servos avoid PWM controller channels');
const canSensor=newProjectDevice({...assembled,drive:{...assembled.drive,gyro:'Pigeon2',gyroCan:8}},hardwareCatalog.find(d=>d.adapter==='cancoder').id,'canEncoder','turretOne');
assert.equal(canSensor.address,null,'CAN sensors never receive a guessed address');
const positionsBefore=JSON.stringify(assembled);
const positioned={...assembled,...moveComponent({...assembled,checks:{mechanical:true}},'turretOne','motor:turretController',{x:10,y:-5})};
assert.deepEqual(componentPosition(positioned,'turretOne','motor:turretController'),{x:.87,y:.14});
assert.equal(positioned.checks.mechanical,true,'visual movement preserves commissioning confirmations');
assert.equal(JSON.stringify(assembled),positionsBefore,'component placement never mutates the previous revision');
assert.deepEqual(parseProject(JSON.stringify(positioned)),positioned,'hardware layout survives import');
assert.deepEqual(restoreCheckpoint(captureCheckpoint(positioned,'Assembled')).subsystems,positioned.subsystems,'hardware layout survives checkpoints');
assert.equal(subsystemComponents(positioned,'turretOne').length,2);
for(const language of ['Java','C++','Python']){
 const before=generateSources({...assembled,language}),after=generateSources({...positioned,language});
 for(const key of Object.keys(before)){if(before[key].includes('CONFIG = json.loads'))continue;assert.equal(before[key],after[key],language+' visual hardware movement must not alter '+key);}
}
assert.throws(()=>placeComponent(assembled,'missing','motor-SparkMax','bad',{x:.5,y:.5}));
assert.throws(()=>placeComponent(assembled,'turretOne','motor-SparkMax','turretController',{x:.5,y:.5}));
assert.throws(()=>placeComponent({...assembled,language:'Python'},'turretOne','motor-ThriftyNova','unsupported',{x:.5,y:.5}));
assert.throws(()=>moveComponent(assembled,'intake','motor:turretController',{x:.5,y:.5}));
const invalid=structuredClone(positioned);invalid.subsystems.at(-1).componentLayout['motor:turretController'].x=2;
assert.equal(projectSchema.safeParse(invalid).success,false);
const fullDio={...assembled,devices:Array.from({length:26},(_,channel)=>({...limit,id:'occupied'+channel,channel}))};
assert.throws(()=>newProjectDevice(fullDio,dio,'overflow','turretOne'),/No free DIO/);
console.log('PASS: drivetrain-first flow, five-digit teams, component placement, global port allocation, immutable movement, persistence and unchanged generated behavior.');
