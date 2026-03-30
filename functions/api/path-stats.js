/**
 * Cloudflare Pages Function
 * Secure proxy for 360Learning API calls
 * Endpoint: GET /api/path-stats?pathId=XXX
 */

export async function onRequestGet({ request, env }) {
  // 1. Read query parameter
  const url = new URL(request.url);
  const pathId = url.searchParams.get("pathId");

  if (!pathId) {
    return Response.json({ error: "pathId is required" }, { status: 400 });
  }

  try {
    // 2. Fetch OAuth token using client_credentials flow
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
      console.error(
        "OAuth token fetch failed:",
        tokenRes.status,
        tokenRes.statusText
      );
      return Response.json(
        { error: "Failed to authenticate with 360Learning" },
        { status: 502 }
      );
    }

    const tokenBody = await tokenRes.json();
    const accessToken = tokenBody.access_token;

    // 3. Fetch path stats filtered by pathId
    const statsRes = await fetch(
      `https://app.360learning.com/api/v2/paths/stats?pathId[in][0]=${encodeURIComponent(pathId)}&limit=200`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "360-api-version": "v2.0",
          "accept": "application/json",
        },
      }
    );

    if (!statsRes.ok) {
      console.error(
        "Path stats fetch failed:",
        statsRes.status,
        statsRes.statusText
      );
      return Response.json(
        {
          error: "Failed to fetch path stats",
          detail: statsRes.statusText,
        },
        { status: 502 }
      );
    }

    const body = await statsRes.json();

    // 4. Normalise response data
    // Handle both array and paginated object responses
    const allRecords = Array.isArray(body) ? body : body.data ?? [];

    // 5. Filter for completed learners and normalise fields
    const completedLearners = allRecords
      .filter((record) => record.status === "completed")
      .map((record) => {
        // Normalise name field (multiple possible variations)
        let name;
        if (record.firstName && record.lastName) {
          name = `${record.firstName} ${record.lastName}`;
        } else if (record.name) {
          name = record.name;
        } else if (record.fullName) {
          name = record.fullName;
        } else if (record.email || record.mail) {
          name = record.email || record.mail;
        } else {
          name = "Unknown";
        }

        // Normalise email field
        const email = record.email || record.mail || "";

        // Normalise completion date field
        const completedAt = record.completedAt || record.completionDate || null;

        // Include score if present
        const score = record.score ?? null;

        return { name, email, completedAt, score };
      })
      // Sort alphabetically by name
      .sort((a, b) => a.name.localeCompare(b.name));

    // 6. Check if any learner has a score (to determine if we should show score column)
    const hasScores = completedLearners.some((l) => l.score !== null);

    // 7. Return response
    return Response.json({
      learners: completedLearners,
      total: completedLearners.length,
      hasScores: hasScores,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Unexpected error in path-stats function:", error);
    return Response.json(
      {
        error: "An unexpected error occurred",
        detail: error.message,
      },
      { status: 500 }
    );
  }
}
