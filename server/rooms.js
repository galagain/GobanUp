
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const json = (value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Server-Time':String(Date.now())}});
function visible(row,player) {
  const clock=JSON.parse(row.clock||'null');
  return {cadence:row.cadence,clock,timedOut:Cadences.expired(clock,Date.now()),id:row.id,kind:row.kind,n:row.size,moves:JSON.parse(row.moves),seat:row.black===player?1:2,
    black:row.black_name,white:row.white_name,ready:!!row.white,resigned:row.resigned,revision:row.revision};
}
async function api(request,db,path,user) {
  const player=user.id;
  const stmt=(sql,...args)=>db.prepare(sql).bind(...args);
  const body=request.method==='POST'?await request.json():{};
  const name=user.name;
  const now=Date.now();
  if(path==='/api/rooms'&&request.method==='POST') {
    const {kind,n,ticket,cadence='none'}=body;
    if(!Cadences.valid(cadence)||!['queue','invite'].includes(kind)||![9,13,19].includes(n)||!uuid.test(ticket))return json({error:'Format incorrect.'},400);
    const create=stmt(`INSERT OR IGNORE INTO rooms (id,kind,size,black,black_name,touched,cadence)
      SELECT ?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM rooms WHERE white_ticket=?)`,ticket,kind,n,player,name,now,cadence,ticket);
    const find=stmt('SELECT * FROM rooms WHERE (id=? AND black=?) OR (white_ticket=? AND white=?)',ticket,player,ticket,player);
    const actions=[];
    if(kind==='queue') actions.push(stmt(`UPDATE rooms SET white=?,white_name=?,white_ticket=?,touched=?,clock=?
      WHERE id=(SELECT id FROM rooms WHERE kind='queue' AND size=? AND cadence=? AND white IS NULL AND black<>? AND touched>? ORDER BY touched,id LIMIT 1)
      AND NOT EXISTS (SELECT 1 FROM rooms WHERE id=? OR white_ticket=?)`,player,name,ticket,now,JSON.stringify(Cadences.initial(cadence,now)),n,cadence,player,now-60000,ticket,ticket));
    const results=await db.batch([...actions,create,find]);const row=results.at(-1).results[0];
    return row?json(visible(row,player)):json({error:'Relancez la recherche.'},409);
  }
  const match=/^\/api\/rooms\/([a-f0-9-]+)(?:\/(join|move|cancel|decline|resign))?$/.exec(path);
  if(!match||!uuid.test(match[1]))return json({error:'Salon introuvable.'},404);
  const [,id,action]=match;
  if(action==='decline'&&request.method==='POST'){
    const res=await stmt('DELETE FROM rooms WHERE id=? AND recipient=? AND white IS NULL',id,player).run();
    return res.meta.changes?json({closed:true}):json({error:'Invitation indisponible.'},409);
  }
  let row=await stmt('SELECT * FROM rooms WHERE id=?',id).first();
  if(row && action==='join' && request.method==='POST' && !row.white){
    const clock=Cadences.initial(row.cadence,now);
    await stmt("UPDATE rooms SET white=?,white_name=?,touched=?,clock=? WHERE id=? AND (kind='invite' OR (kind='friend' AND recipient=?)) AND white IS NULL AND black<>?",player,name,now,JSON.stringify(clock),id,player,player).run();
    row=await stmt('SELECT * FROM rooms WHERE id=?',id).first();
  }
  if(!row)return json({error:'Ce salon a été fermé.'},404);
  if(row.black!==player&&row.white!==player)return json({error:'Ce salon est déjà occupé ou privé.'},403);
  if(!action&&request.method==='GET'){
    if(!row.white&&row.kind==='queue'&&now-row.touched>15000)await stmt('UPDATE rooms SET touched=? WHERE id=? AND white IS NULL',now,id).run();
    return json(visible(row,player));
  }
  if(request.method!=='POST')return json({error:'Méthode incorrecte.'},405);
  if(action==='join')return json(visible(row,player));
  if(action==='cancel'){
    const res=await stmt('DELETE FROM rooms WHERE id=? AND black=? AND white IS NULL',id,player).run();
    return res.meta.changes?json({closed:true}):json({error:'La partie a déjà commencé.'},409);
  }
  const moves=JSON.parse(row.moves),color=moves.length%2+1;
  const seat=row.black===player?1:2;
  if(action==='resign' && row.resigned===seat)return json(visible(row,player));
  const clock=JSON.parse(row.clock||'null');
  if(Cadences.expired(clock,now))return json({error:'La partie est terminée au temps.'},409);
  if(!row.white || row.resigned || (moves.length>=2 && moves.slice(-2).every(m=>m===-1)))
    return json({error:'Cette partie n’est pas en cours.'},409);
  if(action==='resign'){
    const stopped=JSON.stringify(Cadences.advance(row.cadence,clock,now,true));
    const update=await stmt('UPDATE rooms SET resigned=?,clock=?,revision=revision+1,touched=? WHERE id=? AND revision=? AND resigned IS NULL',seat,stopped,now,id,row.revision).run();
    if(!update.meta.changes)return json({error:'La position a changé. Réessayez.'},409);
    return json(visible({...row,clock:stopped,resigned:seat,revision:row.revision+1},player));
  }
  if(action!=='move')return json({error:'Action inconnue.'},400);
  if(body.at!==moves.length || color!==seat)return json({error:'La position a changé. Actualisation en cours.'},409);
  const p=body.p;
  if(p!==-1){
    const states=[Array(row.size*row.size).fill(0)];
    for(const [i,m] of moves.entries())states.push(m===-1?states.at(-1):Go.play(states.at(-1),m,i%2+1,row.size,states).board);
    if(!Go.play(states.at(-1),p,color,row.size,states))return json({error:'Ce coup est interdit.'},400);
  }
  moves.push(p);
  const finished=p===-1 && moves.at(-2)===-1;
  const nextClock=JSON.stringify(Cadences.advance(row.cadence,clock,now,finished));
  const res=await stmt('UPDATE rooms SET moves=?,clock=?,revision=revision+1,touched=? WHERE id=? AND revision=?',JSON.stringify(moves),nextClock,now,id,row.revision).run();
  if(!res.meta.changes)return json({error:'La position a changé.'},409);
  return json(visible({...row,clock:nextClock,moves:JSON.stringify(moves),revision:row.revision+1},player));
}

export default {
  async fetch(request,env) {
    const path=new URL(request.url).pathname;
    if(!path.startsWith('/api/'))return env.ASSETS.fetch(request);
    try{return await club(request,env,path)}
    catch(error){return json({error:error instanceof SyntaxError?'Requête incorrecte.':'Le salon est momentanément indisponible.'},error instanceof SyntaxError?400:503)}
  }
};
