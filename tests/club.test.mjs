import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
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
  const review=await a('reviews',{roomId:challenge.id});
  assert.equal(review.total,4);
  assert.equal((await b('reviews',{roomId:challenge.id})).id,review.id);
  assert.equal((await b('reviews/'+review.id)).status,'queued');
  const study=await a('reviews',{record:{n:9,moves:[40],first:2,komi:0.5,rules:'japanese'}});
  await b('reviews/'+study.id,undefined,404);
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
  await otherDevice('logout',{});
  await otherDevice('club',undefined,401);
});
