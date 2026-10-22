import { AGES, profile } from "../../../lib/qloo.ts";
import { KINDS, typesFor, weekPlan, type Kind } from "../../../lib/plan.ts";
import { rewrite } from "../../../lib/llm.ts";

const geoCache = new Map<string, { lat: number; lng: number; area: string }>();
// Same request, same answer: spares the hackathon key when a public demo gets hammered. ponytail: per-instance, unbounded TTL, capped size.
const planCache = new Map<string, unknown>();

// Nominatim usage policy: identify the app, max 1 req/s, cache results.
async function geocode(address: string) {
  const k = address.toLowerCase().trim();
  const hit = geoCache.get(k);
  if (hit) return hit;
  const u = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=fr&addressdetails=1&q=${encodeURIComponent(address)}`;
  const r = await fetch(u, { headers: { "User-Agent": "CarteLocale/0.1 (yvoolab@gmail.com)" } });
  if (!r.ok) throw new Error(`geocoder HTTP ${r.status}`);
  const [g]: any[] = await r.json();
  if (!g) return null;
  const a = g.address ?? {};
  const out = { lat: Number(g.lat), lng: Number(g.lon), area: [a.suburb ?? a.city_district, a.city ?? a.town ?? a.village].filter(Boolean).join(", ") || g.display_name };
  geoCache.set(k, out);
  return out;
}

export async function POST(req: Request) {
  const b: any = await req.json().catch(() => ({}));
  const address = String(b.address ?? "").slice(0, 200).trim();
  const kind = b.kind as Kind;
  const age = AGES.includes(b.age) ? (b.age as string) : undefined;
  const lang = b.lang === "fr" ? "fr" : "en";
  if (!address || !(kind in KINDS)) return Response.json({ error: "address and a valid business type are required" }, { status: 400 });

  try {
    const geo = await geocode(address);
    if (!geo) return Response.json({ error: "address not found in France" }, { status: 404 });
    const ck = [address.toLowerCase(), kind, age, lang].join("|");
    const hit = planCache.get(ck);
    if (hit) return Response.json(hit);
    const qlooKey = process.env.QLOO_API_KEY;
    let data = qlooKey ? "qloo" : "synthetic";
    // Qloo down or key exhausted: fall back to the labelled synthetic set instead of a dead demo.
    const { out, trace } = await profile(typesFor(kind), geo.lat, geo.lng, qlooKey, age, KINDS[kind].placeTag).catch(() => {
      data = "synthetic";
      return profile(typesFor(kind), geo.lat, geo.lng, undefined, age, KINDS[kind].placeTag);
    });
    const draft = weekPlan(kind, out);
    const { items, llm, usd } = await rewrite(draft, { kind: KINDS[kind].label, area: geo.area, lang });
    const res = { geo, items, trace, data, llm, llm_usd: usd, lang };
    if (data === "qloo") {
      if (planCache.size >= 500) planCache.clear();
      planCache.set(ck, res);
    }
    return Response.json(res);
  } catch (e: any) {
    return Response.json({ error: String(e?.message ?? e) }, { status: 502 });
  }
}
