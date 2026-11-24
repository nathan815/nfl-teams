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

Hosted on Netlify (project `nathancj-nfl`, https://nathancj-nfl.netlify.app), custom domain nfl.nathancj.com via a Cloudflare CNAME `nfl` → `nathancj-nfl.netlify.app` (DNS only). Deploys are currently CLI uploads; always deploy with the project ID so it can't land on another linked project:

```bash
netlify deploy --prod --site c5c136e4-1e5b-4840-9b9f-514500684225
```

Next: connect the Netlify project to this repo for git deploys, Cloudflare Web Analytics, redirect lions.nathancj.com → nfl.nathancj.com/lions, then live game-day features.
