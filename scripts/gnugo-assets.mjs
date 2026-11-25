import {createHash} from 'node:crypto';
import {mkdir, writeFile} from 'node:fs/promises';

// Publish the upstream browser build alongside its matching source distribution.
const source='382df5a9b14b62ea451012ec7d2e81c61162e037';
const build='d2083a69e93bf00fc251e53a599aa14ccff38693';
const raw='https://raw.githubusercontent.com/TristanCacqueray/wasm-gnugo/';
export async function copyGnuGo(dir){
  await mkdir(dir,{recursive:true});
  await Promise.all([
    ['gnugo.js',raw+source+'/javascript/gnugo.js','7e7781c3109cd1edb7929321ebc226ab87fd9e1e0ac61bf4d74e787e4083af78'],
    ['gnugo.wasm',raw+build+'/gnugo.wasm','dc1fc30cc8fe8dbe23a6ae7953af90f17492ad2df841fe3ea656a1f4df545424'],
    ['source.tar.gz','https://codeload.github.com/TristanCacqueray/wasm-gnugo/tar.gz/'+source,'b9134d68a245547388dfc5adf88d08e9818093e763cd6e911b0c25d2eabb4f83']
  ].map(async ([file,url,sha])=>{
    const response=await fetch(url,{signal:AbortSignal.timeout(60000)});
    if(!response.ok)throw Error('GNU Go: '+file+' HTTP '+response.status);
    const data=Buffer.from(await response.arrayBuffer());
    if(createHash('sha256').update(data).digest('hex')!==sha)throw Error('GNU Go: checksum '+file);
    await writeFile(dir+'/'+file,data);
  }));
}
