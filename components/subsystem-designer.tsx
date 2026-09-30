"use client";
import { useRef, useState, type PointerEvent } from 'react';
import { BatteryCharging, Camera, CircleAlert, CircuitBoard, Compass, Gauge, Grip, Lightbulb, MousePointer2, ScanLine, Search, Settings2, SlidersHorizontal, X } from 'lucide-react';
import { toast } from 'sonner';
import { uid, type Project, type Issue } from '@/lib/robot-model';
import { componentBrands, componentCategories, filterComponents } from '@/lib/component-catalog';
import { componentPosition, clampComponentPoint, moveComponent, placeComponent, subsystemComponents, type ComponentProfile } from '@/lib/component-layout';
import { driveType } from '@/lib/drivetrain';
import { subsystemKind, type LayoutPoint } from '@/lib/subsystem-layout';
import SubsystemIcon from './subsystem-icon';
import MotorDetails from './motor-details';
import HardwareDevices from './hardware-devices';
import { Hardware } from './studio-views';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from './ui/sheet';

function ComponentIcon({profile}:{profile:ComponentProfile}) {
  const Icon=profile.kind==='motor'?CircuitBoard:profile.category==='Encoders'?Gauge:profile.category==='Gyros'?Compass:profile.category==='Power'?BatteryCharging:profile.category==='Vision'?Camera:profile.category==='Lighting'?Lightbulb:profile.category==='Pneumatics'?SlidersHorizontal:profile.category==='Mechanics'?Settings2:ScanLine;
  return <Icon aria-hidden="true"/>;
}
type Drag={profile:ComponentProfile;key?:string;pointer:number;startX:number;startY:number;moved:boolean;point:LayoutPoint};
type Props={project:Project;update:(patch:Partial<Project>)=>void;subsystemId:string;issues:Issue[];setTab:(tab:string)=>void};

