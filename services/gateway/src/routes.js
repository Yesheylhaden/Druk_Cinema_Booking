const rules=[
 [/^\/api\/auth\/admin\/users$/,['GET'],'auth'],
 [/^\/api\/auth\/profile$/,['GET','POST'],'profiles',()=>'/api/profiles/me'],
 [/^\/api\/profiles\/me$/,['GET','POST'],'profiles'],
 [/^\/api\/auth\/(?:login|register|logout|password|password\/(?:forgot|reset)|verification\/(?:request|confirm)|email\/change)$/,['POST'],'auth'],
 [/^\/api\/auth\/me$/,['GET'],'auth'],
 [/^\/api\/movies(?:\/\d+)?$/,['GET'],'movies'],
 [/^\/api\/showtimes(?:\/\d+)?$/,['GET'],'showtimes'],
 [/^\/api\/cinemas(?:\/\d+)?$/,['GET'],'cinemas'],
 [/^\/api\/halls(?:\/\d+)?$/,['GET'],'halls'],
 [/^\/api\/seats$/,['GET'],'seats'],
 [/^\/api\/(?:reservations\/seats|bookings\/seats)$/,['GET'],'reservations',()=>'/api/reservations/seats'],
 [/^\/api\/(?:payments\/options|bookings\/options)$/,['GET'],'payments',()=>'/api/payments/options'],
 [/^\/api\/(?:payments\/otp|bookings\/payment\/otp)$/,['POST'],'payments',()=>'/api/payments/otp'],
 [/^\/api\/payments\/authorize$/,['POST'],'payments'],
 [/^\/api\/bookings\/([a-f0-9-]{36})\/ticket$/,['GET'],'tickets',match=>'/api/tickets/'+match[1]+'/pdf'],
 [/^\/api\/bookings\/([a-f0-9-]{36})\/email$/,['POST'],'tickets',match=>'/api/tickets/'+match[1]+'/email'],
 [/^\/api\/tickets\/[a-f0-9-]{36}\/(?:pdf|qr)$/,['GET'],'tickets'],
 [/^\/api\/tickets\/[a-f0-9-]{36}\/email$/,['POST'],'tickets'],
 [/^\/api\/bookings$/,['POST'],'bookings'],
 [/^\/api\/bookings\/(?:mine|[a-f0-9-]{36})$/,['GET'],'bookings'],
 [/^\/api\/bookings\/[a-f0-9-]{36}\/(?:cancel|confirm)$/,['POST'],'bookings'],
 [/^\/api\/notifications\/capabilities$/,['GET'],'notifications'],
 [/^\/api\/search$/,['GET'],'search']
];
export function resolveRoute(path,method){
 for(const [pattern,methods,service,rewrite] of rules){const match=path.match(pattern);if(match)return methods.includes(method)?{service,path:rewrite?rewrite(match):path}:{status:405};}
 return {status:404};
}
