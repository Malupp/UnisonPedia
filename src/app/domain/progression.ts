import { Entry, Goal, UserState, normalizeMode, goalIdentity } from "./contracts";
import { CLASS_WEAPONS } from "./evaluation";
import type { VideoObservation } from "../core/video-meta";
export interface GoalSuggestion { goal: Goal; reason: string; conditions: string; origin: string; observationId: string }
export function goalProgress(goal: Goal, state: UserState, entries: Entry[]) {
  let current = 0;
  let review = goal.buildId !== null && !state.builds.some(b => b.id === goal.buildId);
  if (goal.kind === "acquire") {
    review ||= !goal.itemIds.some(id => entries.some(e => e.id === id));
    current = state.copies.some(c => goal.itemIds.includes(c.itemId)) ? 1 : 0;
  } else if (goal.kind === "potential") {
    const copy = state.copies.find(c => c.copyId === goal.copyId);
    review ||= !copy;
    current = copy?.potential ?? 0;
  } else {
    const build = state.builds.find(b => b.id === goal.buildId);
    const ids = new Set(build?.slots.map(s => s.copyId) ?? []);
    current = state.copies.filter(c => ids.has(c.copyId) && entries.some(e => e.id === c.itemId && e.kind === goal.gearKind && e.element === goal.element)).length;
  }
  return {current:Math.min(current, goal.target), target:goal.target,
    status: (review ? "review" : current >= goal.target ? "complete" : "active") as "review" | "complete" | "active"};
}
export function suggestGoals(state: UserState, entries: Entry[], observations: VideoObservation[], metaVersion: string, buildId: string | null): GoalSuggestion[] {
  const p = state.profile, mode = normalizeMode(p.mode);
  if (!p.classId) return [];
  const build = state.builds.find(b => b.id === buildId && normalizeMode(b.mode) === mode);
  const allowed = CLASS_WEAPONS[p.classId];
  const result: GoalSuggestion[] = [];
  const seen = new Set<string>();
  const add = (goal: Goal, o: VideoObservation) => {
    if (seen.has(goal.id) || state.goals.some(g => goalIdentity(g) === goalIdentity(goal) && g.status === "active") || goalProgress(goal,state,entries).status !== "active") return;
    seen.add(goal.id); result.push({goal,reason:o.summary,conditions:o.conditions,origin:o.origin,observationId:o.id});
  };
  for (const o of observations) {
    if (o.status !== "matched" || (o.modes && !o.modes.some(m => normalizeMode(m) === mode)) || (o.roles && !o.roles.includes(p.role))) continue;
    const ids = o.itemIds.filter(id => entries.some(e => e.id === id && (e.kind !== "weapon" || (allowed && allowed.includes(e.gearType)))));
    if (!ids.length) continue;
    const base = {mode,classId:p.classId,buildId:build?.id ?? null,metaVersion,createdAt:new Date().toISOString(),status:"active" as const};
    const context = ":" + p.classId + ":" + mode + ":" + (build?.id ?? "profile");
    add({...base,id:"acquire:"+o.id+context,kind:"acquire",label:"Ottenere " + o.name,target:1,itemIds:ids},o);
    for (const r of o.requirements ?? []) {
      if (r.kind === "element" && build && state.copies.some(c => ids.includes(c.itemId) && build.slots.some(s => s.copyId === c.copyId))) {
        add({...base,id:"element:"+r.gearKind+":"+r.element+":"+r.target+context,kind:"element",label:"Assegnare " + r.target + (r.gearKind === "weapon" ? " armi " : " difensivi ") + r.element,target:r.target,itemIds:ids,element:r.element,gearKind:r.gearKind},o);
      }
      if (r.kind === "potential") {
        for (const c of state.copies.filter(c => ids.includes(c.itemId)))
          add({...base,id:"potential:"+c.copyId+":"+r.target+context,kind:"potential",label:o.name+": Hidden Potential "+r.target,target:r.target,itemIds:ids,copyId:c.copyId},o);
      }
    }
  }
  return result;
}
