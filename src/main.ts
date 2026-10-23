import { bootstrapApplication } from "@angular/platform-browser";
import {
  provideRouter,
  Routes,
  withComponentInputBinding,
} from "@angular/router";
import { AppComponent } from "./app/app";
import { PUBLIC_CONFIG, PublicConfig } from "./app/core/auth";
const routes: Routes = [
  {path:"account",loadComponent:()=>import("./app/features/account").then(m=>m.AccountComponent)},
  {path:"auth/callback",loadComponent:()=>import("./app/features/account").then(m=>m.AccountComponent)},
  { path: "", redirectTo: "catalogue", pathMatch: "full" },
  {
    path: "catalogue",
    loadComponent: () =>
      import("./app/features/catalogue").then((m) => m.CatalogueComponent),
  },
  {
    path: "meta",
    loadComponent: () =>
      import("./app/features/video-meta").then((m) => m.VideoMetaComponent),
  },
  { path: "video-meta", redirectTo: "meta", pathMatch: "full" },
  {
    path: "item/:id",
    loadComponent: () =>
      import("./app/features/detail").then((m) => m.DetailComponent),
  },
  {
    path: "compare",
    loadComponent: () =>
      import("./app/features/detail").then((m) => m.CompareComponent),
  },
  {
    path: "guide",
    loadComponent: () =>
      import("./app/features/guide").then((m) => m.GuideComponent),
  },
  {
    path: "guide/:id",
    loadComponent: () =>
      import("./app/features/guide").then((m) => m.GuideComponent),
  },
  {
    path: "inventory",
    loadComponent: () =>
      import("./app/features/inventory").then((m) => m.InventoryComponent),
  },
  {
    path: "advice",
    loadComponent: () =>
      import("./app/features/advice").then((m) => m.AdviceComponent),
  },
  {
    path: "spawns",
    loadComponent: () =>
      import("./app/features/spawns").then((m) => m.SpawnsComponent),
  },
  { path: "**", redirectTo: "catalogue" },
];
async function start(){
  let config:PublicConfig={supabaseUrl:"",publishableKey:"",appUrl:""};
  try{
    const response=await fetch("/app-config.json",{cache:"no-store"});
    if(response.ok){
      const raw=await response.json();
      if(raw.supabaseUrl||raw.publishableKey){
        const db=new URL(raw.supabaseUrl),app=new URL(raw.appUrl);
        const safe=(u:URL)=>u.protocol==="https:"||(u.protocol==="http:"&&["localhost","127.0.0.1"].includes(u.hostname));
        if(!safe(db)||!safe(app)||!/^sb_publishable_[A-Za-z0-9_-]+$/.test(raw.publishableKey))throw Error("config");
        config={supabaseUrl:db.origin,publishableKey:raw.publishableKey,appUrl:app.origin};
      }
    }
  }catch{config.error="Collegamento cloud non configurato correttamente. L’inventario locale resta disponibile.";}
  await bootstrapApplication(AppComponent,{providers:[provideRouter(routes,withComponentInputBinding()),{provide:PUBLIC_CONFIG,useValue:config}]});
}
void start().catch(console.error);
