import { checkpointSchema, mergeHistory, HISTORY_LIMIT, type Checkpoint } from './development';
const DATABASE = 'robotforge-development-v1', STORE = 'checkpoints';
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) { reject(Error('Checkpoint storage is unavailable in this browser. Download a project backup before replacing your work.')); return; }
    let blocked = false;
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onerror = () => reject(Error('Could not open checkpoint storage. Download a backup to preserve your work.'));
    request.onblocked = () => { blocked = true; reject(Error('Another RobotForge tab is blocking checkpoint storage. Close it and try again.')); };
    request.onsuccess = () => { const db = request.result; if (blocked) { db.close(); return; } db.onversionchange = () => db.close(); resolve(db); };
  });
}
async function transaction<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore, done: (value: T) => void, fail: (e: Error) => void) => void): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode); let value: T, error: Error | undefined;
    tx.oncomplete = () => { db.close(); resolve(value); };
    tx.onabort = () => { db.close(); reject(error || Error('Checkpoint storage could not save this change. Your current project was kept. Download a backup and free browser storage.')); };
    tx.onerror = () => { /* onabort is the single failure path. */ };
    const fail = (e: Error) => { error = e; tx.abort(); };
    try { run(tx.objectStore(STORE), v => { value = v; }, fail); } catch (e) { fail(e as Error); }
  });
}
export function listCheckpoints() {
  return transaction<Checkpoint[]>('readonly', (store, done, fail) => {
    const request = store.getAll(); request.onsuccess = () => { try { done(request.result.map(c => checkpointSchema.parse(c)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))); } catch { fail(Error('Saved checkpoint data needs recovery. The current project has not been changed.')); } };
  });
}
export function saveCheckpoint(checkpoint: Checkpoint) {
  checkpointSchema.parse(checkpoint);
  return transaction<void>('readwrite', (store, done, fail) => {
    const count = store.count(); count.onsuccess = () => {
      if (count.result >= HISTORY_LIMIT) { fail(Error(`The ${HISTORY_LIMIT}-checkpoint limit is reached. Download history and remove an older checkpoint before saving another.`)); return; }
      store.add(checkpoint); done();
    };
  });
}
export function removeCheckpoint(id: string) { return transaction<void>('readwrite', (store, done) => { store.delete(id); done(); }); }
export function importCheckpoints(incoming: Checkpoint[]) {
  return transaction<number>('readwrite', (store, done, fail) => {
    const request = store.getAll(); request.onsuccess = () => {
      try { const before = request.result.map(c => checkpointSchema.parse(c)); const merged = mergeHistory(before, incoming); merged.forEach(c => store.put(c)); done(merged.length - before.length); }
      catch (e) { fail(e as Error); }
    };
  });
}
