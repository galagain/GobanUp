import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {evaluatePly,quality} from '../public/review-grade.js';

const Go=runInNewContext(readFileSync('public/engine.js','utf8')+'\nGo');
const estimate=(score,win,move)=>({score,win,move});
function grade(g,board,ply,before,after){
  const states=[board];
  for(const [i,p] of g.moves.entries()){
    const color=(g.first-1+i)%2+1;
    states.push(p<0?states.at(-1):Go.play(states.at(-1),p,color,g.n,states).board);
  }
  return evaluatePly({Go,g,states,ply,before,after});
}

test('évalue la passe de Blanc avec les scores bruts avant et après',()=>{
  const after=estimate(2,.55,41);
  const e=grade({n:9,first:2,moves:[-1]},Array(81).fill(0),0,estimate(-3,.35,40),after);
  assert.equal(e.color,2);assert.equal(e.suggestion,40);assert.equal(e.loss,5);assert.equal(e.drop,.2);
  assert.equal(e.badge,'blunder');assert.equal(e.turning,true);assert.deepEqual(e.played,{move:-1,score:-2,win:1-.55});
  assert.deepEqual(e.before,{score:3,win:.65});assert.deepEqual(e.after,after);
});
test('conserve la préférence du réseau et note la position réellement obtenue',()=>{
  const g={n:9,first:1,moves:[-1,-1]},board=Array(81).fill(0);
  const e=grade(g,board,1,estimate(1,.55,-1),estimate(1,.55,40));
  assert.equal(e.badge,'best');assert.equal(e.loss,0);assert.equal(e.played.move,-1);
  assert.equal(quality(true,5,.25,.65),'blunder');
});
test('une capture manquée exige une réponse réelle qui sauve les pierres',()=>{
  const board=Array(81).fill(0);board[0]=board[1]=2;board[9]=board[10]=1;
  const g={n:9,first:1,moves:[40,2]};
  const before=estimate(2,.61,2),after=estimate(-2,.43,2);
  assert.equal(grade(g,board,0,before,after).badge,'missed');
  assert.equal(grade({...g,moves:[40]},board,0,before,after).badge,'mistake');
});
test('un sacrifice brillant est vérifié sur les coups de la partie',()=>{
  const board=Array(361).fill(0);
  for(const p of [0,7,27,28,29])board[p]=1;
  for(const p of [19,2,8,9,10])board[p]=2;
  const g={n:19,first:1,moves:[1,20,11]},before=estimate(1,.5,11),after=estimate(4,.7,20);
  assert.equal(grade(g,board,0,before,after).badge,'brilliant');
  assert.equal(grade({...g,moves:[1]},board,0,before,after).badge,'good');
});
test('ignore les pertes de points qui laissent la situation stable sur la courbe',()=>{
  const e=grade({n:9,first:1,moves:[40]},Array(81).fill(0),0,estimate(25,.99,41),estimate(16,.97,39));
  assert.equal(e.badge,'inaccuracy');assert.equal(e.turning,false);
});
