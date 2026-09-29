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
