import { canAddressLabel } from './can-address';
import type { Project } from './robot-model';
import { componentCatalog } from './component-catalog';
import { newDevice, productById } from './hardware-catalog';
import { newMotor } from './motor-catalog';
import type { LayoutPoint } from './subsystem-layout';

export type ComponentProfile=typeof componentCatalog[number];
const digital=['digital','digitalOut','duty','quadrature','ultrasonic'];
const doubleDigital=['quadrature','ultrasonic'];
const valves=['solenoidRev','solenoidCtre','doubleRev','doubleCtre'];
const free=(used:Set<number|null>,max:number,label:string)=>{
  const value=Array.from({length:max+1},(_,i)=>i).find(i=>!used.has(i));
  if(value===undefined)throw Error(`No free ${label}. Review your configured hardware first.`);
  return value;
};

/** Suggest physical I/O ports across the robot; leave CAN addresses unset. */
export function newProjectDevice(p:Project,product:string,id:string,subsystem:string) {
  const def=productById(product),ds=p.devices||[];
  if(!def)throw Error('Choose a component from the library.');
  if(ds.length>=80)throw Error('This project supports up to 80 sensor and accessory components.');
  if(!p.subsystems.some(s=>s.id===subsystem))throw Error('Choose an existing subsystem first.');
  const d=newDevice(product,id,subsystem),a=def.adapter;
  let number=1;
  while(ds.some(x=>x.name===`${def.name} ${number}`))number++;
  d.name=`${def.name} ${number}`.slice(0,60);
  if(digital.includes(a)){
    const used=new Set(p.motors.filter(m=>m.limit>=0).map(m=>m.limit));
    for(const x of ds){const adapter=productById(x.product)?.adapter||'';if(digital.includes(adapter))used.add(x.channel);if(doubleDigital.includes(adapter))used.add(x.channelB);}
    d.channel=free(used,25,'DIO channels');used.add(d.channel);
    if(doubleDigital.includes(a))d.channelB=free(used,25,'DIO channels');
  }
  if(def.connection==='PWM'){
    const used=new Set(p.motors.filter(m=>m.type.startsWith('PWM')).map(m=>m.can));
    ds.filter(x=>productById(x.product)?.connection==='PWM').forEach(x=>used.add(x.channel));
    d.channel=free(used,19,'PWM channels');
  }
  if(def.connection==='Analog')d.channel=free(new Set(ds.filter(x=>productById(x.product)?.connection==='Analog').map(x=>x.channel)),7,'analog channels');
  if(a==='canbus'||a==='limelight'){
    let n=1;const key=a==='canbus'?'bus':'table',prefix=a==='canbus'?'canivore':'limelight-';
    while(ds.some(x=>x[key]===prefix+n))n++;
    d[key]=prefix+n;
  }
  if(valves.includes(a)){
    const pneumaticModule=ds.find(x=>productById(x.product)?.adapter===(a.endsWith('Rev')?'ph':'pcm'));
    if(pneumaticModule){
      d.module=pneumaticModule.id;const used=new Set<number>();
      ds.filter(x=>x.module===pneumaticModule.id).forEach(x=>{used.add(x.channel);if(productById(x.product)?.adapter.startsWith('double'))used.add(x.channelB);});
      const max=a.endsWith('Rev')?15:7;d.channel=free(used,max,'pneumatic module channels');used.add(d.channel);
      if(a.startsWith('double'))d.channelB=free(used,max,'pneumatic module channels');
    }
  }
  return d;
}

export function subsystemComponents(project:Project,subsystem:string) {
  return [
    ...project.motors.filter(m=>m.subsystem===subsystem).map(m=>({key:'motor:'+m.id,id:m.id,name:m.name,profile:componentCatalog.find(c=>c.kind==='motor'&&c.type===m.type)!,connection:m.type.startsWith('PWM')?`PWM ${m.can}`:canAddressLabel(m.can)})),
    ...(project.devices||[]).filter(d=>d.subsystem===subsystem).map(d=>{const profile=componentCatalog.find(c=>c.kind==='device'&&c.id===d.product)!;return {key:'device:'+d.id,id:d.id,name:d.name,profile,connection:profile?.connection==='CAN'?canAddressLabel(d.address):profile?.connection==='DIO × 2'?`DIO ${d.channel} / ${d.channelB}`:['DIO','PWM','Analog'].includes(profile?.connection)?`${profile.connection} ${d.channel}`:profile?.connection||'Unknown profile'};}),
  ].filter(c=>!!c.profile);
}

export function clampComponentPoint(point:LayoutPoint):LayoutPoint {
  return {x:Math.max(.13,Math.min(.87,Number.isFinite(point.x)?point.x:.5)),y:Math.max(.14,Math.min(.86,Number.isFinite(point.y)?point.y:.5))};
}
export function componentPosition(project:Project,subsystem:string,key:string):LayoutPoint {
  const saved=project.subsystems.find(s=>s.id===subsystem)?.componentLayout?.[key];
  if(saved)return clampComponentPoint(saved);
  const i=Math.max(0,subsystemComponents(project,subsystem).findIndex(c=>c.key===key));
  return {x:[.2,.5,.8][i%3],y:.2+(Math.floor(i/3)%4)*.2};
}
export function moveComponent(project:Project,subsystem:string,key:string,point:LayoutPoint):Partial<Project> {
  const components=subsystemComponents(project,subsystem);
  if(!components.some(c=>c.key===key))throw Error('This component is no longer in the subsystem.');
  return {subsystems:project.subsystems.map(s=>s.id!==subsystem?s:{...s,componentLayout:{...Object.fromEntries(Object.entries(s.componentLayout||{}).filter(([k])=>components.some(c=>c.key===k))),[key]:clampComponentPoint(point)}}),checks:project.checks};
}
export function placeComponent(project:Project,subsystem:string,profileId:string,id:string,point:LayoutPoint):Partial<Project> {
  const profile=componentCatalog.find(c=>c.id===profileId);
  if(!profile)throw Error('Choose a component from the library.');
  if(!/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(id)||project.motors.some(m=>m.id===id)||(project.devices||[]).some(d=>d.id===id))throw Error('Choose a new component identifier.');
  const patch:Partial<Project>=profile.kind==='motor'?{motors:[...project.motors,newMotor(project,profile.type,id,subsystem)]}:{devices:[...(project.devices||[]),newProjectDevice(project,profile.id,id,subsystem)]};
  return {...patch,...moveComponent({...project,...patch},subsystem,profile.kind+':'+id,point),checks:{}};
}
