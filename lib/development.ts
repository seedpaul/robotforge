import { z } from 'zod';
import { projectSchema, type Project, type Motor } from './robot-model';
import { librarySettings } from './library-project';
import { selectedVendors, vendorRegistry } from './libraries';
import { productById } from './hardware-catalog';

export const HISTORY_LIMIT = 40;
export const checkpointSchema = z.object({
  id: z.string().regex(/^checkpoint_[a-zA-Z0-9_-]{1,80}$/),
  name: z.string().min(1).max(80), notes: z.string().max(1000),
  createdAt: z.string().datetime(),
  reason: z.enum(['manual', 'before-import', 'before-restore', 'before-addition']),
  project: projectSchema,
}).strict();
export type Checkpoint = z.infer<typeof checkpointSchema>;
export function captureCheckpoint(project: Project, name: string, notes = '', reason: Checkpoint['reason'] = 'manual'): Checkpoint {
  const parsed = projectSchema.parse(project);
  const settings = librarySettings(parsed);
  return checkpointSchema.parse({ id: 'checkpoint_' + crypto.randomUUID(), name: name.trim(), notes, createdAt: new Date().toISOString(), reason,
    project: structuredClone({ ...parsed, libraries: { mode: settings.mode, extras: settings.extras, lock: settings.lock } }) });
}
export function restoreCheckpoint(checkpoint: Checkpoint): Project {
  const p = checkpointSchema.parse(checkpoint).project;
  const settings = librarySettings(p);
  // Keep the exact dependency versions captured with this design; checks must be repeated.
  return structuredClone({ ...p, checks: {}, libraries: { ...settings, mode: 'frozen' } });
}
export const historyFileSchema = z.object({ format: z.literal('robotforge-development'), version: z.literal(1), exportedAt: z.string().datetime(), checkpoints: z.array(checkpointSchema).max(HISTORY_LIMIT) }).strict();
export function historyFile(checkpoints: Checkpoint[]) { return JSON.stringify(historyFileSchema.parse({ format: 'robotforge-development', version: 1, exportedAt: new Date().toISOString(), checkpoints }), null, 2); }
export function parseHistory(text: string): Checkpoint[] {
  if (text.length > 20 * 1024 * 1024) throw Error('History backups must be under 20 MB.');
  const items = historyFileSchema.parse(JSON.parse(text)).checkpoints;
  if (new Set(items.map(c => c.id)).size !== items.length) throw Error('History backup contains duplicate checkpoint identifiers.');
  for (const c of items) librarySettings(c.project);
  return items;
}
export function mergeHistory(existing: Checkpoint[], incoming: Checkpoint[]): Checkpoint[] {
  const map = new Map(existing.map(c => [c.id, c]));
  for (const c of incoming) {
    const prior = map.get(c.id);
    if (prior && stable(prior) !== stable(c)) throw Error('A checkpoint identifier conflicts with a different saved version. No history was imported.');
    map.set(c.id, c);
  }
  if (map.size > HISTORY_LIMIT) throw Error(`Keep up to ${HISTORY_LIMIT} checkpoints. Download your history, then remove older checkpoints before importing more.`);
  return [...map.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
function stable(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).filter(([,v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => JSON.stringify(k) + ':' + stable(v)).join(',') + '}';
  return JSON.stringify(value) ?? 'null';
}
export type DesignChange = { area: string; name: string; kind: 'added' | 'removed' | 'changed'; details: string[] };
const labels: Record<string, string> = { name: 'Name', type: 'Type', can: 'CAN ID / PWM', address: 'CAN ID', bus: 'CAN bus', subsystem: 'Subsystem', inverted: 'Inversion', current: 'Current limit', motorKind: 'Motor model', limit: 'Limit port', role: 'Drive role', sensorSign: 'Encoder direction', channel: 'Channel', channelB: 'Second channel', description: 'Description', notes: 'Notes', scale: 'Scale', offset: 'Offset', device: 'Output device', untilDevice: 'Stop sensor', condition: 'Comparison', threshold: 'Threshold', output: 'Output', timeout: 'Timeout', command: 'Action', button: 'Button', behavior: 'Button behavior', controller: 'Controller', module: 'Parent module', seconds: 'Seconds', gyro: 'Gyro', gyroCan: 'Gyro CAN ID', trackWidth: 'Track width', wheelDiameter: 'Wheel diameter', gearing: 'Gear ratio', maxSpeed: 'Maximum speed', maxAcceleration: 'Acceleration', waypoints: 'Waypoints', steps: 'Blocks / steps', pulseMin: 'Minimum pulse', pulseMax: 'Maximum pulse', table: 'Camera table', compressor: 'Compressor', interface: 'Connection', product: 'Component profile' };
function label(key: string) { return labels[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, x => x.toUpperCase()); }
function valueText(value: unknown, key?: string, project?: Project) {
  if (value === undefined || value === null || typeof value === 'number' && !Number.isFinite(value)) return 'not set';
  if (Array.isArray(value)) return `${value.length} items`;
  if (typeof value === 'object') return 'settings';
  if (project && typeof value === 'string') {
    const items = key === 'subsystem' ? project.subsystems : key === 'command' ? [...project.commands, ...project.routines || []] : ['device', 'untilDevice', 'module'].includes(key || '') ? project.devices || [] : [];
    const item = items.find(i => i.id === value);
    if (item) return item.name;
  }
  const text = String(value); return text.length > 90 ? text.slice(0, 87) + '…' : text;
}
function fields(before: Record<string, unknown>, after: Record<string, unknown>, beforeProject?: Project, afterProject?: Project) {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(k => k !== 'id' && stable(before[k]) !== stable(after[k])).map(k => `${label(k)}: ${valueText(before[k], k, beforeProject)} → ${valueText(after[k], k, afterProject)}${typeof before[k] === 'object' || typeof after[k] === 'object' ? ' (contents changed)' : ''}`);
}
function libraryDesign(p: Project) {
  const settings = librarySettings(p);
  return { mode: settings.mode, wpilib: settings.lock.wpilib, robotpy: settings.lock.robotpy,
    vendors: Object.fromEntries(selectedVendors(settings).sort().map(id => [id, { native: settings.lock.vendors[id].manifest.version, python: settings.lock.vendors[id].python }])) };
}
export function compareProjects(before: Project, after: Project): DesignChange[] {
  const changes: DesignChange[] = [];
  for (const [key, area] of [['motors', 'Hardware'], ['devices', 'Hardware'], ['subsystems', 'Subsystems'], ['commands', 'Commands'], ['routines', 'Logic builder'], ['bindings', 'Controls']] as const) {
    const a = before[key] || [], b = after[key] || [];
    const name = (item: (typeof a)[number]) => 'name' in item ? item.name : `${item.controller} button ${item.button}`;
    for (const item of a) if (!b.some(x => x.id === item.id)) changes.push({ area, name: name(item), kind: 'removed', details: [] });
    for (const item of b) {
      const old = a.find(x => x.id === item.id);
      if (!old) changes.push({ area, name: name(item), kind: 'added', details: [] });
      else { const details = fields(old, item, before, after); if (details.length) changes.push({ area, name: name(item), kind: 'changed', details }); }
    }
  }
  for (const [area, name, a, b] of [
    ['Code & export', 'Project settings', { name: before.name, team: before.team, language: before.language }, { name: after.name, team: after.team, language: after.language }],
    ['Hardware', 'Drivetrain', before.drive, after.drive], ['Controls', 'Controller settings', before.controls, after.controls], ['Autonomous', 'Autonomous plan', before.auto, after.auto],
  ] as const) { const details = fields(a, b); if (details.length) changes.push({ area, name, kind: 'changed', details }); }
  try {
    const a = libraryDesign(before), b = libraryDesign(after);
    const details = fields({ mode: a.mode, wpilib: a.wpilib, robotpy: a.robotpy }, { mode: b.mode, wpilib: b.wpilib, robotpy: b.robotpy });
    for (const id of new Set([...Object.keys(a.vendors), ...Object.keys(b.vendors)])) {
      if (stable(a.vendors[id]) !== stable(b.vendors[id])) details.push(`${vendorRegistry[id as keyof typeof vendorRegistry].name}: ${a.vendors[id] ? `${a.vendors[id].native} / ${a.vendors[id].python || 'no Python'}` : 'not selected'} → ${b.vendors[id] ? `${b.vendors[id].native} / ${b.vendors[id].python || 'no Python'}` : 'not selected'}`);
    }
    if (details.length) changes.push({ area: 'Libraries & updates', name: 'Library versions & policy', kind: 'changed', details });
  } catch { changes.push({ area: 'Libraries & updates', name: 'Library settings need attention', kind: 'changed', details: [] }); }
  return changes;
}
export type MechanismAddition = { name: string; controller: 'none' | 'SparkMax' | 'SparkFlex' | 'TalonFX'; can: number };
export function nextCanId(p: Project) {
  const used = new Set([...p.motors.filter(m => !m.type.startsWith('PWM') && (m.bus || 'rio') === 'rio').map(m => m.can), ...(p.devices || []).filter(d => d.bus === 'rio' && productById(d.product)?.connection === 'CAN').map(d => d.address), ...(p.drive.gyro === 'Pigeon2' && (p.drive.gyroBus || 'rio') === 'rio' ? [p.drive.gyroCan] : [])]);
  for (let id = 1; id <= 62; id++) if (!used.has(id)) return id;
  return -1;
}
export function appendMechanism(project: Project, addition: MechanismAddition): Project {
  const p = projectSchema.parse(project), name = addition.name.trim();
  if (!name || name.length > 32) throw Error('Choose a mechanism name with 1–32 characters.');
  if (p.subsystems.some(s => s.name.toLowerCase() === name.toLowerCase())) throw Error('Use a different name so teammates can identify this mechanism.');
  const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 16), subsystem = 'mechanism_' + suffix;
  let motors = p.motors, commands = p.commands;
  if (addition.controller !== 'none') {
    const id = addition.can;
    if (!Number.isInteger(id) || id < 0 || id > 62) throw Error('Choose a CAN ID between 0 and 62.');
    if (p.motors.some(m => !m.type.startsWith('PWM') && (m.bus || 'rio') === 'rio' && m.can === id) || (p.devices || []).some(d => d.bus === 'rio' && d.address === id && productById(d.product)?.connection === 'CAN') || p.drive.gyro === 'Pigeon2' && (p.drive.gyroBus || 'rio') === 'rio' && p.drive.gyroCan === id) throw Error('That CAN ID is already assigned on roboRIO CAN.');
    const motor: Motor = { id: 'motor_' + suffix, name: name + ' motor', type: addition.controller, can: id, bus: 'rio', motorKind: 'default', inverted: false, sensorSign: 1, current: 30, subsystem, role: 'mechanism', limit: -1 };
    motors = [...motors, motor]; commands = [...commands, { id: 'action_' + suffix, name: 'Run ' + name, subsystem, output: .2, timeout: 1 }];
  }
  return projectSchema.parse({ ...p, subsystems: [...p.subsystems, { id: subsystem, name, description: '' }], motors, commands, checks: {} });
}
