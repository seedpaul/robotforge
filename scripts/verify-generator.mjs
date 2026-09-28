import ts from 'typescript';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=process.cwd();const tmp=path.join(root,'.verification/js');await fs.mkdir(tmp,{recursive:true});
for(const name of ['robot-model','zip','generator','gen-java','gen-python','gen-cpp']){const source=await fs.readFile(`lib/${name}.ts`,'utf8');const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(.\/[\w-]+)'/g,"from '$1.mjs'");await fs.writeFile(path.join(tmp,name+'.mjs'),js);}
const {initialProject,validate,parseProject}=await import('../.verification/js/robot-model.mjs');
const {assembleProject,pathFiles}=await import('../.verification/js/generator.mjs');
const {zip}=await import('../.verification/js/zip.mjs');
const fixture=()=>({...structuredClone(initialProject),team:9999});
const good=fixture();assert.equal(validate(good).filter(x=>x.level==='error').length,0);
const cases=[['CAN collision',p=>p.motors[1].can=p.motors[0].can],['Controller port collision',p=>p.controls.operatorPort=p.controls.driverPort],['Unknown command',p=>p.bindings[0].command='missing'],['Output overflow',p=>p.commands[0].output=3],['Path too fast',p=>p.auto.maxSpeed=6],['Coincident waypoints',p=>p.auto.waypoints[1]=p.auto.waypoints[0]],['Invalid drive role',p=>p.motors[0].role='mechanism'],['NaN input',p=>p.drive.mass=NaN],['Unknown subsystem',p=>p.motors[0].subsystem='missing'],['Missing team',p=>p.team=0]];
for(const [name,change] of cases){const p=fixture();change(p);assert.ok(validate(p).some(x=>x.level==='error'),name);await assert.rejects(()=>assembleProject(p,async()=>new Uint8Array()));}
assert.throws(()=>parseProject('{"schema":2}'));assert.throws(()=>parseProject('null'));
for(const language of ['Java','C++','Python']){const p={...good,language};const files=await assembleProject(p,async name=>new Uint8Array(await fs.readFile(path.join(root,'public',name))));const dest=path.join(root,'.verification',language==='C++'?'cpp':language.toLowerCase());for(const [file,value] of Object.entries(files)){await fs.mkdir(path.dirname(path.join(dest,file)),{recursive:true});await fs.writeFile(path.join(dest,file),value);}await fs.writeFile(dest+'.zip',zip(files));assert.ok(Object.keys(files).length>6);console.log(`${language}: generated ${Object.keys(files).length} files`);}
const paths=pathFiles(good);const route=JSON.parse(paths['pathplanner/paths/LeaveStart.path']);assert.equal(route.waypoints.length,3);assert.equal(route.waypoints[0].prevControl,null);assert.equal(route.waypoints.at(-1).nextControl,null);console.log('PASS: invalid configurations blocked; Java/C++/Python archives generated; PathPlanner geometry checked.');
