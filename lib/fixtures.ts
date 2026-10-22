// SYNTHETIC fixtures. Invented names, invented scores. Not Qloo data; safe for a public repo.
import type { EType, Entity } from "./qloo.ts";

const mk = (type: string, names: string[]): Entity[] =>
  names.map((name, i) => ({
    id: `synthetic-${type}-${i}`,
    name,
    affinity: Math.round((0.92 - 0.07 * i) * 100) / 100,
    why: `synthetic example: high local affinity among nearby ${type} fans`,
  }));

export const SYNTHETIC: Record<EType, Entity[]> = {
  place: mk("place", ["Café Exemple", "Bistrot Fictif", "Librairie Imaginaire", "Marché Démo", "Cave Inventée", "Atelier Test"]),
  artist: mk("artist", ["Synthetic Jazz Trio", "Demo Chanson Singer", "Placeholder Electro Duo", "Sample Folk Band", "Mock Soul Voice", "Test Indie Group"]),
  brand: mk("brand", ["Example Linen Co.", "Demo Ceramics", "Sample Coffee Roasters", "Mock Sneakers", "Test Stationery", "Fictional Tea House"]),
  movie: mk("movie", ["The Synthetic Summer", "Demo Nights in Lyon", "A Placeholder Story", "Sample City Blues", "Mock Heist", "Test Pattern"]),
};
