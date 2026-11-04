import React,{useEffect,useRef,useState} from 'react';
import {accountRequest} from './auth';

export default function AuthScreens({onBack,onSuccess,initialScreen='login',onNavigate}){
 const [screen,setScreen]=useState(initialScreen),[visible,setVisible]=useState(false),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const heading=useRef(null),login=screen==='login';
 useEffect(()=>{setScreen(initialScreen);setNotice('');setVisible(false);heading.current?.focus();},[initialScreen]);
 function change(next){if(busy)return;setScreen(next);setNotice('');setVisible(false);onNavigate(next);}
 async function submit(event){
  event.preventDefault();if(busy)return;
  const form=event.currentTarget;if(!form.reportValidity())return;
  const data=new FormData(form);
  if(!login&&data.get('password')!==data.get('confirmPassword')){setNotice('Your passwords do not match. Please check them and try again.');return;}
  setBusy(true);setNotice('');
  try{
   const result=await accountRequest(login?'login':'register',{email:data.get('email'),password:data.get('password'),...(!login?{name:data.get('name')}: {})});
   form.reset();onSuccess(result.user);
  }catch(error){setNotice(error.name==='TimeoutError'?'The request timed out. Please try again.':error instanceof TypeError?'Cannot reach the account service. Please try again.':error.message);}finally{setBusy(false);}
 }
 return <main className="auth-page"><aside className="auth-brand-panel">
  <a className="auth-brand-lockup" href="#/" onClick={event=>{event.preventDefault();if(!busy)onBack();}} aria-label="Druk Cinema home">
    <svg className="auth-camera" viewBox="0 0 128 128" fill="none" aria-hidden="true">
      <rect x="8" y="10" width="112" height="112" rx="10" fill="#ee8700"/>
      <rect x="2" y="4" width="112" height="112" rx="10" fill="#ff9d00"/>
      <path d="M13 16Q13 10 21 10H34Q39 12 32 15L23 19Q20 21 18 29Q15 39 12 36Z" fill="#ffc34c"/>
      <circle cx="55" cy="41" r="20" fill="#f8fafb"/>
      <circle cx="89" cy="47" r="14" fill="#f8fafb"/>
      <rect x="43" y="61" width="57" height="43" rx="5" fill="#f8fafb"/>
      <path d="M43 76L23 62Q17 59 17 66V99Q17 106 23 102L43 88Z" fill="#f8fafb"/>
    </svg>
    <h1>DRUK<br/>CINEMA</h1>
    <p>Your Cinematic Companion</p>
  </a>
 </aside><section className="auth-content"><button className="auth-back text-button" disabled={busy} onClick={onBack}>← Back to movies</button>
 <div className="auth-form-wrap"><p className="eyebrow"><span className="dot"/>{login?'YOUR NEXT MOVIE NIGHT AWAITS':'THERE’S A SEAT FOR YOU'}</p>
 <h2 ref={heading} tabIndex={-1}>{login?'Welcome back':'Join the good company'}<i>.</i></h2>
 <p className="auth-intro">{login?'Log in and pick up where your movie night left off.':'Create your account and find your next movie night.'}</p>
 <div className="auth-tabs" aria-label="Account screens"><button disabled={busy} aria-pressed={login} className={login?'active':''} onClick={()=>change('login')}>Log in</button><button disabled={busy} aria-pressed={!login} className={!login?'active':''} onClick={()=>change('register')}>Create account</button></div>
 <form key={screen} onSubmit={submit} aria-busy={busy}><fieldset disabled={busy} className="auth-fields">
 {!login&&<label className="field" htmlFor="auth-name">Full name<input id="auth-name" name="name" autoComplete="name" placeholder="Your full name" minLength={2} maxLength={100} required/></label>}
 <label className="field" htmlFor="auth-email">Email address<input id="auth-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" maxLength={254} required/></label>
 <div className="auth-password-heading"><label htmlFor="auth-password">Password</label>{login&&<button type="button" disabled={busy} onClick={()=>onNavigate('forgot-password')}>Forgot password?</button>}</div>
 <div className="auth-password"><input id="auth-password" name="password" type={visible?'text':'password'} autoComplete={login?'current-password':'new-password'} placeholder={login?'Enter your password':'At least 8 characters'} minLength={login?1:8} maxLength={128} required/><button type="button" aria-label={visible?'Hide password':'Show password'} aria-pressed={visible} onClick={()=>setVisible(value=>!value)}>{visible?'Hide':'Show'}</button></div>
 {!login&&<label className="field" htmlFor="auth-confirm">Confirm password<input id="auth-confirm" name="confirmPassword" type={visible?'text':'password'} autoComplete="new-password" placeholder="Enter your password again" minLength={8} maxLength={128} required/></label>}
 <button className="primary auth-submit" type="submit">{busy?'Please wait…':login?'Log in':'Create account'}<span>→</span></button></fieldset>
 {notice&&<p className="auth-notice" role="alert">{notice}</p>}</form>
 <p className="auth-switch">{login?'New to Druk Cinema?':'Already part of the company?'} <button disabled={busy} onClick={()=>change(login?'register':'login')}>{login?'Create an account':'Log in'}</button></p>
 <p className="auth-preview">Your session stays signed in for up to 7 days. Sign out on shared devices.</p>
 </div><p className="auth-copyright">© 2026 Druk Cinema. Make it a movie night.</p></section></main>;
}
