// Shared ESPN data layer: league-wide pieces (teams, standings) and per-team schedules.

const ESPN = "https://site.api.espn.com/apis";
type Any = any;

export async function getJSON(url: string): Promise<Any> {
  const res = await fetch(url, { headers: { "User-Agent": "nfl-fan-hub/1.0" } });
  if (!res.ok) throw new Error(`${res.status} from ${url}`);
  return res.json();
}

const logoFor = (abbr: string) => `https://a.espncdn.com/i/teamlogos/nfl/500/${abbr.toLowerCase()}.png`;

function statMap(stats: Any[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of stats ?? []) out[s.name] = s.displayValue;
  return out;
}

export type TeamInfo = {
  id: string;
  abbr: string;
  slug: string;
  name: string; // "Detroit Lions"
  nickname: string; // "Lions"
  location: string; // "Detroit"
  color: string;
  alt: string;
  logo: string;
  conf: string; // "NFC"
  division: string; // "NFC North"
};

export type Standing = ReturnType<typeof standingEntry>;

function standingEntry(e: Any, teams: Record<string, TeamInfo>) {
  const s = statMap(e.stats);
  const abbr = e.team.abbreviation;
  const t = teams[abbr];
  return {
    abbr,
    slug: t?.slug ?? abbr.toLowerCase(),
    name: e.team.displayName,
    short: e.team.shortDisplayName ?? e.team.name,
    logo: e.team.logos?.[0]?.href ?? logoFor(abbr),
    color: t?.color,
    conf: t?.conf,
    wins: Number(s.wins ?? 0),
    losses: Number(s.losses ?? 0),
    ties: Number(s.ties ?? 0),
    pct: s.winPercent,
    pctNum: parseFloat(s.winPercent ?? "0") || 0,
    record: s.overall,
    gb: s.gamesBehind,
    seed: s.playoffSeed && s.playoffSeed !== "0" ? Number(s.playoffSeed) : null,
    pf: Number(s.pointsFor ?? 0),
    pa: Number(s.pointsAgainst ?? 0),
    diffNum: Number(s.pointsFor ?? 0) - Number(s.pointsAgainst ?? 0),
    streak: s.streak,
    home: s.Home,
    road: s.Road,
    div: s["vs. Div."],
    confRec: s["vs. Conf."],
  };
}

/** Teams, divisions and standings for the whole league. */
export async function getLeague() {
  const [teamsRaw, confStandings, divStandings] = await Promise.all([
    getJSON(`${ESPN}/site/v2/sports/football/nfl/teams`),
    getJSON(`${ESPN}/v2/sports/football/nfl/standings`),
    getJSON(`${ESPN}/v2/sports/football/nfl/standings?level=3`),
  ]);

  // Division + conference membership from the division standings
  const membership: Record<string, { conf: string; division: string }> = {};
  for (const conf of divStandings.children) {
    for (const div of conf.children ?? []) {
      for (const e of div.standings.entries) membership[e.team.abbreviation] = { conf: conf.abbreviation, division: div.name };
    }
  }

  const teams: Record<string, TeamInfo> = {};
  for (const { team } of teamsRaw.sports[0].leagues[0].teams) {
    const m = membership[team.abbreviation];
    teams[team.abbreviation] = {
      id: team.id,
      abbr: team.abbreviation,
      slug: String(team.name).toLowerCase().replace(/[^a-z0-9]+/g, ""),
      name: team.displayName,
      nickname: team.name,
      location: team.location,
      color: `#${team.color ?? "333333"}`,
      alt: `#${team.alternateColor ?? "999999"}`,
      logo: team.logos?.[0]?.href ?? logoFor(team.abbreviation),
      conf: m?.conf ?? "",
      division: m?.division ?? "",
    };
  }

  const conferences: Record<string, Standing[]> = {};
  for (const conf of confStandings.children) {
    conferences[conf.abbreviation] = conf.standings.entries
      .map((e: Any) => standingEntry(e, teams))
      .sort((a: Standing, b: Standing) => (a.seed ?? 99) - (b.seed ?? 99));
  }

  const divisions: Record<string, Standing[]> = {};
  for (const conf of divStandings.children) {
    for (const div of conf.children ?? []) divisions[div.name] = div.standings.entries.map((e: Any) => standingEntry(e, teams));
  }

  const league = Object.values(conferences)
    .flat()
    .sort((a, b) => b.pctNum - a.pctNum || b.diffNum - a.diffNum);

  return { teams, conferences, divisions, league };
}

