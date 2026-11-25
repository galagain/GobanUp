import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('comptes, invitations, reprise et recherche d’adversaire', async t => {
  const dir = await mkdtemp(join(tmpdir(),'gobanup-'));
  let server;
  let origin;
  async function start() {
    server=spawn(process.execPath,['server/homelab.mjs'],{
      env:{...process.env,DATABASE:join(dir,'test.sqlite'),PORT:'0'},stdio:['ignore','pipe','inherit']
    });
    const [message]=await once(server.stdout,'data');
    origin='http://127.0.0.1:'+message.toString().trim().split(' ').at(-1);
  }
  async function stop() {
    if (!server || server.exitCode!==null || server.signalCode) return;
    const exit=once(server,'exit'); server.kill(); await exit;
  }
  t.after(async()=>{await stop();await rm(dir,{recursive:true,force:true});});
  await start();
  function client() {
    let cookie='';
    return async (path,body,status=200)=>{
      const res=await fetch(origin+'/api/'+path,{
        headers:{cookie,'Content-Type':'application/json'},
        method:body?'POST':'GET',body:body?JSON.stringify(body):undefined
      });
      if(res.headers.has('set-cookie')) cookie=res.headers.get('set-cookie').split(';')[0];
      const data=await res.json();
      assert.equal(res.status,status,JSON.stringify(data)); return data;
    };
  }
  const a=client(),b=client(),otherDevice=client();
  const alice={name:'Noir',password:'un secret de test'};
  const white={name:'Blanc',password:'un autre secret'};
  const {user:black}=await a('register',alice);
  const {user:whiteUser}=await b('register',white);
  await b('register',{...alice,name:'noir'},409);
  await a('friends',{name:'BLANC'});
  await b('friends/'+black.id+'/accept',{});
  const r=await a('friends/'+whiteUser.id+'/challenge',{n:13});
  assert.equal((await b('club')).rooms[0].invited,true);
  await b('rooms/'+r.id+'/decline',{});
  assert.equal((await a('club')).rooms.length,0);
  const challenge=await a('friends/'+whiteUser.id+'/challenge',{n:9});
  const room='rooms/'+challenge.id;
  assert.equal((await b(room+'/join',{})).seat,2);
  await a(room+'/move',{p:20,at:0});
  await b(room+'/move',{p:21,at:1});
  await b(room+'/move',{p:21,at:1},409);
  await stop(); await start();
  await otherDevice('login',alice);
  assert.deepEqual((await otherDevice(room)).moves,[20,21]);
  assert.equal((await b('club')).friends[0].accepted,1);
  await otherDevice(room+'/move',{p:-1,at:2});
  await b(room+'/move',{p:-1,at:3});
  await a(room+'/move',{p:30,at:4},409);
  await a('reviews',{roomId:challenge.id},410);
  const enqueue=fn=>fn('rooms',{kind:'queue',n:19,ticket:crypto.randomUUID()});
  const [first,second]=await Promise.all([enqueue(a),enqueue(b)]);
  assert.equal(first.id,second.id);
  assert.deepEqual([first.seat,second.seat].sort(),[1,2]);
  const invite=await b('rooms',{kind:'invite',n:13,ticket:crypto.randomUUID()});
  assert.equal((await a('rooms/'+invite.id+'/join',{})).ready,true);
  const active='rooms/'+invite.id;
  const result=await a(active+'/resign',{});
  assert.equal(result.resigned,2);
  assert.deepEqual(result.moves,[]);
  assert.equal((await a(active+'/resign',{})).revision,result.revision);
  await b(active+'/move',{at:0,p:1},409);
  await b(active+'/resign',{},409);
  await b(room+'/resign',{},409);
  await stop(); await start();
  assert.equal((await b('club')).rooms.find(g=>g.id===invite.id).resigned,2);
  await t.test('la cadence suit les invitations, les recherches et les pendules',async()=>{
    const queue=(fn,cadence)=>fn('rooms',{kind:'queue',n:13,cadence,ticket:crypto.randomUUID()});
    const blitz=await queue(a,'3+2');
    const rapid=await queue(b,'10+0');
    assert.notEqual(blitz.id,rapid.id);
    assert.equal(blitz.clock,null);
    const paired=await queue(b,'3+2');
    assert.equal(paired.id,blitz.id);
    assert.deepEqual(paired.clock.remaining,[180000,180000]);
    const path='rooms/'+blitz.id;
    const move=await a(path+'/move',{p:2,at:0,clock:{turn:0}});
    assert.equal(move.clock.turn,2);
    assert.equal(move.clock.remaining[0],182000-(move.clock.since-paired.clock.since));
    const store=new DatabaseSync(join(dir,'test.sqlite'));
    try{
      store.prepare("UPDATE rooms SET clock=json_set(clock,'$.since',?) WHERE id=?").run(Date.now()-181000,blitz.id);
    }finally{store.close()}
    assert.equal((await a(path)).timedOut,2);
    await b(path+'/move',{p:4,at:1},409);
    await a(path+'/resign',{},409);
    assert.equal((await b('club')).rooms.find(g=>g.id===blitz.id).timedOut,2);

    const invite=await a('friends/'+whiteUser.id+'/challenge',{n:9,cadence:'1d'});
    assert.equal((await b('club')).rooms.find(g=>g.id===invite.id).cadence,'1d');
    const daily='rooms/'+invite.id;
    const joined=await b(daily+'/join',{});
    assert.deepEqual(joined.clock.remaining,[86400000,86400000]);
    assert.equal((await a(daily+'/move',{p:-1,at:0})).clock.remaining[0],86400000);
    const completed=await b(daily+'/move',{p:-1,at:1});
    assert.equal(completed.clock.turn,0);
    await stop();await start();
    assert.deepEqual((await a(daily)).clock,completed.clock);
    assert.equal((await otherDevice(path)).timedOut,2);
    await a('rooms',{kind:'invite',n:9,ticket:crypto.randomUUID(),cadence:'bogus'},400);
  });
  await otherDevice('logout',{});
  await otherDevice('club',undefined,401);
});
