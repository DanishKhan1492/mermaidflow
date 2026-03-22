export interface SavedDiagram {
  id: string;
  name: string;
  code: string;
  type: string;
  createdAt: number;
  favorite: boolean;
}

const DB_NAME = 'mermaidflow';
const STORE_NAME = 'diagrams';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('favorite', 'favorite', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function detectDiagramType(code: string): string {
  const first = code.trim().split('\n')[0]?.trim().toLowerCase() ?? '';
  if (first.startsWith('sequencediagram')) return 'sequence';
  if (first.startsWith('flowchart') || first.startsWith('graph')) return 'flowchart';
  if (first.startsWith('classdiagram')) return 'class';
  if (first.startsWith('statediagram')) return 'state';
  if (first.startsWith('erdiagram')) return 'er';
  if (first.startsWith('gantt')) return 'gantt';
  if (first.startsWith('pie')) return 'pie';
  if (first.startsWith('gitgraph')) return 'git';
  return 'other';
}

export async function saveDiagram(code: string, name?: string): Promise<SavedDiagram> {
  const db = await openDB();
  const type = detectDiagramType(code);
  const diagram: SavedDiagram = {
    id: crypto.randomUUID(),
    name: name ?? `${type.charAt(0).toUpperCase() + type.slice(1)} — ${new Date().toLocaleString()}`,
    code,
    type,
    createdAt: Date.now(),
    favorite: false,
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(diagram);
    tx.oncomplete = () => resolve(diagram);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllDiagrams(): Promise<SavedDiagram[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).index('createdAt').getAll();
    req.onsuccess = () => resolve((req.result as SavedDiagram[]).reverse());
    req.onerror = () => reject(req.error);
  });
}

export async function deleteDiagram(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function toggleFavorite(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const diagram = getReq.result as SavedDiagram | undefined;
      if (diagram) {
        diagram.favorite = !diagram.favorite;
        store.put(diagram);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearAllDiagrams(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
