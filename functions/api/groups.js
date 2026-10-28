/**
 * Cloudflare Pages Function
 * Finds the Self Study / Mentor Led groups (and any subgroups) in 360Learning.
 * Endpoint: GET /api/groups
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

    const groups = [];
    let next = "https://app.360learning.com/api/v2/groups";
    for (let page = 0; next && page < 40; page++) {
      const res = await fetch(next, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "360-api-version": "v2.0",
          accept: "application/json",
        },
      });

      if (!res.ok) {
        console.error("Groups fetch failed:", res.status, res.statusText);
        return Response.json(
          {
            error: "Failed to fetch groups",
            status: res.status,
            detail: await res.text(),
          },
          { status: 502 }
        );
      }

      const body = await res.json();
      groups.push(...(Array.isArray(body) ? body : body.data ?? []));

      const match = (res.headers.get("Link") || "").match(/<([^>]+)>;\s*rel="next"/);
      next = match ? new URL(match[1], "https://app.360learning.com").href : null;
    }

    // Matching groups plus every descendant (membership in a parent group
    // doesn't necessarily include its subgroups)
    const wanted = new Set(
      groups
        .filter((g) => /self[\s-]*study|mentor[\s-]*led/i.test(g.name || ""))
        .map((g) => g._id)
    );
    let grew = true;
    while (grew) {
      grew = false;
      for (const g of groups) {
        if (!wanted.has(g._id) && wanted.has(g.parentId)) {
          wanted.add(g._id);
          grew = true;
        }
      }
    }

    const matched = groups
      .filter((g) => wanted.has(g._id))
      .map((g) => ({ id: g._id, name: g.name, parentId: g.parentId ?? null }));

    return Response.json({ totalGroups: groups.length, matched });
  } catch (error) {
    console.error("Unexpected error in groups function:", error);
    return Response.json(
      { error: "An unexpected error occurred", detail: error.message },
      { status: 500 }
    );
  }
}
