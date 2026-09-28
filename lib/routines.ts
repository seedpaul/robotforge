import { z } from 'zod';
import type { Project, Issue } from './robot-model';

const identifier = z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,39}$/);
export const routineStepSchema = z.discriminatedUnion('type', [
  z.object({ id: identifier, type: z.literal('action'), command: identifier }).strict(),
  z.object({ id: identifier, type: z.literal('wait'), seconds: z.number().finite().min(.05).max(15) }).strict(),
  z.object({ id: identifier, type: z.enum(['parallel', 'race', 'deadline']), commands: z.array(identifier).max(8) }).strict(),
]);
export const routineSchema = z.object({
  id: identifier, name: z.string().min(1).max(40),
  timeout: z.number().finite().min(.05).max(15),
  steps: z.array(routineStepSchema).max(16),
}).strict();
export type Routine = z.infer<typeof routineSchema>;
export type RoutineStep = z.infer<typeof routineStepSchema>;
export const stepLabels = { action: 'Run an action', wait: 'Wait', parallel: 'Together · finish all', race: 'Together · finish first', deadline: 'Together · lead action finishes' };
export const stepHelp = {
  action: 'Runs one existing command. Its sensor condition and timeout still apply.',
  wait: 'Pauses this routine. No new outputs are started during the wait.',
  parallel: 'Starts these actions together. Continues after every action ends.',
  race: 'Starts these actions together. When any action ends, the others stop.',
  deadline: 'The first action leads. When it ends, any remaining actions stop.',
};
export function stepCommands(step: RoutineStep): string[] {
  return step.type === 'wait' ? [] : step.type === 'action' ? [step.command] : step.commands;
}
export function routineRequirements(p: Project, r: Routine) {
  return [...new Set(r.steps.flatMap(stepCommands).map(id => p.commands.find(c => c.id === id)?.subsystem).filter((id): id is string => !!id))];
}
export function availableActions(p: Project) {
  return [...p.commands.map(c => ({ value: c.id, label: c.name })), ...(p.routines || []).map(r => ({ value: r.id, label: r.name + ' · routine' }))];
}
export function routineReferences(p: Project, command: string) {
  return (p.routines || []).filter(r => r.steps.some(s => stepCommands(s).includes(command)));
}
export function validateRoutines(p: Project): Issue[] {
  const issues: Issue[] = [];
  const error = (message: string) => issues.push({ level: 'error', area: 'Logic builder', message });
  const ids = new Set(p.commands.map(c => c.id));
  for (const r of p.routines || []) {
    if (ids.has(r.id)) error(`${r.name}: each command and routine needs a unique identifier.`);
    ids.add(r.id);
    if (!r.steps.length) error(`${r.name}: add at least one block.`);
    if (new Set(r.steps.map(s => s.id)).size !== r.steps.length) error(`${r.name}: duplicate block identifiers.`);
    r.steps.forEach((step, i) => {
      const where = `${r.name}, block ${i + 1}`;
      const commands = stepCommands(step);
      commands.forEach(id => { if (!p.commands.some(c => c.id === id)) error(`${where}: an action is missing. Routines use individual commands, not other routines.`); });
      if (step.type !== 'action' && step.type !== 'wait') {
        if (commands.length < 2) error(`${where}: a together block needs at least two actions.`);
        const owners = new Set<string>();
        for (const id of commands) {
          const c = p.commands.find(c => c.id === id); if (!c) continue;
          if (owners.has(c.subsystem)) error(`${where}: ${p.subsystems.find(s => s.id === c.subsystem)?.name || c.subsystem} cannot run two actions at once. Move one to the next block.`);
          owners.add(c.subsystem);
        }
      }
    });
    if (routineDuration(p, r) > r.timeout) issues.push({ level: 'warning', area: 'Logic builder', message: `${r.name}: the ${r.timeout}s routine limit can stop later blocks early. Sensors may finish actions sooner.` });
  }
  return issues;
}
export function routineDuration(p: Project, r: Routine) {
  return r.steps.reduce((total, s) => {
    if (s.type === 'wait') return total + s.seconds;
    const times = stepCommands(s).map(id => p.commands.find(c => c.id === id)?.timeout || 0);
    return total + (s.type === 'parallel' ? Math.max(0, ...times) : s.type === 'race' ? Math.min(...times, 15) : times[0] || 0);
  }, 0);
}
export function stepSummary(p: Project, s: RoutineStep) {
  if (s.type === 'wait') return `Wait ${s.seconds} seconds`;
  const names = stepCommands(s).map(id => p.commands.find(c => c.id === id)?.name || 'Missing action');
  if (s.type === 'action') return names[0];
  return `${names.join(' + ')} (${s.type === 'parallel' ? 'finish all' : s.type === 'race' ? 'finish first' : 'first action leads'})`;
}

