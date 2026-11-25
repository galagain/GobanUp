import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { evaluatePly,quality,isTurningPoint } from '../public/review-grade.js';
const Go=runInNewContext(readFileSync('public/engine.js','utf8')+'\nGo');
const estimate=(score,win,candidates=[])=>({score,win,candidates,visits:4});
const move=(x,y,scoreLead,winRate,pv,prior=.4)=>({x,y,scoreLead,winRate,pv,visits:3,prior});

test('seuils provisoires et chute de victoire dans une position serrée',()=>{
  assert.deepEqual([0,1,3,6].map(loss=>quality(false,loss,0,0.5)),['good','inaccuracy','inaccuracy','inaccuracy']);
  assert.equal(quality(true,0,0,0.5),'best');
  assert.equal(quality(false,2,0.21,0.65),'blunder');
});
test('note la passe de Blanc depuis la position suivante même si elle manque aux candidats',()=>{
  const g={n:9,first:2,moves:[-1]};
  const before=estimate(-3,.35,[move(4,4,-3,.35,['E5'])]);
  const after=estimate(2,.55,[move(5,4,2,.55,['F5'])]);
  const grade=evaluatePly({Go,g,ply:0,history:[Array(81).fill(0)],before,after});
  assert.equal(grade.color,2);assert.equal(grade.loss,5);assert.equal(grade.drop,.2);
  assert.equal(grade.badge,'blunder');assert.deepEqual(grade.played.line,[-1,41]);
  assert.deepEqual(grade.before,{win:.65,score:3});
});
test('la seconde passe termine la variante et garde le score de la position finale',()=>{
  const g={n:9,first:1,moves:[-1,-1]};
  const before=estimate(1,.55,[move(-1,-1,1,.55,['pass','E5'])]);
  const after=estimate(2,.65,[move(4,4,2,.65,['E5'])]);
  const board=Array(81).fill(0);
  const grade=evaluatePly({Go,g,ply:1,history:[board,board],before,after});
  assert.equal(grade.badge,'best');assert.equal(grade.loss,0);assert.equal(grade.played.score,-2);
  assert.deepEqual(grade.played.line,[-1]);assert.deepEqual(grade.best.line,[-1]);
});
test('occasion manquée confirmée par la réponse qui sauve les pierres',()=>{
  const board=Array(81).fill(0);board[0]=board[1]=2;board[9]=board[10]=1;
  const g={n:9,first:1,moves:[40]};
  const before=estimate(2,.60,[move(2,0,2,.60,['C9'])]);
  const after=estimate(-2,.44,[move(2,0,-2,.44,['C9'])]);
  const grade=evaluatePly({Go,g,ply:0,history:[board],before,after});
  assert.equal(grade.badge,'missed');assert.match(grade.explanation,/2 pierres/);
});
test('sacrifice rare visible dès la première variante',()=>{
  const board=Array(361).fill(0);
  for(const p of [0,7,27,28,29])board[p]=1;
  for(const p of [19,2,8,9,10])board[p]=2;
  const g={n:19,first:1,moves:[1]};
  const best=move(1,0,4,.7,['B19','B18','M19'],.008);
  best.visits=22;
  const second={...move(11,0,0,.5,['M19']),visits:12};
  const before=estimate(4,.7,[best,second]),after=estimate(4,.7);
  assert.equal(evaluatePly({Go,g,ply:0,history:[board],before,after}).badge,'brilliant');
  best.prior=.4;
  assert.equal(evaluatePly({Go,g,ply:0,history:[board],before,after}).badge,'best');
});
test('marque les bascules visibles depuis la couleur du joueur et ignore les positions stables',()=>{
  const e={badge:'blunder',color:2,loss:4,best:{win:.67,visits:24},played:{win:.38,visits:24},drop:.29};
  assert.equal(isTurningPoint(e,{color:1,played:{win:.34}}),true);
  assert.equal(isTurningPoint(e,{color:1,played:{win:.62}}),false);
  assert.equal(isTurningPoint({...e,badge:'best'},undefined),false);
  assert.equal(isTurningPoint({...e,played:{win:.38,visits:4}},undefined),true);
  assert.equal(isTurningPoint({...e,loss:.4,played:{win:.38,visits:4}},undefined),false);
  assert.equal(quality(false,9,.02,.99),'inaccuracy');
  assert.equal(quality(false,8,.01,.03),'inaccuracy');
});
