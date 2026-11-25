import type { Config } from "@netlify/functions";
import { LEAGUE } from "../../public/league.js";

const SLUGS: string[] = LEAGUE.flatMap((d) => d.teams.map((t) => t.slug));

// GET /random: redirect to a random team. Never cached, so every visit is a fresh pick.
export default async () =>
  new Response(null, {
    status: 302,
    headers: {
      Location: `/${SLUGS[Math.floor(Math.random() * SLUGS.length)]}`,
      "Cache-Control": "no-store",
    },
  });

export const config: Config = { path: "/random" };
