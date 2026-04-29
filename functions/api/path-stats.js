/**
 * Cloudflare Pages Function
 * Secure proxy for 360Learning API calls
 * Endpoint: GET /api/path-stats?pathId=XXX
 */

export async function onRequestGet({ request, env }) {
  // 1. Read query parameters
  const url = new URL(request.url);
  const pathId = url.searchParams.get("pathId");
  const sessionIdsParam = url.searchParams.get("sessionIds");

  // Parse sessionIds (comma-separated or pipe-separated)
  const allowedSessionIds = sessionIdsParam
    ? sessionIdsParam.split(/[,|]/).map((id) => id.trim())
    : null;

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
    // API requires pathId[in][0] format; brackets must not be encoded
    const url = `https://app.360learning.com/api/v2/paths/stats?pathId[in][0]=${pathId}`;
    const statsRes = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "360-api-version": "v2.0",
        "accept": "application/json",
      },
    });

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

    // 4. Response is an array of path stats records
    const allRecords = Array.isArray(body) ? body : body.data ?? [];

    // 5. Filter for learners with successful status (and optional sessionIds)
    const completedRecords = allRecords.filter((record) => {
      const hasSuccessfulStatus =
        record.status && record.status.type === "successful";
      const hasCorrectSession = !allowedSessionIds
        ? true
        : allowedSessionIds.includes(record.sessionId);
      return hasSuccessfulStatus && hasCorrectSession;
    });

    // 6. Fetch user details for each completed learner to get names
    const completedLearners = await Promise.all(
      completedRecords.map(async (record) => {
        try {
          // Fetch user details to get firstName/lastName
          const userRes = await fetch(
            `https://app.360learning.com/api/v2/users/${record.userId}`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "360-api-version": "v2.0",
                "accept": "application/json",
              },
            }
          );

          let name = "Unknown";
          let email = "";

          if (userRes.ok) {
            const userData = await userRes.json();
            if (userData.firstName && userData.lastName) {
              name = `${userData.firstName} ${userData.lastName}`;
            } else {
              console.warn(
                `User ${record.userId} fetch ok but missing name fields. Keys: ${Object.keys(
                  userData
                ).join(",")} | firstName=${JSON.stringify(
                  userData.firstName
                )} lastName=${JSON.stringify(userData.lastName)}`
              );
            }
            email = userData.mail || userData.email || "";
          } else {
            console.warn(
              `User ${record.userId} fetch failed: status=${userRes.status} ${userRes.statusText}`
            );
          }

          return {
            name,
            email,
            completedAt: record.completedAt,
            score: record.score ?? null,
            sessionId: record.sessionId,
          };
        } catch (error) {
          console.error(`Failed to fetch user ${record.userId}:`, error.message);
          return {
            name: "Unknown",
            email: "",
            completedAt: record.completedAt,
            score: record.score ?? null,
            sessionId: record.sessionId,
          };
        }
      })
    );

    const unknownCount = completedLearners.filter((l) => l.name === "Unknown").length;
    if (unknownCount > 0) {
      console.warn(
        `path-stats: ${unknownCount}/${completedLearners.length} learners came back as Unknown for pathId=${pathId}`
      );
    }

    // 7. Sort alphabetically by name
    completedLearners.sort((a, b) => a.name.localeCompare(b.name));

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
