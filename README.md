# NFL Fan Hub

Unofficial fan site for every NFL team: schedule, results and standings at `nfl.nathancj.com/<team>` (e.g. `/lions`, `/49ers`). Grew out of [nathan815/lions](https://github.com/nathan815/lions) (lions.nathancj.com).

- `public/` – static site (HTML/CSS/JS, no build step). One page handles both the home grid (`/`) and team pages (`/<slug>`); `/det`-style abbreviations are rewritten to the slug. Each team page is themed from the team's ESPN colors, with contrast guards for dark/grey primaries.
- `netlify/functions/_shared/espn.mts` – ESPN public API layer (teams, division/conference standings, per-team schedule)
- `netlify/functions/team.mts` – `/api/team/:team`, CDN-cached ~60s per team
- `netlify/functions/teams.mts` – `/api/teams`, all 32 teams by division with records, cached ~5 min
- `netlify/functions/views.mts` – `/api/views?page=<home|slug>`, per-page view counter (today / week / total) in Netlify Blobs

```bash
npm install
netlify dev            # local dev on :8891
```

Not deployed yet. Plan: Netlify project `nathancj-nfl` connected to this repo, Cloudflare CNAME `nfl` → `nathancj-nfl.netlify.app` (DNS only), then redirect lions.nathancj.com → nfl.nathancj.com/lions. Live game-day features come after that.
