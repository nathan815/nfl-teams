import { LEAGUE } from "./league.js";
const TZ = "America/New_York";
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const slug = decodeURIComponent(location.pathname.replace(/^\/+|\/+$/g, "")).toLowerCase();

/* ====================== theming ====================== */
const hexToRgb = (h) => { const n = parseInt(h.replace("#", ""), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const sat = ([r, g, b]) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx === 0 ? 0 : (mx - mn) / mx; };
const hue = ([r, g, b]) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return 0; let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (h * 60 + 360) % 360; };
const mix = (c, t, w) => c.map((v, i) => Math.round(v + (t[i] - v) * w));
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
function toHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return [hue([r * 255, g * 255, b * 255]), s, l];
}
function fromHsl([h, s, l]) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r, g, b].map((v) => Math.round((v + m) * 255));
}
/** Raise HSL lightness (keeping hue and saturation) until luminance reaches `target`. */
function lighten(rgb, target, maxL = 0.82) {
  const [h, s, l0] = toHsl(rgb);
  let out = rgb;
  for (let l = l0; lum(out) < target && l < maxL; l += 0.02) out = fromHsl([h, s, Math.min(l + 0.02, maxL)]);
  return out;
}

// Teams whose identity is their dark primary (navy/burgundy) rather than the alternate color.
const KEEP_PRIMARY = new Set(["NE", "DAL", "WSH"]);

/** Pick readable accent colors for a dark UI from a team's primary/alternate colors. */
function teamPalette(color, alt, abbr = "") {
  let base = hexToRgb(color);
  const altRgb = hexToRgb(alt);
  // Black/grey or near-black primaries (Raiders, Steelers, Texans, Bears, Browns) → use the
  // alternate color as the accent when it's usable.
  const darkOrGrey = sat(base) < 0.2 || (lum(base) < 0.035 && !KEEP_PRIMARY.has(abbr));
  if (darkOrGrey && (sat(altRgb) > 0.3 || lum(altRgb) > 0.3)) base = altRgb;
  // Bright variant for text/glow on near-black; base itself stays visible as a fill.
  const hi = lighten(base, 0.3);
  base = lighten(base, 0.05);
  const onAccent = contrast([255, 255, 255], base) >= contrast([11, 15, 20], base) ? "#fff" : "#0b0f14";
  // If the team's accent is red, losses can't also be red.
  const h = hue(hi), redTeam = sat(hi) > 0.35 && (h < 20 || h > 340);
  return { base, hi, onAccent, loss: redTeam ? "#8a96a1" : "#e0525a" };
}

function applyTheme(team) {
  const p = teamPalette(team.color, team.alt, team.abbr);
  const r = document.documentElement.style;
  r.setProperty("--blue", `rgb(${p.base})`);
  r.setProperty("--blue-hi", `rgb(${p.hi})`);
  r.setProperty("--base-rgb", p.base.join(", "));
  r.setProperty("--hi-rgb", p.hi.join(", "));
  r.setProperty("--on-accent", p.onAccent);
  r.setProperty("--loss", p.loss);
  r.setProperty("--team-logo", `url("${team.logo}")`);
  document.querySelector('meta[name="theme-color"]').content = `rgb(${mix(p.base, [5, 8, 12], 0.8)})`;
  $("favicon").href = team.logo;
}

/* ====================== shared bits ====================== */
function fmt(date, opts) { return new Intl.DateTimeFormat("en-US", { timeZone: TZ, ...opts }).format(new Date(date)); }
function when(g, long = false) {
  const day = fmt(g.date, long ? { weekday: "long", month: "long", day: "numeric" } : { weekday: "short", month: "short", day: "numeric" });
  return g.timeValid ? `${day} · ${fmt(g.date, { hour: "numeric", minute: "2-digit" })} ET` : `${day} · TBD`;
}
function holiday(g) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "numeric", day: "numeric", weekday: "short" }).formatToParts(new Date(g.date)).map((x) => [x.type, x.value]));
  if (p.month === "11" && p.weekday === "Thu" && +p.day >= 22 && +p.day <= 28) return "THANKSGIVING";
  if (p.month === "12" && p.day === "25") return "CHRISTMAS";
  return null;
}
const nextGame = (games) => games.find((g) => g.state === "in") ?? games.find((g) => g.state === "pre") ?? null;
const scoreLine = (g) => `${g.us.score}–${g.them.score}${g.overtime ? " OT" : ""}`;

