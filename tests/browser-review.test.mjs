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
