import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('le bilan précharge les modules de la même version que ses scripts',async()=>{
  const client=new URL('../dist/client/',import.meta.url);
  const html=await readFile(new URL('index.html',client),'utf8');
  const files=[...html.matchAll(/(?:src|href)="(review\/[a-f0-9]+\/[\w-]+\.js)"/g)].map(m=>m[1]);
  const base=files.find(f=>f.endsWith('/move-review.js'));
  assert.ok(base);
  const dir=new URL('.',new URL(base,client));
  for(const name of ['local-analysis.js','review-summary.js','move-review.js','browser-review.js','review-grade.js']){
    const path=files.find(f=>f.endsWith('/'+name));
    assert.ok(path,name);
    const url=new URL(path,client);
    assert.equal(url.href,new URL(name,dir).href);
    assert.equal(await readFile(url,'utf8'),await readFile(new URL('../public/'+name,import.meta.url),'utf8'));
  }
});
