"use client";
import { ArrowLeft, ArrowRight, Boxes, Cable, Check, CheckCircle2, Circle, CircleAlert, Flag, Gamepad2, Plus, Route, Zap } from 'lucide-react';
import { useRef, useState } from 'react';
import type { Issue, Project } from '@/lib/robot-model';
import { driveLabel, driveType } from '@/lib/drivetrain';
import { wizardProgress, type SubsystemProgress, type WizardPosition, type WizardStep } from '@/lib/build-wizard';
import { Hardware, Commands, Subsystems } from './studio-views';
import SubsystemSetup from './subsystem-setup';
import RobotDesigner from './robot-designer';
import { DrivetrainEditor, DriveControls } from './drivetrain-editor';

type Props = { project: Project; update: (patch: Partial<Project>) => void; issues: Issue[];
  setTab: (tab: string) => void; saveStatus: string; position: WizardPosition; onPosition: (position: WizardPosition) => void };
const steps = [
  { title: 'Plan your robot', detail: 'Team, drivetrain & subsystems', icon: Flag },
  { title: 'Add the hardware', detail: 'Motors, controllers & sensors', icon: Cable },
  { title: 'Give it commands', detail: 'Actions for each subsystem', icon: Zap },
];

function RobotVisual({ project, items, selected, onSelect }: { project: Project; items: SubsystemProgress[]; selected: string; onSelect: (id: string) => void }) {
  const drive = items.find(s => s.id === 'drive'), mechanisms = items.filter(s => s.id !== 'drive');
  const height = Math.max(236, 92 + Math.ceil(mechanisms.length / 2) * 62);
  const color = (s?: SubsystemProgress) => s?.complete ? '#2d8a64' : s?.hardwareReady ? '#c77b2e' : '#74879b';
  const shape = driveType(project);
  return <aside className="wizard-visual panel" aria-label="Robot setup progress">
    <div className="panel-title"><div><div className="eyebrow">YOUR ROBOT, TAKING SHAPE</div><h2>Robot map</h2></div><Boxes size={21}/></div>
    <div className="wizard-robot-drawing">
      <svg viewBox={`0 0 300 ${height}`} role="img" aria-label={`${driveLabel(project)} robot schematic. ${items.filter(s => s.complete).length} of ${items.length} subsystems configured. Select a subsystem below to edit it.`}>
        <path d="M150 32V8m-5 6 5-6 5 6" fill="none" stroke="#97a7b8" strokeWidth="2"/>
        <rect x="36" y="42" width="228" height={height-65} rx="18" fill={drive?.complete?'#eef8f3':'#f1f5f9'} stroke={color(drive)} strokeWidth="2"/>
        {[0,1,2,3].map(i => {const x=i%2?254:21,y=i<2?54:height-84;return <g key={i}>
          {shape==='swerve'&&<circle cx={x+12} cy={y+21} r="21" fill="none" stroke={color(drive)} strokeDasharray="3 3"/>}
          <rect x={x} y={y} width="25" height="42" rx={shape==='swerve'?10:5} fill={color(drive)}/>
          {shape==='mecanum'&&[8,18,28].map(n=><path key={n} d={`M${x+4} ${y+n+(i===0||i===3?0:8)}l17 ${i===0||i===3?8:-8}`} stroke="white" strokeWidth="2"/>)}
        </g>;})}
        {(shape==='westCoast'||shape==='tank')&&[21,254].map(x=><rect key={x} x={x} y={height/2-10} width="25" height="35" rx="5" fill={color(drive)}/>)}
        <text x="150" y="65" textAnchor="middle" fontSize="10" letterSpacing="2" fill={color(drive)}>DRIVETRAIN</text>
        {!mechanisms.length&&<><path d="M150 109v26m-13-13h26" stroke="#a4b3c3" strokeWidth="2"/><text x="150" y="159" textAnchor="middle" fontSize="11" fill="#71849a">Add your mechanisms in step 1</text></>}
        {mechanisms.map((s,i)=>{const x=51+(i%2)*103,y=80+Math.floor(i/2)*62;return <g key={s.id}>
          <rect x={x} y={y} width="95" height="49" rx="7" fill={s.complete?'#d9f0e4':s.hardwareReady?'#fff0da':'#fff'} stroke={selected===s.id?'#243e5d':color(s)} strokeWidth={selected===s.id?2:1}/>
          <text x={x+47.5} y={y+21} textAnchor="middle" fontSize="11" fontWeight="600" fill="#253f58">{s.name.length>13?s.name.slice(0,12)+'…':s.name}</text>
          <text x={x+47.5} y={y+37} textAnchor="middle" fontSize="9" fill={color(s)}>{s.complete?'✓ Configured':s.hardwareReady?'Commands next':'Hardware next'}</text>
        </g>;})}
      </svg>
    </div>
    <div className="wizard-map-legend"><span><i className="pending"/>Planned</span><span><i className="partial"/>Hardware added</span><span><i className="done"/>Configured</span></div>
    <div className="wizard-progress-caption" aria-live="polite"><b>{items.filter(s=>s.complete).length} / {items.length}</b> subsystems configured</div>
    <div className="wizard-map-list">{items.map(s=><button key={s.id} aria-pressed={selected===s.id} onClick={()=>onSelect(s.id)} className={s.complete?'complete':''}>
      {s.complete?<CheckCircle2 size={18}/>:s.hardwareReady?<Zap size={18}/>:<Circle size={18}/>}
      <span><b>{s.name}</b><small>{s.status}</small></span><ArrowRight size={14}/>
    </button>)}</div>
    <p className="wizard-map-note">A schematic of your configuration. Green means hardware and behavior are configured; build and robot testing come next.</p>
  </aside>;
}

