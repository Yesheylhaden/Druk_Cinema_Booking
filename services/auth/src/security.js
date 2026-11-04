import {scrypt,randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const derive=promisify(scrypt);
const options={N:131072,r:8,p:1,maxmem:256*1024*1024};
export const normalizeEmail=value=>typeof value==='string'?value.trim().toLowerCase():'';
export const validEmail=value=>value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export const validPassword=value=>typeof value==='string'&&value.length>=8&&value.length<=128;
export const digest=value=>createHash('sha256').update(value).digest('hex');
export function sessionToken(cookie=''){const token=cookie.split(';').map(v=>v.trim()).find(v=>v.startsWith('druk_session='))?.slice(13);return /^[a-f0-9]{64}$/.test(token||'')?token:null;}
export async function hashPassword(password){const salt=randomBytes(16).toString('hex');const hash=await derive(password,salt,64,options);return salt+':'+hash.toString('hex');}
export async function verifyPassword(password,stored){const [salt,hex]=stored.split(':');if(!/^[a-f0-9]{32}$/.test(salt)||!/^[a-f0-9]{128}$/.test(hex))return false;const actual=await derive(password,salt,64,options);return timingSafeEqual(actual,Buffer.from(hex,'hex'));}
