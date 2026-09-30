import { rolldown } from 'rolldown';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const build=await rolldown({input:'scripts/library-test-entry.mjs',platform:'node',external:[/^node:/]});await build.write({file:'.verification/hardware-test.mjs',format:'esm'});await build.close();
const lib=await import('../.verification/hardware-test.mjs');
const {initialProject,newDevice,hardwareCatalog,productById,validate,assembleProject,motorCatalog,newMotor,filterComponents,motorSchema}=lib;
const base=()=>({...structuredClone(initialProject),team:9999,devices:[]});
assert.deepEqual(motorCatalog.map(m=>m.type).sort(),motorSchema.shape.type.options.slice().sort(),'every generated controller must be discoverable in the component library');
assert.equal(filterComponents('','all','Motor controllers').length,motorCatalog.length);
for(const query of ['SPARK MAX','sparkmax','REV SPARK MAX'])assert.ok(filterComponents(query).some(m=>m.kind==='motor'&&m.type==='SparkMax'),query);
assert.ok(filterComponents('Kraken','WCP','Motor controllers').some(m=>m.type==='TalonFX'));
assert.ok(filterComponents('CANrange','CTRE').some(d=>d.id==='canrange'),'peripheral discovery retained');
let allocation=base();allocation.devices.push({...newDevice('canrange','range','intake'),address:7});allocation.drive.gyro='Pigeon2';allocation.drive.gyroCan=8;
assert.equal(newMotor(allocation,'TalonFX','test').can,null,'CAN IDs are entered explicitly');
allocation.devices.push({...newDevice('servo','servo','intake'),channel:0},{...newDevice('blinkin','lights','intake'),channel:1});
assert.equal(newMotor(allocation,'PWMSpark','pwm').can,2,'PWM allocation includes servo and LED channels, separately from CAN');
allocation.devices=Array.from({length:20},(_,i)=>({...newDevice('servo','s'+i,'intake'),channel:i}));
assert.throws(()=>newMotor(allocation,'PWMSpark','full'),/No free PWM/);
allocation=base();allocation.devices=Array.from({length:63},(_,i)=>({...newDevice('canrange','r'+i,'intake'),address:i}));
assert.equal(newMotor(allocation,'SparkMax','full').can,null,'inventory can be drafted before bus/address configuration');
allocation=base();allocation.language='Python';assert.throws(()=>newMotor(allocation,'ThriftyNova','java'),/Java/);
allocation=base();allocation.motors=Array.from({length:40},(_,i)=>({...allocation.motors[0],id:'m'+i}));assert.throws(()=>newMotor(allocation,'SparkMax','full'),/40 motor/);
for(const language of ['Java','C++','Python'])for(const profile of motorCatalog.filter(m=>!m.javaOnly||language==='Java')){
 const project=base();project.language=language;const motor=newMotor(project,profile.type,'catalogMotor');if(!profile.type.startsWith('PWM'))motor.can=42;project.motors.push(motor);
 assert.ok(motorSchema.safeParse(motor).success);assert.equal(motor.type,profile.type);assert.equal(motor.subsystem,'intake');assert.equal(motor.role,'mechanism');
 assert.deepEqual(validate(project).filter(i=>i.level==='error'),[],language+' '+profile.type);
}
let p=base();p.devices.push({...newDevice('canivore','bus','drive'),bus:'drivebus'});p.motors[0].type='TalonFX';p.motors[0].bus='drivebus';
assert.ok(!validate(p).some(x=>x.message.includes('is shared')),'same numeric ID on separate buses allowed');p.motors[1].bus='drivebus';assert.ok(validate(p).some(x=>x.message.includes('does not support CANivore')));
p=base();p.devices.push({...newDevice('canrange','range','intake'),address:1});assert.ok(validate(p).some(x=>x.message.includes('CAN rio:1 is shared')));
p=base();p.devices.push(newDevice('dio','switch','intake'));p.motors[4].limit=0;assert.ok(validate(p).some(x=>x.message.includes('DIO 0 is shared')));
p=base();p.devices.push(newDevice('distance2m','distance','intake'));assert.ok(validate(p).some(x=>x.message.includes('not available')));
p=base();p.devices.push(newDevice('singleRev','valve','intake'));assert.ok(validate(p).some(x=>x.message.includes('select the matching')));
p=base();p.motors[4].type='ThriftyNova';p.language='Python';assert.ok(validate(p).some(x=>x.message.includes('Java adapter only')));
const assets=async path=>new Uint8Array(await fs.readFile('public'+path));
for(const language of (process.argv.includes('--python-only')?['Python']:['Java','C++','Python'])){
 p=base();p.language=language;p.drive.gyro='Pigeon2';p.drive.gyroCan=60;p.drive.gyroBus='drivebus';
 p.devices.push({...newDevice('canivore','canbus','drive'),bus:'drivebus'});
 let can=10,dio=0,pwm=6,analog=0;const seen=new Set(['canbus','passive','custom']);
 for(const def of hardwareCatalog){if(seen.has(def.adapter))continue;seen.add(def.adapter);const d=newDevice(def.id,'dev'+def.adapter,'intake');
  if(def.connection==='CAN')d.address=can++;
  if(['cancoder','canrange','candi','candle','pigeon'].includes(def.adapter))d.bus='drivebus';
  if(def.connection.startsWith('DIO')){d.channel=dio++;if(def.connection.includes('2'))d.channelB=dio++;}
  if(def.connection==='PWM')d.channel=pwm++;
  if(def.connection==='Analog')d.channel=analog++;
  if(def.adapter==='navx')d.interface='usb1';
  if(def.adapter.startsWith('double')||def.adapter.startsWith('solenoid')){d.module=def.adapter.endsWith('Rev')?'devph':'devpcm';d.channel=def.adapter.startsWith('double')?1:0;d.channelB=2;}
  p.devices.push(d);
 }
 for(const [i,type] of ['SparkFlex','TalonFX','TalonFXS','TalonSRX','VictorSPX','PWMSparkMax','PWMTalonSRX','PWMVictorSPX','PWMSpark','PWMVictor',...(language==='Java'?['ThriftyNova']:[])].entries())p.motors.push({...structuredClone(p.motors[4]),id:'motor'+type,name:type,type,can:type.startsWith('PWM')?i-5:can++,bus:'rio',motorKind:'default'});
 p.commands[0].untilDevice='devdigital';p.commands[0].condition='above';p.commands[0].threshold=.5;
 for(const d of p.devices.filter(d=>lib.isActuator(productById(d.product).adapter)))p.commands.push({id:'cmd'+d.id,name:'Actuate '+d.name,subsystem:'intake',device:d.id,output:.5,timeout:1,untilDevice:'devcanrange',condition:'below',threshold:.1});
 const errors=validate(p).filter(x=>x.level==='error');assert.deepEqual(errors,[]);
 const files=await assembleProject(p,assets);const text=Object.values(files).filter(x=>typeof x==='string').join('\n');assert.ok(text.includes('read_devcanrange'));assert.ok(text.includes('stop_devcandle'));assert.ok(text.includes('drivebus'));
 assert.ok(files['HARDWARE.md'].includes('Limelight'));
 const backup=JSON.parse(files['robotforge-project.json']);assert.ok(backup.libraries.extras.includes('phoenix5'));assert.ok(backup.libraries.extras.includes('navx'));assert.ok(backup.libraries.extras.includes('pwf'));
 if(language==='Java')assert.ok(files['vendordeps/ThriftyLib.json']);
 const dir='.verification/hardware-'+(language==='C++'?'cpp':language.toLowerCase());
 for(const [name,value] of Object.entries(files)){const target=dir+'/'+name;await fs.mkdir(target.slice(0,target.lastIndexOf('/')),{recursive:true});await fs.writeFile(target,value);}
 console.log(language+': '+p.devices.length+' adapters, '+p.motors.length+' motors, '+p.commands.length+' commands');
}
console.log('PASS: hardware addressing, bus restrictions, I/O collisions, module links, language gates, adapter generation and automatic dependencies.');
