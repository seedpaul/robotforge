import { rolldown } from 'rolldown';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const bundle = await rolldown({ input: 'scripts/library-test-entry.mjs', platform: 'node', external: [/^node:/] });
await bundle.write({ file: '.verification/routine-test.mjs', format: 'esm' }); await bundle.close();
const { initialProject, parseProject, projectSchema, validate, assembleProject, routineSource, routineRequirements } = await import('../.verification/routine-test.mjs');
const base = () => ({ ...structuredClone(initialProject), team: 9999, routines: [] });
const action = (command, id = 'block') => ({ id, type: 'action', command });
const routine = (steps, id = 'routine') => ({ id, name: id, timeout: 15, steps });
let p = base();
assert.equal(parseProject(JSON.stringify(initialProject)).routines, undefined, 'existing projects still import');
p.routines = [routine([])]; assert.ok(validate(p).some(i => i.message.includes('add at least one')));
p.routines = [routine([action('missing')])]; assert.ok(validate(p).some(i => i.message.includes('action is missing')));
p.routines = [routine([action('routine')])]; assert.ok(validate(p).some(i => i.message.includes('not other routines')));
p.routines = [routine([action('collect')], 'collect')]; assert.ok(validate(p).some(i => i.message.includes('unique identifier')));
p.routines = [routine([action('collect'), action('shoot')])]; assert.ok(validate(p).some(i => i.message.includes('duplicate block')));
p.routines = [routine([{ id: 'together', type: 'parallel', commands: ['collect', 'collect'] }])]; assert.ok(validate(p).some(i => i.message.includes('cannot run two actions')));
p.commands.push({ ...p.commands[0], id: 'reverse', name: 'Reverse', output: -.2 });
p.routines = [routine([{ id: 'together', type: 'race', commands: ['collect', 'reverse'] }])]; assert.ok(validate(p).some(i => i.message.includes('cannot run two actions')));
p.routines = [routine([{ id: 'wait', type: 'wait', seconds: 0 }])]; assert.equal(projectSchema.safeParse(p).success, false);
p = base();
p.routines = [routine([action('collect', 'a'), { id: 'w', type: 'wait', seconds: .5 }, action('collect', 'b')])];
assert.deepEqual(routineRequirements(p, p.routines[0]), ['intake']);
p.routines[0].timeout = .1; assert.ok(validate(p).some(i => i.level === 'warning' && i.message.includes('later blocks')));
p.routines[0].timeout = 15;
p.bindings[0].command = 'routine'; p.auto.steps.push({ id: 'r', type: 'command', command: 'routine', seconds: 1 });
assert.deepEqual(validate(p).filter(i => i.level === 'error'), []);
const exported = await assembleProject(p, async path => new Uint8Array(await fs.readFile('public' + path)));
assert.ok(exported['src/main/deploy/pathplanner/autos/LeaveStart.auto'].includes('"name": "routine"'));
assert.ok(exported['LOGIC.md'].includes('reserves every subsystem'));

for (const language of ['Java', 'C++', 'Python']) {
  p = base(); p.language = language;
  p.commands[0].timeout = .4; p.commands[1].timeout = .8;
  // Exercise legacy package compatibility with the installed test environment too.
  p.motors.find(m => m.id === 'shooterMotor').type = 'TalonSRX';
  p.routines = [
    routine([action('collect', 'a'), { id: 'w', type: 'wait', seconds: .1 }, action('collect', 'b')], 'sequence'),
    ...['parallel', 'race', 'deadline'].map(type => routine([{ id: 'group', type, commands: ['collect', 'shoot'] }], type)),
    { ...routine([{ id: 'group', type: 'parallel', commands: ['collect', 'shoot'] }], 'bounded'), timeout: .15 },
    routine([{ id: 'w', type: 'wait', seconds: .1 }], 'pause'),
  ];
  p.bindings[0].command = 'sequence';
  p.bindings[1].command = 'parallel';
  p.auto.steps.push({ id: 'routineAuto', type: 'command', command: 'deadline', seconds: 1 });
  assert.deepEqual(validate(p).filter(i => i.level === 'error'), []);
  assert.deepEqual(parseProject(JSON.stringify(p)), p, 'routine project roundtrip');
  const files = await assembleProject(p, async path => new Uint8Array(await fs.readFile('public' + path)));
  const sourceFile = language === 'Java' ? 'src/main/java/frc/robot/RobotContainer.java' : language === 'C++' ? 'src/main/cpp/Robot.cpp' : 'robot.py';
  assert.ok(files[sourceFile].replaceAll(/\s+/g, '').includes(routineSource(p.routines[0], language).replaceAll(/\s+/g, '')), 'preview factory is the exported factory');
  const dir = '.verification/routines-' + (language === 'C++' ? 'cpp' : language.toLowerCase());
  for (const [file, content] of Object.entries(files)) { await fs.mkdir(dir + '/' + file.split('/').slice(0, -1).join('/'), { recursive: true }); await fs.writeFile(dir + '/' + file, content); }
  if (language === 'Python') {
    await fs.mkdir(dir + '/tests', { recursive: true });
    await fs.copyFile('scripts/verify-routines-runtime.py', dir + '/tests/test_routines.py');
    await fs.writeFile(dir + '/tests/test_modes.py', 'from pyfrc.tests import *\n');
  }
  console.log(`${language}: six routines exported with sequence, all/first/lead finish, timeout, button + autonomous references.`);
}
console.log('Routine validation, migration, ownership, preview/export agreement, and archive checks passed.');
