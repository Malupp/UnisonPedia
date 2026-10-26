import { Component, ElementRef, computed, effect, inject, signal, untracked, viewChild } from "@angular/core";
import { RouterLink } from "@angular/router";
import { Store } from "../core/store";
import { Item } from "../domain/contracts";
import { FRONTLINE_KEY, FrontlinePosition, FrontlineSlot, castEffects, emptyFrontline, frontlinePhases, mergeFrontlineEffects, groupFrontlineEffects, restoreFrontline } from "../domain/frontline";

@Component({
 standalone:true,
 imports:[RouterLink],
 template:`<header class="page-heading">
  <span class="eyebrow">CINQUE GIOCATORI · UNA SEQUENZA CONDIVISA</span>
  <h1>Composizione front line</h1>
  <p>Scegli le classi e fino a cinque mostri per posizione. Assegna manualmente ogni lancio a una fase, oppure lascia il mostro soltanto in squadra.</p>
 </header>

 @if(s.loading()){<p role="status">Caricamento classi e mostri…</p>}
 <div class="frontline-grid" aria-label="Le cinque posizioni della front line">
 @for(position of team();track $index;let pi=$index){
  <section class="frontline-player panel" [attr.aria-label]="'Posizione '+(pi+1)">
   <header class="frontline-player-header"><div class="frontline-position-title"><span class="frontline-number">0{{pi+1}}</span><h2>Posizione {{pi+1}}</h2></div>
    <label class="frontline-class">@if(classIcon(position.classId);as icon){<img [src]="icon" (error)="fallback($event)" alt="" width="34" height="34"/>}@else{<span class="frontline-class-placeholder" aria-hidden="true">◇</span>}<span>Classe</span><select [attr.aria-label]="'Classe posizione '+(pi+1)" [value]="position.classId" (change)="setClass(pi,$any($event.target).value)"><option value="">Scegli classe</option>@for(c of s.classes();track c.id){<option [value]="c.id" [selected]="position.classId===c.id">{{c.name}}</option>}</select></label>
   </header>
   <div class="frontline-slots" role="region" tabindex="0" [attr.aria-label]="'Slot della posizione '+(pi+1)">
   @for(slot of position.slots;track $index;let si=$index){
    <div class="frontline-slot">
     <span class="eyebrow">SLOT {{si+1}}</span>
     <button class="frontline-monster" aria-haspopup="dialog" [attr.aria-label]="'Scegli mostro posizione '+(pi+1)+' slot '+(si+1)" (click)="openPicker(pi,si)">
      @if(entry(slot.monsterId);as monster){<img [src]="monster.iconPath||'assets/fallback.svg'" (error)="fallback($event)" alt="" width="48" height="48"/><span>{{monster.name}}</span>}@else{<span class="frontline-placeholder" aria-hidden="true">＋</span><span>{{slot.monsterId?'Mostro non disponibile':'Scegli mostro'}}</span>}
     </button>
     <label class="frontline-phase-choice"><span class="sr-only">Fase posizione {{pi+1}} slot {{si+1}}</span><select [attr.aria-label]="'Fase posizione '+(pi+1)+' slot '+(si+1)" [disabled]="!slot.monsterId" [value]="slot.phase??''" (change)="setPhase(pi,si,$any($event.target).value)"><option value="">Solo in squadra</option>@for(n of phaseNumbers;track n){<option [value]="n" [selected]="slot.phase===n">Fase {{n}}</option>}</select></label>
     <div class="frontline-slot-actions">@if(slot.monsterId){<a class="text-link" [routerLink]="['/item',slot.monsterId]">Scheda ↗</a><button class="text-link" [attr.aria-label]="'Rimuovi mostro posizione '+(pi+1)+' slot '+(si+1)" (click)="setSlot(pi,si,{monsterId:null,phase:null})">Rimuovi</button>}</div>
    </div>
   }
   </div>
  </section>
 }
 </div>
 <div class="frontline-toolbar"><div class="frontline-save"><strong>{{selectedCount()}} <span>/ 25 slot</span></strong><span role="status">{{storageMessage()}}</span></div><button (click)="reset()">Svuota composizione</button></div>
 <p class="frontline-icon-credit">Icone classi: <a href="https://unisonleague.fandom.com/wiki/Classes" target="_blank" rel="noopener noreferrer">Unison League Wiki</a>.</p>
 <section class="frontline-phases" aria-labelledby="phases-title">
  <div class="section-heading"><div><span class="eyebrow">ORDINE DEI LANCI</span><h2 id="phases-title">Le fasi</h2></div><span class="muted">{{castCount()}} lanci assegnati</span></div>
  <p>Il merge riunisce gli effetti dei mostri della stessa fase. ×2 indica due ricorrenze: valori e durate restano quelli descritti.</p>
  @for(phase of phaseViews();track phase.number){
   <details class="frontline-phase panel" [open]="phase.casts.length>0" [attr.aria-label]="'Fase '+phase.number">
    <summary><strong>Fase {{phase.number}}</strong><span>{{phase.casts.length}} {{phase.casts.length===1?'mostro':'mostri'}} · {{phase.effects.length}} effetti</span></summary>
    @if(phase.conflicts.length){<p class="message warning" role="alert">Più lanci dello stesso giocatore in questa fase: posizione {{phase.conflicts.join(', ')}}. Controlla la sequenza.</p>}
    <div class="frontline-phase-team">
    @for(cast of phase.casts;track cast.position+'-'+cast.slot){
     <article class="frontline-cast">
      <img [src]="entry(cast.monsterId)?.iconPath||'assets/fallback.svg'" (error)="fallback($event)" alt="" width="36" height="36"/>
      <div><span>Pos. {{cast.position}} · {{cast.classId||'Classe da scegliere'}} · Slot {{cast.slot}}</span><a [routerLink]="['/item',cast.monsterId]">{{entry(cast.monsterId)?.name||'Mostro non disponibile'}}</a></div>
      @if(!cast.classId){<span class="frontline-cast-warning">Scegli la classe</span>}
      @if(failures().includes(cast.monsterId)){<button (click)="loadDetail(cast.monsterId)">Riprova effetti</button>}
     </article>
    }
    </div>
    @if(phase.missing){<p class="message warning" role="status">Riepilogo parziale: {{phase.missing}} lanci con descrizione non ancora disponibile.</p>}
    @if(phase.casts.length){
     <section class="frontline-phase-merge" [attr.aria-label]="'Merge fase '+phase.number">
      <h3>Effetti della fase {{phase.number}}</h3>
      @for(group of phase.groups;track group.id){
       <section class="frontline-target-group" [attr.aria-labelledby]="'phase-'+phase.number+'-target-'+group.id">
        <h4 [id]="'phase-'+phase.number+'-target-'+group.id">{{group.label}}</h4>
        @for(row of group.effects;track row.text){
       <details class="frontline-merged-effect"><summary><span>{{firstLine(row.text)}}</span>@if(row.count>1){<span class="frontline-effect-count" [attr.aria-label]="row.count+' ricorrenze'">×{{row.count}}</span>}</summary><p class="frontline-effect-text" lang="en">{{row.text}}</p><ul>@for(origin of row.origins;track origin.position+'-'+origin.slot){<li>Posizione {{origin.position}} · slot {{origin.slot}} · {{entry(origin.monsterId)?.name}}</li>}</ul></details>
        }
       </section>
      }@empty{<p>Nessun effetto disponibile per questa fase.</p>}
     </section>
    }@else{<p class="frontline-phase-empty">Nessun lancio assegnato a questa fase.</p>}
   </details>
  }
  <p class="frontline-merge-note">Sono riuniti i cast base. Consulta le schede per potenziali, varianti e regole di accumulo.</p>
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
 storageMessage=signal("Salvataggio automatico");
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
 selectedCount=computed(()=>this.team().flatMap(p=>p.slots).filter(s=>s.monsterId).length);
 phaseViews=computed(()=>this.phases().map(phase=>{const effects=mergeFrontlineEffects(phase,this.details());return {...phase,effects,groups:groupFrontlineEffects(effects),missing:phase.casts.filter(c=>{const item=this.details().get(c.monsterId);return !item||!castEffects(item).length;}).length};}));
 firstLine(text:string){return text.split('\n')[0];}
 constructor(){effect(()=>{const ids=new Set(this.team().flatMap(p=>p.slots.map(s=>s.monsterId)).filter((id):id is string=>!!id));const entries=this.entryMap();untracked(()=>{for(const id of ids)if(entries.has(id)&&!this.requested.has(id))void this.loadDetail(id);});});}
 classIcon(id:string){return this.s.classes().find(c=>c.id===id)?.iconPath as string|undefined;}
 entry(id:string|null){return id?this.entryMap().get(id):undefined;}
 private readDraft(){try{const raw=localStorage.getItem(FRONTLINE_KEY);return raw?restoreFrontline(JSON.parse(raw)):emptyFrontline();}catch{this.storageMessage.set("Salvataggio locale non disponibile: conserva questa scheda aperta.");return emptyFrontline();}}
 private save(team:FrontlinePosition[]){this.team.set(team);try{localStorage.setItem(FRONTLINE_KEY,JSON.stringify({version:1,positions:team}));this.storageMessage.set("Salvato nel browser");}catch{this.storageMessage.set("Salvataggio non riuscito: la bozza resta in questa scheda.");}}
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
