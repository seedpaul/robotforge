import { z } from 'zod';

export const SEASON = 2026;
export const stableVersion = /^v?\d+(?:\.\d+){1,3}$/;
const version = z.string().max(40).regex(stableVersion);
export const vendorIds = ['rev', 'ctre', 'pathplanner', 'pwf', 'navx', 'photonvision'] as const;
export type VendorId = typeof vendorIds[number];
export const vendorId = z.enum(vendorIds);
export const vendorRegistry = {
  rev: { name: 'REVLib', description: 'SPARK MAX, SPARK Flex, and REV sensors', file: 'REVLib.json', uuid: '3f48eb8c-50fe-43a6-9cb7-44c86353c4cb', feed: 'https://software-metadata.revrobotics.com/REVLib-2026.json', prefix: 'REVLib-', group: 'com.revrobotics.frc', repositories: ['https://maven.revrobotics.com/'], python: 'robotpy-rev', docs: 'https://docs.revrobotics.com/revlib', required: true },
  ctre: { name: 'CTRE Phoenix 6', description: 'Talon FX, CANcoder, and Pigeon 2', file: 'Phoenix6.json', uuid: 'e995de00-2c64-4df5-8831-c1441420ff19', feed: 'https://maven.ctr-electronics.com/release/com/ctre/phoenix6/latest/Phoenix6-frc2026-latest.json', prefix: 'Phoenix6-', group: 'com.ctre', repositories: ['https://maven.ctr-electronics.com/release/'], python: 'phoenix6', docs: 'https://v6.docs.ctr-electronics.com/', required: true },
  pathplanner: { name: 'PathPlanner', description: 'Autonomous paths and robot-side following', file: 'PathplannerLib.json', uuid: '1b42324f-17c6-4875-8e77-1c312bc8c786', feed: 'https://3015rangerrobotics.github.io/pathplannerlib/PathplannerLib.json', prefix: 'PathplannerLib-', group: 'com.pathplanner.lib', repositories: ['https://3015rangerrobotics.github.io/pathplannerlib/repo'], python: 'robotpy-pathplannerlib', docs: 'https://pathplanner.dev/', required: true },
  pwf: { name: 'Playing With Fusion', description: 'Time of Flight sensors, Venom, and PWF devices', file: 'PlayingWithFusion.json', uuid: '14b8ad04-24df-11ea-978f-2e728ce88125', feed: 'https://www.playingwithfusion.com/frc/playingwithfusion2026.json', prefix: 'PlayingWithFusion-', group: 'com.playingwithfusion.frc', repositories: ['https://www.playingwithfusion.com/frc/maven/'], python: 'robotpy-playingwithfusion', docs: 'https://www.playingwithfusion.com/static/frc.php', required: false },
  navx: { name: 'Studica navX', description: 'NavX MXP and Micro navigation sensors', file: 'Studica.json', uuid: 'cb311d09-36e9-4143-a032-55bb2b94443b', feed: '', prefix: 'Studica-', group: 'com.studica.frc', repositories: ['https://dev.studica.com/maven/release/2026/'], python: 'robotpy-navx', docs: 'https://github.com/Studica-Robotics/NavX/', required: false },
  photonvision: { name: 'PhotonVision', description: 'Camera results, AprilTags, and vision measurements', file: 'photonlib.json', uuid: '515fe07e-bfc6-11fa-b3de-0242ac130004', feed: '', prefix: 'photonlib-', group: 'org.photonvision', repositories: ['https://maven.photonvision.org/repository/internal', 'https://maven.photonvision.org/repository/snapshots'], python: 'photonlibpy', docs: 'https://docs.photonvision.org/', required: false },
} as const;

const atom = z.string().regex(/^[A-Za-z0-9_.+-]+$/).max(120);
const dependency = z.object({ groupId: atom, artifactId: atom, version, libName: atom.optional(), headerClassifier: atom.optional(), sourcesClassifier: atom.optional(), sharedLibrary: z.boolean().optional(), skipInvalidPlatforms: z.boolean().optional(), isJar: z.boolean().optional(), validPlatforms: z.array(atom).max(30).optional(), binaryPlatforms: z.array(atom).max(30).optional(), simMode: atom.optional() }).strict();
export const manifestSchema = z.object({ fileName: z.string().regex(/^[A-Za-z0-9_.-]+\.json$/), name: z.string().min(1).max(100), version, frcYear: z.union([z.literal('2026'), z.literal(2026)]), uuid: z.string().uuid(), mavenUrls: z.array(z.string().url()).max(6), jsonUrl: z.string().max(500), conflictsWith: z.array(z.object({ uuid: z.string().uuid(), errorMessage: z.string().max(500), offlineFileName: z.string().regex(/^[A-Za-z0-9_.-]+\.json$/) }).strict()).max(10).optional(), javaDependencies: z.array(dependency).max(30), jniDependencies: z.array(dependency).max(50), cppDependencies: z.array(dependency).max(50) }).strict();
export type VendorManifest = z.infer<typeof manifestSchema>;
export const libraryLockSchema = z.object({ season: z.literal(2026), checkedAt: z.string().max(50), wpilib: version, robotpy: version, vendors: z.object({ rev: z.object({ manifest: manifestSchema, python: version }), ctre: z.object({ manifest: manifestSchema, python: version }), pathplanner: z.object({ manifest: manifestSchema, python: version }), pwf: z.object({ manifest: manifestSchema, python: version }), navx: z.object({ manifest: manifestSchema, python: version }), photonvision: z.object({ manifest: manifestSchema, python: version }) }).strict() }).strict();
export type LibraryLock = z.infer<typeof libraryLockSchema>;
export const librarySettingsSchema = z.object({ mode: z.enum(['automatic', 'frozen']), extras: z.array(vendorId).max(3), lock: libraryLockSchema, previous: libraryLockSchema.optional() }).strict();
export type LibrarySettings = z.infer<typeof librarySettingsSchema>;
export type LibraryCatalog = { lock: LibraryLock; errors: string[]; checkedAt: string; sources: Record<string, 'live'|'bundled'> };

