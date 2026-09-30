import { projectSchema, validate, type Project, type Issue } from './robot-model';
import { isActuator, productById } from './hardware-catalog';

export type WizardStep = 1 | 2 | 3;
export type WizardPosition = { step: WizardStep; subsystem: string };
export const wizardStart: WizardPosition = { step: 1, subsystem: 'drive' };

/** Navigation is local UI state. Completion always comes from the current robot design. */
export function readWizardPosition(raw: string | null): WizardPosition {
  try {
    const value = JSON.parse(raw || 'null');
    if ([1, 2, 3].includes(value?.step) && typeof value.subsystem === 'string')
      return { step: value.step, subsystem: value.subsystem };
  } catch { /* An old or damaged navigation preference cannot prevent project recovery. */ }
  return { ...wizardStart };
}

/** Legacy robots with drive motors already have a working drivetrain selection. */
export function hasChosenDrivetrain(project: Project): boolean {
  return !!project.drive.type || project.motors.some(m => m.subsystem === 'drive');
}

export function wizardProgress(project: Project, findings: Issue[] = validate(project)) {
  const errors = findings.filter(i => i.level === 'error');
  const configurationErrors = errors.filter(i => i.area === 'Configuration');
  const setupReady = hasChosenDrivetrain(project) && Number.isInteger(project.team) && project.team > 0 && project.team <= 99999
    && !!project.name.trim() && project.name.length <= 60
    && project.subsystems.some(s => s.id === 'drive')
    && project.subsystems.every(s => !!s.name.trim() && s.name.length <= 40)
    && project.subsystems.length <= 20;
  const applicable = (issue: Issue, id: string) => !issue.subsystems?.length || issue.subsystems.includes(id);
  const subsystems = project.subsystems.map(subsystem => {
    const motors = project.motors.filter(m => m.subsystem === subsystem.id);
    const devices = (project.devices || []).filter(d => d.subsystem === subsystem.id);
    const commands = project.commands.filter(c => c.subsystem === subsystem.id);
    const hardwareErrors = [...configurationErrors, ...errors.filter(i => i.area === 'Hardware' && applicable(i, subsystem.id))];
    const commandErrors = [...configurationErrors, ...errors.filter(i =>
      (i.area === 'Commands' || (subsystem.id === 'drive' && i.area === 'Controls')) && applicable(i, subsystem.id))];
    const needsCommands = subsystem.id !== 'drive' && (motors.length > 0 || devices.some(d => isActuator(productById(d.product)?.adapter || 'passive')));
    const hardwareReady = motors.length + devices.length > 0 && hardwareErrors.length === 0;
    const commandsReady = commandErrors.length === 0 && (!needsCommands || commands.length > 0);
    const complete = hardwareReady && commandsReady;
    const status = !hardwareReady ? (motors.length + devices.length ? 'Fix hardware' : 'Add hardware')
      : commandErrors.length ? 'Fix commands' : !commandsReady ? 'Add commands' : 'Configured';
    return { ...subsystem, motors: motors.length, devices: devices.length, commands: commands.length,
      needsCommands, hardwareReady, commandsReady, complete, status, hardwareErrors, commandErrors };
  });
  const hardwareReady = subsystems.length > 0 && subsystems.every(s => s.hardwareReady);
  const commandsReady = hardwareReady && subsystems.every(s => s.commandsReady);
  return { setupReady, hardwareReady, commandsReady, subsystems, errors,
    complete: setupReady && hardwareReady && commandsReady && projectSchema.safeParse(project).success };
}
export type SubsystemProgress = ReturnType<typeof wizardProgress>['subsystems'][number];
