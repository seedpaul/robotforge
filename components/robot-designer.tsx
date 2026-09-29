"use client";
import { useRef, useState, type PointerEvent } from 'react';
import { CheckCircle2, Grip, MousePointer2, X } from 'lucide-react';
import { uid, type Project, type Issue } from '@/lib/robot-model';
import { driveType } from '@/lib/drivetrain';
import { wizardProgress } from '@/lib/build-wizard';
import { clampPlacement, moveSubsystem, placeSubsystem, subsystemKind, subsystemPlacement, subsystemTemplates, type SubsystemKind, type LayoutPoint } from '@/lib/subsystem-layout';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SubsystemIcon from './subsystem-icon';
import { toast } from 'sonner';

type Drag = { kind:SubsystemKind; id?:string; pointer:number; startX:number; startY:number; moved:boolean; point:LayoutPoint };
export default function RobotDesigner({project,update,issues,onConfigure}:{project:Project;update:(patch:Partial<Project>)=>void;issues:Issue[];onConfigure:(id:string)=>void}) {
  const board=useRef<HTMLDivElement>(null),tracking=useRef<Drag|null>(null);
  const [tray,setTray]=useState('mechanisms');
  const [armed,setArmed]=useState<SubsystemKind|null>(null),[drag,setDrag]=useState<Drag|null>(null),[message,setMessage]=useState('');
  const progress=wizardProgress(project,issues),type=driveType(project);
  const drive=progress.subsystems.find(s=>s.id==='drive');
  const parts=project.subsystems.filter(s=>s.id!=='drive');
  const point=(x:number,y:number)=>{const rect=board.current!.getBoundingClientRect();return {x:(x-rect.left)/rect.width,y:(y-rect.top)/rect.height};};
  function configure(id:string){setArmed(null);onConfigure(id);}
  function place(kind:SubsystemKind,position:LayoutPoint){try{const result=placeSubsystem(project,kind,position,uid('subsystem'));update(result.patch);setArmed(null);const name=subsystemTemplates.find(t=>t.kind===kind)!.name;setMessage(name+' placed. Select its icon to configure it.');toast.success(name+' placed. Click its icon to set it up.');}catch(e){toast.error(e instanceof Error?e.message:'Could not place subsystem.');}}
  function start(e:PointerEvent<HTMLButtonElement>,kind:SubsystemKind,id?:string){if(e.button!==0)return;e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);tracking.current={kind,id,pointer:e.pointerId,startX:e.clientX,startY:e.clientY,moved:false,point:point(e.clientX,e.clientY)};}
  function moving(e:PointerEvent<HTMLButtonElement>){const current=tracking.current;if(!current||current.pointer!==e.pointerId)return;if(Math.hypot(e.clientX-current.startX,e.clientY-current.startY)>6)current.moved=true;if(current.moved){current.point=point(e.clientX,e.clientY);setDrag({...current});}}
  function finish(e:PointerEvent<HTMLButtonElement>){const current=tracking.current;if(!current||current.pointer!==e.pointerId)return;e.stopPropagation();tracking.current=null;setDrag(null);if(current.moved){const p=point(e.clientX,e.clientY);if(p.x<0||p.x>1||p.y<0||p.y>1){setMessage('Drop inside the chassis to place a subsystem.');return;}if(current.id){update(moveSubsystem(project,current.id,p));setMessage('Subsystem position saved.');}else place(current.kind,p);}else if(current.id)configure(current.id);else setArmed(current.kind);}
  const cancel=()=>{tracking.current=null;setDrag(null);};
  const pointerProps=(kind:SubsystemKind,id?:string)=>({onPointerDown:(e:PointerEvent<HTMLButtonElement>)=>start(e,kind,id),onPointerMove:moving,onPointerUp:finish,onPointerCancel:cancel,onClick:(e:React.MouseEvent<HTMLButtonElement>)=>{e.stopPropagation();if(e.detail===0){if(id)configure(id);else setArmed(kind);}}});
  return <section className="robot-designer" aria-label="Visual robot builder">
    <div className="designer-heading"><div><h2>Assemble your robot</h2><p>Drag a subsystem onto the chassis. Click its icon to set it up.</p></div><span><CheckCircle2 size={17}/>{progress.subsystems.filter(s=>s.complete).length} of {progress.subsystems.length} configured</span></div>
    <div className="designer-workspace">
      <aside className="parts-tray" aria-label="Subsystem parts tray"><h3>Subsystems</h3><p>Drag, or select to place.</p><Tabs value={tray} onValueChange={setTray}><TabsList><TabsTrigger value="mechanisms">Mechanisms</TabsTrigger><TabsTrigger value="drive">Drive</TabsTrigger></TabsList></Tabs>{[tray==='drive'].map(drivetrain=><div key={String(drivetrain)}><h4>{drivetrain?'Drivetrains':'Mechanisms'}</h4><div className="parts-grid">{subsystemTemplates.filter(t=>!!t.drive===drivetrain).map(t=><button key={t.kind} className={'part-template '+(armed===t.kind?'selected':'')} aria-label={'Place '+t.name} aria-pressed={armed===t.kind} title={t.description} {...pointerProps(t.kind)} disabled={!t.drive&&project.subsystems.length>=20}><SubsystemIcon kind={t.kind}/><span>{t.name}</span></button>)}</div></div>)}</aside>
      <div className="designer-canvas-panel">
        <div className="designer-canvas-toolbar"><span><Grip size={16}/>Top view · chassis</span><small>FRONT</small></div>
        {armed&&<div className="placement-prompt" role="status"><MousePointer2 size={18}/><span>Click the chassis to place {subsystemTemplates.find(t=>t.kind===armed)?.name}.</span><button aria-label="Cancel placement" onClick={()=>setArmed(null)}><X size={18}/></button></div>}
        <div ref={board} className={'robot-chassis '+(armed||drag?'placing':'')} role="group" aria-label="Robot chassis placement area" tabIndex={armed?0:-1} onKeyDown={e=>{if(e.target!==e.currentTarget)return;if(e.key==='Escape')setArmed(null);if(armed&&(e.key==='Enter'||e.key===' ')){e.preventDefault();place(armed,{x:.5,y:.4});}}} onClick={e=>{if(armed)place(armed,point(e.clientX,e.clientY));}}>
          <svg className="chassis-lines" viewBox="0 0 600 430" preserveAspectRatio="none" aria-hidden="true"><rect x="72" y="35" width="456" height="353" rx="30"/><rect x="92" y="55" width="416" height="313" rx="18"/><path d="M300 10V35M292 18l8-8 8 8M72 122h456M72 285h456M170 35v353M430 35v353"/>{[0,1,2,3].map(i=>{const x=i%2?514:54,y=i<2?66:298;return <g key={i}>{type==='swerve'&&<circle cx={x+16} cy={y+30} r="32" strokeDasharray="4 5"/>}<rect x={x} y={y} width="32" height="61" rx={type==='swerve'?14:6} className={drive?.complete?'configured-wheel':'unconfigured-wheel'}/>{type==='mecanum'&&[12,27,42].map(n=><path key={n} d={`M${x+5} ${y+n}l22 ${i===0||i===3?9:-9}`}/>)}</g>;})}</svg>
          {!parts.length&&<div className="chassis-empty"><MousePointer2 size={24}/><b>Your mechanisms go here</b><span>Start with an intake, turret, or shooter.</span></div>}
          {parts.map(s=>{const state=progress.subsystems.find(p=>p.id===s.id)!;const p=drag?.id===s.id?clampPlacement(drag.point):subsystemPlacement(project,s);return <button key={s.id} id={'chassis-part-'+s.id} className={'chassis-part '+(state.complete?'configured':state.hardwareReady?'hardware-ready':'planned')} style={{left:p.x*100+'%',top:p.y*100+'%'}} aria-label={'Configure '+s.name} aria-describedby="chassis-keyboard-help" {...pointerProps(subsystemKind(project,s),s.id)} onKeyDown={e=>{const offset={ArrowLeft:[-.025,0],ArrowRight:[.025,0],ArrowUp:[0,-.025],ArrowDown:[0,.025]}[e.key];if(offset){e.preventDefault();update(moveSubsystem(project,s.id,{x:p.x+offset[0],y:p.y+offset[1]}));setMessage(s.name+' position saved.');}}}><SubsystemIcon kind={subsystemKind(project,s)}/><b>{s.name}</b><small>{state.complete?'Configured':state.hardwareReady?'Commands next':'Set up hardware'}</small></button>;})}
          <button id="chassis-part-drive" className={'chassis-drive '+(drive?.complete?'configured':'')} aria-label="Configure drivetrain" onClick={e=>{e.stopPropagation();if(armed)place(armed,point(e.clientX,e.clientY));else configure('drive');}}><SubsystemIcon kind={type}/><span><b>{subsystemTemplates.find(t=>t.kind===type)?.name}</b><small>{drive?.complete?'Configured':'Set up drivetrain'}</small></span></button>
          {drag&&!drag.id&&<div className="chassis-ghost" style={{left:clampPlacement(drag.point).x*100+'%',top:clampPlacement(drag.point).y*100+'%'}}><SubsystemIcon kind={drag.kind}/></div>}
        </div>
        <div className="designer-legend"><span><i/>Planned</span><span><i className="hardware"/>Hardware configured</span><span><i className="complete"/>Commands configured</span></div>
        <p className="designer-note">Visual layout only. Set wheel dimensions, gearing, and sensor offsets in drivetrain setup.</p>
        <div className="designer-accessible-parts">{progress.subsystems.map(s=><button key={s.id} onClick={()=>configure(s.id)}><SubsystemIcon kind={subsystemKind(project,s)}/><span>{s.name}<small>{s.status}</small></span></button>)}</div>
      </div>
    </div><p id="chassis-keyboard-help" className="sr-only">Drag to reposition. Arrow keys move this subsystem. Enter opens guided setup.</p><div className="sr-only" aria-live="polite">{message}</div>
  </section>;
}