export function compareVersions(a: string, b: string) {
  const av = a.replace(/^v/, '').split('.').map(Number), bv = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(av.length, bv.length); i++) if ((av[i] || 0) !== (bv[i] || 0)) return (av[i] || 0) - (bv[i] || 0);
  return 0;
}
export function isSeasonVersion(value: string, short = false) { return stableVersion.test(value) && Number(value.replace(/^v/, '').split('.')[0]) === (short ? 26 : SEASON); }
export function validateManifest(id: VendorId, data: unknown): VendorManifest {
  const m = manifestSchema.parse(data), def = vendorRegistry[id];
  if (m.uuid !== def.uuid || !isSeasonVersion(m.version, id === 'ctre')) throw Error(`${def.name}: wrong library, season, or prerelease.`);
  const metadataUrl = new URL(m.jsonUrl);
  const publisherHosts = [...def.repositories.map(repo => new URL(repo).hostname), ...(def.feed ? [new URL(def.feed).hostname] : [])];
  if (metadataUrl.protocol !== 'https:' || metadataUrl.username || metadataUrl.password || !publisherHosts.includes(metadataUrl.hostname)) throw Error(`${def.name}: unrecognized metadata URL.`);
  for (const repo of m.mavenUrls) if (!def.repositories.some(base => repo === base || repo === base.replace(/\/$/, ''))) throw Error(`${def.name}: unrecognized package repository.`);
  for (const d of [...m.javaDependencies, ...m.jniDependencies, ...m.cppDependencies]) {
    if (!(d.groupId === def.group || d.groupId.startsWith(def.group + '.'))) throw Error(`${def.name}: unexpected Maven group.`);
    if (!isSeasonVersion(d.version, id === 'ctre')) throw Error(`${def.name}: unsupported dependency version.`);
  }
  return { ...m, fileName: def.file };
}
export function validateLibraryLock(data: unknown): LibraryLock {
  const lock = libraryLockSchema.parse(data);
  if (!isSeasonVersion(lock.wpilib) || !isSeasonVersion(lock.robotpy)) throw Error('Use stable 2026 WPILib and RobotPy versions.');
  for (const id of vendorIds) {
    validateManifest(id, lock.vendors[id].manifest);
    if (!isSeasonVersion(lock.vendors[id].python, id === 'ctre')) throw Error(`${vendorRegistry[id].name}: unsupported Python version.`);
  }
  return lock;
}
export function selectedVendors(settings?: Pick<LibrarySettings, 'extras'>): VendorId[] { return vendorIds.filter(id => vendorRegistry[id].required || settings?.extras.includes(id)); }
export function pythonRequirements(lock: LibraryLock, extras: VendorId[] = []) { return [`robotpy[commands2]==${lock.robotpy}`, ...selectedVendors({ extras }).map(id => `${vendorRegistry[id].python}==${lock.vendors[id].python}`)]; }
export function lockKey(lock: LibraryLock) { return JSON.stringify({ wpilib: lock.wpilib, robotpy: lock.robotpy, vendors: vendorIds.map(id => [id, lock.vendors[id].manifest, lock.vendors[id].python]) }); }
export function mergeNewer(current: LibraryLock, available: LibraryLock): LibraryLock {
  const newer = (a: string, b: string) => compareVersions(b, a) > 0 ? b : a;
  const result = structuredClone(current); result.checkedAt = available.checkedAt;
  result.wpilib = newer(current.wpilib, available.wpilib); result.robotpy = newer(current.robotpy, available.robotpy);
  for (const id of vendorIds) {
    if (compareVersions(available.vendors[id].manifest.version, current.vendors[id].manifest.version) > 0) result.vendors[id].manifest = available.vendors[id].manifest;
    result.vendors[id].python = newer(current.vendors[id].python, available.vendors[id].python);
  }
  return result;
}
