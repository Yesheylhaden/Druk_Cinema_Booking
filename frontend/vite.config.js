import {defineConfig} from 'vite';
const target=port=>'http://localhost:'+port;
export default defineConfig({server:{proxy:{
 '/api/auth/profile':{target:target(4004),rewrite:path=>path.replace('/api/auth/profile','/api/profiles/me')},
 '/api/auth':target(4003),'/api/profiles':target(4004),
 '/api/movies':target(4001),'/api/showtimes':target(4006),'/api/cinemas':target(4005),'/api/halls':target(4007),'/api/seats':target(4008),
 '/api/reservations':target(4009),'/api/payments':target(4010),'/api/tickets':target(4011),'/api/notifications':target(4012),'/api/search':target(4013),
 '/api/bookings/seats':{target:target(4009),rewrite:path=>path.replace('/api/bookings/seats','/api/reservations/seats')},
 '/api/bookings/payment/otp':{target:target(4010),rewrite:path=>path.replace('/api/bookings/payment/otp','/api/payments/otp')},
 '/api/bookings/options':{target:target(4010),rewrite:path=>path.replace('/api/bookings/options','/api/payments/options')},
 '^/api/bookings/[^/]+/(ticket|email)$':{target:target(4011),rewrite:path=>path.replace(/\/api\/bookings\/([^/]+)\/(ticket|email)/,(_match,id,operation)=>'/api/tickets/'+id+'/'+(operation==='ticket'?'pdf':'email'))},
 '/api/bookings':target(4002)
}}});