export default function BuildWizard({ project, update, issues, setTab, saveStatus, position, onPosition }: Props) {
  const [setupId,setSetupId]=useState<string|null>(null);
  const progress = wizardProgress(project, issues), step = position.step;
  const selected = progress.subsystems.find(s=>s.id===position.subsystem) || progress.subsystems[0];
  const content = useRef<HTMLHeadingElement>(null);
  const stageReady = [progress.setupReady, progress.hardwareReady, progress.commandsReady];
  const move = (next: WizardStep, subsystem = selected?.id || 'drive') => {
    onPosition({step:next,subsystem});
    requestAnimationFrame(()=>{content.current?.focus({preventScroll:true});content.current?.scrollIntoView({behavior:'smooth',block:'start'});});
  };
  const select = (id: string) => move(step===1?2:step,id);
  const shared = { project, update, issues, setTab, tab: 'Build wizard', subsystemId: selected?.id };
  const index = progress.subsystems.findIndex(s=>s.id===selected?.id);
  const nextSubsystem = progress.subsystems[index+1];
  return <div className="build-wizard">
    <div className="page-heading"><div><div className="eyebrow">BUILD WIZARD</div><h1>Build your robot.</h1><p>Place your subsystems, connect the hardware, and define what each one does.</p></div><span className="wizard-draft-tag">{saveStatus}</span></div>
    <nav className="wizard-steps" aria-label="Robot creation steps">{steps.map((s,i)=><button key={s.title} aria-current={step===i+1?'step':undefined} onClick={()=>move((i+1) as WizardStep)}>
      <span className={'wizard-step-number '+(stageReady[i]?'done':'')}>{stageReady[i]?<Check size={20}/>:i+1}</span><span><b>{s.title}</b><small>{s.detail}</small></span>
    </button>)}</nav>
    <div className={"wizard-layout "+(step===1?"designer-planning":"")}>
      <div className="wizard-editor">
        <div className="wizard-stage-heading"><span>STEP {step} OF 3</span><h2 ref={content} tabIndex={-1}>{steps[step-1].title}</h2><p>{step===1?'Tell us about your team and the mechanisms you plan to build.':step===2?'Choose a subsystem, then add and configure its real hardware.': 'Choose a subsystem and describe what you want it to do.'}</p></div>
        {step===1?<div className="view-stack"><RobotDesigner project={project} update={update} issues={issues} onConfigure={setSetupId}/>
          <section className="panel"><div className="panel-title"><div><h2>Your team & project</h2><p>This information travels with your generated robot code.</p></div><Flag size={22}/></div><div className="form-grid wizard-team-fields">
            <label className="form-field"><span>Team number</span><input aria-label="Team number" type="number" min="1" max="99999" placeholder="e.g. 254" value={project.team||''} onChange={e=>update({team:e.target.value===''?0:e.target.valueAsNumber})}/></label>
            <label className="form-field"><span>Team / robot project name</span><input aria-label="Team / robot project name" maxLength={60} value={project.name} onChange={e=>update({name:e.target.value})}/></label>
            <label className="form-field"><span>Robot code language</span><select aria-label="Robot code language" value={project.language} onChange={e=>update({language:e.target.value as Project['language']})}>{['Java','C++','Python'].map(l=><option key={l}>{l}</option>)}</select></label>
          </div>{!progress.setupReady&&<p className="wizard-inline-help">Enter a team number and name, and give each subsystem a name to complete this step.</p>}</section>

          <details className="wizard-subsystems designer-list-editor"><summary>Manage subsystem list</summary><Subsystems {...shared}/></details>
        </div>:selected?<>
          <div className="wizard-subsystem-picker"><label className="form-field"><span>Working on subsystem</span><select aria-label="Working on subsystem" value={selected.id} onChange={e=>select(e.target.value)}>{progress.subsystems.map(s=><option key={s.id} value={s.id}>{s.name} · {step===2?(s.hardwareReady?'Hardware configured':'Needs hardware setup'):(s.complete?'Configured':s.status)}</option>)}</select></label><button className="text-button" onClick={()=>move(1)}><Plus size={15}/>Add a subsystem</button></div>
          <div className="wizard-subsystem-context"><span className="card-icon">{step===2?<Cable size={22}/>:<Zap size={22}/>}</span><div><h3>{selected.name}</h3><p>{selected.description || 'Build this subsystem at your own pace.'}</p><small>{selected.motors} motor controllers · {selected.devices} other components · {selected.id==='drive'?'Default drive command':`${selected.commands} commands`}</small></div><span className={'wizard-status '+(selected.complete?'complete':'')}>{selected.status}</span></div>
          {step===2?<Hardware key={selected.id} {...shared}/>:<div className="view-stack">
            {!selected.hardwareReady&&<div className="wizard-callout"><Cable size={20}/><div><b>This subsystem still needs hardware setup.</b><p>Add or fix its components so commands can use them.</p></div><button className="button" onClick={()=>move(2)}>Set up hardware</button></div>}
            {selected.id==='drive'?<>
              <section className="panel"><div className="panel-title"><div><h2>Driving is your default command</h2><p>The generated drivetrain command runs whenever no autonomous path is using it. Set how your driver controls it below.</p></div><Gamepad2 size={24}/></div><div className="form-grid two">
                <label className="form-field"><span>Driver controller</span><select aria-label="Wizard driver controller" value={project.controls.driverType} onChange={e=>update({controls:{...project.controls,driverType:e.target.value as 'Xbox'|'Joystick'}})}><option>Xbox</option><option>Joystick</option></select></label>
                <label className="form-field"><span>Driver Station USB port</span><input aria-label="Wizard driver USB port" type="number" min="0" max="5" value={project.controls.driverPort} onChange={e=>update({controls:{...project.controls,driverPort:e.target.valueAsNumber}})}/></label>
              </div></section><DriveControls project={project} update={update}/>
              <div className="wizard-callout"><Route size={21}/><div><b>Path following is a drivetrain action, too.</b><p>Build the route and autonomous sequence in Autonomous.</p></div><button className="button" onClick={()=>setTab('Autonomous')}>Plan autonomous <ArrowRight size={15}/></button></div>
            </>:<>
              {selected.hardwareReady&&!selected.needsCommands&&<div className="info-note"><CheckCircle2 size={20}/><div>This subsystem contains sensors, power, or passive components. Its available telemetry is generated automatically. It does not need an output command unless you add an actuator.</div></div>}
              <Commands key={selected.id} {...shared}/>
            </>}
            {selected.commandErrors.length>0&&<div className="wizard-errors" role="status">{selected.commandErrors.map((i,n)=><p key={n}><CircleAlert size={17}/>{i.message}</p>)}</div>}
          </div>}
          {nextSubsystem&&<button className="wizard-next-subsystem" onClick={()=>select(nextSubsystem.id)}><span>Next subsystem <b>{nextSubsystem.name}</b></span><ArrowRight size={19}/></button>}
        </>:null}
        {step===3&&<section className="wizard-finish"><CheckCircle2 size={25}/><div><h2>{progress.complete?'Your robot configuration is taking shape.':'Keep building at your own pace.'}</h2><p>{progress.subsystems.filter(s=>s.complete).length} of {progress.subsystems.length} subsystems configured. Next, assign command buttons, plan autonomous, and run preflight before building and deploying.</p><div><button className="button" onClick={()=>setTab('Controls')}><Gamepad2 size={16}/>Assign buttons</button><button className="button" onClick={()=>setTab('Logic builder')}>Combine commands</button></div></div></section>}
        <div className="wizard-navigation"><button className="button" disabled={step===1} onClick={()=>move((step-1) as WizardStep)}><ArrowLeft size={16}/>Back</button><span>{stageReady[step-1]?<><CheckCircle2 size={16}/>Step configured</>:'You can revisit any step.'}</span><button className="button primary" onClick={()=>step<3?move((step+1) as WizardStep,'drive'):setTab('Preflight')}>{step===1?'Continue to hardware':step===2?'Continue to commands':'Review preflight'}<ArrowRight size={16}/></button></div>
      </div>
      {step!==1&&<RobotVisual project={project} items={progress.subsystems} selected={selected?.id||'drive'} onSelect={select}/>}
    </div>
    {setupId&&<SubsystemSetup key={setupId} project={project} update={update} issues={issues} subsystemId={setupId} onClose={()=>setSetupId(null)} setTab={setTab}/>}
  </div>;
}
