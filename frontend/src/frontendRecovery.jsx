import React,{useEffect,useState} from 'react';
import {accountRequest} from './frontendAuth';
export default function Recovery({screen,onLogin,onDone}){
 const [token]=useState(()=>new URLSearchParams(window.location.hash.split('?')[1]||'').get('token')||'');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[done,setDone]=useState(false);
 const forgot=screen==='forgot-password',verify=screen==='verify-email';
 useEffect(()=>{if(token)window.history.replaceState(null,'',window.location.pathname+window.location.search+'#/'+screen);},[]);
 async function submit(event){
  event.preventDefault();if(busy)return;const data=new FormData(event.currentTarget);
  if(!forgot&&!verify&&data.get('newPassword')!==data.get('confirmPassword')){setError('Passwords do not match.');return;}
  setBusy(true);setError('');setMessage('');
  try{
   const result=await accountRequest(forgot?'password/forgot':verify?'verification/confirm':'password/reset',forgot?{email:data.get('email')}:verify?{token}:{token,newPassword:data.get('newPassword')});
   setMessage(result.message);setDone(true);if(!forgot)onDone(result.loginRequired||!verify);
  }catch(err){setError(err.message||'The request could not be completed.');}finally{setBusy(false);}
 }
 return <main className="recovery-page"><section className="recovery-card"><button className="auth-back text-button" disabled={busy} onClick={onLogin}>← Back to login</button><p className="eyebrow"><span className="dot"/>DRUK CINEMA · ACCOUNT SECURITY</p><h1>{forgot?'Forgot password':verify?'Verify your email':'Reset password'}<i>.</i></h1><p className="muted">{forgot?'Enter your account email to request a one-time reset link.':verify?'Confirm this email link to verify your address.':'Choose a new password. All existing sessions will be signed out.'}</p>
 {error&&<p role="alert" className="error">{error}</p>}{message&&<p role="status" className="ticket-feedback">{message}</p>}
 {!done&&<form onSubmit={submit}><fieldset className="auth-fields" disabled={busy||(!forgot&&!token)}>{forgot?<label className="field">Email address<input name="email" type="email" autoComplete="email" maxLength={254} required/></label>:!verify&&<><label className="field">New password<input name="newPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128} required/></label><label className="field">Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128} required/></label></>}<button className="primary auth-submit">{busy?'Please wait…':forgot?'Request reset link':verify?'Confirm email':'Reset password'}</button></fieldset></form>}
 {!forgot&&!token&&<p className="ticket-note muted">No valid link was provided. Request a new email and open its link.</p>}
 {done&&<button className="ticket-button" onClick={onLogin}>Continue to login →</button>}
 <p className="ticket-note muted">Links expire after one hour and can be used once. No password is ever sent by email.</p></section></main>;
}
