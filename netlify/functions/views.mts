import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";

// Simple page-view counter: today, this week (Mon–Sun) and all-time, in Detroit time.
// All counts live in one blob so a single conditional write updates them together;
// on a concurrent write the ETag check fails and we retry.

const TZ = "America/Detroit";
const PAGES = new Set(["home", "49ers", "bears", "bengals", "bills", "broncos", "browns", "buccaneers", "cardinals", "chargers", "chiefs", "colts", "commanders", "cowboys", "dolphins", "eagles", "falcons", "giants", "jaguars", "jets", "lions", "packers", "panthers", "patriots", "raiders", "rams", "ravens", "saints", "seahawks", "steelers", "texans", "titans", "vikings"]);
const KEEP_DAYS = 21;
const KEEP_WEEKS = 12;

type Counts = { total: number; days: Record<string, number>; weeks: Record<string, number> };

function detroitDate(d = new Date()): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function isoWeek(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay() || 7; // Mon=1..Sun=7
  date.setUTCDate(date.getUTCDate() + 4 - day); // Thursday of this week decides the year
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 864e5 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function prune(rec: Record<string, number>, keep: number) {
  const keys = Object.keys(rec).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - keep))) delete rec[k];
}

function summary(c: Counts) {
  const today = detroitDate();
  const week = isoWeek(today);
  return { today: c.days[today] ?? 0, week: c.weeks[week] ?? 0, total: c.total };
}

const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|curl|wget|python|monitor/i;

export default async (req: Request) => {
  const store = getStore({ name: "views", consistency: "strong" });
  // One counter per page: ?page=home or ?page=<team slug>
  const page = new URL(req.url).searchParams.get("page") ?? "home";
  if (!PAGES.has(page)) return new Response("unknown page", { status: 400 });
  const KEY = `page-${page}`;
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });

  const read = async () => {
    const r = await store.getWithMetadata(KEY, { type: "json" });
    return { counts: (r?.data as Counts) ?? { total: 0, days: {}, weeks: {} }, etag: r?.etag, exists: !!r };
  };

  if (req.method === "GET") return json(summary((await read()).counts));
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  // Don't count bots; just report the current numbers.
  if (BOT.test(req.headers.get("user-agent") ?? "")) return json(summary((await read()).counts));

  for (let attempt = 0; attempt < 15; attempt++) {
    const { counts, etag, exists } = await read();
    const day = detroitDate();
    const week = isoWeek(day);
    counts.total += 1;
    counts.days[day] = (counts.days[day] ?? 0) + 1;
    counts.weeks[week] = (counts.weeks[week] ?? 0) + 1;
    prune(counts.days, KEEP_DAYS);
    prune(counts.weeks, KEEP_WEEKS);

    // Conditional write when we have an ETag (production). The local dev emulator
    // doesn't return ETags, so there we fall back to a plain write.
    const res = etag
      ? await store.setJSON(KEY, counts, { onlyIfMatch: etag })
      : exists
        ? await store.setJSON(KEY, counts)
        : await store.setJSON(KEY, counts, { onlyIfNew: true });
    if (res.modified) return json(summary(counts));
    await new Promise((r) => setTimeout(r, Math.min(400, 15 * 2 ** attempt) * (0.5 + Math.random())));
  }
  // Lost the race repeatedly; return what's there rather than failing the page.
  return json(summary((await read()).counts));
};

export const config: Config = { path: "/api/views" };
