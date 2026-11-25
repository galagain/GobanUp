import {evaluatePly} from './review-grade.js';

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
function workerEval(worker,payload,signal){
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
      if(data.type!=='katago:eval_result')return;
      const value=data.eval;
      if(data.ok && Number.isFinite(value?.rootScoreLead) && Number.isFinite(value?.rootWinRate)){
        finish(resolve,value);
      }else finish(reject,Error('Évaluation locale indisponible.'));
    };
    signal.addEventListener('abort',abort,{once:true});
    worker.postMessage(payload);
  });
}

export async function reviewGame(source,scope,signal,publish){
  const g={...source,first:source.first||1};
  const identity=JSON.stringify([scope,g.n,g.first,g.komi??6.5,g.rules||'chinese',g.start||null,g.moves]);
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(identity));
  const key='raw-v1-'+Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
  const stored=await cacheRequest('readonly',store=>store.getAll(IDBKeyRange.bound([key,1],[key,g.moves.length])));
  const entries=[];
  for(const e of stored||[]){if(e.ply!==entries.length+1)break;entries.push(e)}
  signal.throwIfAborted();
  publish(entries);
  if(entries.length===g.moves.length)return;
  const {states}=makeStates(g);
  const inputs=LocalAnalysis.positionInputs(g,states);
  let worker;
  async function estimate(ply){
    signal.throwIfAborted();
    const key=LocalAnalysis.positionKey(g,g.moves.slice(0,ply));
    const cached=LocalAnalysis.rawEstimate(key);
    if(cached)return cached;
    worker??=new Worker(new URL('katago/analysis-worker.js?policy=1',document.baseURI),{name:'KataGo · bilan'});
    const value=await workerEval(worker,{...inputs(ply),type:'katago:eval',includePolicy:true,id:ply},signal);
    const move=LocalAnalysis.policyMove(value.policyLogits,states[ply],g.n,turnAt(g,ply),states.slice(0,ply+1));
    return LocalAnalysis.rememberRaw(key,{win:value.rootWinRate,score:value.rootScoreLead,move});
  }
  try{
    let before=entries.at(-1)?.after??await estimate(0);
    for(let ply=entries.length;ply<g.moves.length;ply++){
      const after=await estimate(ply+1);
      signal.throwIfAborted();
      const entry=evaluatePly({Go,g,states,ply,before,after});
      entries.push(entry);
      before=after;
      await cacheRequest('readwrite',store=>store.put(entry,[key,entry.ply]));
      signal.throwIfAborted();
      publish(entries);
    }
  }finally{worker?.terminate()}
}
