import bundled from './bundled-libraries.json';
import { validateLibraryLock, selectedVendors, vendorRegistry, type LibrarySettings } from './libraries';
export const bundledLock = validateLibraryLock(bundled);
export function librarySettings(project: { libraries?: LibrarySettings }): LibrarySettings { return project.libraries || { mode: 'automatic', extras: [], lock: bundledLock }; }
export function versionsFor(project: { libraries?: LibrarySettings }) {
  const lock = librarySettings(project).lock;
  return { wpilib: lock.wpilib, robotpy: lock.robotpy, rev: lock.vendors.rev.manifest.version, robotpyRev: lock.vendors.rev.python, phoenix: lock.vendors.ctre.manifest.version, pathplanner: lock.vendors.pathplanner.manifest.version, checked: lock.checkedAt.slice(0, 10) };
}
export function pythonProjectFile(project: { libraries?: LibrarySettings }) {
  const settings = librarySettings(project);
  const requires = selectedVendors(settings).map(id => `${vendorRegistry[id].python}==${settings.lock.vendors[id].python}`);
  return `[tool.robotpy]\nrobotpy_version = "${settings.lock.robotpy}"\ncomponents = ["commands2"]\nrequires = ${JSON.stringify(requires)}\n`;
}
