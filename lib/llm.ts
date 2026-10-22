// Optional copy layer: Claude rewrites the template plan into concrete, shop-specific suggestions.
// No ANTHROPIC_API_KEY, budget spent, or any failure -> caller keeps the template plan. The demo never 500s on this.
import { applyRewrite, type Item } from "./plan.ts";

const MODEL = "claude-sonnet-5-5";
const PRICE_IN = 2 / 1e6; // USD per token, Sonnet 5.5
const PRICE_OUT = 10 / 1e6;

// ponytail: per-instance counter; serverless instances each get their own. The real ceiling is the
// spend limit on the dedicated API key's workspace (set at deploy, see README). This only stops runaway loops.
let spent = 0;
const cache = new Map<string, Item[]>();
export const spentUsd = () => spent;

export async function rewrite(items: Item[], ctx: { kind: string; area: string; lang: "en" | "fr" }, fetchImpl = fetch): Promise<{ items: Item[]; llm: "claude" | "cached" | "template"; usd: number }> {
  const key = process.env.ANTHROPIC_API_KEY;
  const budget = Number(process.env.LLM_BUDGET_USD ?? 10);
  const ck = JSON.stringify([ctx, items.map((i) => [i.day, i.entity.id])]);
  const hit = cache.get(ck);
  if (hit) return { items: hit, llm: "cached", usd: 0 };
  if (!key || spent >= budget) return { items, llm: "template", usd: 0 };

  const lines = items.map((i) => ({ day: i.day, id: i.entity.id, type: i.type, entity: i.entity.name, why: i.entity.why, draft: i.text }));
  const prompt =
    `You write a one-week plan for an independent ${ctx.kind} near ${ctx.area}, France. ` +
    `Each line is built on one taste signal from Qloo (a place, artist, brand or film that people nearby like). ` +
    `Rewrite each draft as one concrete, doable suggestion (max 30 words) in ${ctx.lang === "fr" ? "French" : "English"}. ` +
    `Keep the entity name verbatim. Do not add facts about the entity you are not sure of. Plain, confident tone, no emoji, no exclamation marks. ` +
    `Return only a JSON array of {"day","id","text"} in the same order; copy "day" and "id" unchanged.\n\n${JSON.stringify(lines)}`;
  let usd = 0;
  try {
    const r = await fetchImpl("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 1200, messages: [{ role: "user", content: prompt }] }),
    });
    if (!r.ok) return { items, llm: "template", usd: 0 };
    const body: any = await r.json();
    usd = (body.usage?.input_tokens ?? 0) * PRICE_IN + (body.usage?.output_tokens ?? 0) * PRICE_OUT;
    spent += usd;
    const text: string = body.content?.find((c: any) => c.type === "text")?.text ?? "";
    const json = text.slice(text.indexOf("["), text.lastIndexOf("]") + 1);
    const out = applyRewrite(items, JSON.parse(json));
    if (!out) return { items, llm: "template", usd };
    cache.set(ck, out);
    return { items: out, llm: "claude", usd };
  } catch {
    return { items, llm: "template", usd };
  }
}
