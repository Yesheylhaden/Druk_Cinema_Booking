import {readFile,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
const path=new URL('../.env',import.meta.url);
let content;let created=false;
try{content=await readFile(path,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;content=await readFile(new URL('../.env.example',import.meta.url),'utf8');created=true;}
const keys=['SERVICE_TOKEN',...['auth','profiles','cinemas','movies','showtimes','halls','seats','reservations','payments','tickets','notifications','search','bookings'].map(name=>name.toUpperCase()+'_DB_PASSWORD')];
if(created)keys.push('POSTGRES_PASSWORD');
for(const key of keys){
 const pattern=new RegExp('^'+key+'=(.*)$','m'),match=content.match(pattern);
 if(!match||!match[1].trim()||match[1].startsWith('replace-')||created&&key==='POSTGRES_PASSWORD'){
  const entry=key+'='+randomBytes(32).toString('hex');content=match?content.replace(pattern,entry):content+'\n'+entry+'\n';
 }
}
await writeFile(path,content.replace(/\r\n/g,'\n'));console.log('Local service environment prepared. No secrets were printed.');
