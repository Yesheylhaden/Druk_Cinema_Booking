const API=(import.meta.env?.VITE_API_URL||'').replace(/\/$/,'');
export async function accountRequest(path,body){
 const response=await fetch(API+'/api/auth/'+path,{method:body?'POST':'GET',credentials:'include',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});
 const data=await response.json().catch(()=>({error:'Account service unavailable. Please try again.'}));
 if(!response.ok){const error=new Error(data.error||'Unable to continue. Please try again.');error.status=response.status;throw error;}
 return data;
}
export function safeDestination(value){return /^\/movie\/[1-9]\d*$/.test(value||'')||['/','/movies','/my-list','/bookings','/profile'].includes(value)?value:'/';}
export function readRoute(){return window.location.hash.slice(1)||'/';}
