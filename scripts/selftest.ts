// Self-check. Offline by default (synthetic data, stubbed Claude). `--live` hits Qloo once with QLOO_API_KEY.
import assert from "node:assert/strict";
import { profile } from "../lib/qloo.ts";
import { DAYS, typesFor, weekPlan, applyRewrite, KINDS, type Kind } from "../lib/plan.ts";
import { rewrite, spentUsd } from "../lib/llm.ts";

const LYON = { lat: 45.7697, lng: 4.8503 }; // test point only

for (const kind of Object.keys(KINDS) as Kind[]) {
  const { out, trace } = await profile(typesFor(kind), LYON.lat, LYON.lng, undefined);
  assert.deepEqual(trace.map((t) => t.type), typesFor(kind));
  const plan = weekPlan(kind, out);
  assert.deepEqual(plan.map((p) => p.day), DAYS, `${kind}: seven days`);
  assert.equal(new Set(plan.map((p) => p.entity.id)).size, 7, `${kind}: no entity reused`);
  assert.ok(plan.every((p) => p.text.includes(p.entity.name)), `${kind}: text names its entity`);
}

// sparse data: plan shrinks instead of crashing or repeating
const { out } = await profile(["place", "artist", "movie"], 0, 0, undefined);
const thin = { ...out, place: out.place.slice(0, 1), artist: [], movie: out.movie.slice(0, 2) };
assert.equal(weekPlan("restaurant", thin).length, 3);

// rewrite validator: wrong id, missing name, wrong length all rejected
const plan = weekPlan("cafe", (await profile(typesFor("cafe"), 0, 0, undefined)).out);
const good = plan.map((p) => ({ day: p.day, id: p.entity.id, text: `Try ${p.entity.name} this week.` }));
assert.ok(applyRewrite(plan, good));
assert.equal(applyRewrite(plan, good.slice(1)), null);
assert.equal(applyRewrite(plan, good.map((g, i) => (i ? g : { ...g, id: "invented" }))), null);
assert.ok(applyRewrite(plan, good.map((g) => ({ ...g, day: "Lundi" }))), "translated day field tolerated");
assert.equal(applyRewrite(plan, good.map((g, i) => (i ? g : { ...g, text: "Something generic." }))), null);

// llm layer: no key -> template; stubbed key -> claude, then cached; budget stops calls
delete process.env.ANTHROPIC_API_KEY;
assert.equal((await rewrite(plan, { kind: "Café", area: "Lyon", lang: "en" })).llm, "template");
process.env.ANTHROPIC_API_KEY = "stub";
process.env.LLM_BUDGET_USD = "0.02";
let calls = 0;
const stub = (async () => {
  calls++;
  return new Response(JSON.stringify({ usage: { input_tokens: 1000, output_tokens: 1000 }, content: [{ type: "text", text: JSON.stringify(good) }] }));
}) as typeof fetch;
const ctx = { kind: "Café", area: "Lyon", lang: "en" as const };
assert.equal((await rewrite(plan, ctx, stub)).llm, "claude");
assert.equal((await rewrite(plan, ctx, stub)).llm, "cached");
assert.equal((await rewrite(plan, { ...ctx, area: "Paris" }, stub)).llm, "claude"); // spent 0.024 >= 0.02
assert.equal((await rewrite(plan, { ...ctx, area: "Nantes" }, stub)).llm, "template");
assert.equal(calls, 2);
assert.ok(Math.abs(spentUsd() - 0.024) < 1e-9);

if (process.argv.includes("--live")) {
  const key = process.env.QLOO_API_KEY;
  assert.ok(key, "set QLOO_API_KEY");
  const live = await profile(["place", "artist"], LYON.lat, LYON.lng, key);
  console.log("live trace:", live.trace, "sample:", live.out.artist?.[0]);
  assert.ok(live.out.place.length && live.out.artist.length, "live: both types return entities");
  assert.ok(live.out.artist.some((e) => e.why?.startsWith("liked by")), "live: explainability ties artists to local places");
}
console.log("selftest ok");
