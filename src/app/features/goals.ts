import { Component, computed, inject, input } from "@angular/core";
import { RouterLink } from "@angular/router";
import { Store } from "../core/store";
import { VideoMetaStore } from "../core/video-meta";
import { Goal, modeLabel, goalIdentity } from "../domain/contracts";
import { goalProgress, GoalSuggestion, suggestGoals } from "../domain/progression";
@Component({selector:"app-goals",standalone:true,imports:[RouterLink],template:
`<section class="goal-section"><div class="section-heading"><div><span class="eyebrow">IL TUO PROSSIMO PASSO</span><h2>Obiettivi di crescita</h2></div></div>
@if(meta.loading()){<p role="status">Caricamento dei riferimenti META…</p>}
@if(meta.error()){<div class="message warning">{{meta.error()}} <button (click)="meta.load()">Riprova</button></div>}
@if(meta.data();as data){<p class="goal-source">META analizzato il {{data.analyzedAt}} · catalogo al {{data.catalogueAsOf}}. I suggerimenti richiedono la verifica di condizioni, ruolo e modalità; le alternative simili sono distinte dalla selezione dell’autore.</p>}
@if(followed().length){<div class="advice-list">@for(g of followed();track g.id){@let p=progress(g);<article class="panel goal-card"><div class="section-heading"><h3>{{g.label}}</h3><span class="effect-tag">{{p.status==='complete'?'Completato':p.status==='review'?'Da rivedere':'In corso'}}</span></div><p>{{g.classId}} · {{modeLabel(g.mode)}} · {{buildName(g.buildId)}}</p><p class="goal-progress">{{p.current}} / {{p.target}}</p><progress [value]="p.current" [max]="p.target" [attr.aria-label]="g.label"></progress><p class="goal-source">Riferimento META: {{g.metaVersion}}</p>
@if(g.metaVersion!==meta.data()?.analyzedAt){<p class="muted">Il riferimento META è cambiato: ricontrolla questo obiettivo.</p>}
@if(p.status==='review'){<p class="message warning">La copia, la build o il riferimento non è più disponibile. L’obiettivo è conservato per permetterti di rivederlo.</p>}
<div class="actions">@for(id of g.itemIds.slice(0,3);track id){<a class="text-link" [routerLink]="['/item',id]">{{name(id)}}</a>}<button (click)="archive(g)">Smetti di seguire</button></div></article>}</div>}
@if(!s.profile().classId){<p>Scegli una classe per ricevere obiettivi compatibili.</p>} @else if(!suggestions().length && !meta.loading()) {<p class="muted">Nessun nuovo obiettivo verificabile per questo contesto. Seleziona una build o consulta la selezione META.</p>}
<div class="advice-list">@for(row of suggestions();track row.goal.id){<article class="panel goal-card"><span class="eyebrow">{{row.goal.kind==='acquire'?'OGGETTO DA OTTENERE':row.goal.kind==='potential'?'POTENZIALE DA SBLOCCARE':'REQUISITO DELLA BUILD'}} · {{row.origin==='video'?'Selezione dell’autore':'Alternativa simile'}}</span><h3>{{row.goal.label}}</h3><p>{{row.reason}}</p><p><strong>Condizioni:</strong> {{row.conditions}}</p><div class="actions"><button class="primary" [disabled]="!s.ready()" (click)="follow(row)">Segui obiettivo</button><a class="text-link" routerLink="/meta">Verifica nel META</a>@if(row.goal.itemIds[0]){<a class="text-link" [routerLink]="['/item',row.goal.itemIds[0]]">Scheda e requisiti</a>}</div></article>}</div>
</section>`})
export class GoalsComponent {
 s=inject(Store);meta=inject(VideoMetaStore);buildId=input<string|null>(null);modeLabel=modeLabel;
 followed=computed(()=>this.s.state().goals.filter(g=>g.status==="active"));
 suggestions=computed(()=>suggestGoals(this.s.state(),this.s.entries(),this.meta.data()?.observations??[],this.meta.data()?.analyzedAt??"",this.buildId()));
 progress(g:Goal){const result=goalProgress(g,this.s.state(),this.s.entries());if(g.kind==="acquire"&&this.meta.data()&&!this.meta.data()!.observations.some(o=>o.status==="matched"&&o.itemIds.some(id=>g.itemIds.includes(id))))return {...result,status:"review" as const};return result;}
 name(id:string){return this.s.entries().find(e=>e.id===id)?.name??id;}
 buildName(id:string|null){return id?this.s.state().builds.find(b=>b.id===id)?.name??"Build da rivedere":"Profilo";}
 follow(row:GoalSuggestion){void this.s.update(s=>{const existing=s.goals.find(g=>goalIdentity(g)===goalIdentity(row.goal));if(existing)existing.status="active";else s.goals.push({...row.goal,createdAt:new Date().toISOString()});return s;});}
 archive(goal:Goal){void this.s.update(s=>({...s,goals:s.goals.map(g=>g.id===goal.id?{...g,status:"archived"}:g)}));}
}
