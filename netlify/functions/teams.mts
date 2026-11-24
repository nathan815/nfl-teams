import type { Config } from "@netlify/functions";
import { getLeague, jsonResponse } from "./_shared/espn.mts";

// GET /api/teams — every team with colors, division and current record, grouped for the home page.
export default async () => {
  try {
    const lg = await getLeague();
    const byAbbr = Object.fromEntries(lg.league.map((t) => [t.abbr, t]));
    const conferences = ["AFC", "NFC"].map((conf) => ({
      conf,
      divisions: Object.entries(lg.divisions)
        .filter(([name]) => name.startsWith(conf))
        .sort(([a], [b]) => ["East", "North", "South", "West"].indexOf(a.split(" ")[1]) - ["East", "North", "South", "West"].indexOf(b.split(" ")[1]))
        .map(([name, entries]) => ({
          name,
          teams: entries.map((e) => {
            const t = lg.teams[e.abbr];
            const s = byAbbr[e.abbr];
            return { ...t, record: s?.record, streak: s?.streak, seed: s?.seed ?? null };
          }),
        })),
    }));
    return jsonResponse({ updated: new Date().toISOString(), conferences }, 300);
  } catch (err) {
    return jsonResponse({ error: String(err) }, 0, 502);
  }
};

export const config: Config = { path: "/api/teams" };
