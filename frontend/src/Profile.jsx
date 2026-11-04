import React,{useEffect,useState} from 'react';
import {accountRequest} from './auth';
export default function Profile({onUpdate,onAuthRequired}){
 const [profile,setProfile]=useState(null),[emailAvailable,setEmailAvailable]=useState(false),[busy,setBusy]=useState(''),[notice,setNotice]=useState(''),[error,setError]=useState('');
 useEffect(()=>{let active=true;accountRequest('profile').then(data=>{if(active){setProfile(data.user);setEmailAvailable(data.emailAvailable);}}).catch(err=>{if(active){if(err.status===401)onAuthRequired();else setError(err.message);}});return()=>{active=false;};},[]);
 async function submit(event,kind){
  event.preventDefault();if(busy)return;const form=event.currentTarget,data=new FormData(form);
  if(kind==='password'&&data.get('newPassword')!==data.get('confirmPassword')){setError('New passwords do not match.');return;}
  setBusy(kind);setNotice('');setError('');
  try{
   const payload=kind==='profile'?{name:data.get('name'),phone:data.get('phone')}:kind==='password'?{currentPassword:data.get('currentPassword'),newPassword:data.get('newPassword')}:{email:data.get('email'),currentPassword:data.get('currentPassword')};
   const result=await accountRequest(kind==='email'?'email/change':kind,payload);
   if(result.user){setProfile(result.user);onUpdate(result.user);}
   if(kind!=='profile')form.reset();setNotice(result.message);
  }catch(err){if(err.status===401)onAuthRequired();else setError(err.message||'Unable to update your account.');}finally{setBusy('');}
 }
 async function verify(){
  setBusy('verify');setError('');setNotice('');
  try{setNotice((await accountRequest('verification/request',{})).message);}catch(err){if(err.status===401)onAuthRequired();else setError(err.message);}finally{setBusy('');}
 }
 return <main className="profile-page section-wrap"><p className="eyebrow"><span className="dot"/>YOUR CINEMA ACCOUNT</p><h1>My profile<i>.</i></h1><p className="muted">Your details, account security, and email preferences.</p>
 {notice&&<p role="status" className="ticket-feedback">{notice}</p>}{error&&<p role="alert" className="error">{error}</p>}
 {!profile?<p role="status">{error?'Profile could not be loaded. Refresh to retry.':'Loading profile…'}</p>:<div className="profile-grid">
 <section className="profile-card"><h2>Personal details</h2><form onSubmit={e=>submit(e,'profile')}><fieldset className="auth-fields" disabled={!!busy}><label className="field">Full name<input name="name" defaultValue={profile.name} autoComplete="name" minLength={2} maxLength={100} required/></label><label className="field">Phone number <span className="muted">(optional)</span><input name="phone" defaultValue={profile.phone} autoComplete="tel" type="tel" maxLength={30} placeholder="+975 …"/></label><p className="ticket-note muted">Member since {new Date(profile.createdAt).toLocaleDateString()}</p><button className="primary small">{busy==='profile'?'Saving…':'Save profile'}</button></fieldset></form></section>
 <section className="profile-card"><h2>Email address</h2><p className="profile-email">{profile.email}</p><span className="booking-badge">{profile.emailVerified?'Verified':'Not verified'}</span>{!profile.emailVerified&&<button className="ticket-button" disabled={!!busy||!emailAvailable} onClick={verify}>{busy==='verify'?'Requesting…':'Send verification email'}</button>}
 {!emailAvailable&&<p className="ticket-note muted">Email is not configured. Verification, email changes, and password reset emails are unavailable until SMTP is set up.</p>}
 <form onSubmit={e=>submit(e,'email')}><fieldset className="auth-fields" disabled={!!busy||!emailAvailable}><label className="field">New email address<input name="email" type="email" autoComplete="email" maxLength={254} required/></label><label className="field">Current password<input name="currentPassword" type="password" autoComplete="current-password" maxLength={128} required/></label><button className="ticket-button">{busy==='email'?'Requesting…':'Request email change'}</button></fieldset></form><p className="ticket-note muted">Your current email stays active until you verify the new address. Confirming an email change signs out all sessions.</p></section>
 <section className="profile-card"><h2>Change password</h2><form onSubmit={e=>submit(e,'password')}><fieldset className="auth-fields" disabled={!!busy}><label className="field">Current password<input name="currentPassword" type="password" autoComplete="current-password" maxLength={128} required/></label><label className="field">New password<input name="newPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128} required/></label><label className="field">Confirm new password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128} required/></label><button className="primary small">{busy==='password'?'Updating…':'Update password'}</button></fieldset></form><p className="ticket-note muted">Other sessions and outstanding recovery links are revoked when you change your password.</p></section>
 </div>}</main>;
}
