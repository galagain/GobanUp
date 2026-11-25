import {evaluatePly,coordinate,isTurningPoint} from './review-grade.js';

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
      if(data.id!==payload.id||data.type!=='katago:analyze_result')return;
      if(data.ok && data.analysis)finish(resolve,data.analysis);
      else finish(reject,Error('Calcul local interrompu.'));
    };
    signal.addEventListener('abort',abort,{once:true});
    worker.postMessage(payload);
  });
}
const asCoord=s=>s.toLowerCase()==='pass'?'pass':s.toUpperCase();

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
  const worker=new Worker(new URL('katago/analysis-worker.js',document.baseURI),{name:'KataGo · bilan'});
  let id=0;
  try{
    for(let ply=entries.length;ply<g.moves.length;ply++){
      signal.throwIfAborted();
      const history=states.slice(0,ply+1),moves=g.moves.slice(0,ply);
      const root=LocalAnalysis.analysisPayload(g,history,moves);
      const query=async(visits,force)=>{
        const p=force===undefined?null:force==='pass'?-1:'ABCDEFGHJKLMNOPQRST'.indexOf(force[0])+(g.n-Number(force.slice(1)))*g.n;
        const options={analysisGroup:'review',reportDuringSearchEveryMs:0,nnRandomize:false,
          visits,maxTimeMs:visits>100?15000:4500,topK:12};
        const allow=p===null?undefined:[{moves:[{x:p<0?-1:p%g.n,y:p<0?-1:Math.floor(p/g.n)}],untilDepth:1}];
        const result=await workerSearch(worker,{...root,...options,id:++id,allowMoves:allow},signal);
        const moveInfos=result.moves.filter(m=>m.visits>0).map(m=>({
          move:coordinate(m.x<0?-1:m.y*g.n+m.x,g.n),order:m.order,visits:m.visits,winrate:m.winRate,scoreLead:m.scoreLead,pv:m.pv.map(asCoord)
        }));
        if(p===null)return {moveInfos,policy:result.policy};
        const found=moveInfos.find(m=>m.move===force);
        if(found&&found.visits>=12)return {moveInfos:[found]};
        // Some roots prune the requested move (including pass). Search its child position.
        const next=p<0?history.at(-1):Go.play(history.at(-1),p,turnAt(g,ply),g.n,history)?.board;
        if(!next)throw Error('Coup illégal dans la partie.');
        const child=LocalAnalysis.analysisPayload(g,[...history,next],[...moves,p]);
        const reply=await workerSearch(worker,{...child,...options,id:++id},signal);
        return {moveInfos:[{move:force,order:0,visits:reply.rootVisits,winrate:reply.rootWinRate,
          scoreLead:reply.rootScoreLead,pv:[force,...(reply.moves[0]?.pv||[]).map(asCoord)]}]};
      };
      const entry=await evaluatePly({Go,g,ply,history,query});
      signal.throwIfAborted();
      entry.turning=isTurningPoint(entry,entries.at(-1));
      entries.push(entry);
      await cacheRequest('readwrite',store=>store.put(entry,[key,entry.ply]));
      signal.throwIfAborted();
      publish(entries);
    }
  }finally{worker.terminate()}
}
