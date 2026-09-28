import bundled from './bundled-libraries.json';
import { validateLibraryLock, selectedVendors, vendorRegistry, type LibrarySettings,type VendorId,type LibraryLock } from './libraries';
import { productById } from './hardware-catalog';
import type { Project } from './robot-model';
export const bundledLock = validateLibraryLock(bundled);
export function hardwareVendors(project:Partial<Project>):VendorId[]{
 const ids=new Set<VendorId>();
 for(const d of project.devices||[]){const v=productById(d.product)?.vendor;if(v)ids.add(v);}
 if(project.drive?.gyro==='NavX')ids.add('navx');
 if(project.motors?.some(m=>['TalonSRX','VictorSPX'].includes(m.type)))ids.add('phoenix5');
 if(project.motors?.some(m=>m.type==='ThriftyNova'))ids.add('thrifty');
 return [...ids];
}
export function projectLibraryLock(project:Partial<Project>,lock:LibraryLock):LibraryLock {if(project.language==='Python'&&(hardwareVendors(project).includes('phoenix5')||project.libraries?.extras.includes('phoenix5')))return {...lock,vendors:{...lock.vendors,ctre:{...lock.vendors.ctre,python:lock.legacyPhoenix6}}};return lock;}
export function librarySettings(project:Partial<Project>):LibrarySettings { const settings=project.libraries||{mode:'automatic',extras:[],lock:bundledLock};return {...settings,lock:projectLibraryLock(project,validateLibraryLock(settings.lock)),extras:[...new Set([...settings.extras,...hardwareVendors(project)])]}; }
export function versionsFor(project:Partial<Project>) {
  const lock = librarySettings(project).lock;
  return { wpilib: lock.wpilib, robotpy: lock.robotpy, rev: lock.vendors.rev.manifest.version, robotpyRev: lock.vendors.rev.python, phoenix:project.language==='Python'?lock.vendors.ctre.python:lock.vendors.ctre.manifest.version, pathplanner: lock.vendors.pathplanner.manifest.version, checked: lock.checkedAt.slice(0, 10) };
}
export function pythonProjectFile(project:Partial<Project>) {
  const settings = librarySettings(project);
  const requires = selectedVendors(settings).filter(id=>vendorRegistry[id].python).map(id => `${vendorRegistry[id].python}==${settings.lock.vendors[id].python}`);
  return `[tool.robotpy]\nrobotpy_version = "${settings.lock.robotpy}"\ncomponents = ["commands2"]\nrequires = ${JSON.stringify(requires)}\n`;
}
