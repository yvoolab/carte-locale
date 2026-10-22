# Carte Locale

A taste advisor agent for independent French merchants. Give it a shop address and a business type; it reads what people around that address like, across places, music, brands and film, using the Qloo Insights API, and turns those signals into a one-week plan: dish of the day, playlist, shelf pick, window theme, partner to approach. Each line shows the Qloo signal it is built on.

Without Qloo the agent has nothing to say about a specific street. That is the point of it.

## How it works

1. Geocode the address (OpenStreetMap Nominatim, cached).
2. Pick the entity types that matter for the business type (restaurant: places, artists, films; boutique: brands, artists, films, places).
3. Read local places first: Qloo `/v2/insights` with `filter.location` + `signal.location` around the address, narrowed to the business's own kind of venue (`filter.tags`, e.g. `urn:tag:genre:place:restaurant`, ids from `GET /v2/tags`). If fewer than 5 results come back, widen the radius 1.5 km → 5 km → 20 km.
4. Feed the top 5 local places back as `signal.interests.entities` and query the other types (artists, brands, films) with `feature.explainability=true`, plus optional `signal.demographics.age`. Qloo then says which neighbourhood venue each result is tied to, and the page shows it: "liked by people who also go to X and Y". Without the seeds Qloo answers "Could not calculate explainability".
5. Rules layer maps each signal to a concrete action for that business type.
6. Optional copy layer: Claude rewrites the seven lines in English or French. The rewrite is rejected unless every line keeps its Qloo entity, so the model cannot drift away from the data. No key, budget reached, or any error: the rule templates are served instead. The page never fails on this step.
7. The result page lists every step under "How the agent got here".

## Run

```
npm install
cp .env.example .env.local   # fill what you have; both keys optional
npm run dev
npm run selftest             # offline checks
npm run check:live           # one live Qloo call, needs QLOO_API_KEY
```

With no `QLOO_API_KEY` the app runs on synthetic fixtures (`lib/fixtures.ts`, invented names) and says so on the page. No Qloo response data is stored in this repository.

## Cost guard

`LLM_BUDGET_USD` caps Claude spend per server instance. On Vercel, instances do not share memory, so the real ceiling is the spend limit of the workspace that owns the deployed API key. Results are cached per input.

## License

MIT
