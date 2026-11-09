import {notificationsReady,notify} from '../../common/http.js';
export const mailReady=notificationsReady;
export function accountLink(origin,screen,token){const url=new URL(origin);url.hash='/'+screen+'?token='+encodeURIComponent(token);return url.toString();}
export const accountMail=(to,subject,text)=>notify({to,subject,text});