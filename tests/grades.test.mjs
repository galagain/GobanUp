import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { evaluatePly,quality } from '../reviewer/grade.mjs';
const Go=runInNewContext(readFileSync('public/engine.js','utf8')+'\nGo');
const info=(move,scoreLead,winrate,pv=[move],visits=32,order=0)=>({move,scoreLead,winrate,pv,visits,order});

test('seuils provisoires et chute de victoire dans une position serrée',()=>{
  assert.deepEqual([0,1,3,6].map(loss=>quality(false,loss,0,0.5)),['good','inaccuracy','mistake','blunder']);
  assert.equal(quality(true,0,0,0.5),'best');
  assert.equal(quality(false,2,0.21,0.65),'blunder');
});
test('recherche ciblée au même tour et perspective de Blanc',async()=>{
  const g={n:9,first:2,moves:[-1]}, requests=[];
  const grade=await evaluatePly({Go,g,ply:0,history:[Array(81).fill(0)],query:async(visits,force)=>{
    requests.push(force);
    return {moveInfos:force?[info('pass',2,.55)]:[info('E5',-3,.35),info('pass',2,.55,['pass'],2,1)]};
  }});
  assert.deepEqual(requests,[undefined,'pass']);assert.equal(grade.color,2);
  assert.equal(grade.loss,5);assert.equal(grade.drop,.2);assert.equal(grade.badge,'blunder');
});
test('occasion manquée confirmée par la réponse qui sauve les pierres',async()=>{
  const board=Array(81).fill(0);board[0]=board[1]=2;board[9]=board[10]=1;
  const g={n:9,first:1,moves:[40]};
  const query=async()=>({moveInfos:[info('C9',2,.60),info('E5',-2,.44,['E5','C9'],20,1)]});
  const grade=await evaluatePly({Go,g,ply:0,history:[board],query});
  assert.equal(grade.badge,'missed');assert.match(grade.explanation,/2 pierres/);
});
test('brillant uniquement sur sacrifice confirmé en profondeur et rare pour le profil humain',async()=>{
  const board=Array(361).fill(0);
  for(const p of [0,7,27,28,29])board[p]=1;
  for(const p of [19,2,8,9,10])board[p]=2;
  const g={n:19,first:1,moves:[1]}, visits=[];
  const moves=[info('B19',4,.7,['B19','B18','M19']),info('M19',0,.5,['M19'],18,1)];
  const query=async v=>{visits.push(v);return {moveInfos:moves,humanPolicy:[0,.008]}};
  assert.equal((await evaluatePly({Go,g,ply:0,history:[board],query})).badge,'brilliant');
  assert.deepEqual(visits,[96,384]);
  assert.equal((await evaluatePly({Go,g,ply:0,history:[board],query:async()=>({moveInfos:moves})})).badge,'best');
});
