import { DatabaseSync } from 'node:sqlite';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline';
import { setTimeout as sleep } from 'node:timers/promises';
import Go from '../assets/engine.cjs';
import { coordinate, side, play, evaluatePly } from './grade.mjs';

const db=new DatabaseSync(process.env.DATABASE||'/data/gobanup.sqlite');
db.exec('PRAGMA busy_timeout=10000; PRAGMA foreign_keys=ON');
const owner=randomUUID(), leaseMs=120000;
let stopping=false,engine=null;
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{stopping=true;engine?.kill()});

function claim(){
  const now=Date.now();
  return db.prepare(`UPDATE reviews SET status='running',owner=?,lease_until=?
    WHERE NOT EXISTS(SELECT 1 FROM reviews WHERE status='running' AND lease_until>=?)
    AND id=(SELECT id FROM reviews WHERE status='queued' OR (status='running' AND lease_until<?)
    ORDER BY created,id LIMIT 1) RETURNING id,record,done,total,attempts`).get(owner,now+leaseMs,now,now);
}
function katago(){
  const child=spawn('katago',['analysis','-model','assets/g170-b6c96.bin.gz','-human-model','assets/human.bin.gz',
    '-config','reviewer/engine.cfg'],{stdio:['pipe','pipe','inherit']});
  const lines=createInterface({input:child.stdout}), iterator=lines[Symbol.asyncIterator]();
  let failure;
  child.on('error',err=>{failure=err;lines.close()});
  child.stdin.on('error',err=>{failure=err});
  return {child,async ask(payload){
    const id=randomUUID();
    const timer=setTimeout(()=>child.kill('SIGKILL'),90000);
    try{
      if(failure)throw failure;
      child.stdin.write(JSON.stringify({...payload,id})+'\n');
      for(;;){
        const {done,value}=await iterator.next();
        if(done)throw failure||Error('KataGo arrêté');
        const result=JSON.parse(value);
        if(result.id!==id || result.warning)continue;
        if(result.error)throw Error(result.error);
        if(!result.isDuringSearch && result.moveInfos?.length)return result;
        if(result.noResults || !result.isDuringSearch)throw Error('Aucun résultat pour cette position');
      }
    }finally{clearTimeout(timer)}
  }};
}
async function processReview(job){
  const g=JSON.parse(job.record), stones=[],moves=[];
  const history=[g.start||Array(g.n*g.n).fill(0)];
  history[0].forEach((c,p)=>{if(c)stones.push([c===1?'B':'W',coordinate(p,g.n)])});
  // Reject invalid records before spending search time or publishing partial grades.
  for(const [i,p] of g.moves.entries()){
    const next=play(Go,history,p,side(g,i),g.n);
    if(!next)throw Error('Coup illégal dans la partie');
    history.push(next.board);
  }
  const {child,ask}=katago();engine=child;
  try{
    const prefix=history.slice(0,1);
    for(const [ply,p] of g.moves.entries()){
      const player=side(g,ply)===1?'B':'W';
      if(ply>=job.done){
        const query=(maxVisits,force)=>ask({boardXSize:g.n,boardYSize:g.n,initialStones:stones,
          initialPlayer:g.first===1?'B':'W',moves,rules:g.rules,komi:g.komi,maxVisits,
          includePolicy:g.n===19&&!force,overrideSettings:{humanSLProfile:'rank_5k'},
          ...(force?{allowMoves:[{player,moves:[force],untilDepth:1}]}:{})});
        const grade=await evaluatePly({Go,g,ply,history:prefix,query});
        db.exec('BEGIN IMMEDIATE');
        try{
          const updated=db.prepare(`UPDATE reviews SET done=?,status=?,lease_until=?,attempts=0
            WHERE id=? AND owner=? AND done=?`).run(ply+1,ply+1===job.total?'complete':'running',Date.now()+leaseMs,job.id,owner,ply);
          if(!updated.changes)throw Error('Revue reprise ailleurs');
          db.prepare('INSERT INTO review_moves(review,ply,result) VALUES(?,?,?)').run(job.id,ply+1,JSON.stringify(grade));
          db.exec('COMMIT');
        }catch(e){db.exec('ROLLBACK');throw e}
      }
      moves.push([player,coordinate(p,g.n)]);prefix.push(history[ply+1]);
      if(stopping)throw Error('Arrêt du processus');
    }
  }finally{child.kill();engine=null}
}
while(!stopping){
  const job=claim();
  if(!job){await sleep(750);continue}
  // Renew even during slow engine startup or a deeper tactical verification.
  const heartbeat=setInterval(()=>db.prepare("UPDATE reviews SET lease_until=? WHERE id=? AND owner=? AND status='running'")
    .run(Date.now()+leaseMs,job.id,owner),20000);
  try{await processReview(job)}
  catch(err){
    console.error('Revue',job.id,err.message);
    db.prepare(`UPDATE reviews SET owner=NULL,lease_until=0,attempts=attempts+?,status=
      CASE WHEN ? OR attempts<1 THEN 'queued' ELSE 'failed' END WHERE id=? AND owner=? AND status='running'`)
      .run(stopping?0:1,stopping?1:0,job.id,owner);
    if(!stopping)await sleep(1500);
  }finally{clearInterval(heartbeat)}
}
