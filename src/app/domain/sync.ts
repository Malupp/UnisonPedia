import { emptyState, UserState } from "./contracts";
import { CachedPlayerState, validateBackup } from "./inventory";
export interface RemotePlayerState { state: UserState; revision: number }
export interface PlayerTransport { load(owner: string): Promise<RemotePlayerState | null>; save(owner: string, revision: number, state: UserState): Promise<RemotePlayerState> }
export interface PlayerCache { loadRecord(): Promise<CachedPlayerState>; saveRecord(record: CachedPlayerState): Promise<void> }
export class RevisionConflict extends Error { constructor(){super("L'inventario online è cambiato su un altro dispositivo");} }
export interface SyncSnapshot extends CachedPlayerState {
 owner: string | null; status: "loading" | "local" | "saving" | "synced" | "pending" | "conflict";
 error: string; cacheError: boolean; remote: RemotePlayerState | null;
}
const checked = (state: unknown) => {const v=validateBackup(state); if(!v.ok)throw new Error(v.errors.map(e=>e.message).join("; "));return v.data!;};
export class PlayerSync {
 snapshot: SyncSnapshot = {owner:null,state:emptyState(),revision:0,dirty:false,status:"loading",error:"",cacheError:false,remote:null};
 private generation=0;
 private queue: Promise<unknown> = Promise.resolve();
 constructor(private transport: PlayerTransport, private cache: (owner:string|null)=>PlayerCache, private changed:(s:SyncSnapshot)=>void){}
 private publish(patch:Partial<SyncSnapshot>){this.snapshot={...this.snapshot,...patch};this.changed(this.snapshot);}
 private serial<T>(operation:()=>Promise<T>):Promise<T>{const task=this.queue.then(operation);this.queue=task.catch(()=>{});return task;}
 private async persist(generation:number){
   const s=this.snapshot;
   try{await this.cache(s.owner).saveRecord({state:s.state,revision:s.revision,dirty:s.dirty});}
   catch{if(generation===this.generation)this.publish({cacheError:true});}
 }
 async activate(owner:string|null){
   const generation=++this.generation;
   // Each owner gets a fresh queue. Stale requests retain their generation guard.
   this.queue=Promise.resolve();
   this.publish({owner,state:emptyState(),revision:0,dirty:false,status:"loading",error:"",cacheError:false,remote:null});
   return this.serial(async()=>{
   if(generation!==this.generation)return;
   try {
     const local=await this.cache(owner).loadRecord();
     if(generation!==this.generation)return;
     this.publish({...local,state:checked(local.state)});
   } catch {if(generation===this.generation)this.publish({cacheError:true,error:"Cache locale non disponibile. Esporta un backup."});}
   if(generation!==this.generation)return;
   if(!owner){this.publish({status:"local"});return;}
   await this.reconcile(generation);
   });
 }
 private async reconcile(generation:number){
   const owner=this.snapshot.owner;
   if(!owner)return;
   try {
     const row=await this.transport.load(owner);
     if(generation!==this.generation)return;
     const remote=row?{state:checked(row.state),revision:row.revision}:{state:emptyState(),revision:0};
     if(this.snapshot.dirty){
       if(remote.revision!==this.snapshot.revision){this.publish({status:"conflict",remote,error:"Scegli quale versione conservare. La tua modifica è ancora disponibile."});return;}
       await this.flush(generation);
     }else{
       this.publish({...remote,dirty:false,status:"synced",remote:null,error:""});await this.persist(generation);
     }
   }catch(e){if(generation===this.generation)this.publish({status:"pending",error:"Connessione cloud non disponibile. Riprova per verificare il salvataggio online."});}
 }
 update(change:(state:UserState)=>UserState){
   const generation=this.generation;
   return this.serial(async()=>{
     if(generation!==this.generation)throw new Error("Account cambiato: ripeti la modifica nel nuovo account");
     if(this.snapshot.status==="loading")throw new Error("Attendi il caricamento dell'inventario");
     const state=checked(change(structuredClone(this.snapshot.state)));
     this.publish({state,dirty:!!this.snapshot.owner,error:"",status:this.snapshot.status==="conflict"?"conflict":this.snapshot.owner?"pending":"local"});
     await this.persist(generation);
     if(generation!==this.generation)return;
     if(this.snapshot.owner && this.snapshot.status!=="conflict")await this.flush(generation);
   });
 }
 private async flush(generation:number){
   const s=this.snapshot;
   if(!s.owner || !s.dirty || s.status==="conflict")return;
   this.publish({status:"saving",error:""});
   try{
     const row=await this.transport.save(s.owner,s.revision,s.state);
     if(generation!==this.generation)return;
     this.publish({state:checked(row.state),revision:row.revision,dirty:false,status:"synced",remote:null,error:""});await this.persist(generation);
   }catch(e){
     if(generation!==this.generation)return;
     if(e instanceof RevisionConflict){
       this.publish({status:"conflict",error:e.message});
       try{const remote=await this.transport.load(s.owner);if(generation===this.generation)this.publish({remote:remote??{state:emptyState(),revision:0}});}catch{ /* Keep local state; retry retrieves the remote version. */ }
     }else this.publish({status:"pending",error:"Modifiche in attesa di invio. Controlla la connessione e riprova."});
   }
 }
 retry(){const generation=this.generation;return this.serial(()=>this.reconcile(generation));}
 resolve(choice:"local"|"remote"){
   const generation=this.generation;
   return this.serial(async()=>{
     const s=this.snapshot;
     if(s.status!=="conflict"||!s.owner||!s.remote)throw new Error("Ricarica la versione online prima di scegliere");
     const row=await this.transport.load(s.owner);
     if(generation!==this.generation)return;
     const remote=row??{state:emptyState(),revision:0};
     if(remote.revision!==s.remote.revision){this.publish({remote,error:"La versione online è cambiata ancora. Controllala prima di confermare."});return;}
     this.publish({state:choice==="remote"?checked(remote.state):s.state,revision:remote.revision,dirty:choice==="local",status:choice==="local"?"pending":"synced",remote:null,error:""});
     await this.persist(generation);
     if(generation===this.generation&&choice==="local")await this.flush(generation);
   });
 }
}