/** The editor and exported project share these exact factories. Each reference creates a fresh command. */
export function routineSource(r: Routine, language: Project['language']) {
  const call = (id: string) => language === 'Java' ? `action_${id}()` : language === 'C++' ? `Action_${id}()` : `self.action(${JSON.stringify(id)})`;
  const expression = (s: RoutineStep): string => {
    if (s.type === 'action') return call(s.command);
    if (s.type === 'wait') return language === 'Java' ? `Commands.waitSeconds(${s.seconds})` : language === 'C++' ? `frc2::cmd::Wait(units::second_t{${s.seconds}})` : `commands2.cmd.waitSeconds(${s.seconds})`;
    const name = s.type === 'parallel' ? 'parallel' : s.type === 'race' ? 'race' : 'deadline';
    return (language === 'Java' ? `Commands.${name}` : language === 'C++' ? `frc2::cmd::${name[0].toUpperCase() + name.slice(1)}` : `commands2.cmd.${name}`) + `(${s.commands.map(call).join(', ')})`;
  };
  const expressions = r.steps.map(expression);
  const name = JSON.stringify(r.name);
  if (language === 'Java') return `private Command action_${r.id}() {\n  return Commands.sequence(\n    ${expressions.join(',\n    ')}\n  ).withTimeout(${r.timeout}).withName(${name});\n}`;
  if (language === 'C++') return `frc2::CommandPtr Action_${r.id}() {\n  return frc2::cmd::Sequence(\n    ${expressions.join(',\n    ')}\n  ).WithTimeout(units::second_t{${r.timeout}}).WithName(${name});\n}`;
  return `def routine_${r.id}(self):\n    return commands2.cmd.sequence(\n        ${expressions.join(',\n        ')}\n    ).withTimeout(${r.timeout}).withName(${name})`;
}

export function logicGuide(p: Project) {
  return '# Robot behavior map\n\nEdit the project in RobotForge and regenerate to keep the visual plan and source aligned. Source edits are not imported back into the visual builder.\n\n## Commands\n\n' + p.commands.map(c => `- **${c.name}**: ${p.subsystems.find(s => s.id === c.subsystem)?.name}; output ${c.output}; maximum ${c.timeout}s${c.untilDevice ? '; stop sensor ' + (p.devices || []).find(d => d.id === c.untilDevice)?.name : ''}.`).join('\n') + '\n\n## Routines\n\n' + (p.routines || []).map(r => `### ${r.name}\nMaximum ${r.timeout}s. Owns: ${routineRequirements(p, r).map(id => p.subsystems.find(s => s.id === id)?.name).join(', ') || 'no mechanisms'}.\n\n` + r.steps.map((s, i) => `${i + 1}. ${stepSummary(p, s)}`).join('\n')).join('\n\n') + '\n\n## Button assignments\n\n' + p.bindings.map(b => `- ${b.controller} button ${b.button}: ${availableActions(p).find(a => a.value === b.command)?.label} (${b.behavior}).`).join('\n') + '\n\nA routine reserves every subsystem used anywhere in it for its full duration, including waits. Another command using one of those subsystems can interrupt the routine. Together blocks cannot share a subsystem. Each action stops its output on end or interruption; a routine timeout cancels its current block. While-held bindings finish at the timeout and need a release and another press to restart. An invalid sensor reading stops its action; it does not automatically cancel later blocks. This plan is not a physics simulation.\n';
}
