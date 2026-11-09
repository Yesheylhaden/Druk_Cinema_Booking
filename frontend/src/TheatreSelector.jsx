import React,{useState} from 'react';
export const bhutanDate=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Thimphu',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
const time=value=>new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Thimphu',hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(value));
const dayLabel=(date,options)=>new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Thimphu',...options}).format(new Date(date+'T12:00:00+06:00'));
export default function TheatreSelector({shows,selectedId,onSelect,choosing,onContinue,onChange,disabled}){
 const dates=[...new Set(shows.map(show=>bhutanDate(show.starts_at)))].sort();
 const [chosenDate,setChosenDate]=useState('');
 const date=dates.includes(chosenDate)?chosenDate:dates[0]||'';
 const selected=shows.find(show=>String(show.id)===selectedId);
 const venues=[...new Map(shows.map(show=>[show.theatre_id||1,{id:show.theatre_id||1,name:show.theatre_name||'Cinema Hall',city:show.city||'Thimphu'}])).values()].sort((a,b)=>a.id-b.id);
 if(!shows.length)return <p className="muted" role="status">No upcoming theatre schedules for this movie.</p>;
 if(!choosing&&selected)return <section className="selected-theatre"><div><p className="eyebrow">YOUR THEATRE & SHOWTIME</p><strong>{selected.theatre_name||selected.auditorium}</strong><p>{dayLabel(bhutanDate(selected.starts_at),{weekday:'short',day:'numeric',month:'short'})} · {time(selected.starts_at)} · Nu. {selected.price}</p></div><button className="text-button" type="button" disabled={disabled} onClick={onChange}>Change theatre</button></section>;
 return <section className="theatre-picker" aria-labelledby="theatre-picker-title"><h3 id="theatre-picker-title">Showtime & theatre selection</h3><p className="muted theatre-note">Choose from {venues.length} theatres in Thimphu. All times are in Bhutan time.</p>
 <div className="theatre-dates" aria-label="Choose a date">{dates.map(value=><button key={value} type="button" disabled={disabled} className={date===value?'active':''} aria-pressed={date===value} onClick={()=>{setChosenDate(value);onSelect('');}}><span>{dayLabel(value,{weekday:'short'})}</span><strong>{dayLabel(value,{day:'numeric'})}</strong><small>{dayLabel(value,{month:'short'})}</small></button>)}</div>
 <div className="theatre-venues">{venues.map(venue=>{const slots=shows.filter(show=>(show.theatre_id||1)===venue.id&&bhutanDate(show.starts_at)===date);return <article className={'theatre-venue '+(selected&&(selected.theatre_id||1)===venue.id?'is-selected':'')} key={venue.id}><div className="theatre-venue-heading"><span className="venue-pin" aria-hidden="true">⌖</span><div><h4>{venue.name}</h4><p>{venue.city}</p></div><span className="venue-tag">Hall 1</span></div><div className="theatre-slot-layout"><div className={'venue-art '+(venue.id===2?'venue-red':'')} aria-hidden="true"><span className="venue-screen"/><div>{Array.from({length:12},(_,i)=><i key={i}/>)}</div></div><div className="theatre-slots" aria-label={venue.name+' showtimes'}>{slots.length?slots.map(show=><button type="button" key={show.id} disabled={disabled} aria-pressed={String(show.id)===selectedId} className={String(show.id)===selectedId?'active':''} onClick={()=>onSelect(String(show.id))}><span>{time(show.starts_at)}</span><small>Nu. {show.price}</small></button>):<p className="theatre-note muted">No shows on this date.</p>}</div></div></article>;})}</div>
 <p className="theatre-note muted">Demo schedules · Seats are separate for every theatre and showtime.</p>
 <button className="primary theatre-continue" type="button" disabled={disabled||!selected||bhutanDate(selected.starts_at)!==date} onClick={onContinue}>Continue to seats →</button>
 </section>;
}
