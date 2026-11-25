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
// Store the quick estimate and the search separately so simultaneous tabs cannot
// overwrite a completed search with a cheaper evaluation of the same position.
const recent=new Map();
const namespace=(scope,kind)=>JSON.stringify(['position-v1',scope,kind]);
async function readPositions(scope,keys){
  const values=new Map();
  const db=await openCache();
  let tx;
  try{if(db)tx=db.transaction('moves','readonly')}catch{}
  const reads=[];
  for(const kind of ['quick','search']){
    const ns=namespace(scope,kind), found=new Map();
    values.set(kind,found);
    for(const key of keys){
      const address=[ns,key],memory=recent.get(JSON.stringify(address));
      if(memory){found.set(key,memory);continue}
      if(tx){
        const request=tx.objectStore('moves').get(address);
        reads.push(new Promise(resolve=>{
          request.onsuccess=()=>{if(request.result)found.set(key,request.result);resolve()};
          request.onerror=resolve;
        }));
      }
    }
  }
  await Promise.all(reads);
  return values;
}
async function savePosition(scope,key,kind,value){
  const address=[namespace(scope,kind),key];
  recent.set(JSON.stringify(address),value);
  if(recent.size>800)recent.delete(recent.keys().next().value);
  await cacheRequest('readwrite',store=>store.put(value,address));
}

let sequence=0;
function ask(worker,payload,signal){
  signal.throwIfAborted();
  const id=++sequence;
  return new Promise((resolve,reject)=>{
    function finish(callback,value){
      worker.onmessage=worker.onerror=worker.onmessageerror=null;
      signal.removeEventListener('abort',abort);
      callback(value);
    }
    function abort(){
      if(payload.type==='katago:analyze')worker.postMessage({type:'katago:cancel',analysisGroup:payload.analysisGroup,id});
      finish(reject,signal.reason);
    }
    worker.onerror=worker.onmessageerror=()=>finish(reject,Error('Moteur local indisponible.'));
    worker.onmessage=({data})=>{
      if(data.id!==id)return;
      if(!data.ok){finish(reject,Error('Évaluation locale indisponible.'));return}
      if(data.type===payload.type+'_result')finish(resolve,data);
    };
    signal.addEventListener('abort',abort,{once:true});
    worker.postMessage({...payload,id});
  });
}
const newWorker=name=>new Worker(new URL('katago/analysis-worker.js?policy=1',document.baseURI),{name});
async function quickEstimate(worker,inputs,g,states,ply,signal){
  const {eval:value}=await ask(worker,{...inputs(ply),type:'katago:eval',includePolicy:true},signal);
  if(!Number.isFinite(value?.rootScoreLead)||!Number.isFinite(value?.rootWinRate))throw Error('Évaluation locale indisponible.');
  const move=LocalAnalysis.policyMove(value.policyLogits,states[ply],g.n,turnAt(g,ply),states.slice(0,ply+1));
  return {win:value.rootWinRate,score:value.rootScoreLead,move};
}

