import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { createReadStream, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import worker from '../dist/server/index.js';

const db = new DatabaseSync(process.env.DATABASE || '/data/gobanup.sqlite');
db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS migrations(name TEXT PRIMARY KEY)');
for (const name of readdirSync('drizzle').filter(n => n.endsWith('.sql')).sort()) {
  if (db.prepare('SELECT 1 FROM migrations WHERE name=?').get(name)) continue;
  db.exec('BEGIN');
  try {
    db.exec(readFileSync(join('drizzle',name),'utf8'));
    db.prepare('INSERT INTO migrations VALUES (?)').run(name);
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}
// Use the same bound statements and atomic batches as the Worker.
class Statement {
  constructor(query,args) { this.query=query; this.args=args; }
  first() { return db.prepare(this.query).get(...this.args); }
  run() { return {meta:db.prepare(this.query).run(...this.args)}; }
  execute() {
    const stmt = db.prepare(this.query);
    if (stmt.columns().length) return {results:stmt.all(...this.args)};
    return {meta:stmt.run(...this.args),results:[]};
  }
}
const DB = {
  prepare(query) { return {bind:(...args) => new Statement(query,args)}; },
  batch(statements) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const rows = statements.map(s => s.execute());
      db.exec('COMMIT');
      return rows;
    } catch (e) { db.exec('ROLLBACK'); throw e; }
  }
};
const types = {'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.wasm':'application/wasm','.txt':'text/plain'};
const files = new Map();
function index(dir, prefix='') {
  for (const entry of readdirSync(dir,{withFileTypes:true})) {
    const path=join(dir,entry.name), url=prefix+'/'+entry.name;
    if (entry.isDirectory()) index(path,url);
    else if (entry.isFile()) files.set(url,path);
  }
}
index('dist/client');
const origin = process.env.ORIGIN || 'https://gobanup.galagain.com';
const server = createServer(async (req,res) => {
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','same-origin');
  res.setHeader('X-Frame-Options','DENY');
  try {
    const url = new URL(req.url,origin);
    if (url.origin !== origin) { res.writeHead(400).end(); return; }
    if (url.pathname === '/health') { db.prepare('SELECT 1').get(); res.end('ok'); return; }
    if (url.pathname.startsWith('/api/')) {
      const chunks=[];
      let size=0;
      for await (const chunk of req) {
        size+=chunk.length;
        if (size>16384) { res.writeHead(413).end(); return; }
        chunks.push(chunk);
      }
      const options={method:req.method,headers:req.headers};
      if (req.method==='POST') options.body=Buffer.concat(chunks);
      const response=await worker.fetch(new Request(url,options),{DB,PASSWORD_ITERATIONS:600000});
      res.writeHead(response.status,Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    const path=files.get(url.pathname==='/'?'/index.html':url.pathname);
    if (!path || !['GET','HEAD'].includes(req.method)) { res.writeHead(404).end(); return; }
    res.writeHead(200,{'Content-Type':types[extname(path)] || 'application/octet-stream','Content-Length':statSync(path).size,
      'Cache-Control':(url.pathname.startsWith('/katago/')||url.pathname.startsWith('/bots/gnugo/'))?'public, max-age=86400':'no-cache'});
    if (req.method==='HEAD') res.end();
    else createReadStream(path).on('error',()=>res.destroy()).pipe(res);
  } catch (e) { console.error(e.message); if (!res.headersSent) res.writeHead(500); res.end(); }
});
server.requestTimeout=15000;
server.listen(Number(process.env.PORT ?? 8093),'0.0.0.0',()=>console.log('GobanUp écoute sur le port',server.address().port));