function wireSeg(id, attr, onPick) {
  $(id).addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    for (const x of $(id).querySelectorAll("button")) x.setAttribute("aria-selected", String(x === b));
    onPick(b.dataset[attr]);
  });
}

/* ====================== view counter ====================== */
async function trackViews(page) {
  const flag = `viewed-${page}`;
  let counted = false;
  try { counted = sessionStorage.getItem(flag) === "1"; } catch {}
  try {
    const res = await fetch(`/api/views?page=${encodeURIComponent(page)}`, { method: counted ? "GET" : "POST" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const v = await res.json();
    try { sessionStorage.setItem(flag, "1"); } catch {}
    for (const [id, val] of [["vToday", v.today], ["vWeek", v.week], ["vTotal", v.total]]) {
      const el = $(id);
      el.classList.remove("sk", "sk-num");
      el.textContent = Number(val ?? 0).toLocaleString();
    }
  } catch (err) {
    console.warn("view counter unavailable", err);
    $("views").hidden = true;
  }
}

/* ====================== home page ====================== */
const recordHtml = (t) => `${esc(t.record ?? "")}${t.seed && t.seed <= 7 ? `<i class="tc-seed">#${t.seed}</i>` : ""}`;

async function renderHome() {
  $("homeView").hidden = false;
  const league = $("league");
  // Teams, colors and divisions are static, so the full grid renders immediately;
  // only the records wait for the network.
  league.innerHTML = ["AFC", "NFC"].map((conf) => `
    <section class="conf">
      <h2>${conf}</h2>
      <div class="divs">${LEAGUE.filter((d) => d.conf === conf).map((d) => `
        <div class="div" data-div="${esc(d.name)}">
          <h3>${esc(d.name.replace(`${conf} `, ""))}</h3>
          ${d.teams.map((t) => {
            const p = teamPalette(t.color, t.alt, t.abbr);
            return `
            <a class="team-card" data-abbr="${esc(t.abbr)}" href="/${esc(t.slug)}" style="--c:${p.base.join(",")};--h:${p.hi.join(",")}">
              <img src="${esc(t.logo)}" alt="" width="44" height="44">
              <span class="tc-name"><small>${esc(t.location)}</small>${esc(t.nickname)}</span>
              <span class="tc-rec"><span class="sk sk-rec"></span></span>
            </a>`;
          }).join("")}
        </div>`).join("")}
      </div>
    </section>`).join("");

  try {
    const res = await fetch("/api/teams");
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    league.classList.add("settled"); // entrance animation done; don't replay it on moves
    for (const c of data.conferences) {
      for (const d of c.divisions) {
        const box = league.querySelector(`[data-div="${CSS.escape(d.name)}"]`);
        for (const t of d.teams) {
          const rec = league.querySelector(`[data-abbr="${CSS.escape(t.abbr)}"] .tc-rec`);
          if (!rec) continue;
          rec.innerHTML = recordHtml(t);
          rec.classList.add("in");
        }
        // Follow the live standings order within each division, moving cards only if it changed.
        if (!box) continue;
        const current = [...box.querySelectorAll(".team-card")].map((el) => el.dataset.abbr).join();
        if (current !== d.teams.map((t) => t.abbr).join()) {
          for (const t of d.teams) {
            const card = box.querySelector(`[data-abbr="${CSS.escape(t.abbr)}"]`);
            if (card) box.appendChild(card);
          }
        }
      }
    }
  } catch (err) {
    console.warn("records unavailable", err);
    for (const el of league.querySelectorAll(".tc-rec")) el.textContent = "";
  }
}

/** Brand the page for a team: from the static list before data arrives, then from the API. */
function brandTeam(t) {
  applyTheme(t);
  document.title = `${t.name} · NFL Fan Hub`;
  $("brandLogo").src = t.logo;
  $("brandLogo").hidden = false;
  $("brandText").innerHTML = `${esc(t.nickname.toUpperCase())}<b> HUB</b>`;
  $("grit").textContent = `GO ${t.nickname.toUpperCase()}`;
  if (t.division) $("tabDivision").textContent = t.division;
  if (t.conf) $("tabConference").textContent = t.conf;
}

/* ====================== team page ====================== */
let data = null;
let schedFilter = "all";
let standTab = "division";
let countdownTimer = null;
let centeredOn = null;

const isUs = (abbr) => abbr === data.team.abbr;

function renderHero() {
  const { team, season } = data;
  const s = team.stats;
  $("seasonLabel").textContent = `${season.year ?? ""} ${season.name ?? ""} · ${team.name}`;
  $("record").textContent = s.ties ? `${s.wins}-${s.losses}-${s.ties}` : `${s.wins}-${s.losses}`;
  $("standingSummary").textContent = team.standingSummary ?? "";
  const diff = s.diffNum;
  const chips = [
    s.seed ? [`${team.conf} Seed`, `#${s.seed}`] : null,
    ["NFL Rank", `#${team.leagueRank}`],
    s.streak ? ["Streak", s.streak] : null,
    ["Point Diff", `${diff > 0 ? "+" : ""}${diff}`],
    ["Home", s.home],
    ["Road", s.road],
  ].filter(Boolean);
  $("chips").innerHTML = chips.map(([k, v]) => `<span class="chip">${esc(k)} <b>${esc(v)}</b></span>`).join("");
}

function renderNext() {
  const g = nextGame(data.games);
  const el = $("nextGame");
  clearInterval(countdownTimer);
  if (!g) {
    el.innerHTML = `<div class="next-label"><span>Season complete</span></div><p style="margin-top:18px;color:var(--silver)">No upcoming games on the schedule. See you next season.</p>`;
    return;
  }
  const live = g.state === "in";
  const home = g.home ? g.us : g.them;
  const away = g.home ? g.them : g.us;
  const side = (t) => `
    <a class="side" href="/${esc(t.slug ?? "")}">
      <img src="${esc(t.logo)}" alt="${esc(t.name)}" width="76" height="76">
      <div class="nm">${esc(t.short)}</div>
      ${live ? `<div class="sc">${t.score ?? 0}</div>` : `<div class="rc">${esc(t.record ?? "")}</div>`}
    </a>`;
  const hol = holiday(g);
  const tags = [
    live ? `<span class="tag live">● LIVE</span>` : "",
    hol ? `<span class="tag holiday">${hol}</span>` : "",
    g.division ? `<span class="tag">DIVISION</span>` : "",
  ].join(" ");
  el.innerHTML = `
    <div class="next-label"><span>${live ? "Game on" : "Next up"} · Week ${g.week}</span><span>${tags}</span></div>
    <div class="matchup">${side(away)}<div class="vs">${live ? "–" : "@"}</div>${side(home)}</div>
    ${live ? `<div class="next-meta"><span>${esc(g.statusDetail)}</span></div>` : `<div class="countdown" id="countdown"></div>`}
    <div class="next-meta">
      <span>${esc(when(g, true))}</span>
      ${g.tv.length ? `<span>${esc(g.tv.join(" / "))}</span>` : ""}
      ${g.venue ? `<span>${esc(g.venue.name)}</span>` : ""}
    </div>`;
  if (!live) {
    const tick = () => {
      const ms = Math.max(0, new Date(g.date) - Date.now());
      const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1e3) % 60;
      const cd = $("countdown");
      if (!cd) return;
      cd.innerHTML = [[d, "Days"], [h, "Hrs"], [m, "Min"], [s, "Sec"]].map(([v, l]) => `<div><b>${String(v).padStart(2, "0")}</b><span>${l}</span></div>`).join("");
      if (ms === 0) { clearInterval(countdownTimer); loadTeam(); }
    };
    tick();
    countdownTimer = setInterval(tick, 1000);
  }
}

function weeksWithBye() {
  const byWeek = new Map(data.games.map((g) => [g.week, g]));
  const last = Math.max(...data.games.map((g) => g.week), data.team.byeWeek ?? 0);
  const out = [];
  for (let w = 1; w <= last; w++) out.push(byWeek.get(w) ?? { week: w, bye: true });
  return out;
}

function centerJourney() {
  const j = $("journey");
  if (j.scrollWidth <= j.clientWidth) return;
  const target = $("journeyTrack").querySelector(".next-up") ?? $("journeyTrack").lastElementChild;
  if (!target) return;
  const tile = target.closest(".wk") ?? target;
  const offset = tile.getBoundingClientRect().left - j.getBoundingClientRect().left + j.scrollLeft;
  j.scrollLeft = Math.max(0, offset + tile.offsetWidth / 2 - j.clientWidth / 2);
}
let lastWidth = innerWidth;
addEventListener("resize", () => { if (data && Math.abs(innerWidth - lastWidth) > 40) { lastWidth = innerWidth; centerJourney(); } });

function renderJourney() {
  const weeks = weeksWithBye();
  const next = nextGame(data.games);
  const margins = data.games.filter((g) => g.result).map((g) => Math.abs(g.us.score - g.them.score));
  const max = Math.max(14, ...margins);
  let w = 0, l = 0, t = 0;
  $("journeyTrack").innerHTML = weeks.map((g) => {
    if (g.bye) return `<div class="wk"><div class="bar-zone"></div><div class="tile bye"><span class="w">WK ${g.week}</span><span class="res">BYE</span></div><div class="bar-zone below"></div><div class="run">&nbsp;</div></div>`;
    const m = g.result ? g.us.score - g.them.score : 0;
    if (g.result === "W") w++; else if (g.result === "L") l++; else if (g.result === "T") t++;
    const h = Math.round((Math.abs(m) / max) * 100);
    const cls = g.result === "W" ? "win" : g.result === "L" ? "loss" : g.state === "in" ? "live" : "pre";
    const up = g.result === "W" ? `<div class="bar" style="height:${h}px"><span class="bar-num">+${m}</span></div>` : "";
    const down = g.result === "L" ? `<div class="bar loss" style="height:${h}px"><span class="bar-num">${m}</span></div>` : "";
    const res = g.result ? `${g.result} ${g.us.score}–${g.them.score}` : g.state === "in" ? `${g.us.score}–${g.them.score}` : fmt(g.date, { month: "numeric", day: "numeric" });
    const title = `Week ${g.week}: ${g.home ? "vs" : "@"} ${g.them.name}${g.result ? ` — ${g.result} ${scoreLine(g)}` : ` — ${when(g)}`}`;
    return `
      <a class="wk" href="${esc(g.link)}" target="_blank" rel="noopener" title="${esc(title)}">
        <div class="bar-zone">${up}</div>
        <div class="tile ${cls} ${next && next.id === g.id ? "next-up" : ""}">
          <span class="w">WK ${g.week}${g.overtime ? " · OT" : ""}</span>
          <img src="${esc(g.them.logo)}" alt="" width="34" height="34" loading="lazy">
          <span class="at">${g.home ? "vs" : "@"} ${esc(g.them.abbr)}</span>
          <span class="res">${esc(res)}</span>
        </div>
        <div class="bar-zone below">${down}</div>
        <div class="run">${g.result ? (t ? `${w}-${l}-${t}` : `${w}-${l}`) : "&nbsp;"}</div>
      </a>`;
  }).join("");

  const focusId = next?.id ?? "end";
  if (focusId !== centeredOn) { centeredOn = focusId; setTimeout(centerJourney, 0); }

  const s = data.team.stats;
  const played = data.games.filter((g) => g.result);
  const stats = [
    ["Points For", s.pf],
    ["Points Against", s.pa],
    ["Pts / Game", played.length ? (s.pf / played.length).toFixed(1) : "–"],
    ["Allowed / Game", played.length ? (s.pa / played.length).toFixed(1) : "–"],
    ["Division", s.div ?? "–"],
    ["Games Left", data.games.filter((g) => !g.result).length],
  ];
  $("seasonStats").innerHTML = stats.map(([k, v]) => `<div class="stat"><span>${k}</span><b>${esc(v)}</b></div>`).join("");
}

function renderSchedule() {
  const next = nextGame(data.games);
  const rows = weeksWithBye().filter((g) => {
    if (g.bye) return schedFilter === "all";
    if (schedFilter === "home") return g.home;
    if (schedFilter === "away") return !g.home;
    if (schedFilter === "div") return g.division;
    return true;
  });
  $("games").innerHTML = rows.map((g) => {
    if (g.bye) return `<div class="game bye"><div class="wkcol"><small>WEEK</small><b>${g.week}</b></div><div class="opp"><div class="t"><div class="n">Bye week</div><div class="d">Rest up.</div></div></div></div>`;
    const cls = g.result === "W" ? "win" : g.result === "L" ? "loss" : "";
    const hol = holiday(g);
    const pills = [
      g.division ? `<span class="pill div">DIV</span>` : "",
      hol ? `<span class="pill">${hol === "THANKSGIVING" ? "TURKEY DAY" : hol}</span>` : "",
      g.neutral ? `<span class="pill">INTL</span>` : "",
    ].join("");
    const venue = g.venue ? `${g.venue.name}${g.venue.city ? `, ${g.venue.city}` : ""}` : "";
    const out = g.result
      ? `<div class="r">${g.result} ${esc(scoreLine(g))}</div><div class="s">${esc(g.them.record ?? "")}</div>`
      : g.state === "in"
        ? `<div class="r">${g.us.score}–${g.them.score}</div><div class="s"><span class="tag live">LIVE</span> ${esc(g.statusDetail)}</div>`
        : `<div class="r" style="font-size:16px">${g.timeValid ? fmt(g.date, { hour: "numeric", minute: "2-digit" }) : "TBD"}</div><div class="s">${esc(g.tv.join(" / ") || g.them.record || "")}</div>`;
    return `
      <a class="game ${cls} ${next && next.id === g.id ? "next-up" : ""}" href="${esc(g.link)}" target="_blank" rel="noopener">
        <div class="wkcol"><small>WEEK</small><b>${g.week}</b></div>
        <div class="opp">
          <img src="${esc(g.them.logo)}" alt="" width="40" height="40" loading="lazy">
          <div class="t">
            <div class="n"><em>${g.home || g.neutral ? "vs" : "@"}</em>${esc(g.them.name)}${pills}</div>
            <div class="d">${esc(`${fmt(g.date, { weekday: "short", month: "short", day: "numeric" })} · ${venue}`)}</div>
          </div>
        </div>
        <div class="out">${out}</div>
      </a>`;
  }).join("");
}

const teamCell = (t, extra = "") => `<a class="tm" href="/${esc(t.slug)}"><img src="${esc(t.logo)}" alt="" width="26" height="26" loading="lazy"><span class="full">${esc(t.name)}</span><span class="ab">${esc(t.abbr)}</span>${extra}</a>`;
const diffCell = (t) => `<td class="${t.diffNum > 0 ? "pos" : t.diffNum < 0 ? "neg" : ""}">${t.diffNum > 0 ? "+" : ""}${t.diffNum}</td>`;
const strk = (t, cls = "") => `<td class="${cls} strk-${esc((t.streak ?? "")[0])}">${esc(t.streak ?? "")}</td>`;

function renderStandings() {
  const st = data.standings;
  const conf = data.team.conf;
  let head, body, note = "";
  if (standTab === "division") {
    head = `<th></th><th class="l">Team</th><th>W</th><th>L</th><th class="hide-sm">T</th><th>PCT</th><th>GB</th><th class="hide-sm">Home</th><th class="hide-sm">Road</th><th>Div</th><th class="hide-sm">Conf</th><th class="hide-sm">PF</th><th class="hide-sm">PA</th><th>Diff</th><th class="hide-sm">Strk</th>`;
    body = st.division.map((t, i) => `
      <tr class="${isUs(t.abbr) ? "det" : ""}">
        <td class="rk">${i + 1}</td><td class="l">${teamCell(t)}</td>
        <td class="wl">${t.wins}</td><td class="wl">${t.losses}</td><td class="hide-sm">${t.ties}</td><td>${esc(t.pct)}</td><td>${esc(t.gb)}</td>
        <td class="hide-sm">${esc(t.home)}</td><td class="hide-sm">${esc(t.road)}</td><td>${esc(t.div)}</td><td class="hide-sm">${esc(t.confRec)}</td>
        <td class="hide-sm">${t.pf}</td><td class="hide-sm">${t.pa}</td>${diffCell(t)}${strk(t, "hide-sm")}
      </tr>`).join("");
  } else if (standTab === "conference") {
    head = `<th>Seed</th><th class="l">Team</th><th>W</th><th>L</th><th class="hide-sm">T</th><th>PCT</th><th class="hide-sm">Div</th><th>Conf</th><th class="hide-sm">PF</th><th class="hide-sm">PA</th><th>Diff</th><th>Strk</th>`;
    body = st.conference.map((t) => {
      const seedCls = t.seed && t.seed <= 4 ? "div" : t.seed && t.seed <= 7 ? "wc" : "";
      return `
      <tr class="${isUs(t.abbr) ? "det" : ""} ${t.seed === 7 ? "cut" : ""}">
        <td class="rk"><span class="seed-badge ${seedCls}">${t.seed ?? "–"}</span></td><td class="l">${teamCell(t)}</td>
        <td class="wl">${t.wins}</td><td class="wl">${t.losses}</td><td class="hide-sm">${t.ties}</td><td>${esc(t.pct)}</td>
        <td class="hide-sm">${esc(t.div)}</td><td>${esc(t.confRec)}</td><td class="hide-sm">${t.pf}</td><td class="hide-sm">${t.pa}</td>${diffCell(t)}${strk(t)}
      </tr>`;
    }).join("");
    note = `${conf} seeds 1–4 are division leaders; 5–7 are wild cards. Dashed line = playoff cut. Seed 1 gets the only first-round bye.`;
  } else {
    head = `<th>#</th><th class="l">Team</th><th>W</th><th>L</th><th class="hide-sm">T</th><th>PCT</th><th class="hide-sm">PF</th><th class="hide-sm">PA</th><th>Diff</th><th>Strk</th>`;
    body = st.league.map((t, i) => `
      <tr class="${isUs(t.abbr) ? "det" : ""}">
        <td class="rk">${i + 1}</td><td class="l">${teamCell(t, `<span class="conf-tag">${esc(t.conf)}</span>`)}</td>
        <td class="wl">${t.wins}</td><td class="wl">${t.losses}</td><td class="hide-sm">${t.ties}</td><td>${esc(t.pct)}</td>
        <td class="hide-sm">${t.pf}</td><td class="hide-sm">${t.pa}</td>${diffCell(t)}${strk(t)}
      </tr>`).join("");
    note = "League-wide ranking by win percentage, then point differential (not official tiebreakers).";
  }
  $("standingsTable").innerHTML = `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  $("standNote").textContent = note;
}

function renderSkeletons() {
  const heights = [40, 70, 25, 0, 55, 0, 20, 30, 50, 80, 45, 0, 0, 0, 0, 0, 0, 0, 0];
  $("journeyTrack").innerHTML = heights.map((h) => `
    <div class="wk">
      <div class="bar-zone">${h ? `<div class="sk sk-bar" style="height:${h}px;display:block"></div>` : ""}</div>
      <div class="tile sk-tile"><span class="sk sk-text" style="width:60%"></span><span class="sk sk-logo"></span><span class="sk sk-text" style="width:70%"></span><span class="sk sk-text" style="width:80%;height:13px"></span></div>
      <div class="bar-zone below"></div><div class="run">&nbsp;</div>
    </div>`).join("");
  $("seasonStats").innerHTML = Array.from({ length: 6 }, () => `<div class="stat"><span class="sk sk-text" style="width:60%"></span><span class="sk sk-text" style="width:40%;height:22px;margin-top:10px"></span></div>`).join("");
  $("games").innerHTML = Array.from({ length: 8 }, () => `
    <div class="game sk-game">
      <div class="wkcol"><span class="sk sk-text" style="width:70%;margin:0 auto 6px"></span><span class="sk" style="width:26px;height:24px"></span></div>
      <div class="opp"><span class="sk" style="width:40px;height:40px;border-radius:50%;flex:none"></span><div class="t" style="flex:1"><span class="sk sk-text" style="width:70%;height:13px"></span><span class="sk sk-text" style="width:50%;margin-top:8px"></span></div></div>
      <div class="out"><span class="sk" style="width:70px;height:22px"></span></div>
    </div>`).join("");
  $("standingsTable").innerHTML = `<table><tbody>${Array.from({ length: 4 }, () => `<tr><td class="rk"><span class="sk" style="width:22px;height:22px"></span></td><td class="l"><div class="tm"><span class="sk" style="width:26px;height:26px;border-radius:50%"></span><span class="sk sk-text" style="width:150px;height:12px"></span></div></td>${'<td><span class="sk sk-text" style="width:32px;margin-left:auto"></span></td>'.repeat(5)}</tr>`).join("")}</tbody></table>`;
}

let refreshTimer = null;
let themed = false;
async function loadTeam() {
  try {
    const res = await fetch(`/api/team/${encodeURIComponent(slug)}`, { cache: "no-cache" });
    if (res.status === 404) return showNotFound();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
    if (data.error) throw new Error(data.error);
    if (!themed) {
      themed = true;
      if (data.team.slug !== slug) history.replaceState(null, "", `/${data.team.slug}${location.hash}`);
      brandTeam(data.team);
      trackViews(data.team.slug);
    }
    $("record").removeAttribute("aria-busy");
    renderHero();
    renderNext();
    renderJourney();
    renderSchedule();
    renderStandings();
    $("updated").textContent = ` · updated ${new Date(data.updated).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  } catch (err) {
    console.error(err);
    if (!data) $("games").innerHTML = `<div class="error">Couldn't load team data right now (${esc(err.message)}). Retrying shortly…</div>`;
  }
  clearTimeout(refreshTimer);
  const live = data?.games?.some((g) => g.state === "in");
  refreshTimer = setTimeout(loadTeam, live ? 20_000 : 120_000);
}

function showNotFound() {
  $("teamView").hidden = true;
  $("teamNav").hidden = true;
  $("notFound").hidden = false;
  $("views").hidden = true;
}

/* ====================== boot ====================== */
if (!slug) {
  renderHome();
  trackViews("home");
} else {
  $("teamView").hidden = false;
  $("teamNav").hidden = false;
  wireSeg("schedFilter", "f", (f) => { schedFilter = f; renderSchedule(); });
  wireSeg("standTabs", "t", (t) => { standTab = t; renderStandings(); });
  // Theme the skeleton in the team's colors right away when we know the team.
  const known = LEAGUE.flatMap((d) => d.teams.map((t) => ({ ...t, conf: d.conf, division: d.name })))
    .find((t) => t.slug === slug || t.abbr.toLowerCase() === slug);
  if (known) brandTeam(known);
  renderSkeletons();
  loadTeam();
}
