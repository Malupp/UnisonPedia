import { bootstrapApplication } from "@angular/platform-browser";
import {
  provideRouter,
  Routes,
  withComponentInputBinding,
} from "@angular/router";
import { AppComponent } from "./app/app";
const routes: Routes = [
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
bootstrapApplication(AppComponent, {
  providers: [provideRouter(routes, withComponentInputBinding())],
}).catch(console.error);