export function findTeam(teams: Record<string, TeamInfo>, key: string): TeamInfo | undefined {
  const k = key.toLowerCase();
  return Object.values(teams).find((t) => t.slug === k || t.abbr.toLowerCase() === k);
}

/** Full payload for one team's page. */
export async function getTeamPage(key: string) {
  const lg = await getLeague();
  const team = findTeam(lg.teams, key);
  if (!team) return null;
  const sched = await getJSON(`${ESPN}/site/v2/sports/football/nfl/teams/${team.abbr.toLowerCase()}/schedule`);

  const recordByAbbr: Record<string, string> = {};
  for (const t of lg.league) recordByAbbr[t.abbr] = t.record;
  const divisionMates = new Set(lg.divisions[team.division]?.map((t) => t.abbr).filter((a) => a !== team.abbr));

  const competitor = (c: Any) => {
    const t = c.team;
    const score = typeof c.score === "object" ? c.score?.displayValue : c.score;
    return {
      abbr: t.abbreviation,
      slug: lg.teams[t.abbreviation]?.slug,
      name: t.displayName,
      short: t.shortDisplayName ?? t.nickname,
      logo: t.logos?.[0]?.href ?? logoFor(t.abbreviation),
      homeAway: c.homeAway,
      score: score != null ? Number(score) : null,
      record: recordByAbbr[t.abbreviation] ?? null,
    };
  };

  const games = sched.events.map((e: Any) => {
    const c = e.competitions[0];
    const comps = c.competitors.map(competitor);
    const us = comps.find((x: Any) => x.abbr === team.abbr);
    const them = comps.find((x: Any) => x.abbr !== team.abbr);
    const st = c.status.type;
    let result: "W" | "L" | "T" | null = null;
    if (st.completed && us.score != null && them.score != null) {
      result = us.score > them.score ? "W" : us.score < them.score ? "L" : "T";
    }
    return {
      id: e.id,
      week: e.week?.number,
      date: e.date,
      timeValid: c.timeValid !== false,
      home: us.homeAway === "home",
      neutral: !!c.neutralSite,
      division: divisionMates.has(them.abbr),
      venue: c.venue ? { name: c.venue.fullName, city: c.venue.address?.city } : null,
      tv: (c.broadcasts ?? []).map((b: Any) => b.media?.shortName).filter(Boolean),
      state: st.state, // pre | in | post
      statusDetail: st.shortDetail ?? st.detail,
      overtime: /OT/.test(st.detail ?? ""),
      result,
      us,
      them,
      link: `https://www.espn.com/nfl/game/_/gameId/${e.id}`,
    };
  });

  const stats = lg.league.find((t) => t.abbr === team.abbr)!;
  return {
    updated: new Date().toISOString(),
    season: { year: sched.season?.year, name: sched.season?.name },
    team: {
      ...team,
      record: sched.team.recordSummary,
      standingSummary: sched.team.standingSummary,
      byeWeek: sched.byeWeek ?? null,
      stats,
      leagueRank: lg.league.findIndex((t) => t.abbr === team.abbr) + 1,
    },
    games,
    standings: {
      division: lg.divisions[team.division] ?? [],
      conference: lg.conferences[team.conf] ?? [],
      league: lg.league,
    },
  };
}

export const jsonResponse = (body: unknown, cdnSeconds: number, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": status === 200 ? "public, max-age=30" : "no-store",
      ...(status === 200
        ? { "Netlify-CDN-Cache-Control": `public, durable, s-maxage=${cdnSeconds}, stale-while-revalidate=300` }
        : {}),
    },
  });
