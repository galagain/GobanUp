import {evaluatePly,isTurningPoint} from './review-grade.js';

let database;
function openCache(){
  if(!database)database=new Promise(resolve=>{
    try{
      const request=indexedDB.open('gobanup-game-reviews',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('moves');
      request.onsuccess=()=>resolve(request.result);
      request.onerror=request.onblocked=()=>resolve(null);
    }catch{resolve(null)}
  });
  return database;
}
async function cacheRequest(mode,operation){
  try{
    const db=await openCache();
    if(!db)return;
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction('moves',mode),request=operation(tx.objectStore('moves'));
      tx.oncomplete=()=>resolve(request.result);
      tx.onabort=tx.onerror=()=>reject(tx.error);
    });
  }catch{/* A browser with storage disabled can still run a review. */}
}
function workerSearch(worker,payload,signal){
  signal.throwIfAborted();
  return new Promise((resolve,reject)=>{
    const abort=()=>finish(reject,signal.reason);
    function finish(callback,value){
      worker.onmessage=worker.onerror=worker.onmessageerror=null;
      signal.removeEventListener('abort',abort);
      callback(value);
    }
    worker.onerror=worker.onmessageerror=()=>finish(reject,Error('Moteur local indisponible.'));
    worker.onmessage=({data})=>{
      if(data.id!==payload.id)return;
      if(data.type!=='katago:analyze_update'&&data.type!=='katago:analyze_result')return;
      if(data.ok && data.analysis){
        if(data.type==='katago:analyze_update'){
          if(!data.analysis.moves.some(m=>m.visits>0))return;
          worker.postMessage({type:'katago:cancel',analysisGroup:payload.analysisGroup,id:payload.id});
        }
        finish(resolve,data);
      }
      else finish(reject,Error('Calcul local interrompu.'));
    };
    signal.addEventListener('abort',abort,{once:true});
    worker.postMessage(payload);
  });
}

export async function reviewGame(source,scope,signal,publish){
  const g={...source,first:source.first||1};
  const identity=JSON.stringify([scope,g.n,g.first,g.komi??6.5,g.rules||'chinese',g.start||null,g.moves]);
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(identity));
  const key='v1-'+Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
  const stored=await cacheRequest('readonly',store=>store.getAll(IDBKeyRange.bound([key,1],[key,g.moves.length])));
  const entries=[];
  for(const e of stored||[]){if(e.ply!==entries.length+1)break;entries.push(e)}
  signal.throwIfAborted();
  publish(entries);
  if(entries.length===g.moves.length)return;
  const {states}=makeStates(g);
  let worker,id=0;
  async function estimate(ply){
    signal.throwIfAborted();
    const moves=g.moves.slice(0,ply),key=LocalAnalysis.positionKey(g,moves);
    const cached=LocalAnalysis.firstEstimate(key);
    if(cached)return cached;
    worker??=new Worker(new URL('katago/analysis-worker.js',document.baseURI),{name:'KataGo · bilan'});
    const history=states.slice(0,ply+1);
    const payload=LocalAnalysis.analysisPayload(g,history,moves);
    // Stop at the first reporting interval used by the interactive analysis.
    const data=await workerSearch(worker,{...payload,analysisGroup:'review',id:++id,maxTimeMs:payload.reportDuringSearchEveryMs},signal);
    const first=LocalAnalysis.snapshot(data.analysis,g,history,moves,data.backend);
    return LocalAnalysis.rememberEstimate(key,first);
  }
  try{
    let before=await estimate(entries.length);
    for(let ply=entries.length;ply<g.moves.length;ply++){
      const after=await estimate(ply+1);
      signal.throwIfAborted();
      const entry=evaluatePly({Go,g,ply,history:states.slice(0,ply+1),before,after});
      entry.turning=isTurningPoint(entry,entries.at(-1));
      entries.push(entry);
      before=after;
      await cacheRequest('readwrite',store=>store.put(entry,[key,entry.ply]));
      signal.throwIfAborted();
      publish(entries);
    }
  }finally{worker?.terminate()}
}
