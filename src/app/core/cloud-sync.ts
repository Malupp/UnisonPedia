import { AuthService } from "./auth";
import { PlayerTransport, RemotePlayerState, RevisionConflict } from "../domain/sync";
import { UserState } from "../domain/contracts";
import { validateBackup } from "../domain/inventory";
export function cloudTransport(auth: AuthService): PlayerTransport {
 async function request(owner:string,path:string,body?:unknown){
   // Capture credentials before starting fetch. An account switch cannot retarget this request.
   const session=auth.session();
   if(!session || session.user.id!==owner)throw new Error("Account cambiato");
   const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);
   try{
     const response=await fetch(auth.config.supabaseUrl+"/rest/v1/"+path,{method:body?"POST":"GET",headers:{apikey:auth.config.publishableKey,Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined,signal:controller.signal,cache:"no-store"});
     const data=await response.json();
     if(!response.ok){if(data.code==="40001")throw new RevisionConflict();throw new Error("Archivio online non disponibile");}
     return data;
   }finally{clearTimeout(timeout);}
 }
 function decode(row:any):RemotePlayerState {
   const valid=validateBackup({schemaVersion:row.schema_version,profile:row.profile,copies:row.copies,builds:row.builds,goals:row.goals});
   if(!valid.ok||!Number.isSafeInteger(row.revision)||row.revision<1)throw new Error("Dati cloud non validi");
   return {state:valid.data!,revision:row.revision};
 }
 return {
   async load(owner){const rows=await request(owner,"player_states?user_id=eq."+encodeURIComponent(owner)+"&select=schema_version,profile,copies,builds,goals,revision");return rows.length?decode(rows[0]):null;},
   async save(owner,revision,state:UserState){const row=await request(owner,"rpc/save_player_state",{expected_revision:revision,payload:state});return decode(row);}
 };
}
