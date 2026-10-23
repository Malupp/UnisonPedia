import { Injectable, computed, signal } from "@angular/core";

export type VideoCategory = "weapon" | "defence" | "monster" | "healing" | "opening" | "constant";
export interface VideoObservation {
  id: string;
  name: string;
  category: VideoCategory;
  family?: string;
  familyName?: string;
  element?: string;
  status: "matched" | "pending";
  origin: "video" | "similar";
  similarTo?: string[];
  priority: string;
  summary: string;
  conditions: string;
  skillNames: string[];
  itemIds: string[];
  modes?: import("../domain/contracts").Mode[];
  roles?: import("../domain/contracts").Role[];
  requirements?: ({kind: "element"; element: string; gearKind: "weapon" | "defence"; target: number} | {kind: "potential"; target: number})[];
  evidence: { video: string; seconds: number }[];
}
export interface VideoCollection {
  analyzedAt: string;
  catalogueAsOf: string;
  videos: { id: string; label: string; recordedAt: string; durationSeconds: number }[];
  observations: VideoObservation[];
  takeaways: { title: string; text: string; points: string[]; highlight?: boolean }[];
}

@Injectable({ providedIn: "root" })
export class VideoMetaStore {
  data = signal<VideoCollection | null>(null);
  loading = signal(false);
  error = signal("");
  highlights = computed(() => this.data()?.takeaways.filter((t) => t.highlight) ?? []);
  counts = computed(() => {
    const rows = this.data()?.observations ?? [];
    return {
      equipment: new Set(rows.filter((o) => o.category !== "monster").flatMap((o) => o.itemIds)).size,
      monsters: rows.filter((o) => o.category === "monster").length,
      pending: rows.filter((o) => o.status === "pending").length,
    };
  });

  constructor() { void this.load(); }

  async load() {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set("");
    try {
      const response = await fetch("data/video-meta.json");
      if (!response.ok) throw new Error("collection unavailable");
      this.data.set(await response.json());
    } catch {
      this.error.set("La selezione dei video non è disponibile. Riprova tra poco.");
    } finally {
      this.loading.set(false);
    }
  }
}
