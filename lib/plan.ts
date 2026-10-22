// Rules layer: business type -> which Qloo entity types to read and what each one becomes in the week plan.
import type { EType, Entity } from "./qloo.ts";

export type Kind = "restaurant" | "cafe" | "boutique";
export type Item = { day: string; type: EType; entity: Entity; text: string };

type Action = { type: EType; text: (n: string) => string };
// placeTag narrows the local-place read (and so the interest seeds) to the business's own kind of venue.
export const KINDS: Record<Kind, { label: string; placeTag: string; actions: Action[] }> = {
  restaurant: {
    label: "Restaurant",
    placeTag: "urn:tag:genre:place:restaurant",
    actions: [
      { type: "place", text: (n) => `Dish of the day: a nod to ${n}, a place your neighbours rate highly.` },
      { type: "artist", text: (n) => `Dinner playlist built around ${n}.` },
      { type: "movie", text: (n) => `Themed evening: a set menu paired with ${n}.` },
    ],
  },
  cafe: {
    label: "Café",
    placeTag: "urn:tag:genre:place:restaurant:cafe",
    actions: [
      { type: "artist", text: (n) => `Morning playlist: ${n}.` },
      { type: "place", text: (n) => `Drink or pastry of the week inspired by ${n}.` },
      { type: "movie", text: (n) => `Quiz or screening night: ${n}.` },
      { type: "brand", text: (n) => `Counter pick or collab: ${n}.` },
    ],
  },
  boutique: {
    label: "Boutique",
    placeTag: "urn:tag:genre:place:clothing_store",
    actions: [
      { type: "brand", text: (n) => `Shelf pick: stock or style next to ${n}.` },
      { type: "artist", text: (n) => `In-store playlist: ${n}.` },
      { type: "movie", text: (n) => `Window display theme: ${n}.` },
      { type: "place", text: (n) => `Partner to approach for a joint event: ${n}.` },
    ],
  },
};

export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export const typesFor = (kind: Kind): EType[] => [...new Set(KINDS[kind].actions.map((a) => a.type))];

/** Template plan: rotate the kind's actions over seven days, each day taking the next unused entity of that type. */
export function weekPlan(kind: Kind, picks: Record<EType, Entity[]>): Item[] {
  const actions = KINDS[kind].actions;
  const used: Partial<Record<EType, number>> = {};
  const items: Item[] = [];
  for (let d = 0, a = 0; d < DAYS.length && a < DAYS.length * actions.length; a++) {
    const act = actions[a % actions.length];
    const i = used[act.type] ?? 0;
    const entity = picks[act.type]?.[i];
    if (!entity) continue; // type exhausted, try the next action
    used[act.type] = i + 1;
    items.push({ day: DAYS[d++], type: act.type, entity, text: act.text(entity.name).replace(/\.\.$/, ".") });
  }
  return items;
}

/** Accept LLM rewrites only if they keep the same entities in the same order; day comes from our side. */
export function applyRewrite(items: Item[], rewrite: unknown): Item[] | null {
  if (!Array.isArray(rewrite) || rewrite.length !== items.length) return null;
  const out = items.map((it, i) => {
    const r: any = rewrite[i];
    if (r?.id !== it.entity.id || typeof r?.text !== "string" || !r.text.trim()) return null;
    if (!r.text.includes(it.entity.name)) return null; // must name the Qloo entity it is built on
    return { ...it, text: r.text.trim().slice(0, 280) };
  });
  return out.every(Boolean) ? (out as Item[]) : null;
}
