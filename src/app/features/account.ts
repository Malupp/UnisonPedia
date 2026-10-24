import { Component, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { AuthService } from "../core/auth";
import { Store } from "../core/store";
@Component({standalone:true,imports:[FormsModule,RouterLink],template:
`<div class="page-heading"><span class="eyebrow">IL TUO PERSONAGGIO, OVUNQUE</span><h1>Il tuo account.</h1><p>Inventario, build e obiettivi disponibili sui tuoi dispositivi.</p></div>
@if(auth.loading()){<p role="status">Verifica dell’accesso…</p>}
@if(auth.error()){<div class="message error" role="alert">{{auth.error()}}</div>}
@if(auth.message()){<div class="message" role="status">{{auth.message()}}</div>}
@if(!auth.client){
 <section class="panel"><h2>Collegamento cloud in preparazione</h2><p>L’iscrizione sarà disponibile quando il gestore avrà collegato Supabase al sito. Puoi continuare a usare l’inventario in questo browser ed esportare un backup.</p><a class="button" routerLink="/inventory">Apri inventario</a></section>
} @else if(auth.session(); as session){
 <section class="panel"><h2>{{session.user.email}}</h2><p role="status">{{s.syncLabel()}}</p><p class="muted">Un personaggio per account, con più configurazioni PvE e PvP.</p>
 @if(s.sync().error){<p class="message warning">{{s.sync().error}}</p>}
 @if(s.sync().cacheError){<p class="message warning">Il browser non riesce a conservare la cache. Esporta un backup delle modifiche in attesa.</p>}
 <div class="actions"><button (click)="s.retrySync()" [disabled]="s.sync().status==='loading'||s.sync().status==='saving'">Sincronizza ora</button><button (click)="download()">Esporta versione locale</button><button (click)="auth.signOut()" [disabled]="auth.busy()">Esci</button></div>
 @if(s.sync().dirty){<p class="muted">Le modifiche in attesa restano nella cache di questo account anche dopo l’uscita, se il browser consente il salvataggio.</p>}</section>
 @if(s.sync().status==='conflict'){
 <section class="panel"><h2>Due versioni da confrontare</h2><p>Le tue modifiche: {{s.state().copies.length}} copie e {{s.state().builds.length}} build.</p>
 @if(s.sync().remote; as remote){<p>Versione online {{remote.revision}}: {{remote.state.copies.length}} copie e {{remote.state.builds.length}} build.</p><button (click)="download(true)">Esporta versione online</button>
 <label class="checkbox-row"><input type="checkbox" [(ngModel)]="confirmConflict" />Ho confrontato le versioni e confermo la sostituzione di quella scartata.</label>
 <div class="actions"><button [disabled]="!confirmConflict" (click)="resolve('remote')">Usa versione online</button><button [disabled]="!confirmConflict" (click)="resolve('local')">Sostituisci online con la mia versione</button></div>
 } @else {<button (click)="s.retrySync()">Carica versione online</button>}</section>
 }
 @if(guest(); as g){
 @if(g.copies||g.builds||g.goals){<section class="panel"><h2>Importa l’inventario ospite</h2><p>In questo browser: {{g.copies}} copie, {{g.builds}} build, {{g.goals}} obiettivi. L’unione aggiunge le copie; ripetere l’importazione può creare duplicati.</p><label class="checkbox-row"><input type="checkbox" [(ngModel)]="confirmImport" />Voglio unire questi dati al mio account.</label><button class="primary" [disabled]="!confirmImport||!s.ready()||imported()" (click)="importGuest()">{{imported()?'Importazione eseguita':'Unisci all’account'}}</button></section>}}
}`})
export class AccountComponent {
 auth=inject(AuthService);s=inject(Store);
 guest=signal<{copies:number;builds:number;goals:number}|null>(null);
 confirmImport=false;confirmConflict=false;imported=signal(false);
 constructor(){effect(()=>{const owner=this.auth.session()?.user.id;this.guest.set(null);this.imported.set(false);this.confirmImport=false;this.confirmConflict=false;if(owner)void this.s.guestSummary().then(g=>{if(this.auth.session()?.user.id===owner)this.guest.set(g);}).catch(()=>{});});}
 async importGuest(){const success=await this.s.importGuest();if(success)this.imported.set(true);this.confirmImport=false;}
 async resolve(choice:"local"|"remote"){await this.s.resolveConflict(choice);this.confirmConflict=false;}
 download(remote=false){const state=remote?this.s.sync().remote?.state:this.s.state();if(!state)return;const blob=new Blob([JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="unisonpedia-"+(remote?"online":"locale")+"-"+new Date().toISOString().slice(0,10)+".json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
}
