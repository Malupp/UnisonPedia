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
export class GuestPreference {
 enabled=false;
 private readonly key="unisonpedia-guest-entry";
 constructor(private storage?:GuestStorage){try{this.enabled=storage?.getItem(this.key)==="1";}catch{ /* Private browsing can deny storage. */ }}
 set(enabled:boolean){this.enabled=enabled;try{if(enabled)this.storage?.setItem(this.key,"1");else this.storage?.removeItem(this.key);}catch{ /* Keep the explicit choice for this page session. */ }}
}
