import {copyGnuGo} from './gnugo-assets.mjs';
import { createHash } from 'node:crypto';
import { mkdir, cp, readFile, writeFile, rm } from 'node:fs/promises';
await mkdir('dist/server', {recursive:true});
await rm('dist/client',{recursive:true,force:true});
await cp('public','dist/client',{recursive:true});
await copyGnuGo('dist/client/bots/gnugo');
// The review's classic scripts and their relative ES imports must come from the same release.
const reviewFiles=['local-analysis.js','review-summary.js','move-review.js','browser-review.js','review-grade.js'];
const reviewHash=createHash('sha256');
for(const file of reviewFiles){
  reviewHash.update(file).update('\0').update(await readFile('public/'+file)).update('\0');
}
const reviewDir='review/'+reviewHash.digest('hex').slice(0,16);
await mkdir('dist/client/'+reviewDir,{recursive:true});
await Promise.all(reviewFiles.map(file=>cp('public/'+file,'dist/client/'+reviewDir+'/'+file)));

// The other page assets can be versioned independently.
const indexPath = 'dist/client/index.html';
let html = await readFile(indexPath,'utf8');
for (const [attribute,file] of html.matchAll(/(?:src|href)="([\w-]+\.(?:js|css))"/g)) {
  if(reviewFiles.includes(file)){
    html=html.replace(attribute,attribute.replace(file,reviewDir+'/'+file));
    continue;
  }
  const content = await readFile('dist/client/'+file);
  const version = createHash('sha256').update(content).digest('hex').slice(0,12);
  html = html.replace(attribute,attribute.replace(file,file+'?v='+version));
}
await writeFile(indexPath,html);
const rules = await readFile('public/engine.js','utf8');
const roomApi = await readFile('server/rooms.js','utf8');
await writeFile('dist/server/index.js',rules+'\n'+await readFile('public/cadences.js','utf8')+'\n'+await readFile('server/club.js','utf8')+'\n'+roomApi);
