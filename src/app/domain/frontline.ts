import type { Item } from "./contracts";
export interface FrontlineSlot { monsterId: string | null; phase: number | null }
export interface FrontlinePosition { classId: string; slots: FrontlineSlot[] }
export interface FrontlineCast { position: number; slot: number; classId: string; monsterId: string }
export interface FrontlinePhase { number: number; casts: FrontlineCast[]; conflicts: number[] }
export const FRONTLINE_KEY = "unisonpedia-frontline-v1";
export function emptyFrontline(): FrontlinePosition[] {
 return Array.from({length:5},()=>({classId:"",slots:Array.from({length:5},()=>({monsterId:null,phase:null}))}));
}
export function restoreFrontline(raw: unknown): FrontlinePosition[] {
 const data=raw as {version?:unknown;positions?:unknown};
 if(data?.version!==1||!Array.isArray(data.positions)||data.positions.length!==5)return emptyFrontline();
 const valid=data.positions.every(p=>p&&typeof p.classId==="string"&&Array.isArray(p.slots)&&p.slots.length===5&&p.slots.every((s:FrontlineSlot)=>s&&(s.monsterId===null||(typeof s.monsterId==="string"&&s.monsterId.length>0))&&(s.phase===null||(Number.isInteger(s.phase)&&s.phase>=1&&s.phase<=5))));
 if(!valid)return emptyFrontline();
 return data.positions.map(p=>({classId:p.classId,slots:p.slots.map((s:FrontlineSlot)=>({monsterId:s.monsterId,phase:s.monsterId?s.phase:null}))}));
}
export function frontlinePhases(team: FrontlinePosition[]): FrontlinePhase[] {
 return Array.from({length:5},(_,i)=>{
  const casts:FrontlineCast[]=[];
  team.forEach((p,position)=>p.slots.forEach((s,slot)=>{if(s.monsterId&&s.phase===i+1)casts.push({position:position+1,slot:slot+1,classId:p.classId,monsterId:s.monsterId});}));
  const counts=new Map<number,number>();for(const cast of casts)counts.set(cast.position,(counts.get(cast.position)??0)+1);
  return {number:i+1,casts,conflicts:[...counts].filter(([,count])=>count>1).map(([position])=>position)};
 });
}
// Catalogue order: the first Skill Name/Effect is the Unison cast. Later skills may be Main Slot passives.
// Keep each target, duration and conditional clause together; potentials remain separate.
export function castEffects(item: Item): string[] {
 const blocks:string[]=[];
 for(const section of item.sections.filter(s=>s.kind==="Effect").slice(0,1)){
  let block="";
  for(const line of section.text.split(/\n/)){
   if(/^\s*-\s*\S/.test(line)&&block){blocks.push(block.trim());block="";}
   block+=(block?"\n":"")+line;
  }
  if(block.trim())blocks.push(block.trim());
 }
 return [...new Set(blocks)];
}
export function mergeFrontlineEffects(phase: FrontlinePhase,items: ReadonlyMap<string,Item>) {
 const merged=new Map<string,{text:string;count:number;origins:(FrontlineCast&{phase:number})[]}>();
 for(const cast of phase.casts){
  const item=items.get(cast.monsterId);if(!item)continue;
  for(const text of castEffects(item)){
   const key=text.replace(/^\s*-\s*/," ").trim().replace(/\s+/g," ").toLowerCase();
   const row=merged.get(key)??{text,count:0,origins:[]};row.count++;row.origins.push({...cast,phase:phase.number});merged.set(key,row);
  }
 }
 return [...merged.values()];
}
