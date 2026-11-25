import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reviewGame} from '../public/browser-review.js';

test('le bilan envoie une seule inférence par position, même pour un coup absent des suggestions',async t=>{
  const requests=[],seen=new Map();
  const globals={
    document:{baseURI:'https://goban.test/'},
    Go:{},turnAt:(g,i)=>(g.first-1+i)%2+1,
    makeStates:g=>({states:Array.from({length:g.moves.length+1},()=>Array(g.n*g.n).fill(0))}),
    LocalAnalysis:{
      positionInputs:()=>ply=>({ply}),positionKey:(_,moves)=>JSON.stringify(moves),
      rawEstimate:key=>seen.get(key),policyMove:()=>40,
      rememberRaw:(key,value)=>{seen.set(key,value);return value}
    },
    Worker:class {
      postMessage(msg){
        requests.push([msg.type,msg.ply,msg.includePolicy]);
        queueMicrotask(()=>this.onmessage({data:{id:msg.id,type:'katago:eval_result',ok:true,
          eval:{rootScoreLead:0,rootWinRate:.5,policyLogits:Array(82).fill(0)}}}));
      }
      terminate(){}
    }
  };
  for(const [key,value] of Object.entries(globals)){
    const saved=Object.getOwnPropertyDescriptor(globalThis,key);
    Object.defineProperty(globalThis,key,{value,configurable:true});
    t.after(()=>{if(saved)Object.defineProperty(globalThis,key,saved);else delete globalThis[key]});
  }
  const game={n:9,first:2,moves:[40,16,-1]},signal=new AbortController().signal;
  let result;
  await reviewGame(game,'test',signal,entries=>{result=entries});
  assert.deepEqual(requests,[0,1,2,3].map(ply=>['katago:eval',ply,true]));
  assert.deepEqual(result.map(e=>e.played.move),game.moves);
  await reviewGame(game,'test',signal,()=>{});
  assert.equal(requests.length,4);
});

test('prépare les deux profondeurs, réutilise les variantes et complète un bilan partiel sans recherche supplémentaire',async t=>{
  const requests=[],cache=new Map();
  let notify=()=>{};
  const globals={
    document:{baseURI:'https://goban.test/'},Go:{},turnAt:(g,i)=>i%2+1,
    makeStates:g=>({states:Array.from({length:g.moves.length+1},()=>Array(81).fill(0))}),
    LocalAnalysis:{
      positionInputs:()=>ply=>({ply}),positionKey:(g,moves)=>JSON.stringify(moves),
      rawEstimate:key=>cache.get(key),rememberRaw:(key,v)=>cache.set(key,v),policyMove:()=>12,
      searchSettings:{visits:180},snapshot:a=>({score:a.rootScoreLead,win:.5,visits:42,candidates:[{x:3,y:2,pv:['D7']}]})
    },
    Worker:class{
      postMessage(msg){
        requests.push([msg.type,msg.ply]);
        queueMicrotask(()=>{
          const data={ok:true,id:msg.id,type:msg.type+'_result'};
          if(msg.type==='katago:eval')data.eval={rootScoreLead:0,rootWinRate:.5,policyLogits:Array(82).fill(0)};
          else data.analysis={rootScoreLead:2};
          this.onmessage?.({data});notify();
        });
      }
      terminate(){}
    }
  };
  for(const [key,value] of Object.entries(globals)){
    const saved=Object.getOwnPropertyDescriptor(globalThis,key);
    Object.defineProperty(globalThis,key,{value,configurable:true});
    t.after(()=>{if(saved)Object.defineProperty(globalThis,key,saved);else delete globalThis[key]});
  }
  const {createPreparation}=await import('../public/browser-review.js');
  const prep=createPreparation('live'),game={n:9,first:1,moves:[21]},signal=new AbortController().signal;
  t.after(()=>prep.stop());
  prep.update(game,makeStates(game).states,true);
  await new Promise(resolve=>setTimeout(resolve,120));
  assert.equal(requests.length,0);
  const completed=new Promise(resolve=>{notify=()=>{if(requests.length===4)resolve()}});
  prep.update(game,makeStates(game).states,false);
  await completed;
  await new Promise(resolve=>setTimeout(resolve,0));
  prep.stop();
  assert.deepEqual(requests,[['katago:eval',0],['katago:eval',1],['katago:analyze',0],['katago:analyze',1]]);
  let entries,lines;
  await reviewGame(game,'live',signal,v=>{entries=v},v=>{lines=v});
  assert.equal(requests.length,4);
  assert.equal(lines.size,2);
  assert.equal(entries[0].suggestion,21);
  assert.equal(entries[0].before.score,2);
  await reviewGame({...game,moves:[21,40]},'live',signal,v=>{entries=v});
  assert.deepEqual(requests.slice(4),[['katago:eval',2]]);
  assert.equal(entries[1].suggestion,12);
  assert.equal(Math.abs(entries[1].before.score),0);
});
