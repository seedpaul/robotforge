"use client";
import { useEffect, useRef, useState } from 'react';
import { Cable, CheckCircle2, CircleAlert, Settings2 } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from './ui/sheet';
import SubsystemIcon from './subsystem-icon';
import { Commands, Hardware } from './studio-views';
import { DriveControls } from './drivetrain-editor';
import { wizardProgress } from '@/lib/build-wizard';
import { subsystemKind, subsystemPlacement, subsystemTemplates, type SubsystemKind } from '@/lib/subsystem-layout';
import { driveType } from '@/lib/drivetrain';
import type { Project, Issue } from '@/lib/robot-model';

type Props={project:Project;update:(patch:Partial<Project>)=>void;issues:Issue[];subsystemId:string;onClose:()=>void;setTab:(tab:string)=>void};
const motorHelp:Partial<Record<SubsystemKind,string>>={
  swerve:'Add four drive controllers and four steering controllers. Set each motor’s role, then assign the corners in the Drivetrain step.',
  differential:'Add the motor controllers for both sides. Assign each to Left side or Right side; use equal counts, from one to four per side.',
  westCoast:'Add the motor controllers for both sides. Assign each to Left side or Right side; use equal counts, from one to four per side.',
  tank:'Add the motor controllers for both sides. Assign each to Left side or Right side; use equal counts, from one to four per side.',
  mecanum:'Add one controller for each wheel. Assign the four corners in the Drivetrain step.',
  turret:'Add the motor controller that rotates the turret. Set its current limit and direction for your mechanism.',
  shooter:'Add your flywheel controllers. A motor command runs all motors in this subsystem; separate independently controlled mechanisms into their own subsystems.',
  indexer:'Add the controllers that move or stage game pieces. You can use a sensor to end the indexing command.',
  intake:'Add the roller controller. If a separate motor deploys the intake, give it a separate subsystem for independent control.',
};

