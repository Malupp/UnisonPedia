import { Component, ElementRef, computed, effect, inject, signal, untracked, viewChild } from "@angular/core";
import { RouterLink } from "@angular/router";
import { Store } from "../core/store";
import { Item } from "../domain/contracts";
import { FRONTLINE_KEY, FrontlinePosition, FrontlineSlot, castEffects, emptyFrontline, frontlinePhases, mergeFrontlineEffects, restoreFrontline } from "../domain/frontline";

@Component({
 standalone:true,
 imports:[RouterLink],
 template:`<header class="page-heading">
  <span class="eyebrow">CINQUE GIOCATORI · UNA SEQUENZA CONDIVISA</span>
  <h1>Composizione front line</h1>
  <p>Scegli le classi e fino a cinque mostri per posizione. Assegna manualmente ogni lancio a una fase, oppure lascia il mostro soltanto in squadra.</p>
 </header>
 <div class="frontline-toolbar"><span role="status">{{storageMessage()}}</span><button (click)="reset()">Svuota composizione</button></div>
 @if(s.loading()){<p role="status">Caricamento classi e mostri…</p>}
 <div class="frontline-grid" aria-label="Le cinque posizioni della front line">
 @for(position of team();track $index;let pi=$index){
  <section class="frontline-player panel" [attr.aria-label]="'Posizione '+(pi+1)">
   <header><span class="frontline-number">0{{pi+1}}</span><h2>Posizione {{pi+1}}</h2></header>
   <label>Classe posizione {{pi+1}}<select [attr.aria-label]="'Classe posizione '+(pi+1)" [value]="position.classId" (change)="setClass(pi,$any($event.target).value)"><option value="">Scegli classe</option>@for(c of s.classes();track c.id){<option [value]="c.id" [selected]="position.classId===c.id">{{c.name}}</option>}</select></label>
   @for(slot of position.slots;track $index;let si=$index){
    <div class="frontline-slot">
     <span class="eyebrow">SLOT {{si+1}}</span>
     <button class="frontline-monster" aria-haspopup="dialog" [attr.aria-label]="'Scegli mostro posizione '+(pi+1)+' slot '+(si+1)" (click)="openPicker(pi,si)">
      @if(entry(slot.monsterId);as monster){<img [src]="monster.iconPath||'assets/fallback.svg'" (error)="fallback($event)" alt="" width="42" height="42"/><span>{{monster.name}}</span>}@else{<span class="frontline-placeholder" aria-hidden="true">＋</span><span>{{slot.monsterId?'Mostro non disponibile':'Scegli mostro'}}</span>}
     </button>
     <label>Fase posizione {{pi+1}} slot {{si+1}}<select [attr.aria-label]="'Fase posizione '+(pi+1)+' slot '+(si+1)" [disabled]="!slot.monsterId" [value]="slot.phase??''" (change)="setPhase(pi,si,$any($event.target).value)"><option value="">Solo in squadra</option>@for(n of phaseNumbers;track n){<option [value]="n" [selected]="slot.phase===n">Fase {{n}}</option>}</select></label>
     @if(slot.monsterId){<div class="frontline-slot-actions"><a class="text-link" [routerLink]="['/item',slot.monsterId]">Scheda e potenziali ↗</a><button class="text-link" [attr.aria-label]="'Rimuovi mostro posizione '+(pi+1)+' slot '+(si+1)" (click)="setSlot(pi,si,{monsterId:null,phase:null})">Rimuovi</button></div>}
    </div>
   }
  </section>
 }
 </div>
 <section class="frontline-phases" aria-labelledby="phases-title">
  <div class="section-heading"><div><span class="eyebrow">ORDINE DEI LANCI</span><h2 id="phases-title">Le fasi</h2></div><span class="muted">{{castCount()}} lanci assegnati</span></div>
  <p>L’ordine degli slot resta visibile. Le fasi dipendono dalle tue assegnazioni; i mostri solo in squadra non partecipano al merge dei lanci.</p>
  @for(phase of phases();track phase.number){
   <details class="frontline-phase panel" [open]="phase.casts.length>0">
    <summary>Fase {{phase.number}} <span>{{phase.casts.length}} mostri</span></summary>
    @if(phase.conflicts.length){<p class="message warning" role="alert">Più lanci dello stesso giocatore in questa fase: posizione {{phase.conflicts.join(', ')}}. Controlla la sequenza.</p>}
    @for(cast of phase.casts;track cast.position+'-'+cast.slot){
     <article class="frontline-cast">
      <div><span class="eyebrow">POSIZIONE {{cast.position}} · SLOT {{cast.slot}} · {{cast.classId||'Classe da scegliere'}}</span><h3>{{entry(cast.monsterId)?.name||'Mostro non disponibile'}}</h3></div>
      @if(!cast.classId){<p class="message warning">Scegli la classe per questa posizione.</p>}
      @if(details().get(cast.monsterId);as item){
       <details class="frontline-effects"><summary>Effetti del lancio base</summary>@for(text of effects(item);track $index){<p class="frontline-effect-text" lang="en">{{text}}</p>}@empty{<p>Descrizione del lancio non disponibile. <a class="text-link" [routerLink]="['/item',cast.monsterId]">Apri la scheda</a>.</p>}</details>
      }@else if(failures().includes(cast.monsterId)){<p class="message warning">Effetti non disponibili. <button (click)="loadDetail(cast.monsterId)">Riprova</button></p>}@else if(entry(cast.monsterId)){<p role="status">Caricamento effetti…</p>}@else{<p class="message warning">Questo mostro non è presente nel catalogo. Sostituiscilo per leggere gli effetti.</p>}
     </article>
    }@empty{<p>Nessun lancio assegnato. Scegli questa fase dal menu sotto un mostro.</p>}
   </details>
  }
 </section>
 <section class="frontline-merge panel" aria-labelledby="merge-title"><span class="eyebrow">LEGGI LA COMPOSIZIONE NEL SUO INSIEME</span><h2 id="merge-title">Merge finale degli effetti</h2>
  <p>Riepilogo dei cast base previsti nella sequenza. Le descrizioni identiche sono raggruppate con tutte le provenienze. Durate e condizioni restano nel testo; la presenza in fasi diverse non significa che gli effetti siano attivi contemporaneamente.</p>
  <p class="muted">Potenziali, stacking e sovrascritture richiedono la verifica delle schede: questo scheletro non calcola bonus complessivi.</p>
  @if(missingCount()){<p class="message warning" role="status">Riepilogo parziale: {{missingCount()}} lanci con descrizione non ancora disponibile.</p>}
  @if(hasConflicts()){<p class="message warning">Ci sono fasi con più lanci della stessa posizione. Risolvi le assegnazioni per completare la sequenza.</p>}
  @for(row of merged();track row.text){<details class="frontline-merged-effect"><summary>{{firstLine(row.text)}}</summary><p class="frontline-effect-text" lang="en">{{row.text}}</p><ul>@for(origin of row.origins;track origin.phase+'-'+origin.position+'-'+origin.slot){<li>Fase {{origin.phase}} · posizione {{origin.position}} · slot {{origin.slot}} · {{entry(origin.monsterId)?.name}}</li>}</ul></details>}@empty{<p>Assegna un mostro a una fase per iniziare il riepilogo.</p>}
 </section>
 <dialog #picker class="frontline-picker" aria-labelledby="picker-title" (close)="target.set(null)" (keydown.escape)="closePicker();$event.preventDefault()">
  <div class="section-heading"><h2 id="picker-title">Scegli un mostro</h2><button (click)="closePicker()" aria-label="Chiudi selezione mostro">×</button></div>
  <label>Cerca mostro<input type="search" [value]="query()" (input)="query.set($any($event.target).value)" placeholder="Nome, elemento o ID…" /></label>
  <p role="status">{{matches().length}} risultati. @if(matches().length>60){Affina la ricerca: sono mostrati i primi 60.}</p>
  <div class="frontline-picker-list">@for(monster of matches().slice(0,60);track monster.id){<button (click)="choose(monster.id)"><img [src]="monster.iconPath||'assets/fallback.svg'" (error)="fallback($event)" alt="" width="48" height="48" loading="lazy"/><span><strong>{{monster.name}}</strong><small>{{monster.element}} · Cost {{monster.cost}} · #{{monster.id}}</small></span></button>}@empty{<p>Nessun mostro trovato. Prova un altro nome.</p>}</div>
 </dialog>`,
 styleUrl:"./frontline.css"
})
export class FrontlineComponent {
 s=inject(Store);
 storageMessage=signal("Bozza locale · salvataggio automatico nel browser");
 team=signal<FrontlinePosition[]>(this.readDraft());
 details=signal(new Map<string,Item>());
 failures=signal<string[]>([]);
 private requested=new Set<string>();
 picker=viewChild.required<ElementRef<HTMLDialogElement>>("picker");
 target=signal<{position:number;slot:number}|null>(null);
 query=signal("");
 phaseNumbers=[1,2,3,4,5];
 entryMap=computed(()=>new Map(this.s.entries().filter(e=>e.kind==="monster").map(e=>[e.id,e])));
 monsters=computed(()=>[...this.entryMap().values()].sort((a,b)=>b.cost-a.cost||a.name.localeCompare(b.name)));
 matches=computed(()=>{const q=this.query().trim().toLowerCase();return this.monsters().filter(e=>!q||(e.name+" "+e.element+" "+e.id).toLowerCase().includes(q));});
 phases=computed(()=>frontlinePhases(this.team()));
 castCount=computed(()=>this.phases().reduce((n,p)=>n+p.casts.length,0));
 hasConflicts=computed(()=>this.phases().some(p=>p.conflicts.length));
 missingCount=computed(()=>this.phases().flatMap(p=>p.casts).filter(c=>{const item=this.details().get(c.monsterId);return !item||!castEffects(item).length;}).length);
 merged=computed(()=>mergeFrontlineEffects(this.phases(),this.details()));
 effects=castEffects;
 firstLine(text:string){return text.split('\n')[0];}
 constructor(){effect(()=>{const ids=new Set(this.team().flatMap(p=>p.slots.map(s=>s.monsterId)).filter((id):id is string=>!!id));const entries=this.entryMap();untracked(()=>{for(const id of ids)if(entries.has(id)&&!this.requested.has(id))void this.loadDetail(id);});});}
 entry(id:string|null){return id?this.entryMap().get(id):undefined;}
 private readDraft(){try{const raw=localStorage.getItem(FRONTLINE_KEY);return raw?restoreFrontline(JSON.parse(raw)):emptyFrontline();}catch{this.storageMessage.set("Salvataggio locale non disponibile: conserva questa scheda aperta.");return emptyFrontline();}}
 private save(team:FrontlinePosition[]){this.team.set(team);try{localStorage.setItem(FRONTLINE_KEY,JSON.stringify({version:1,positions:team}));this.storageMessage.set("Bozza salvata in questo browser");}catch{this.storageMessage.set("Salvataggio non riuscito: la bozza resta in questa scheda.");}}
 setClass(position:number,classId:string){this.save(this.team().map((p,i)=>i===position?{...p,classId}:p));}
 setSlot(position:number,slot:number,value:FrontlineSlot){this.save(this.team().map((p,i)=>i===position?{...p,slots:p.slots.map((s,j)=>j===slot?value:s)}:p));}
 setPhase(position:number,slot:number,value:string){this.setSlot(position,slot,{...this.team()[position].slots[slot],phase:value?Number(value):null});}
 openPicker(position:number,slot:number){this.target.set({position,slot});this.query.set("");this.picker().nativeElement.showModal();}
 closePicker(){this.picker().nativeElement.close();}
 choose(id:string){const target=this.target();if(target){this.setSlot(target.position,target.slot,{monsterId:id,phase:this.team()[target.position].slots[target.slot].phase});this.closePicker();}}
 async loadDetail(id:string){this.requested.add(id);this.failures.update(ids=>ids.filter(x=>x!==id));try{const item=await this.s.getDetail(id);this.details.update(items=>new Map(items).set(id,item));}catch{this.failures.update(ids=>[...ids,id]);}}
 reset(){this.save(emptyFrontline());}
 fallback(event:Event){const img=event.target as HTMLImageElement;if(!img.dataset["fallback"]){img.dataset["fallback"]="1";img.src="assets/fallback.svg";}}
}
