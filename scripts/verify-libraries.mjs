import { rolldown } from 'rolldown';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const build = await rolldown({ input: 'scripts/library-test-entry.mjs', platform: 'node', external: [/^node:/] });
await build.write({ file: '.verification/libraries-test.mjs', format: 'esm' }); await build.close();
const lib = await import('../.verification/libraries-test.mjs');
const baseline = lib.bundledLock;
assert.equal(lib.validateLibraryLock(baseline).season, 2026);
assert.equal(lib.isSeasonVersion('2027.0.0'), false);
assert.equal(lib.isSeasonVersion('2026.3.0-beta-1'), false);
assert.ok(lib.compareVersions('2026.10.0','2026.9.0') > 0);
assert.equal(lib.latestPython({releases:{'2027.0.0':[{}],'2026.2.1':[{}],'2026.4.0':[{yanked:true}],'2026.3.0rc1':[{}]}}), '2026.2.1');
assert.equal(lib.registryFile([{name:'photonlib-v2027.0.0.json'},{name:'photonlib-v2026.3.4.json'},{name:'photonlib-v2026.4.0-beta.json'}],'photonvision'),'photonlib-v2026.3.4.json');
for(const change of [m=>m.uuid='00000000-0000-4000-8000-000000000000',m=>m.frcYear='2027',m=>m.version='2026.9.0-beta',m=>m.mavenUrls=['http://127.0.0.1/'],m=>m.javaDependencies[0].groupId='evil.package',m=>m.javaDependencies[0].version='2026.0.5;malicious',m=>m.fileName='../escape.json']) {
  const manifest = structuredClone(baseline.vendors.rev.manifest); change(manifest); assert.throws(()=>lib.validateManifest('rev',manifest));
}
const lowered = structuredClone(baseline); lowered.wpilib='2026.1.1';
assert.equal(lib.mergeNewer(baseline,lowered).wpilib,baseline.wpilib);
const noNetwork = await lib.refreshLibraryCatalog(async()=>{throw Error('Offline test');});
assert.equal(lib.lockKey(noNetwork.lock),lib.lockKey(baseline)); assert.equal(noNetwork.errors.length,18);
const asset = async name=>new Uint8Array(await fs.readFile('public'+name));
for(const language of ['Java','C++','Python']) {
  const p={...structuredClone(lib.initialProject),team:9999,language,libraries:{mode:'frozen',extras:['pwf','navx','photonvision'],lock:baseline}};
  const files=await lib.assembleProject(p,asset);
  const restored=lib.parseProject(files['robotforge-project.json']); assert.equal(restored.libraries.mode,'frozen');
  assert.equal(JSON.parse(files['robotforge-libraries.lock.json']).wpilib,baseline.wpilib);
  if(language==='Python')for(const name of ['robotpy-playingwithfusion','robotpy-navx','photonlibpy'])assert.ok(files['pyproject.toml'].includes(name+'=='));
  else for(const name of ['PlayingWithFusion','Studica','photonlib'])assert.ok(files['vendordeps/'+name+'.json']);
  const dir='.verification/vendor-'+(language==='C++'?'cpp':language.toLowerCase());
  for(const [file,value] of Object.entries(files)){const target=dir+'/'+file;await fs.mkdir(target.slice(0,target.lastIndexOf('/')),{recursive:true});await fs.writeFile(target,value);}
}
const old={...structuredClone(lib.initialProject),team:9999};assert.ok(lib.parseProject(JSON.stringify(old)));assert.equal(lib.librarySettings(old).mode,'automatic');
console.log('PASS: stable-season filtering, yanked releases, vendor identity/repositories, malicious metadata, no downgrade, outage fallback, old backups, three-language optional vendors, exact lockfiles.');
if(process.argv.includes('--live')){
  const live=await lib.refreshLibraryCatalog();
  console.log(JSON.stringify({checked:live.checkedAt,wpilib:live.lock.wpilib,robotpy:live.lock.robotpy,vendors:Object.fromEntries(lib.vendorIds.map(id=>[id,{native:live.lock.vendors[id].manifest.version,python:live.lock.vendors[id].python}])),errors:live.errors},null,2));
  assert.equal(live.errors.length,0,'All publisher feeds should be available in this live verification');
}