// Drain new positions first. Search one position at a time between moves,
// keeping the worker warm and handing the device back to a thinking bot.
export function createPreparation(scope){
  let current,worker,timer,task,paused=false,closed=false,failedAt=-1,quick=0,deep=0;
  function schedule(){
    if(closed || paused || task || timer || failedAt===current.g.moves.length)return;
    if(Math.min(quick,deep)<=current.g.moves.length){
      timer=setTimeout(()=>{timer=null;void run()},100);
    }else if(current.finished){
      worker?.terminate();worker=null;
    }
  }
  async function run(){
    const context=current,{g,states}=context;
    const shallow=quick<=g.moves.length,ply=shallow?quick:deep,kind=shallow?'quick':'search';
    const job=task=new AbortController(),{signal}=job;
    try{
      const moves=g.moves.slice(0,ply),key=LocalAnalysis.positionKey(g,moves);
      const saved=await readPositions(scope,[key]);
      signal.throwIfAborted();
      if(!saved.get(kind).has(key) && (shallow || !(moves.length>=2 && moves.slice(-2).every(p=>p===-1)))){
        const inputs=context.inputs??=LocalAnalysis.positionInputs(g,states);
        worker??=newWorker('KataGo · préparation');
        if(shallow){
          const raw=await quickEstimate(worker,inputs,g,states,ply,signal);
          signal.throwIfAborted();
          await savePosition(scope,key,kind,raw);
        }else{
          const data=await ask(worker,{...inputs(ply),type:'katago:analyze',analysisGroup:'preparation',...LocalAnalysis.searchSettings},signal);
          signal.throwIfAborted();
          const result=LocalAnalysis.snapshot(data.analysis,g,states.slice(0,ply+1),moves,data.backend);
          if(result.visits>0 && Number.isFinite(result.score) && Number.isFinite(result.win) && result.candidates.length){
            await savePosition(scope,key,kind,{...result,complete:true});
          }
        }
      }
      signal.throwIfAborted();
      if(shallow)quick++;else deep++;
    }catch{
      // A background failure must never block a move or the on-demand review.
      if(!signal.aborted){failedAt=g.moves.length;worker?.terminate();worker=null}
    }finally{task=null;schedule()}
  }
  return {
    update(source,states,botThinking){
      if(closed)return;
      const moves=source.moves,previous=current?.g.moves;
      if(!previous || moves.length!==previous.length || moves.some((m,i)=>m!==previous[i])){
        if(previous && (moves.length<previous.length || previous.some((m,i)=>m!==moves[i]))){
          task?.abort();quick=deep=0;
        }
        current={g:{...source,moves:moves.slice()},states};
      }
      current.finished=Boolean(source.resigned || source.timedOut || (moves.length>=2 && moves.slice(-2).every(p=>p===-1)));
      paused=botThinking;
      if(paused){clearTimeout(timer);timer=null;task?.abort()}
      else schedule();
    },
    stop(){closed=true;clearTimeout(timer);task?.abort();worker?.terminate()}
  };
}

export async function reviewGame(source,scope,signal,publish,onPrepared=()=>{}){
  const g={...source,first:source.first||1,moves:source.moves.slice()};
  const keys=Array.from({length:g.moves.length+1},(_,i)=>LocalAnalysis.positionKey(g,g.moves.slice(0,i)));
  const positions=await readPositions(scope,keys);
  signal.throwIfAborted();
  const searches=positions.get('search'),quick=positions.get('quick');
  onPrepared(searches);
  if(!g.moves.length){publish([]);return}
  // Read reviews saved before background preparation was introduced.
  let legacy=[];
  if(keys.some(key=>!quick.has(key))){
    const identity=JSON.stringify([scope,g.n,g.first,g.komi??6.5,g.rules||'chinese',g.start||null,g.moves]);
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(identity));
    const key='raw-v1-'+Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
    legacy=await cacheRequest('readonly',store=>store.getAll(IDBKeyRange.bound([key,1],[key,g.moves.length])))||[];
  }
  signal.throwIfAborted();
  const entries=[],{states}=makeStates(g);
  let inputs,worker;
  async function estimate(ply){
    const key=keys[ply];
    let value=quick.get(key)||LocalAnalysis.rawEstimate(key)||legacy[ply-1]?.after;
    if(!value && ply===0 && legacy[0]){
      const {before,suggestion}=legacy[0],black=g.first===1;
      value={score:black?before.score:-before.score,win:black?before.win:1-before.win,move:suggestion};
    }
    if(!value){
      worker??=newWorker('KataGo · bilan');
      inputs??=LocalAnalysis.positionInputs(g,states);
      value=await quickEstimate(worker,inputs,g,states,ply,signal);
      signal.throwIfAborted();
      LocalAnalysis.rememberRaw(key,value);
      await savePosition(scope,key,'quick',value);
    }
    quick.set(key,value);return value;
  }
  function searched(s){
    const best=s.candidates[0];
    return {win:s.win,score:s.score,move:best.x<0?-1:best.y*g.n+best.x};
  }
  try{
    for(let ply=0;ply<g.moves.length;ply++){
      signal.throwIfAborted();
      const left=searches.get(keys[ply]),right=searches.get(keys[ply+1]);
      if(left && right){
        entries.push(evaluatePly({Go,g,states,ply,before:searched(left),after:searched(right)}));
      }else if(legacy[ply]){
        entries.push(legacy[ply]);
      }else{
        if(!quick.has(keys[ply])||!quick.has(keys[ply+1]))publish(entries);
        const before=await estimate(ply),after=await estimate(ply+1);
        entries.push(evaluatePly({Go,g,states,ply,before,after}));
      }
    }
    signal.throwIfAborted();
    publish(entries);
  }finally{worker?.terminate()}
}