export default function SubsystemDesigner({project,update,subsystemId,issues,setTab}:Props) {
  const subsystem=project.subsystems.find(s=>s.id===subsystemId)!;
  const parts=subsystemComponents(project,subsystemId);
  const board=useRef<HTMLDivElement>(null),tracking=useRef<Drag|null>(null);
  const [search,setSearch]=useState(''),[brand,setBrand]=useState('all'),[category,setCategory]=useState('all');
  const [armed,setArmed]=useState<ComponentProfile|null>(null),[drag,setDrag]=useState<Drag|null>(null),[selected,setSelected]=useState<string|null>(null),[message,setMessage]=useState('');
  const current=parts.find(c=>c.key===selected);
  const findings=issues.filter(i=>(i.area==='Hardware'||i.area==='Configuration')&&(!i.subsystems?.length||i.subsystems.includes(subsystemId)));
  const point=(x:number,y:number)=>{const r=board.current!.getBoundingClientRect();return {x:(x-r.left)/r.width,y:(y-r.top)/r.height};};
  function place(profile:ComponentProfile,p:LayoutPoint){try{update(placeComponent(project,subsystemId,profile.id,uid(profile.kind),p));setArmed(null);setMessage(profile.name+' added. Click its icon to configure it.');toast.success(profile.name+' added to '+subsystem.name);}catch(e){toast.error(e instanceof Error?e.message:'Could not place component.');}}
  function configure(key:string){setArmed(null);setSelected(key);}
  function start(e:PointerEvent<HTMLButtonElement>,profile:ComponentProfile,key?:string){if(e.button!==0)return;e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);tracking.current={profile,key,pointer:e.pointerId,startX:e.clientX,startY:e.clientY,moved:false,point:point(e.clientX,e.clientY)};}
  function moving(e:PointerEvent<HTMLButtonElement>){const d=tracking.current;if(!d||d.pointer!==e.pointerId)return;if(Math.hypot(e.clientX-d.startX,e.clientY-d.startY)>6)d.moved=true;if(d.moved){d.point=point(e.clientX,e.clientY);setDrag({...d});}}
  function finish(e:PointerEvent<HTMLButtonElement>){const d=tracking.current;if(!d||d.pointer!==e.pointerId)return;e.stopPropagation();tracking.current=null;setDrag(null);if(d.moved){const p=point(e.clientX,e.clientY);if(p.x<0||p.x>1||p.y<0||p.y>1){setMessage('Drop inside the subsystem to add a component.');return;}if(d.key){update(moveComponent(project,subsystemId,d.key,p));setMessage('Component position saved.');}else place(d.profile,p);}else if(d.key)configure(d.key);else setArmed(d.profile);}
  const cancel=()=>{tracking.current=null;setDrag(null);};
  const pointers=(profile:ComponentProfile,key?:string)=>({onPointerDown:(e:PointerEvent<HTMLButtonElement>)=>start(e,profile,key),onPointerMove:moving,onPointerUp:finish,onPointerCancel:cancel,onClick:(e:React.MouseEvent<HTMLButtonElement>)=>{e.stopPropagation();if(e.detail===0){if(key)configure(key);else setArmed(profile);}}});
  function unavailable(c:ComponentProfile){if(c.kind==='device')return (project.devices||[]).length>=80?'Component limit reached':null;if(project.motors.length>=40)return 'Controller limit reached';if(c.javaOnly&&project.language!=='Java')return 'Requires Java';if(subsystemId==='drive'&&!['SparkMax','SparkFlex','TalonFX'].includes(c.type)&&!(c.type==='TalonFXS'&&driveType(project)==='swerve'))return 'Mechanisms only';return null;}
  const filtered=filterComponents(search,brand,category);
  const changeSubsystem=(patch:Partial<typeof subsystem>)=>update({subsystems:project.subsystems.map(s=>s.id===subsystemId?{...s,...patch}:s)});
  return <div className="view-stack subsystem-assembly">
    <section className="component-designer" aria-label={'Assemble '+subsystem.name}>
      <div className="designer-heading"><div><h2>Assemble {subsystem.name}</h2><p>Drag hardware into this subsystem, then click a component to set it up.</p></div><span>{parts.length} {parts.length===1?'component':'components'}</span></div>
      <div className="component-workspace">
        <aside className="component-tray" aria-label="Hardware parts tray"><h3>Component library</h3><label className="catalog-search"><Search size={16}/><input aria-label="Search hardware to place" placeholder="SPARK MAX, CANcoder…" value={search} onChange={e=>setSearch(e.target.value)}/></label>
          <label className="form-field"><span className="sr-only">Hardware category</span><select aria-label="Hardware category" value={category} onChange={e=>setCategory(e.target.value)}><option value="all">All components</option>{componentCategories.map(c=><option key={c}>{c}</option>)}</select></label>
          <label className="form-field"><span className="sr-only">Hardware manufacturer</span><select aria-label="Hardware manufacturer" value={brand} onChange={e=>setBrand(e.target.value)}><option value="all">All manufacturers</option>{componentBrands.map(b=><option key={b}>{b}</option>)}</select></label>
          <small>{filtered.length} profiles · Drag or select to place</small>
          <div className="component-tray-list">{filtered.map(c=>{const disabled=unavailable(c);return <button key={c.id} className={'component-template '+(armed?.id===c.id?'selected':'')} aria-label={'Place '+c.name} aria-pressed={armed?.id===c.id} title={disabled||c.description} disabled={!!disabled} {...pointers(c)}><ComponentIcon profile={c}/><span><b>{c.name}</b><small>{c.brand} · {c.connection}</small><em>{disabled||(c.kind==='motor'?'Motor + controller':c.adapter==='custom'?'Integration required':c.adapter==='passive'?'Wiring / inventory':c.category)}</em></span><Grip size={14}/></button>;})}{!filtered.length&&<p className="component-help">No matching components. Try a different name or filter.</p>}</div>
        </aside>
        <div className="component-board-panel"><div className="designer-canvas-toolbar"><span><SubsystemIcon kind={subsystemKind(project,subsystem)}/>{subsystem.name}</span><small>COMPONENT LAYOUT</small></div>
          {armed&&<div className="placement-prompt" role="status"><MousePointer2 size={18}/><span>Click the workspace to place {armed.name}.</span><button aria-label="Cancel component placement" onClick={()=>setArmed(null)}><X size={18}/></button></div>}
          <div ref={board} className={'component-board '+(armed||drag?'placing':'')} role="group" aria-label="Subsystem component placement area" tabIndex={armed?0:-1} onClick={e=>{if(armed)place(armed,point(e.clientX,e.clientY));}} onKeyDown={e=>{if(e.target!==e.currentTarget)return;if(e.key==='Escape')setArmed(null);if(armed&&(e.key==='Enter'||e.key===' ')){e.preventDefault();const i=parts.length;place(armed,{x:[.2,.5,.8][i%3],y:.2+Math.floor(i/3)%4*.2});}}}>
            <div className="component-blueprint" aria-hidden="true"><SubsystemIcon kind={subsystemKind(project,subsystem)}/></div>
            {!parts.length&&<div className="component-board-empty"><CircuitBoard size={32}/><h3>What makes this subsystem work?</h3><p>Start with a motor controller, then add your sensors and accessories.</p></div>}
            {parts.map(c=>{const p=drag?.key===c.key?clampComponentPoint(drag.point):componentPosition(project,subsystemId,c.key);return <button key={c.key} id={'component-'+c.id} className={'component-node '+c.profile.kind} style={{left:p.x*100+'%',top:p.y*100+'%'}} aria-label={'Configure '+c.name} aria-describedby="component-keyboard-help" {...pointers(c.profile,c.key)} onKeyDown={e=>{const delta={ArrowLeft:[-.025,0],ArrowRight:[.025,0],ArrowUp:[0,-.025],ArrowDown:[0,.025]}[e.key];if(delta){e.preventDefault();update(moveComponent(project,subsystemId,c.key,{x:p.x+delta[0],y:p.y+delta[1]}));}}}><ComponentIcon profile={c.profile}/><b>{c.name}</b><small>{c.connection}</small></button>;})}
            {drag&&!drag.key&&<div className="component-ghost" style={{left:clampComponentPoint(drag.point).x*100+'%',top:clampComponentPoint(drag.point).y*100+'%'}}><ComponentIcon profile={drag.profile}/></div>}
          </div>
          <p className="component-layout-note">Positions help you organize your hardware. Click each component to match its wiring and settings.</p>
          {!!parts.length&&<div className="component-inventory" aria-label="Components in this subsystem">{parts.map(c=><button key={c.key} onClick={()=>configure(c.key)}><ComponentIcon profile={c.profile}/><span>{c.name}<small>{c.connection}</small></span><Settings2 size={14}/></button>)}</div>}
        </div>
      </div><p id="component-keyboard-help" className="sr-only">Drag or use arrow keys to reposition. Press Enter to configure. To add with the keyboard, select a library item, then focus the workspace and press Enter.</p><div className="sr-only" aria-live="polite">{message}</div>
    </section>
    {subsystemId==='drive'&&<details className="assembly-details" open><summary>Drivetrain geometry, wheel assignments & heading sensor</summary><Hardware project={project} update={update} issues={issues} setTab={setTab} tab="Build wizard" subsystemId="drive" hardwareStage="feedback"/></details>}
    <details className="assembly-details"><summary>Subsystem name & description</summary><div className="form-grid two"><label className="form-field"><span>Subsystem name</span><input aria-label="Subsystem name" maxLength={40} value={subsystem.name} onChange={e=>changeSubsystem({name:e.target.value})}/></label><label className="form-field"><span>What does it do?</span><input aria-label="Subsystem description" maxLength={200} value={subsystem.description} onChange={e=>changeSubsystem({description:e.target.value})}/></label></div></details>
    {!!findings.length&&<details className="assembly-details"><summary><CircleAlert size={17}/>{findings.length} hardware checks to review</summary><div className="assembly-findings">{findings.map((i,n)=><p key={n}>{i.message}</p>)}</div></details>}
    <Sheet open={!!current} onOpenChange={open=>{if(!open)setSelected(null);}}><SheetContent className="component-inspector" onCloseAutoFocus={e=>{e.preventDefault();if(current)document.getElementById('component-'+current.id)?.focus();}}><SheetHeader><SheetTitle>{current?.name||'Component settings'}</SheetTitle><SheetDescription>Set this component&apos;s connections and behavior in {subsystem.name}. Changes save as you work.</SheetDescription></SheetHeader>{current&&<div className="component-inspector-content">{current.profile.kind==='motor'?<MotorDetails project={project} update={update} motor={project.motors.find(m=>m.id===current.id)!}/>:<HardwareDevices key={current.id} project={project} update={update} mode="devices" hideLibrary selectedDeviceId={current.id} subsystemId={subsystemId} onAddMotor={()=>{}} motorEditor={()=>null}/>}<button className="button primary component-done" onClick={()=>setSelected(null)}>Done</button></div>}</SheetContent></Sheet>
  </div>;
}
