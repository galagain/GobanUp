import { createHash, randomUUID } from 'node:crypto';

const hash = value => createHash('sha256').update(value).digest('hex');
const response = (data,status=200) => Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const error = (message,status) => response({error:message},status);
const rulesets = ['chinese','japanese','korean','aga','new-zealand','tromp-taylor'];
function normalize(g) {
  if (!g || ![9,13,19].includes(g.n) || !Array.isArray(g.moves) || !g.moves.length ||
      g.moves.length>3001 || !g.moves.every(p=>Number.isInteger(p)&&p>=-1&&p<g.n*g.n)) return null;
  const {n,moves,first=1,rules='chinese',komi=6.5,start=null}=g;
  if (![1,2].includes(first) || !rulesets.includes(rules) || !Number.isFinite(komi) || Math.abs(komi)>150) return null;
  if (start!==null && (!Array.isArray(start)||start.length!==n*n||!start.every(p=>[0,1,2].includes(p)))) return null;
  return {n,first,rules,komi,start:start?.some(Boolean)?start:null,moves};
}
export async function reviewApi(db,request,user) {
  const url=new URL(request.url), path=url.pathname;
  const guest=request.headers.get('X-Review-Key')||'';
  const identity=user?'user:'+user.id:/^[a-f0-9-]{36}$/.test(guest)?'guest:'+hash(guest):null;
  if (!identity) return error('Impossible d’identifier cette revue.',401);
  const isMember=id=>user && db.prepare('SELECT 1 FROM rooms WHERE id=? AND (black=? OR white=?)').get(id,user.id,user.id);
  function status(row,after=0) {
    const entries=db.prepare('SELECT result FROM review_moves WHERE review=? AND ply>? ORDER BY ply LIMIT 128').all(row.id,after);
    return response({id:row.id,status:row.status,total:row.total,done:row.done,entries:entries.map(e=>JSON.parse(e.result))});
  }
  if (request.method==='GET') {
    const id=path.match(/^\/api\/reviews\/([a-f0-9-]{36})$/)?.[1];
    const row=id && db.prepare('SELECT id,scope,total,done,status FROM reviews WHERE id=?').get(id);
    if (!row || (row.scope!==identity && !(row.scope.startsWith('room:')&&isMember(row.scope.slice(5)))))
      return error('Revue introuvable.',404);
    const after=Number(url.searchParams.get('after')||0);
    return status(row,Number.isSafeInteger(after)&&after>=0?after:0);
  }
  if (request.method!=='POST'||path!=='/api/reviews') return error('Requête incorrecte.',400);
  const body=await request.json();
  if(!body || typeof body!=='object')return error('Requête incorrecte.',400);
  let record,scope=identity;
  if (body.roomId) {
    if (typeof body.roomId!=='string' || !isMember(body.roomId)) return error('Partie introuvable.',404);
    const room=db.prepare('SELECT size,moves FROM rooms WHERE id=?').get(body.roomId);
    const moves=JSON.parse(room.moves);
    const length=body.length??moves.length;
    if(!Number.isInteger(length)||length<1||length>moves.length)return error('Position indisponible.',409);
    record=normalize({n:room.size,moves:moves.slice(0,length)});
    scope='room:'+body.roomId;
  } else record=normalize(body.record);
  if (!record) return error('La revue nécessite une partie valide avec au moins un coup.',400);
  const serialized=JSON.stringify(record), fingerprint=hash('gobanup-review-v1:'+serialized);
  const requester=user?identity:'network:'+hash(request.headers.get('CF-Connecting-IP')||'local');
  const now=Date.now();
  db.exec('BEGIN IMMEDIATE');
  try {
    let row=db.prepare('SELECT id,scope,total,done,status FROM reviews WHERE scope=? AND fingerprint=?').get(scope,fingerprint);
    if (!row || (row.status==='failed'&&body.retry===true)) {
      const active=db.prepare("SELECT count(*) AS n FROM reviews WHERE status IN ('queued','running')").get().n;
      const usage=db.prepare('SELECT count(*) AS n FROM reviews WHERE requester=? AND created>?').get(requester,now-3600000).n;
      if (active>=32 || usage>=20) { db.exec('ROLLBACK');return error('La file de revue est pleine. Réessayez plus tard.',429); }
      if (row) {
        db.prepare("UPDATE reviews SET status='queued',attempts=0,created=?,requester=? WHERE id=?").run(now,requester,row.id);
        row.status='queued';
      } else {
        const id=randomUUID();
        db.prepare('INSERT INTO reviews(id,scope,fingerprint,record,total,requester,created) VALUES(?,?,?,?,?,?,?)')
          .run(id,scope,fingerprint,serialized,record.moves.length,requester,now);
        row={id,total:record.moves.length,done:0,status:'queued'};
      }
    }
    db.exec('COMMIT');
    return status(row);
  } catch(e) { if(db.isTransaction)db.exec('ROLLBACK');throw e; }
}
