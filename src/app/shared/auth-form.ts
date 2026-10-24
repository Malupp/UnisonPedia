import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { AuthService } from "../core/auth";
@Component({selector:"app-auth-form",standalone:true,imports:[FormsModule],template:
`@if(auth.recovery()){
 <span class="eyebrow">IL TUO ACCOUNT</span><h2>Una nuova password.<br />Si riparte da qui.</h2><p>Scegli una password di almeno 8 caratteri per tornare al tuo personaggio.</p>
 <form #recoveryForm="ngForm" (ngSubmit)="changePassword()" [attr.aria-busy]="auth.busy()">
  <label for="recovery-password">Nuova password</label><div class="entry-password"><input id="recovery-password" [disabled]="auth.busy()" name="newPassword" [type]="showPassword()?'text':'password'" [(ngModel)]="password" required minlength="8" autocomplete="new-password" /><button type="button" (click)="showPassword.set(!showPassword())" [attr.aria-pressed]="showPassword()" [attr.aria-label]="showPassword()?'Nascondi password':'Mostra password'">{{showPassword()?'Nascondi':'Mostra'}}</button></div>
  <button class="primary entry-submit" [disabled]="auth.busy()||recoveryForm.invalid">{{auth.busy()?'Aggiornamento…':'Salva la nuova password'}}</button>
 </form>
 <button class="text-link entry-forgot" type="button" (click)="auth.signOut()" [disabled]="auth.busy()">Annulla e torna all’accesso</button>
} @else {
 <div class="entry-switch" aria-label="Scegli accesso o iscrizione"><button type="button" [disabled]="auth.busy()" (click)="setMode('signin')" [attr.aria-pressed]="mode()==='signin'" [class.selected]="mode()==='signin'">Accedi</button><button type="button" [disabled]="auth.busy()" (click)="setMode('signup')" [attr.aria-pressed]="mode()==='signup'" [class.selected]="mode()==='signup'">Crea account</button></div>
 <div class="entry-form-heading"><span class="eyebrow">{{mode()==='signup'?'IL TUO PERCORSO INIZIA QUI':mode()==='reset'?'RECUPERA IL TUO ACCOUNT':'BENTORNATO SU UNISONPEDIA'}}</span><h2>{{mode()==='signup'?'Dai un futuro al tuo set.':mode()==='reset'?'Torniamo al tuo set.':'Il prossimo upgrade ti aspetta.'}}</h2><p>{{mode()==='signup'?'Salva inventario, build e obiettivi e ritrovali sui tuoi dispositivi.':mode()==='reset'?'Ti invieremo un link per scegliere una nuova password.':'Accedi per riprendere il tuo inventario e i tuoi obiettivi.'}}</p></div>
 @if(auth.client){
 <form #accessForm="ngForm" (ngSubmit)="submit()" [attr.aria-busy]="auth.busy()">
  <label for="entry-email">Indirizzo email</label><input id="entry-email" #emailField="ngModel" email [attr.aria-invalid]="emailField.touched&&emailField.invalid?true:null" [disabled]="auth.busy()" type="email" name="email" [(ngModel)]="email" required autocomplete="email" placeholder="nome@esempio.it" />
  @if(emailField.touched&&emailField.invalid){<p class="entry-field-error" role="alert">Inserisci un indirizzo email valido.</p>}
  @if(mode()!=='reset'){
   <div class="entry-password-label"><label for="entry-password">Password</label>@if(mode()==='signin'){<button type="button" class="text-link" [disabled]="auth.busy()" (click)="setMode('reset')">Dimenticata?</button>}</div>
   <div class="entry-password"><input id="entry-password" [disabled]="auth.busy()" name="password" [type]="showPassword()?'text':'password'" [(ngModel)]="password" required [minlength]="mode()==='signup'?8:1" [autocomplete]="mode()==='signup'?'new-password':'current-password'" [attr.aria-describedby]="mode()==='signup'?'password-hint':null" /><button type="button" (click)="showPassword.set(!showPassword())" [attr.aria-pressed]="showPassword()" [attr.aria-label]="showPassword()?'Nascondi password':'Mostra password'">{{showPassword()?'Nascondi':'Mostra'}}</button></div>
  }
  @if(mode()==='signup'){<p id="password-hint" class="entry-field-hint">Almeno 8 caratteri. Confermerai l’indirizzo via email.</p>}
  <button class="primary entry-submit" [disabled]="auth.busy()||accessForm.invalid">{{auth.busy()?'Attendi…':mode()==='signup'?'Crea il tuo account':mode()==='reset'?'Invia il link di recupero':'Entra nella wiki'}} <span aria-hidden="true">→</span></button>
 </form>
 } @else {<div class="message warning">L’accesso con account è temporaneamente indisponibile. Puoi esplorare la wiki come ospite.</div>}
 @if(mode()==='reset'){<button type="button" class="text-link entry-forgot" (click)="setMode('signin')">← Torna all’accesso</button>}
}
@if(auth.error()){<div class="entry-feedback error" role="alert">{{auth.error()}}</div>}
@if(auth.message()){<div class="entry-feedback success" role="status">{{auth.message()}}</div>}
`})
export class AuthFormComponent {
 auth=inject(AuthService);router=inject(Router);
 mode=signal<"signin"|"signup"|"reset">("signin");showPassword=signal(false);email="";password="";
 setMode(mode:"signin"|"signup"|"reset"){this.mode.set(mode);this.password="";this.showPassword.set(false);this.auth.error.set("");this.auth.message.set("");}
 async submit(){
  const email=this.email.trim();if(!email||this.auth.busy())return;
  try{
   if(this.mode()==="reset")await this.auth.resetPassword(email);
   else if(this.mode()==="signup"&&this.password.length>=8)await this.auth.signUp(email,this.password);
   else if(this.mode()==="signin"&&this.password)await this.auth.signIn(email,this.password);
   if(this.auth.session()&&!this.auth.error()&&/^\/(account|auth\/callback)(?:[/?#]|$)/.test(this.router.url))await this.router.navigateByUrl("/catalogue",{replaceUrl:true});
  }finally{this.password="";}
 }
 async changePassword(){if(this.password.length<8||this.auth.busy())return;await this.auth.updatePassword(this.password);this.password="";if(!this.auth.error())await this.router.navigateByUrl("/account",{replaceUrl:true});}
}
