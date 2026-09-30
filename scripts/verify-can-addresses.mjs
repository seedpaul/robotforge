import {rolldown} from 'rolldown';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const bundle=await rolldown({input:'scripts/library-test-entry.mjs',platform:'node',external:[/^node:/]});
await bundle.write({file:'.verification/can-address-test.mjs',format:'esm'});await bundle.close();
const {initialProject,createDraft,newMotor,newDevice,newProjectDevice,motorCatalog,hardwareCatalog,projectSchema,parseProject,captureCheckpoint,restoreCheckpoint,validate,assembleProject}=await import('../.verification/can-address-test.mjs');
const base=()=>({...structuredClone(initialProject),team:9999});
const errors=p=>validate(p).filter(i=>i.level==='error');
const assets=async name=>new Uint8Array(await fs.readFile('public'+name));
for(const c of motorCatalog.filter(c=>c.connection==='CAN'))assert.equal(newMotor(base(),c.type,'newController','intake').can,null,c.name);
for(const d of hardwareCatalog.filter(d=>d.connection==='CAN')){
 assert.equal(newDevice(d.id,'newDevice','intake').address,null,d.name);
 assert.equal(newProjectDevice(base(),d.id,'newDevice','intake').address,null,d.name+' in library');
}
assert.equal(createDraft().drive.gyroCan,null);
const pending=base();pending.motors[0].can=null;pending.motors[1].can=null;
pending.devices=[newDevice('cancoder','moduleEncoder','drive')];
pending.drive={...pending.drive,gyro:'Pigeon2',gyroCan:null};
assert.ok(projectSchema.safeParse(pending).success,'pending addresses are valid draft data');
assert.deepEqual(parseProject(JSON.stringify(pending)),pending,'save/reload preserves blank addresses');
assert.deepEqual(restoreCheckpoint(captureCheckpoint(pending,'Awaiting CAN configuration')).motors,pending.motors);
assert.equal(errors(pending).filter(i=>i.message.includes('enter the actual CAN ID')).length,4);
assert.ok(!errors(pending).some(i=>i.message.includes('is shared')),'blank IDs are not conflicting address zero');
for(const language of ['Java','C++','Python']){
 for(const clear of [p=>p.motors[0].can=null,p=>p.devices.push(newDevice('pdh','power','drive')),p=>p.drive={...p.drive,gyro:'Pigeon2',gyroCan:null}]){
  const p={...base(),language,devices:[]};clear(p);let reads=0;
  await assert.rejects(()=>assembleProject(p,async()=>{reads++;return new Uint8Array();}));
  assert.equal(reads,0,'block before building an archive');
 }
 const explicit=base();explicit.language=language;
 const ids=[42,0,61,19,8,35];explicit.motors.forEach((m,i)=>m.can=ids[i]);
 explicit.drive={...explicit.drive,gyroCan:null}; // Inactive CAN gyro does not require an ID.
 assert.deepEqual(errors(explicit),[],'non-sequential IDs and ID zero are valid');
 const files=await assembleProject(explicit,assets);
 assert.ok(!files['Configuration.txt']);
 assert.deepEqual(explicit.motors.map(m=>m.can),ids,'export must never renumber entered IDs');
 const duplicate=structuredClone(explicit);duplicate.devices=[{...newDevice('cancoder','encoder','drive'),address:42}];
 assert.ok(errors(duplicate).some(i=>i.message.includes('CAN rio:42 is shared')));
}
for(const invalid of [-1,63,NaN,1.5]){const p=base();p.motors[0].can=invalid;assert.ok(!projectSchema.safeParse(p).success);}
const old=base();assert.deepEqual(parseProject(JSON.stringify(old)),old,'legacy assignments stay unchanged');
console.log('PASS: every CAN profile starts blank; draft/backup/checkpoint persistence; required addresses block all three exports; explicit non-sequential IDs and zero preserved; duplicate and invalid IDs rejected.');
