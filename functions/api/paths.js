/**
 * Cloudflare Pages Function
 * Lists all paths from 360Learning (follows pagination) so path/subpath IDs can be found.
 * Endpoint: GET /api/paths
 */

export async function onRequestGet({ env }) {
  try {
    const tokenRes = await fetch(
      "https://app.360learning.com/api/v2/oauth2/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "client_credentials",
          client_id: env.CLIENT_ID,
          client_secret: env.CLIENT_SECRET,
        }),
      }
    );

    if (!tokenRes.ok) {
      console.error("OAuth token fetch failed:", tokenRes.status);
      return Response.json(
        { error: "Failed to authenticate with 360Learning" },
        { status: 502 }
      );
    }

    const { access_token: accessToken } = await tokenRes.json();

    const paths = [];
    let next = "https://app.360learning.com/api/v2/paths";
    // Stay well under Cloudflare's 50-subrequest cap (1 used for the token)
    for (let page = 0; next && page < 40; page++) {
      const res = await fetch(next, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "360-api-version": "v2.0",
          accept: "application/json",
        },
      });

      if (!res.ok) {
        console.error("Paths fetch failed:", res.status, res.statusText);
        return Response.json(
          {
            error: "Failed to fetch paths",
            status: res.status,
            detail: await res.text(),
          },
          { status: 502 }
        );
      }

      const body = await res.json();
      paths.push(...(Array.isArray(body) ? body : body.data ?? []));

      // Link: <url>; rel="next" (only present when another page exists)
      const match = (res.headers.get("Link") || "").match(/<([^>]+)>;\s*rel="next"/);
      next = match ? new URL(match[1], "https://app.360learning.com").href : null;
    }

    // Trim to what's needed to map paths -> subpaths (full records carry up to 300 steps each)
    const summary = paths.map((p) => ({
      id: p._id,
      name: p.name,
      status: p.status,
      stepCount: (p.steps || []).length,
      pathSteps: (p.steps || []).filter((s) => s.type === "path"),
    }));

    return Response.json({ total: summary.length, paths: summary });
  } catch (error) {
    console.error("Unexpected error in paths function:", error);
    return Response.json(
      { error: "An unexpected error occurred", detail: error.message },
      { status: 500 }
    );
  }
}
