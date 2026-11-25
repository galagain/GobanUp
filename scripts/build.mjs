import { createHash } from 'node:crypto';
import { mkdir, cp, readFile, writeFile, rm } from 'node:fs/promises';
await mkdir('dist/server', {recursive:true});
await rm('dist/client',{recursive:true,force:true});
await cp('public','dist/client',{recursive:true});
// Public caches can retain scripts between releases; tie each URL to its contents.
const indexPath = 'dist/client/index.html';
let html = await readFile(indexPath,'utf8');
for (const [attribute,file] of html.matchAll(/(?:src|href)="([\w-]+\.(?:js|css))"/g)) {
  const content = await readFile('dist/client/'+file);
  const version = createHash('sha256').update(content).digest('hex').slice(0,12);
  html = html.replace(attribute,attribute.replace(file,file+'?v='+version));
}
await writeFile(indexPath,html);
const rules = await readFile('public/engine.js','utf8');
const roomApi = await readFile('server/rooms.js','utf8');
await writeFile('dist/server/index.js',rules+'\n'+await readFile('server/club.js','utf8')+'\n'+roomApi);
