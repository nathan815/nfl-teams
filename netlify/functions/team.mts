import type { Config, Context } from "@netlify/functions";
import { getTeamPage, jsonResponse } from "./_shared/espn.mts";

// GET /api/team/:team  (team = slug like "lions" or abbreviation like "det")
export default async (_req: Request, context: Context) => {
  try {
    const page = await getTeamPage(context.params.team ?? "");
    if (!page) return jsonResponse({ error: "unknown team" }, 0, 404);
    return jsonResponse(page, 60);
  } catch (err) {
    return jsonResponse({ error: String(err) }, 0, 502);
  }
};

export const config: Config = { path: "/api/team/:team" };
