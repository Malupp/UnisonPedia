import { Injectable, InjectionToken, inject, signal } from "@angular/core";
import { createClient, SupabaseClient, Session } from "@supabase/supabase-js";
export interface PublicConfig { supabaseUrl: string; publishableKey: string; appUrl: string; error?: string }
export const PUBLIC_CONFIG = new InjectionToken<PublicConfig>("public-config", {providedIn:"root",factory:()=>({supabaseUrl:"",publishableKey:"",appUrl:""})});
@Injectable({providedIn:"root"})
export class AuthService {
 config=inject(PUBLIC_CONFIG);
 session=signal<Session|null>(null);
 loading=signal(true);
 busy=signal(false);
 recovery=signal(false);
 message=signal("");
 error=signal("");
 client:SupabaseClient|null=null;
 constructor(){
   if(!this.config.supabaseUrl || !this.config.publishableKey){this.loading.set(false);if(this.config.error)this.error.set(this.config.error);return;}
   try {
     this.client=createClient(this.config.supabaseUrl,this.config.publishableKey,{auth:{flowType:"pkce",detectSessionInUrl:true,persistSession:true,autoRefreshToken:true}});
     this.client.auth.onAuthStateChange((event,session)=>{
       this.session.set(session);this.loading.set(false);
       if(event==="PASSWORD_RECOVERY")this.recovery.set(true);
       if(event==="SIGNED_OUT")this.recovery.set(false);
     });
     void this.client.auth.getSession().then(({data,error})=>{if(error)this.error.set("Sessione non disponibile. Accedi di nuovo o richiedi un nuovo link.");this.session.set(data.session);this.loading.set(false);}).catch(()=>{this.error.set("Accesso cloud non disponibile. Riprova.");this.loading.set(false);});
   }catch{this.error.set("Configurazione Supabase non valida. Contatta il gestore del sito.");this.loading.set(false);}
 }
 private redirect(){return this.config.appUrl+"/auth/callback";}
 private async perform(operation:()=>Promise<{error:unknown}>,message:string,failure:string){
   if(!this.client||this.busy())return;
   this.busy.set(true);this.error.set("");this.message.set("");
   try{const {error}=await operation();if(error)throw error;this.message.set(message);}catch{this.error.set(failure);}finally{this.busy.set(false);}
 }
 signIn(email:string,password:string){return this.perform(()=>this.client!.auth.signInWithPassword({email,password}),"Accesso effettuato.","Accesso non riuscito. Verifica email, password e conferma dell’indirizzo.");}
 signUp(email:string,password:string){return this.perform(()=>this.client!.auth.signUp({email,password,options:{emailRedirectTo:this.redirect()}}),"Controlla la posta per confermare l’indirizzo email, poi accedi.","Iscrizione non riuscita. Verifica i dati o riprova tra poco.");}
 resetPassword(email:string){return this.perform(()=>this.client!.auth.resetPasswordForEmail(email,{redirectTo:this.redirect()}),"Se l’indirizzo è registrato, riceverai un link per reimpostare la password.","Richiesta non riuscita. Riprova tra poco.");}
 async updatePassword(password:string){await this.perform(()=>this.client!.auth.updateUser({password}),"Password aggiornata.","Link scaduto o aggiornamento non riuscito. Richiedi un nuovo recupero.");if(!this.error())this.recovery.set(false);}
 signOut(){return this.perform(()=>this.client!.auth.signOut({scope:"local"}),"Disconnessione effettuata su questo dispositivo.","Disconnessione non riuscita. Riprova.");}
}
