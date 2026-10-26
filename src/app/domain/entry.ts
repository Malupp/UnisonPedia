export type EntryScreen = "loading" | "welcome" | "wiki";
export interface EntryContext { loading:boolean; signedIn:boolean; recovery:boolean; guest:boolean; path:string }
const pathOnly=(path:string)=>path.split(/[?#]/)[0].replace(/\/$/,"");
const isAccountPath=(path:string)=>["/account","/auth/callback"].includes(pathOnly(path));
// This is public-wiki navigation UX. Personal data authorization remains in Supabase RLS.
export function entryScreen(context:EntryContext):EntryScreen {
 if(context.loading)return "loading";
 if(context.recovery)return "welcome";
 if(context.signedIn)return "wiki";
 return context.guest&&!isAccountPath(context.path)?"wiki":"welcome";
}
export function guestDestination(path:string):string {
 return !path||path==="/"||!path.startsWith("/")||path.startsWith("//")||isAccountPath(path)?"/catalogue":path;
}
interface GuestStorage {getItem(key:string):string|null;setItem(key:string,value:string):void;removeItem(key:string):void}
export const GUEST_ENTRY_KEY="unisonpedia-guest-entry";
export const GUEST_DURATION_MS=2*60*60*1000;
interface GuestIdentity {id:string;expiresAt:number}
export class GuestPreference {
 private identity:GuestIdentity|null=null;
 constructor(private storage?:GuestStorage,private now:()=>number=Date.now){this.refresh();}
 get enabled(){if(this.identity&&this.identity.expiresAt<=this.now())this.set(false);return !!this.identity;}
 get id(){return this.enabled?this.identity!.id:null;}
 get expiresAt(){return this.enabled?this.identity!.expiresAt:null;}
 refresh(){
  if(!this.storage)return;
  let raw:string|null;
  try{raw=this.storage.getItem(GUEST_ENTRY_KEY);}catch{return;}
  try{
   if(!raw){this.identity=null;return;}
   const value=JSON.parse(raw);
   if(typeof value?.id!=="string"||!value.id.trim()||!Number.isFinite(value.expiresAt)||value.expiresAt<=this.now()||value.expiresAt>this.now()+GUEST_DURATION_MS){this.set(false);return;}
   this.identity={id:value.id,expiresAt:value.expiresAt};
  }catch{this.set(false);}
 }
 set(enabled:boolean){
  this.identity=enabled?{id:crypto.randomUUID(),expiresAt:this.now()+GUEST_DURATION_MS}:null;
  try{if(this.identity)this.storage?.setItem(GUEST_ENTRY_KEY,JSON.stringify(this.identity));else this.storage?.removeItem(GUEST_ENTRY_KEY);}catch{ /* Keep the explicit choice in memory when storage is denied. */ }
 }
}
