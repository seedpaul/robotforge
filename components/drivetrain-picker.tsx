"use client";
import { useState } from 'react';
import { Check, ArrowRight } from 'lucide-react';
import type { Project } from '@/lib/robot-model';
import { driveType } from '@/lib/drivetrain';
import { hasChosenDrivetrain } from '@/lib/build-wizard';
import { placeSubsystem, subsystemTemplates } from '@/lib/subsystem-layout';
import SubsystemIcon from './subsystem-icon';

export default function DrivetrainPicker({project,update}:{project:Project;update:(patch:Partial<Project>)=>void}) {
  const [changing,setChanging]=useState(false);
  const chosen=hasChosenDrivetrain(project),type=driveType(project);
  const selected=subsystemTemplates.find(t=>t.kind===type)!;
  return <section className={'drivetrain-start panel '+(chosen&&!changing?'compact':'')} aria-label="Choose your drivetrain">
    {chosen&&!changing?<div className="chosen-drivetrain"><SubsystemIcon kind={type}/><div><small>YOUR ROBOT&apos;S FOUNDATION</small><h2>{selected.name}</h2><p>Now add the mechanisms your robot needs.</p></div><button className="button" onClick={()=>setChanging(true)}>Change drivetrain</button></div>:<>
      <div className="panel-title"><div><div className="eyebrow">START HERE</div><h2>Choose your drivetrain</h2><p>Start with how your robot moves. Then build the rest around it.</p></div>{chosen&&<button className="text-button" onClick={()=>setChanging(false)}>Keep {selected.name}</button>}</div>
      <div className="drivetrain-start-options">{subsystemTemplates.filter(t=>t.drive).map(t=><button key={t.kind} className={chosen&&type===t.drive?'selected':''} aria-label={'Choose '+t.name} aria-pressed={chosen&&type===t.drive} onClick={()=>{update(placeSubsystem(project,t.kind,{x:.5,y:.88},'drive').patch);setChanging(false);}}><SubsystemIcon kind={t.kind}/><b>{t.name}</b><p>{t.description}</p><span>{chosen&&type===t.drive?<><Check size={16}/>Selected</>:<>Select drivetrain<ArrowRight size={15}/></>}</span></button>)}</div>
    </>}
  </section>;
}
