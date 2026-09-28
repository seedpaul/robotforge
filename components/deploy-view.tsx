"use client";
import { useEffect, useState } from 'react';
import { Cable, Download, Hammer, Radio, Rocket, Terminal, Unplug, X } from 'lucide-react';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { projectSchema, type Project } from '@/lib/robot-model';

type Job = { id: string; state: 'building'|'ready'|'deploying'|'deployed'|'failed'|'cancelled'; team: number; language: string; target: string; fingerprint: string; log: string; error: string|null; libraries?: string|null };
const BRIDGE = 'http://127.0.0.1:5819';
// Pairing credentials never enter project backups, cloud storage, or persistent browser storage.
const session: { token: string; builtPayload: string } = { token: '', builtPayload: '' };
const labels = { building: 'Building on your laptop…', ready: 'Build passed · ready for review', deploying: 'Sending code to the robot…', deployed: 'Deployment tool reported success', failed: 'Operation failed', cancelled: 'Build cancelled' };
export default function DeployView({ project, blocked }: { project: Project; blocked: boolean }) {
  const [code, setCode] = useState(session.token), [paired, setPaired] = useState(false), [working, setWorking] = useState(false);
  const [error, setError] = useState(''), [job, setJob] = useState<Job|null>(null), [connection, setConnection] = useState('network'), [offline, setOffline] = useState(false);
  const [snapshot, setSnapshot] = useState(session.builtPayload), [review, setReview] = useState(false), [team, setTeam] = useState(''), [disabled, setDisabled] = useState(false);
  const parsed = projectSchema.safeParse(project);
  const payload = JSON.stringify({ project: parsed.success ? parsed.data : project, connection, offline });
  const running = job?.state === 'building' || job?.state === 'deploying';
  const target = connection === 'usb' ? '172.22.11.2' : `roborio-${project.team}-FRC.local`;
  const canDeploy = paired && !error && !working && !blocked && job?.state === 'ready' && snapshot === payload;

  async function request(endpoint: string, body?: unknown, token = session.token) {
    let response: Response;
    try { response = await fetch(BRIDGE + endpoint, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10000), cache: 'no-store' }); }
    catch { throw Error('Cannot reach your companion. Keep its window open on this computer. In Chrome or Edge, allow local network access for this site, then connect again.'); }
    const result = await response.json() as { protocol?: number; job: Job|null; error?: string };
    if (!response.ok) throw Error(result.error || 'The companion could not complete that request.');
    return result;
  }
  async function connect() {
    setWorking(true); setError('');
    try { const result = await request('/status', undefined, code.trim()); if (result.protocol !== 4) throw Error('Download the latest companion to continue.'); session.token = code.trim(); setJob(result.job); setPaired(true); }
    catch (e) { setError((e as Error).message); setPaired(false); }
    finally { setWorking(false); }
  }
  useEffect(() => {
    if (!paired) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try { const result = await request('/status'); if (!disposed) { setJob(result.job); setError(''); } }
      catch (e) { if (!disposed) setError((e as Error).message); }
      if (!disposed) timer = setTimeout(poll, 1200);
    }
    timer = setTimeout(poll, 1200);
    return () => { disposed = true; clearTimeout(timer); };
  }, [paired]);
  async function act(action: 'build'|'deploy'|'cancel') {
    setWorking(true); setError('');
    try {
      const body = action === 'build' ? JSON.parse(payload) : action === 'deploy' ? { ...JSON.parse(payload), id: job?.id, confirmTeam: team, disabled } : { id: job?.id };
      const result = await request('/' + action, body);
      if (action === 'build') { setSnapshot(payload); session.builtPayload = payload; }
      setJob(result.job);
    } catch (e) { setError((e as Error).message); }
    finally { setWorking(false); }
  }
  return <section className="panel deploy-panel" aria-labelledby="deploy-title">
    <div className="panel-title"><div><h2 id="deploy-title"><Rocket size={20}/> Deploy to robot</h2><p>Build on your laptop, then send the reviewed project to your roboRIO.</p></div><span className={`tag ${paired && !error ? 'connected-tag' : ''}`}>{paired && !error ? 'Companion connected' : 'Companion required'}</span></div>
    {!paired && <div className="deploy-setup">
      <div><span className="step-number">1</span><h3>Start your companion</h3><p>Download and extract the ZIP on your laptop. Open <b>Start RobotForge.cmd</b> on Windows, or run <b>node companion.mjs</b> on macOS/Linux. Keep that window open.</p><a className="button" href="/companion/RobotForge-Companion.zip" download><Download size={16}/>Download companion</a><details><summary>One-time setup & troubleshooting</summary><p>Install <a href="https://nodejs.org/en/download" target="_blank" rel="noreferrer">Node.js 22.13+</a>. For Java/C++, install the <a href="https://docs.wpilib.org/en/stable/docs/zero-to-robot/step-2/wpilib-setup.html" target="_blank" rel="noreferrer">2026 WPILib tools</a> (including the C++ roboRIO toolchain). For Python, install Python 3.12; the companion creates an isolated RobotPy environment on your first build.</p><p>Use Chrome or Edge on the same computer and allow this site to access your local network. If your school blocks this permission, use the exported project in WPILib VS Code. The included README explains custom tool locations.</p></details></div>
      <div><span className="step-number">2</span><h3>Pair this browser</h3><p>Paste the pairing code shown in the companion window. It changes each time you start the companion.</p><label className="form-field">Pairing code<input type="password" autoComplete="off" spellCheck={false} value={code} onChange={e=>setCode(e.target.value)} placeholder="Paste code from companion"/></label><button className="button primary" disabled={working || !code.trim()} onClick={connect}><Cable size={16}/>{working ? 'Connecting…' : 'Connect companion'}</button></div>
    </div>}
    {paired && <>
      <div className="deploy-controls"><label className="form-field">Robot connection<Select value={connection} onValueChange={setConnection} disabled={running || working}><SelectTrigger className="select-control" aria-label="Robot connection"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="network">Robot network · team hostname</SelectItem><SelectItem value="usb">USB cable · 172.22.11.2</SelectItem></SelectContent></Select><small><Radio size={13}/> {target}</small></label><label className="deploy-check"><input type="checkbox" checked={offline} disabled={running || working} onChange={e=>setOffline(e.target.checked)}/><span>Use cached dependencies<small>For the robot network or an event. Complete one online build first.</small></span></label></div>
      <div className="deploy-actions"><button className="button" disabled={working || running || blocked || !!error} onClick={()=>act('build')}><Hammer size={16}/>Build {project.language} project</button><button className="button primary" disabled={!canDeploy} onClick={()=>{setTeam('');setDisabled(false);setReview(true);}}><Rocket size={16}/>Review & deploy</button>{job?.state === 'building' && <button className="text-button" disabled={working} onClick={()=>act('cancel')}><X size={15}/>Cancel build</button>}<button className="text-button" disabled={running || working} onClick={()=>{setPaired(false);session.token='';setCode('');setError('');}}><Unplug size={15}/>Disconnect</button></div>
      {blocked && <p className="deploy-hint">Resolve the configuration errors in Preflight before building.</p>}
      {job?.state === 'ready' && snapshot !== payload && <p className="deploy-hint">Your configuration or connection changed. Build again to update the reviewed project.</p>}
      <p className="deploy-hint">Build while connected to the internet first. Then join your robot network or connect USB. Keep the robot disabled during deployment.</p>
    </>}
    {error && <div className="issue error" role="alert"><div>{error}{paired && <button className="text-button" onClick={()=>{setPaired(false);setJob(null);setError('');session.token='';setCode('');}}>Pair again (current operation continues)</button>}</div></div>}
    {job && <div className="deploy-result"><div className="deploy-result-header" role="status"><strong>{labels[job.state]}</strong><span>Team {job.team} · {job.language} · {job.target}</span></div>{job.state === 'deploying' && <p>Keep the robot powered and the companion open. An upload cannot be safely cancelled here.</p>}{job.state === 'deployed' && <p>Confirm code status in Driver Station and inspect robot logs before enabling. Tool success does not verify hardware behavior.</p>}<p className="deploy-hint">{job.libraries}</p><details open={running || job.state === 'failed'}><summary><Terminal size={15}/> Build & deployment log</summary><pre className="deployment-log" aria-label="Build and deployment log">{job.log || 'Waiting for build output…'}</pre></details></div>}
    <AlertDialog open={review} onOpenChange={setReview}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Deploy to Team {job?.team}?</AlertDialogTitle><AlertDialogDescription>This replaces the robot program and deployed path files at {job?.target}. The robot program restarts after upload. Verify the connected robot before continuing.</AlertDialogDescription></AlertDialogHeader><label className="form-field">Type team number {job?.team}<input inputMode="numeric" value={team} onChange={e=>setTeam(e.target.value)} autoComplete="off"/></label><label className="deploy-check"><input type="checkbox" checked={disabled} onChange={e=>setDisabled(e.target.checked)}/><span>I verified this is our robot, it is disabled, and it is safe to update.</span></label><AlertDialogFooter><AlertDialogCancel>Go back</AlertDialogCancel><AlertDialogAction disabled={!canDeploy || team !== String(job?.team) || !disabled} onClick={()=>act('deploy')}>Deploy robot code</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;
}
