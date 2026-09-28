"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Download, LockKeyhole, Package, RefreshCw, Undo2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import type { Project } from '@/lib/robot-model';
import { librarySettings } from '@/lib/library-project';
import { vendorIds, vendorRegistry, lockKey, mergeNewer, validateLibraryLock, type LibraryCatalog, type LibrarySettings } from '@/lib/libraries';
import { download } from '@/lib/zip';

export function useLibraryUpdates(ready: boolean, project: Project, update: (patch: Partial<Project>)=>void) {
  const latest = useRef({ project, update });
  useEffect(() => { latest.current = { project, update }; }, [project, update]);
  const [catalog, setCatalog] = useState<LibraryCatalog|null>(null), [checking, setChecking] = useState(false), [error, setError] = useState('');
  const busy = useRef(false);
  const check = useCallback(async (force = false) => {
    if (busy.current) return;
    busy.current = true; setChecking(true);
    try {
      const response = await fetch('/api/libraries' + (force ? '?refresh=1' : ''), { cache: 'no-cache', signal: AbortSignal.timeout(25000) });
      if (!response.ok) throw Error('Update service unavailable. Your saved versions are still usable.');
      const result = await response.json() as LibraryCatalog;
      result.lock = validateLibraryLock(result.lock);
      setCatalog(result); setError('');
      const state = latest.current, settings = librarySettings(state.project);
      if (settings.mode === 'automatic') {
        const lock = mergeNewer(settings.lock, result.lock);
        if (!state.project.libraries || lockKey(lock) !== lockKey(settings.lock)) {
          state.update({ libraries: { ...settings, lock, previous: settings.lock } });
          if (state.project.libraries) toast.info('Stable library updates applied. Build and test before deploying.');
        }
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not check for updates. Keeping your saved versions.'); }
    finally { busy.current = false; setChecking(false); }
  }, []);
  useEffect(() => {
    if (!ready) return;
    const kickoff = setTimeout(check, 0);
    const timer = setInterval(check, 60 * 60 * 1000);
    const online = () => { void check(); };
    window.addEventListener('online', online);
    return () => { clearTimeout(kickoff); clearInterval(timer); window.removeEventListener('online', online); };
  }, [ready, check]);
  return { catalog, checking, error, check };
}
export type UpdateStatus = ReturnType<typeof useLibraryUpdates>;
export default function LibraryUpdates({ project, update, status }: { project: Project; update: (patch: Partial<Project>)=>void; status: UpdateStatus }) {
  const settings = librarySettings(project), { catalog, checking, error, check } = status;
  const next = catalog ? mergeNewer(settings.lock, catalog.lock) : settings.lock;
  const available = lockKey(next) !== lockKey(settings.lock);
  const change = (patch: Partial<LibrarySettings>) => update({ libraries: { ...settings, ...patch } });
  return <div className="view-stack library-view"><div className="page-heading"><div><div className="eyebrow">LIBRARIES & UPDATES</div><h1>Keep your robot’s tools current.</h1><p>Official releases, exact versions, and a competition freeze when you need it.</p></div></div>
    <section className="panel"><div className="panel-title"><div><h2>2026 update policy</h2><p>{checking ? 'Checking official release feeds…' : catalog ? `Last checked ${new Date(catalog.checkedAt).toLocaleString()}` : 'Using saved library versions until the next successful check.'}</p></div><button className="button" disabled={checking} onClick={()=>check(true)}><RefreshCw size={16}/>{checking ? 'Checking…' : 'Check now'}</button></div><div className="library-policy"><div><h3>{settings.mode === 'automatic' ? 'Automatic stable updates' : 'Frozen for this project'}</h3><p>Check on opening, every hour while the app is open, and when your internet returns. Online companion builds also resolve the latest stable releases. Updates stay within the 2026 season.</p></div><Switch aria-label="Automatic stable library updates" checked={settings.mode === 'automatic'} onCheckedChange={on=>change({ mode: on ? 'automatic' : 'frozen', ...(on && catalog && available ? { lock: next, previous: settings.lock } : {}) })}/></div>
      <div className="library-policy-note"><LockKeyhole size={17}/><span>Turn automatic updates off before an event. Builds and exports keep an exact library snapshot; deployment uses the versions that passed that build.</span></div>
      {available && settings.mode === 'frozen' && <div className="library-actions"><span>New stable versions are available. Your project remains frozen.</span><button className="button" onClick={()=>change({ lock: next, previous: settings.lock })}>Apply available updates</button></div>}
      <div className="library-actions"><button className="text-button" disabled={!settings.previous} onClick={()=>{if(settings.previous){change({ lock: settings.previous, previous: settings.lock, mode: 'frozen' });toast.success('Previous versions restored and automatic updates paused. Build again before deploying.');}}}><Undo2 size={15}/>Restore previous versions</button><button className="text-button" onClick={()=>download(JSON.stringify(settings.lock,null,2),'robotforge-libraries.lock.json','application/json')}><Download size={15}/>Save version snapshot</button></div>
      {(error || !!catalog?.errors.length) && <div className="issue warning" role="status"><div><b>Some update checks could not finish.</b><p>{error || 'Saved versions are retained for unavailable feeds. No dependency is downgraded.'}</p>{!!catalog?.errors.length && <details><summary>Show feed details</summary>{catalog.errors.map(e=><p key={e}>{e}</p>)}</details>}</div></div>}
    </section>
    <section className="panel"><div className="panel-title"><div><h2>Core FIRST tools</h2><p>Stable releases only. New-season releases and previews are excluded.</p></div><span className="tag">2026</span></div><div className="library-core"><div><b>WPILib / GradleRIO</b><span>{settings.lock.wpilib}</span><a href="https://github.com/wpilibsuite/allwpilib/releases" target="_blank" rel="noreferrer">Release notes <ArrowUpRight size={13}/></a></div><div><b>RobotPy</b><span>{settings.lock.robotpy}</span><a href="https://github.com/robotpy/robotpy/releases" target="_blank" rel="noreferrer">Release notes <ArrowUpRight size={13}/></a></div></div></section>
    <section className="panel"><div className="panel-title"><div><h2>Vendor libraries</h2><p>Java and C++ receive vendordep files. Python receives the matching pinned package.</p></div><Package size={23}/></div><div className="vendor-list">{vendorIds.map(id=>{const def=vendorRegistry[id], enabled=def.required || settings.extras.includes(id), release=settings.lock.vendors[id];return <div className="vendor-item" key={id}><div className="vendor-description"><h3>{def.name}{def.required && <span className="tag">Generator dependency</span>}</h3><p>{def.description}</p><a href={def.docs} target="_blank" rel="noreferrer">API documentation <ArrowUpRight size={13}/></a></div><div className="vendor-versions"><span>Java / C++ <b>{release.manifest.version}</b></span><span>Python <b>{release.python}</b></span></div><Switch aria-label={`Include ${def.name}`} checked={enabled} disabled={def.required} onCheckedChange={on=>change({extras:on?[...settings.extras,id]:settings.extras.filter(v=>v!==id)})}/></div>;})}</div></section>
    <div className="info-note">Adding a library installs its APIs in the generated project. Device-specific logic for PWF sensors, navX, and PhotonVision still needs to be written in the exported code; the robot editor currently generates its existing motor and drivetrain integrations. A library update does not automatically rewrite code for breaking API changes. The companion blocks deployment if the updated project fails to build.</div>
  </div>;
}
