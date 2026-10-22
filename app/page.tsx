"use client";
import { useState } from "react";

type Item = { day: string; type: string; text: string; entity: { name: string; affinity: number | null; why: string | null } };
type Res = { geo: { area: string; lat: number; lng: number }; items: Item[]; trace: { type: string; radius: number; hits: number; seeds?: number }[]; data: "qloo" | "synthetic"; llm: string; lang: "en" | "fr" };
const FR: Record<string, string> = { Monday: "Lundi", Tuesday: "Mardi", Wednesday: "Mercredi", Thursday: "Jeudi", Friday: "Vendredi", Saturday: "Samedi", Sunday: "Dimanche" };

const AGES: [string, string][] = [["", "Any age"], ["24_and_younger", "24 and younger"], ["25_to_29", "25-29"], ["30_to_34", "30-34"], ["35_to_44", "35-44"], ["45_to_54", "45-54"], ["55_and_older", "55 and older"]];

export default function Page() {
  const [res, setRes] = useState<Res | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setErr(""); setRes(null);
    const body = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const r = await fetch("/api/plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) setErr(j.error ?? `Error ${r.status}`); else setRes(j);
    } catch { setErr("Network error. Try again."); }
    setBusy(false);
  }

  return (
    <main>
      <h1>Carte Locale</h1>
      <p className="lede">Enter a shop address in France. The agent reads what people around it like, across places, music, brands and film, and turns it into a week of concrete ideas. Each idea shows the taste signal it comes from.</p>
      <form onSubmit={submit}>
        <label>Shop address<input name="address" required placeholder="12 rue Exemple, 69006 Lyon" /></label>
        <div className="row">
          <label>Business type<select name="kind" defaultValue="restaurant"><option value="restaurant">Restaurant</option><option value="cafe">Café</option><option value="boutique">Boutique</option></select></label>
          <label>Main clientele<select name="age" defaultValue="">{AGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <label>Plan language<select name="lang" defaultValue="en"><option value="en">English</option><option value="fr">Français</option></select></label>
        </div>
        <button disabled={busy}>{busy ? "Reading the neighbourhood…" : "Build my week"}</button>
      </form>
      {err && <p className="err">{err}</p>}
      {res && (
        <section>
          <h2>Your week near {res.geo.area}</h2>
          {res.data === "synthetic" && <p className="note">Demo mode: synthetic taste data (Qloo unavailable right now). Names below are invented.</p>}
          <table><tbody>
            {res.items.map((it) => (
              <tr key={it.day}>
                <td className="day">{res.lang === "fr" ? FR[it.day] : it.day}</td>
                <td>{it.text}<div className="why">Signal: {it.type} · {it.entity.name}{it.entity.affinity != null && ` · affinity ${it.entity.affinity.toFixed(2)}`}{it.entity.why && ` · ${it.entity.why}`}</div></td>
              </tr>
            ))}
          </tbody></table>
          <details>
            <summary>How the agent got here</summary>
            <ol>
              <li>Geocoded the address to {res.geo.lat.toFixed(4)}, {res.geo.lng.toFixed(4)}.</li>
              {res.trace.map((s, i) => <li key={i}>Queried Qloo for <code>{s.type}</code> within {s.radius} m{s.seeds ? `, seeded with the ${s.seeds} top local places` : ""}: {s.hits} results{s.hits < 5 && s.radius < 20000 ? ", too sparse, widened" : ""}.</li>)}
              <li>Mapped signals to {res.items.length} actions for this business type; copy: {res.llm === "template" ? "rule templates" : "Claude rewrite, checked to keep every Qloo entity"}.</li>
            </ol>
          </details>
        </section>
      )}
    </main>
  );
}
