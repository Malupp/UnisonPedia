import { DestroyRef, Injectable, InjectionToken, inject, signal } from "@angular/core";
import { GUEST_ENTRY_KEY, GuestPreference } from "../domain/entry";
import { authErrorMessage } from "../domain/auth-errors";
import { createClient, SupabaseClient, Session } from "@supabase/supabase-js";
export interface PublicConfig { supabaseUrl: string; publishableKey: string; appUrl: string; error?: string }
export const PUBLIC_CONFIG = new InjectionToken<PublicConfig>("public-config", {providedIn:"root",factory:()=>({supabaseUrl:"",publishableKey:"",appUrl:""})});
@Injectable({providedIn:"root"})
export class AuthService {
 config=inject(PUBLIC_CONFIG);
 private guestPreference=new GuestPreference(this.guestStorage());
 guestMode=signal(this.guestPreference.enabled);
 session=signal<Session|null>(null);
 loading=signal(true);
 busy=signal(false);
 recovery=signal(false);
 message=signal("");
 error=signal("");
 googleAvailable=signal(false);
 confirmationRequired=signal(false);
 confirmationCooldown=signal(0);
 client:SupabaseClient|null=null;
 private guestTimer:ReturnType<typeof setTimeout>|undefined;
 private confirmationTimer:ReturnType<typeof setInterval>|undefined;
 constructor(){
   const refresh=()=>{this.guestPreference.refresh();this.updateGuest();};
   const onStorage=(event:StorageEvent)=>{if(event.key===GUEST_ENTRY_KEY||event.key===null)refresh();};
   window.addEventListener("storage",onStorage);window.addEventListener("focus",refresh);
   inject(DestroyRef).onDestroy(()=>{clearTimeout(this.guestTimer);clearInterval(this.confirmationTimer);window.removeEventListener("storage",onStorage);window.removeEventListener("focus",refresh);});
   this.updateGuest();
   if(!this.config.supabaseUrl || !this.config.publishableKey){this.loading.set(false);if(this.config.error)this.error.set(this.config.error);return;}
   try {
     this.client=createClient(this.config.supabaseUrl,this.config.publishableKey,{auth:{flowType:"pkce",detectSessionInUrl:true,persistSession:true,autoRefreshToken:true}});
     void this.loadProviders();
     this.client.auth.onAuthStateChange((event,session)=>{
       if(session||event==="SIGNED_OUT")this.leaveGuest();
       this.session.set(session);this.loading.set(false);
       if(event==="PASSWORD_RECOVERY")this.recovery.set(true);
       if(event==="SIGNED_OUT")this.recovery.set(false);
     });
     void this.client.auth.getSession().then(({data,error})=>{if(error)this.error.set(authErrorMessage(error,"Sessione non disponibile. Accedi di nuovo o richiedi un nuovo link."));this.session.set(data.session);this.loading.set(false);}).catch(()=>{this.error.set("Accesso cloud non disponibile. Riprova.");this.loading.set(false);});
   }catch{this.error.set("Configurazione Supabase non valida. Contatta il gestore del sito.");this.loading.set(false);}
 }
 private guestStorage(){try{return window.localStorage;}catch{return undefined;}}
 enterGuest(){this.guestPreference.set(true);this.updateGuest();this.error.set("");this.message.set("");}
 leaveGuest(){this.guestPreference.set(false);this.updateGuest();}
 private updateGuest(){
   clearTimeout(this.guestTimer);this.guestMode.set(this.guestPreference.enabled);
   const expiresAt=this.guestPreference.expiresAt;
   if(expiresAt)this.guestTimer=setTimeout(()=>{this.guestPreference.refresh();this.updateGuest();},Math.max(0,expiresAt-Date.now()));
 }
 private redirect(){return this.config.appUrl+"/auth/callback";}
 private async loadProviders(){
   try{const response=await fetch(this.config.supabaseUrl+"/auth/v1/settings",{headers:{apikey:this.config.publishableKey},signal:AbortSignal.timeout(8000)});if(response.ok){const settings=await response.json();this.googleAvailable.set(settings?.external?.google===true);}}catch{ /* Email access remains available if provider discovery fails. */ }
 }
 private startConfirmationCooldown(){
   clearInterval(this.confirmationTimer);const until=Date.now()+60000;this.confirmationCooldown.set(60);
   this.confirmationTimer=setInterval(()=>{const seconds=Math.max(0,Math.ceil((until-Date.now())/1000));this.confirmationCooldown.set(seconds);if(!seconds)clearInterval(this.confirmationTimer);},1000);
 }
 private async perform(operation:()=>Promise<{error:unknown}>,message:string,failure:string):Promise<boolean>{
   if(this.busy())return false;
   if(!this.client){this.error.set("L’accesso con account è temporaneamente indisponibile.");return false;}
   this.busy.set(true);this.error.set("");this.message.set("");
   try{const {error}=await operation();if(error)throw error;this.message.set(message);return true;}
   catch(error){
     this.error.set(authErrorMessage(error,failure));
     const code=(error as {code?:string}|null)?.code;
     if(code==="email_not_confirmed")this.confirmationRequired.set(true);
     if(code==="over_email_send_rate_limit"||code==="over_request_rate_limit")this.startConfirmationCooldown();
     return false;
   }finally{this.busy.set(false);}
 }
 signIn(email:string,password:string){return this.perform(()=>this.client!.auth.signInWithPassword({email:email.trim(),password}),"Accesso effettuato.","Accesso non riuscito. Verifica email e password o riprova tra poco.");}
 async signUp(email:string,password:string){
   const success=await this.perform(()=>this.client!.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:this.redirect()}}),"Richiesta ricevuta. Se l’indirizzo è nuovo o deve ancora essere confermato, controlla la posta e lo spam e apri il link nello stesso browser. Se hai già un account confermato, accedi o recupera la password: non viene inviata una nuova conferma.","Iscrizione non riuscita. Verifica i dati o riprova tra poco.");
   if(success&&!this.session()){this.confirmationRequired.set(true);this.startConfirmationCooldown();}
   return success;
 }
 async resendConfirmation(email:string){
   if(this.confirmationCooldown()>0)return false;
   const success=await this.perform(()=>this.client!.auth.resend({type:"signup",email:email.trim(),options:{emailRedirectTo:this.redirect()}}),"Se l’indirizzo è in attesa di conferma, riceverai un nuovo link. Controlla anche lo spam. Un account già confermato non riceve un’altra conferma.","Invio della conferma non riuscito. Riprova tra poco.");
   if(success)this.startConfirmationCooldown();return success;
 }
 signInWithGoogle(){
   if(!this.googleAvailable()){this.error.set("L’accesso con Google non è ancora disponibile. Usa email e password.");return Promise.resolve(false);}
   return this.perform(()=>this.client!.auth.signInWithOAuth({provider:"google",options:{redirectTo:this.redirect(),queryParams:{prompt:"select_account"}}}),"Ti stiamo portando a Google…","Accesso con Google non riuscito. Riprova.");
 }
 resetPassword(email:string){return this.perform(()=>this.client!.auth.resetPasswordForEmail(email.trim(),{redirectTo:this.redirect()}),"Se l’indirizzo è registrato, riceverai un link per reimpostare la password.","Richiesta non riuscita. Riprova tra poco.");}
 async updatePassword(password:string){const success=await this.perform(()=>this.client!.auth.updateUser({password}),"Password aggiornata.","Link scaduto o aggiornamento non riuscito. Richiedi un nuovo recupero.");if(success)this.recovery.set(false);return success;}
 signOut(){return this.perform(()=>this.client!.auth.signOut({scope:"local"}),"Disconnessione effettuata su questo dispositivo.","Disconnessione non riuscita. Riprova.");}
}
