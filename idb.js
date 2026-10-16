// Simple IndexedDB helper for LISTTA
const IDB_NAME = 'listta_db';
const IDB_VERSION = 1;
const STORE_DATA = 'app_data';
const STORE_PENDING = 'pending_ops';

function openDb(){
  return new Promise((resolve, reject)=>{
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if(!db.objectStoreNames.contains(STORE_DATA)) db.createObjectStore(STORE_DATA);
      if(!db.objectStoreNames.contains(STORE_PENDING)) db.createObjectStore(STORE_PENDING, {keyPath:'id'});
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}

async function idbPut(store, key, value){
  const db = await openDb();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value, key);
    tx.oncomplete = ()=>resolve(true);
    tx.onerror = e=>reject(e.target.error);
  });
}

async function idbGet(store, key){
  const db = await openDb();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = ()=>resolve(req.result);
    req.onerror = e=>reject(e.target.error);
  });
}

async function idbGetAll(store){
  const db = await openDb();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = ()=>resolve(req.result||[]);
    req.onerror = e=>reject(e.target.error);
  });
}

async function addPendingOp(op){
  // op must have id
  await idbPut(STORE_PENDING, op.id, op);
}

async function clearPendingOp(id){
  const db = await openDb();
  return new Promise((resolve,reject)=>{
    const tx = db.transaction(STORE_PENDING,'readwrite');
    tx.objectStore(STORE_PENDING).delete(id);
    tx.oncomplete = ()=>resolve(true);
    tx.onerror = e=>reject(e.target.error);
  });
}

// export helpers to window
window.LISTTA_IDB = {idbPut,idbGet,idbGetAll,addPendingOp,clearPendingOp};
