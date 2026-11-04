import React,{useEffect,useState} from 'react';
const API=(import.meta.env.VITE_API_URL||'').replace(/\/$/,'');
export function TicketActions({booking,request,onAuthRequired,onUpdate}){
 const [busy,setBusy]=useState(''),[message,setMessage]=useState(''),[error,setError]=useState('');
 async function act(action){
  setBusy(action);setError('');setMessage('');
  try{
   if(action==='email'){const result=await request('/api/bookings/'+booking.reference+'/email',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});setMessage(result.message);onUpdate?.();}
   else{
    const response=await fetch(API+'/api/bookings/'+booking.reference+'/ticket',{credentials:'include',signal:AbortSignal.timeout(15000)});
    if(!response.ok){const data=await response.json();const err=new Error(data.error);err.status=response.status;throw err;}
    const url=URL.createObjectURL(await response.blob()),link=document.createElement('a');link.href=url;link.download='druk-cinema-'+booking.reference+'.pdf';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);setMessage('Your PDF ticket has been downloaded.');
   }
  }catch(err){if(err.status===401)onAuthRequired();else setError(err.message||'Unable to complete this request.');}finally{setBusy('');}
 }
 return <div className="ticket-actions"><div className="ticket-action-buttons"><button className="ticket-button" disabled={!!busy||booking.status!=='confirmed'||!['paid','demo_paid'].includes(booking.paymentStatus)} onClick={()=>act('download')}>{busy==='download'?'Preparing ticket…':'Download PDF ticket ↓'}</button><button className="ticket-button" disabled={!!busy||!booking.emailAvailable||booking.status!=='confirmed'||!['paid','demo_paid'].includes(booking.paymentStatus)} onClick={()=>act('email')}>{busy==='email'?'Sending…':'Email ticket'}</button></div>{!['paid','demo_paid'].includes(booking.paymentStatus)&&<p className="muted ticket-note">Payment is not verified. No ticket can be issued.</p>}{!booking.emailAvailable&&<p className="muted ticket-note">{booking.demo?'Email is disabled for demo tickets. Download the sample PDF instead.':'Email delivery is not configured. PDF tickets are available for paid bookings.'}</p>}{message&&<p className="ticket-feedback" role="status">{message}</p>}{error&&<p className="error" role="alert">{error}</p>}</div>;
}
const formatDate=value=>value?new Date(value).toLocaleString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Thimphu'}):'Showtime details unavailable';
export default function CustomerBookings({request,onAuthRequired,onBrowse}){
 const [items,setItems]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[filter,setFilter]=useState('Upcoming'),[reload,setReload]=useState(0),[message,setMessage]=useState('');
 useEffect(()=>{let active=true;setLoading(true);setError('');request('/api/bookings/mine').then(rows=>{if(active)setItems(rows);}).catch(err=>{if(!active)return;if(err.status===401)onAuthRequired();else setError(err.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[request,reload]);
 const upcoming=item=>item.status==='confirmed'&&new Date(item.startsAt)>new Date();
 const filtered=items.filter(item=>filter==='All bookings'||filter==='Cancelled'&&item.status==='cancelled'||filter==='Upcoming'&&upcoming(item)||filter==='Past'&&item.status==='confirmed'&&!upcoming(item));
 return <main className="booking-history section-wrap"><div className="history-heading"><div><p className="eyebrow"><span className="dot"/>YOUR MOVIE NIGHTS</p><h1>My bookings<i>.</i></h1><p className="muted">Your reservations, tickets, and plans—all in one place.</p></div><button className="primary small" onClick={onBrowse}>Find another movie →</button></div>
 <div className="history-toolbar"><div className="chips">{['Upcoming','Past','Cancelled','All bookings'].map(tab=><button key={tab} aria-pressed={filter===tab} className={filter===tab?'active':''} onClick={()=>setFilter(tab)}>{tab}</button>)}</div><button className="text-button" disabled={loading} onClick={()=>setReload(v=>v+1)}>↻ Refresh</button></div>
 {message&&<p role="status" className="ticket-feedback">{message}</p>}{error&&<p className="error" role="alert">{error}</p>}
 {loading?<p className="history-loading" role="status">Loading your bookings…</p>:!filtered.length?<div className="empty"><span>✳</span><h2>No {filter==='All bookings'?'':filter.toLowerCase()+' '}bookings yet.</h2><p>Your next movie night is waiting.</p><button className="text-button" onClick={onBrowse}>Explore movies →</button></div>:<div className="history-list">{filtered.map(item=><article key={item.reference} className={'history-card '+(item.status==='cancelled'?'is-cancelled':'')}><div className="history-card-heading"><div><p className="eyebrow muted">{item.auditorium||'Druk Cinema'}</p><h2>{item.movieTitle}</h2></div><span className={'booking-badge '+item.status}>{item.status==='cancelled'?'Cancelled':item.demo?'Demo booking':upcoming(item)?item.paymentStatus==='paid'?'Booked':'Unpaid':'Past show'}</span></div><dl className="booking-facts"><div><dt>Showtime · Bhutan time</dt><dd>{formatDate(item.startsAt)}</dd></div><div><dt>Seats</dt><dd>{item.seats.join(', ')||'Contact the cinema'}</dd></div><div><dt>Total</dt><dd>Nu. {item.total.toFixed(2)}</dd></div><div><dt>Payment</dt><dd>{item.demo?'Demo payment · no money charged':item.paymentStatus==='paid'?'Paid':'Unpaid · ticket not issued'}</dd></div></dl><p className="booking-reference">Reference <code>{item.reference}</code></p>
 {item.status==='confirmed'&&<TicketActions booking={item} request={request} onAuthRequired={onAuthRequired} onUpdate={()=>setReload(v=>v+1)}/>}
 {item.status==='cancelled'&&<p className="ticket-note muted">Cancelled {formatDate(item.cancelledAt)}. Previously downloaded tickets are no longer valid.</p>}
 </article>)}</div>}
 <p className="history-disclaimer">Booked tickets cannot be cancelled. Demo payments charge no money and demo tickets are not valid for admission. Real Bank of Bhutan checkout remains unavailable.</p>
 </main>;
}
