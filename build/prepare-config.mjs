import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export function createPublicConfig(env) {
 const supabaseUrl=(env.SUPABASE_URL??'').trim();
 const publishableKey=(env.SUPABASE_PUBLISHABLE_KEY??'').trim();
 const appUrl=(env.APP_URL??'').trim().replace(/\/$/,'');
 if(!supabaseUrl&&!publishableKey)return {supabaseUrl:'',publishableKey:'',appUrl:''};
 if(!supabaseUrl||!publishableKey||!appUrl)throw Error('Configura SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY e APP_URL insieme');
 const db=new URL(supabaseUrl),app=new URL(appUrl);
 const local=(u)=>u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname);
 if((db.protocol!=='https:'&&!local(db))||db.username||db.password||db.search||db.hash||db.pathname!=='/')throw Error('SUPABASE_URL non valido');
 if((app.protocol!=='https:'&&!local(app))||app.username||app.password||app.search||app.hash||app.pathname!=='/')throw Error('APP_URL deve essere un origin HTTPS o localhost');
 if(!/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey))throw Error('Usa soltanto una chiave Supabase publishable (sb_publishable_...), mai secret o service_role');
 return {supabaseUrl:db.origin,publishableKey,appUrl:app.origin};
}
export async function prepareConfig(env, output) {
 const config=createPublicConfig(env);await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(config)+'\n');return config;
}
if(typeof process!=='undefined' && process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 await prepareConfig(process.env,resolve('public/app-config.json'));
 console.log('Configurazione pubblica preparata');
}
