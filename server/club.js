// Account and club API, shared by the Worker and the self-hosted server.
const hex = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
const encode = value => new TextEncoder().encode(value);
const sessionAge = 30 * 24 * 3600;
const cookieName = '__Host-gobanup';
const fail = (error, status) => json({error}, status);
const sessionDigest = token => crypto.subtle.digest('SHA-256', encode(token)).then(hex);
async function passwordHash(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', encode(password), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({name:'PBKDF2', hash:'SHA-256', salt:encode(salt), iterations}, key, 256));
}
function sessionResponse(user, token) {
  const response = json({user});
  response.headers.set('Set-Cookie', cookieName+'='+token+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age='+(user ? sessionAge : 0));
  return response;
}
async function club(request, env, path) {
  const db = env.DB;
  const sql = (query, ...args) => db.prepare(query).bind(...args);
  const now = Date.now();
  const post = request.method === 'POST';
  if (!post && request.method !== 'GET') return fail('Méthode incorrecte.', 405);
  if (post && (!request.headers.get('Content-Type')?.startsWith('application/json') ||
      (request.headers.has('Origin') && request.headers.get('Origin') !== new URL(request.url).origin)))
    return fail('Origine ou format de requête incorrect.', 403);
  const token = request.headers.get('Cookie')?.match(/(?:^|;\s*)__Host-gobanup=([a-f0-9]{64})(?:;|$)/)?.[1];
  const digest = token ? await sessionDigest(token) : null;
  const user = digest ? await sql('SELECT u.id,u.name FROM sessions s JOIN users u ON s.user_id=u.id WHERE token=? AND expires>?',digest,now).first() : null;
  if (path === '/api/me' && !post) return json({user});
  if (path === '/api/logout' && post) {
    if (digest) await sql('DELETE FROM sessions WHERE token=?',digest).run();
    return sessionResponse(null,'');
  }
  if (post && ['/api/register','/api/login'].includes(path)) {
    const register = path === '/api/register';
    const body = await request.json();
    const name = typeof body?.name === 'string' ? body.name.normalize('NFC').trim() : '';
    const password = body?.password;
    if (!/^[\p{L}\p{N}_-]{3,24}$/u.test(name) || typeof password !== 'string' || password.length > 128)
      return fail('Utilisez un pseudo de 3 à 24 lettres, chiffres, tirets ou tirets bas et un mot de passe valide.',400);
    if (register && password.length < 10) return fail('Utilisez au moins 10 caractères pour le mot de passe.',400);
    const window = 15*60*1000;
    const key = path+'|'+(request.headers.get('CF-Connecting-IP') || 'local')+'|'+Math.floor(now/window);
    const limits = await db.batch([sql('DELETE FROM auth_limits WHERE expires<=?',now),
      sql('INSERT INTO auth_limits VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count',key,now+window)]);
    if (limits[1].results[0].count > (register ? 12 : 40)) return fail('Trop de tentatives. Réessayez dans 15 minutes.',429);
    const lookup = name.toLowerCase();
    const stored = await sql('SELECT * FROM users WHERE lookup=?',lookup).first();
    if (register && stored) return fail('Ce pseudo est déjà utilisé.',409);
    const salt = stored?.salt || hex(crypto.getRandomValues(new Uint8Array(16)));
    const iterations = stored?.iterations || Number(env.PASSWORD_ITERATIONS || 100000);
    const hash = await passwordHash(password,salt,iterations);
    if (!register && (!stored || hash !== stored.hash)) return fail('Pseudo ou mot de passe incorrect.',401);
    const account = stored ? {id:stored.id,name:stored.name} : {id:crypto.randomUUID(),name};
    if (register) {
      const created = await sql('INSERT OR IGNORE INTO users VALUES (?,?,?,?,?,?)',account.id,name,lookup,salt,hash,iterations).run();
      if (!created.meta.changes) return fail('Ce pseudo est déjà utilisé.',409);
    }
    const fresh = hex(crypto.getRandomValues(new Uint8Array(32)));
    await db.batch([sql('DELETE FROM sessions WHERE expires<=? OR token=?',now,digest),
      sql('INSERT INTO sessions VALUES (?,?,?)',await sessionDigest(fresh),account.id,now+sessionAge*1000)]);
    return sessionResponse(account,fresh);
  }
  if (!user) return fail('Connectez-vous pour jouer avec le club.',401);
  if (path.startsWith('/api/rooms')) return api(request,db,path,user);
  if (path === '/api/club' && !post) {
    const [friends,rooms] = await db.batch([
      sql('SELECT u.id,u.name,f.accepted,f.sender FROM friendships f JOIN users u ON u.id=CASE WHEN f.lo=? THEN f.hi ELSE f.lo END WHERE f.lo=? OR f.hi=? ORDER BY u.lookup',user.id,user.id,user.id),
      sql('SELECT * FROM rooms WHERE black=? OR white=? OR (recipient=? AND white IS NULL) ORDER BY touched DESC LIMIT 200',user.id,user.id,user.id)
    ]);
    return json({friends:friends.results,rooms:rooms.results.map(r => ({...visible(r,user.id),invited:r.recipient===user.id && !r.white,recipient:r.recipient}))});
  }
  if (!post) return fail('Page introuvable.',404);
  const body = await request.json();
  if (path === '/api/friends') {
    const target = await sql('SELECT id FROM users WHERE lookup=?',String(body.name||'').trim().normalize('NFC').toLowerCase()).first();
    if (!target) return fail('Aucun compte ne porte ce pseudo.',404);
    if (target.id === user.id) return fail('Choisissez un autre joueur.',400);
    const [lo,hi] = [user.id,target.id].sort();
    const result = await sql('INSERT OR IGNORE INTO friendships(lo,hi,sender) VALUES(?,?,?)',lo,hi,user.id).run();
    return result.meta.changes ? json({ok:true}) : fail('Une demande ou une amitié existe déjà.',409);
  }
  const match = /^\/api\/friends\/([a-f0-9-]+)\/(accept|remove|challenge)$/.exec(path);
  if (!match || !uuid.test(match[1])) return fail('Action inconnue.',404);
  const [,target,action] = match;
  const [lo,hi] = [user.id,target].sort();
  if (action === 'challenge') {
    if (![9,13,19].includes(body.n)) return fail('Taille de goban incorrecte.',400);
    const id = crypto.randomUUID();
    const results = await db.batch([sql(`INSERT OR IGNORE INTO rooms(id,kind,size,black,black_name,touched,recipient)
      SELECT ?,'friend',?,?,?,?,? FROM friendships WHERE lo=? AND hi=? AND accepted=1`,id,body.n,user.id,user.name,now,target,lo,hi),
      sql('SELECT * FROM rooms WHERE black=? AND recipient=? AND white IS NULL',user.id,target)]);
    const room = results[1].results[0];
    return room ? json(visible(room,user.id)) : fail('Ajoutez ce joueur à vos amis pour l’inviter.',403);
  }
  const change = action === 'accept'
    ? sql('UPDATE friendships SET accepted=1 WHERE lo=? AND hi=? AND sender=? AND accepted=0',lo,hi,target)
    : sql('DELETE FROM friendships WHERE lo=? AND hi=?',lo,hi);
  const results = await db.batch(action === 'remove' ? [change,
    sql('DELETE FROM rooms WHERE white IS NULL AND ((black=? AND recipient=?) OR (black=? AND recipient=?))',lo,hi,hi,lo)] : [change]);
  return results[0].meta.changes ? json({ok:true}) : fail('Cette demande a déjà été traitée.',409);
}
