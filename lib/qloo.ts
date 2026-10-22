// Qloo Insights client + the agent's radius-widening step.
// Rules (docs.qloo.com, read 2026-10-10):
//   - hackathon key only works against https://hackathon.api.qloo.com, header X-Api-Key
//   - signal.location = WKT POINT(lng lat) biases any entity type toward local taste;
//     filter.location only applies to place/destination, so it is set for places alone
//   - take <= 50; feature.explainability=true adds per-result metadata
// Without QLOO_API_KEY the client serves synthetic fixtures (never real Qloo data in the repo).
import { SYNTHETIC } from "./fixtures.ts";

const BASE = "https://hackathon.api.qloo.com/v2/insights";
export const TYPES = ["place", "artist", "brand", "movie"] as const;
export type EType = (typeof TYPES)[number];
export type Entity = { id: string; name: string; affinity: number | null; why: string | null };
export type Step = { type: EType; radius: number; hits: number; seeds?: number };
export const AGES = ["24_and_younger", "25_to_29", "30_to_34", "35_to_44", "45_to_54", "55_and_older"] as const;

const RADII = [1500, 5000, 20000]; // metres; widen when sparse
const SPARSE = 5;
const SEEDS = 5; // top local places fed back as interest signals

// Explainability (seen live 2026-10-22): with location-only signals Qloo warns "Could not calculate explainability".
// With signal.interests.entities it returns query.explainability["signal.interests.entities"] = [{entity_id, score}],
// i.e. which seed entity drove this result. Seeds are the top local places, so `names` maps their ids back to names.
function why(e: any, names: Map<string, string>): string | null {
  const ex = e?.query?.explainability?.["signal.interests.entities"];
  if (Array.isArray(ex)) {
    const by = ex.map((x: any) => names.get(x?.entity_id)).filter(Boolean).slice(0, 2);
    if (by.length) return `liked by people who also go to ${by.join(" and ")}`;
  }
  const bits: string[] = [];
  const d = e?.query?.distance;
  if (typeof d === "number") bits.push(`${(d / 1000).toFixed(1)} km away`);
  const tags = e?.tags?.slice?.(0, 3).map((t: any) => t?.name).filter(Boolean);
  if (tags?.length) bits.push(`tags: ${tags.join(", ")}`);
  return bits.length ? bits.join(" · ") : null;
}

export async function insights(type: EType, lat: number, lng: number, radius: number, key: string, age?: string, seeds: Map<string, string> = new Map(), placeTag?: string): Promise<Entity[]> {
  const point = `POINT(${lng} ${lat})`;
  const p = new URLSearchParams({
    "filter.type": `urn:entity:${type}`,
    "signal.location": point,
    "signal.location.radius": String(radius),
    take: "10",
    "feature.explainability": "true",
  });
  if (type === "place") {
    p.set("filter.location", point);
    p.set("filter.location.radius", String(radius));
    if (placeTag) p.set("filter.tags", placeTag); // tag ids from Qloo GET /v2/tags, e.g. urn:tag:genre:place:restaurant
  }
  if (seeds.size) p.set("signal.interests.entities", [...seeds.keys()].join(","));
  if (age) p.set("signal.demographics.age", age);
  const r = await fetch(`${BASE}?${p}`, { headers: { "X-Api-Key": key }, cache: "no-store" });
  if (!r.ok) throw new Error(`Qloo ${type} HTTP ${r.status}`);
  const body: any = await r.json();
  return (body?.results?.entities ?? []).map((e: any) => ({
    id: String(e.entity_id),
    name: String(e.name),
    affinity: typeof e?.query?.affinity === "number" ? e.query.affinity : null,
    why: why(e, seeds),
  }));
}

/** Agent steps: read local places first (widening the radius until >= SPARSE hits), then feed the top places back
 *  as interest signals so artist/brand/movie results come with Qloo explainability tied to the neighbourhood. */
export async function profile(types: readonly EType[], lat: number, lng: number, key: string | undefined, age?: string, placeTag?: string) {
  const out = {} as Record<EType, Entity[]>;
  const trace: Step[] = [];
  if (!key) {
    for (const t of types) {
      out[t] = SYNTHETIC[t];
      trace.push({ type: t, radius: RADII[0], hits: out[t].length });
    }
    return { out, trace };
  }
  const widen = async (t: EType, seeds?: Map<string, string>) => {
    for (const r of RADII) {
      const ents = await insights(t, lat, lng, r, key, age, seeds, placeTag);
      trace.push({ type: t, radius: r, hits: ents.length, ...(seeds?.size ? { seeds: seeds.size } : {}) });
      out[t] = ents;
      if (ents.length >= SPARSE) break;
    }
  };
  await widen("place");
  const seeds = new Map(out.place.slice(0, SEEDS).map((e) => [e.id, e.name] as [string, string]));
  for (const t of types) if (t !== "place") await widen(t, seeds);
  if (!types.includes("place")) delete (out as any).place;
  return { out, trace };
}
