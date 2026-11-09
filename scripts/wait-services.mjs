import {readFile} from 'node:fs/promises';
const services=JSON.parse(await readFile(new URL('../services/manifest.json',import.meta.url),'utf8'));
const pending=new Set(services.map(service=>service.name));
for(let attempt=0;attempt<60&&pending.size;attempt++){
 await Promise.all(services.filter(service=>pending.has(service.name)).map(async service=>{try{const response=await fetch('http://localhost:'+service.port+'/health',{signal:AbortSignal.timeout(2000)});if(response.ok&&(await response.json()).service===service.name)pending.delete(service.name);}catch{}}));
 if(pending.size)await new Promise(resolve=>setTimeout(resolve,1000));
}
if(pending.size){console.error('Services not ready: '+[...pending].join(', '));process.exitCode=1;}else console.log('All '+services.length+' independent backend services are healthy.');
