import { mkdir, cp, readFile, writeFile } from 'node:fs/promises';
await mkdir('dist/server', {recursive:true});
await cp('public','dist/client',{recursive:true});
const rules = await readFile('public/engine.js','utf8');
const roomApi = await readFile('server/rooms.js','utf8');
await writeFile('dist/server/index.js',rules+'\n'+roomApi);
