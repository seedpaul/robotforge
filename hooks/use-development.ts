"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Project } from '@/lib/robot-model';
import { captureCheckpoint, restoreCheckpoint, appendMechanism, type Checkpoint, type MechanismAddition } from '@/lib/development';
import { listCheckpoints, saveCheckpoint, removeCheckpoint, importCheckpoints } from '@/lib/checkpoint-store';
import { toast } from 'sonner';

export function useDevelopment(project: Project, replace: (p: Project) => void) {
  const latest = useRef({ project, replace }); latest.current = { project, replace };
  const gate = useRef(false);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]), [busy, setBusy] = useState(false), [loaded, setLoaded] = useState(false), [error, setError] = useState('');
  const refresh = useCallback(async () => { try { setCheckpoints(await listCheckpoints()); setError(''); } catch (e) { setError((e as Error).message); } finally { setLoaded(true); } }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  async function perform<T>(operation: () => Promise<T>): Promise<T | undefined> {
    if (gate.current) return;
    gate.current = true; setBusy(true); setError('');
    try { const result = await operation(); await refresh(); return result; }
    catch (e) { const message = e instanceof Error ? e.message : 'Could not save this development change.'; setError(message); toast.error(message); }
    finally { gate.current = false; setBusy(false); }
  }
  function save(name: string, notes: string) {
    return perform(async () => { const c = captureCheckpoint(latest.current.project, name, notes); await saveCheckpoint(c); toast.success('Checkpoint saved with this design and its library versions.'); return c.id; });
  }
  async function preserve(reason: Checkpoint['reason'], name: string, next: Project) {
    // Save first. If storage fails, never replace the active project.
    await saveCheckpoint(captureCheckpoint(latest.current.project, name, 'Automatic recovery copy of the working design before replacement.', reason));
    latest.current.replace(next);
  }
  function restore(c: Checkpoint) { return perform(async () => { await preserve('before-restore', 'Before restoring ' + c.name.slice(0, 60), restoreCheckpoint(c)); toast.success('Checkpoint restored. Libraries are frozen and bench checks need repeating.'); return true; }); }
  function importProject(next: Project) { return perform(async () => { await preserve('before-import', 'Before importing ' + next.name.slice(0, 60), { ...next, checks: {} }); toast.success('Project imported. Your previous design is saved in Development.'); return true; }); }
  function addMechanism(addition: MechanismAddition) { return perform(async () => { const next = appendMechanism(latest.current.project, addition); await preserve('before-addition', 'Before adding ' + addition.name.slice(0, 60), next); toast.success('Mechanism added. Existing hardware and assignments were preserved.'); return true; }); }
  function remove(id: string) { return perform(async () => { await removeCheckpoint(id); return true; }); }
  function importHistory(items: Checkpoint[]) { return perform(async () => { const count = await importCheckpoints(items); toast.success(`${count} checkpoints added. The working design was not changed.`); return true; }); }
  return { checkpoints, busy, loaded, error, refresh, save, restore, importProject, addMechanism, remove, importHistory, isLocked: () => gate.current };
}
export type DevelopmentState = ReturnType<typeof useDevelopment>;
