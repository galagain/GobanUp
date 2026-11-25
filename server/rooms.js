
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const json = (value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
function visible(row,player) {
  return {id:row.id,kind:row.kind,n:row.size,moves:JSON.parse(row.moves),seat:row.black===player?1:2,
    black:row.black_name,white:row.white_name,ready:!!row.white,revision:row.revision};
}
async function api(request,db,path,user) {
  const player=user.id;
  const stmt=(sql,...args)=>db.prepare(sql).bind(...args);
  const body=request.method==='POST'?await request.json():{};
  const name=user.name;
  const now=Date.now();
  if(path==='/api/rooms'&&request.method==='POST') {
    const {kind,n,ticket}=body;
    if(!['queue','invite'].includes(kind)||![9,13,19].includes(n)||!uuid.test(ticket))return json({error:'Format incorrect.'},400);
    const create=stmt(`INSERT OR IGNORE INTO rooms (id,kind,size,black,black_name,touched)
      SELECT ?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM rooms WHERE white_ticket=?)`,ticket,kind,n,player,name,now,ticket);
    const find=stmt('SELECT * FROM rooms WHERE (id=? AND black=?) OR (white_ticket=? AND white=?)',ticket,player,ticket,player);
    const actions=[];
    if(kind==='queue') actions.push(stmt(`UPDATE rooms SET white=?,white_name=?,white_ticket=?,touched=?
      WHERE id=(SELECT id FROM rooms WHERE kind='queue' AND size=? AND white IS NULL AND black<>? AND touched>? ORDER BY touched,id LIMIT 1)
      AND NOT EXISTS (SELECT 1 FROM rooms WHERE id=? OR white_ticket=?)`,player,name,ticket,now,n,player,now-60000,ticket,ticket));
    const results=await db.batch([...actions,create,find]);const row=results.at(-1).results[0];
    return row?json(visible(row,player)):json({error:'Relancez la recherche.'},409);
  }
  const match=/^\/api\/rooms\/([a-f0-9-]+)(?:\/(join|move|cancel|decline))?$/.exec(path);
  if(!match||!uuid.test(match[1]))return json({error:'Salon introuvable.'},404);
  const [,id,action]=match;
  if(action==='decline'&&request.method==='POST'){
    const res=await stmt('DELETE FROM rooms WHERE id=? AND recipient=? AND white IS NULL',id,player).run();
    return res.meta.changes?json({closed:true}):json({error:'Invitation indisponible.'},409);
  }
  if(action==='join'&&request.method==='POST')
    await stmt("UPDATE rooms SET white=?,white_name=?,touched=? WHERE id=? AND (kind='invite' OR (kind='friend' AND recipient=?)) AND white IS NULL AND black<>?",player,name,now,id,player,player).run();
  let row=await stmt('SELECT * FROM rooms WHERE id=?',id).first();
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
  if(action!=='move')return json({error:'Action inconnue.'},400);
  const moves=JSON.parse(row.moves),color=moves.length%2+1;
  if(body.at!==moves.length||!row.white||(color===1?row.black:row.white)!==player||
    (moves.length>=2&&moves.slice(-2).every(m=>m===-1)))return json({error:'La position a changé. Actualisation en cours.'},409);
  const p=body.p;
  if(p!==-1){
    const states=[Array(row.size*row.size).fill(0)];
    for(const [i,m] of moves.entries())states.push(m===-1?states.at(-1):Go.play(states.at(-1),m,i%2+1,row.size,states).board);
    if(!Go.play(states.at(-1),p,color,row.size,states))return json({error:'Ce coup est interdit.'},400);
  }
  moves.push(p);
  const res=await stmt('UPDATE rooms SET moves=?,revision=revision+1,touched=? WHERE id=? AND revision=?',JSON.stringify(moves),now,id,row.revision).run();
  if(!res.meta.changes)return json({error:'La position a changé.'},409);
  return json(visible({...row,moves:JSON.stringify(moves),revision:row.revision+1},player));
}

export default {
  async fetch(request,env) {
    const path=new URL(request.url).pathname;
    if(!path.startsWith('/api/'))return env.ASSETS.fetch(request);
    try{return await club(request,env,path)}
    catch(error){return json({error:error instanceof SyntaxError?'Requête incorrecte.':'Le salon est momentanément indisponible.'},error instanceof SyntaxError?400:503)}
  }
};