export default function SubsystemSetup({project,update,issues,subsystemId,onClose,setTab}:Props){
  const subsystem=project.subsystems.find(s=>s.id===subsystemId);
  const [stage,setStage]=useState(0),body=useRef<HTMLDivElement>(null),heading=useRef<HTMLHeadingElement>(null);
  const isDrive=subsystemId==='drive';
  const stages=isDrive?['About','Motors','Sensors & devices','Drivetrain','Drive controls','Review']:['About','Motors','Sensors & devices','Commands','Review'];
  useEffect(()=>{body.current?.scrollTo({top:0});heading.current?.focus({preventScroll:true});},[stage]);
  if(!subsystem)return null;
  const kind=subsystemKind(project,subsystem),state=wizardProgress(project,issues).subsystems.find(s=>s.id===subsystemId)!;
  const props={project,update,issues,subsystemId,setTab,tab:'Build wizard'};
  const current=stages[stage];
  const findings=[...state.hardwareErrors,...state.commandErrors].filter((item,index,all)=>all.findIndex(i=>i.message===item.message)===index);
  const change=(patch:Partial<typeof subsystem>)=>update({subsystems:project.subsystems.map(s=>s.id===subsystemId?{...s,...patch}:s)});
  const go=(tab:string)=>{onClose();setTab(tab);};
  return <Sheet open onOpenChange={open=>{if(!open)onClose();}}><SheetContent className="subsystem-setup" onCloseAutoFocus={e=>{e.preventDefault();document.getElementById('chassis-part-'+subsystemId)?.focus({preventScroll:true});}}>
    <SheetHeader className="subsystem-setup-header"><span className="setup-part-icon"><SubsystemIcon kind={kind}/></span><div><SheetTitle>{subsystem.name} setup</SheetTitle><SheetDescription>Configure this subsystem one step at a time. Changes save with your robot.</SheetDescription></div></SheetHeader>
    <nav className="subsystem-setup-steps" aria-label="Subsystem setup steps">{stages.map((name,i)=><button key={name} aria-current={stage===i?'step':undefined} onClick={()=>setStage(i)}><span>{i+1}</span>{name}</button>)}</nav>
    <div className="subsystem-setup-body" ref={body}>
      <div className="setup-stage-heading"><small>STEP {stage+1} OF {stages.length}</small><h2 ref={heading} tabIndex={-1}>{current}</h2></div>
      {current==='About'?<div className="view-stack">
        <section className="panel"><div className="form-grid two">
          <label className="form-field"><span>Subsystem name</span><input aria-label="Setup subsystem name" value={subsystem.name} maxLength={40} onChange={e=>change({name:e.target.value})}/></label>
          <label className="form-field"><span>Subsystem icon</span><select aria-label="Subsystem icon" value={kind} disabled={isDrive} onChange={e=>change({layout:{...subsystemPlacement(project,subsystem),kind:e.target.value as SubsystemKind}})}>{subsystemTemplates.filter(t=>isDrive?!!t.drive:!t.drive).map(t=><option value={t.kind} key={t.kind}>{t.name}</option>)}</select></label>
          <label className="form-field setup-description"><span>What does it do?</span><textarea aria-label="Subsystem purpose" value={subsystem.description} maxLength={200} placeholder="Describe this mechanism’s job on your robot." onChange={e=>change({description:e.target.value})}/></label>
        </div></section>
        <div className="setup-guide"><Settings2 size={22}/><div><b>{isDrive?'Wire your drivetrain into the project.':'Give this mechanism its own hardware and commands.'}</b><p>{isDrive?'Define the motors and sensors, then configure wheel geometry, feedback, and the driver command.':'Choose the motor controllers, add sensors and other devices, then define timed or sensor-stopped actions.'}</p></div></div>
        {['turret','arm','elevator','climber'].includes(kind)&&<p className="setup-note">This template organizes hardware and bounded output commands. Closed-loop angle or position control requires additional robot code.</p>}
        <div className="setup-inventory"><span><b>{state.motors}</b> motor controllers</span><span><b>{state.devices}</b> sensors / devices</span><span><b>{isDrive?'Default drive':state.commands}</b>{isDrive?' command':' commands'}</span></div>
      </div>:current==='Motors'?<div className="view-stack"><p className="setup-guide-text">{motorHelp[kind]||'Add the controllers on this mechanism, then match their CAN IDs or PWM channels, current limits, and directions. Use Next if this subsystem has no motors.'}</p><Hardware key="motors" {...props} hardwareStage="motors"/></div>
      :current==='Sensors & devices'?<div className="view-stack"><p className="setup-guide-text">{kind==='swerve'?'Add an absolute encoder for each module. Select a CANcoder or a duty-cycle encoder connected to the roboRIO; assign each encoder in the next step.':'Add feedback such as encoders, distance sensors, and limit switches, or outputs such as valves and servos. This step is optional when no extra devices are needed.'}{isDrive&&' Select the main heading sensor in the Drivetrain step to avoid adding the same gyro twice.'}</p><Hardware key="devices" {...props} hardwareStage="devices"/></div>
      :current==='Drivetrain'?<Hardware key="feedback" {...props} hardwareStage="feedback"/>
      :current==='Drive controls'?<div className="view-stack"><div className="setup-guide"><Settings2 size={22}/><div><b>The driver command is generated automatically.</b><p>It controls {driveType(project)==='swerve'||driveType(project)==='mecanum'?'forward motion, strafe, and rotation':'the left and right wheel groups'} whenever autonomous is not using the drivetrain.</p></div></div><section className="panel"><div className="form-grid two"><label className="form-field"><span>Driver controller</span><select aria-label="Setup driver controller" value={project.controls.driverType} onChange={e=>update({controls:{...project.controls,driverType:e.target.value as 'Xbox'|'Joystick'}})}><option>Xbox</option><option>Joystick</option></select></label><label className="form-field"><span>Driver Station USB port</span><input aria-label="Setup driver USB port" type="number" min={0} max={5} value={project.controls.driverPort} onChange={e=>update({controls:{...project.controls,driverPort:e.target.valueAsNumber}})}/></label></div></section><DriveControls project={project} update={update}/></div>
      :current==='Commands'?<div className="view-stack">{!state.hardwareReady&&<div className="setup-guide"><Cable size={21}/><div><b>Hardware setup is still incomplete.</b><p>You can draft actions now and finish their hardware connections later.</p></div></div>}{state.hardwareReady&&!state.needsCommands&&<div className="setup-guide"><CheckCircle2 size={22}/><p>Sensor-only and passive subsystems do not need output commands. Their available telemetry is generated automatically.</p></div>}<Commands {...props}/>{state.commandErrors.map((i,n)=><div className="issue error" key={n}><CircleAlert size={18}/><p>{i.message}</p></div>)}</div>
      :<div className="view-stack"><div className={'setup-summary '+(state.complete?'complete':'')}><CheckCircle2 size={26}/><div><h3>{state.complete?'Subsystem configured':state.status}</h3><p>{state.complete?'Its hardware and behavior are configured. Build and physical robot testing follow.':'Keep your draft and return to the steps above whenever you are ready.'}</p></div></div><div className="setup-review-lines"><div><span>Motor controllers</span><b>{state.motors}</b><button onClick={()=>setStage(1)}>Edit motors</button></div><div><span>Sensors & devices</span><b>{state.devices}</b><button onClick={()=>setStage(2)}>Edit devices</button></div><div><span>{isDrive?'Driver behavior':'Commands'}</span><b>{isDrive?'Default drive':state.commands}</b><button onClick={()=>setStage(stages.indexOf(isDrive?'Drive controls':'Commands'))}>Edit behavior</button></div></div>{findings.length>0&&<div className="wizard-errors">{findings.map((i,n)=><p key={n}><CircleAlert size={18}/>{i.message}</p>)}</div>}<div className="setup-after"><button className="button" onClick={()=>go(isDrive?'Autonomous':'Controls')}>{isDrive?'Plan autonomous':'Assign command buttons'}</button><button className="button" onClick={()=>go('Preflight')}>Robot preflight</button></div></div>}
    </div>
    <div className="subsystem-setup-footer"><button className="button" onClick={onClose}>Back to chassis</button><span>{state.complete?<><CheckCircle2 size={17}/>Configured</>:state.status}</span><button className="button" disabled={stage===0} onClick={()=>setStage(stage-1)}>Previous</button><button className="button primary" onClick={()=>stage===stages.length-1?onClose():setStage(stage+1)}>{stage===stages.length-1?'Finish for now':'Next: '+stages[stage+1]}</button></div>
  </SheetContent></Sheet>;
}
