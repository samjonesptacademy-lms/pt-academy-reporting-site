/**
 * Cloudflare Pages Function
 * Data feed for the "no progress" report: Self Study / Mentor Led learners and
 * their activity in the in-scope paths (and sub paths), for migration to the new LXP.
 *
 * GET /api/no-progress?key=XXX&mode=learners
 *     -> learners in the two groups, with names/emails
 * GET /api/no-progress?key=XXX&mode=stats[&cursor=URL]
 *     -> path stats reduced per user for up to MAX_PAGES pages, plus `next`
 *        (the cursor for the following call, null when finished). The full
 *        result is too big for one invocation (Cloudflare's 50-subrequest cap),
 *        so the caller loops and merges.
 *
 * Returns learner names and emails, so it is gated by a key (only its SHA-256
 * hash lives in this file).
 */

const KEY_SHA256 = "137ad5b6a6c4e462a9bbf2bb3e42139cc6dba55a2766dfd5b7c066ad9b839fca";

// Learner groups in scope (no subgroups exist under either)
const GROUP_IDS = {
  "68c17a87e28fda43591558f4": "Self Study",
  "68c1829f0cbde61fa2e0943a": "Mentor Led",
};

// Level 2 / Level 3 / Level 3 Diploma paths and every sub path beneath them,
// as ticked in 360-paths-selection.xlsx (125 distinct paths)
const PATH_IDS = [
  "683870d4260fd5d3514fd2dc",
  "68387117d42f0bad6d0f0568",
  "68387263281239c9a420bf1c",
  "6838728acab6fa5d88d7700c",
  "687a24e210387d2a6dbabb4d",
  "687a69708be7aee0cadd59d1",
  "687e1f8bc5a860ddf7f268bd",
  "687e2f10c58a1d8a72b34729",
  "687e6055019a68b193020a16",
  "687e606df3abea8c9a13e93e",
  "687e608523362540eab255fb",
  "687e60c2ab20843389266789",
  "687f7ab5d9d2bb4e9c35979b",
  "687f7add240ccb3dfc3c32c2",
  "687f7b05db6c40909d9cfafd",
  "687f7b261bf75021cebbcfb8",
  "687f7b629d7b9ca4dc3fc43a",
  "6880d80538962270c893a6ac",
  "6880e37a007bf81ce73a33df",
  "6882266302f65f0e35c46199",
  "68824dab01ad6fa8c66e4ae1",
  "68824dfc54b6e25ae57912b1",
  "688361b77240a88600e5cd69",
  "688361d38fd7f51542cac8f0",
  "688371bdb9144c1402a50e7c",
  "68873ed2e8ec98f46d317c52",
  "68875f9f3204292b2cc8f417",
  "688893f2a75bceee8ef0181c",
  "6888942e10dd57363cd4cb7e",
  "6888945a2a79722d386fe1d7",
  "68889473b8aa1861eaae40e5",
  "68889495ac01ad76aaaf0cd4",
  "6889f882960ae60ce813e0fc",
  "6889f8976b89e3388cd30b74",
  "6889f8c74283b1e0de791706",
  "6889f9201d53a47e2c583f36",
  "68960fc1d20317be278e0635",
  "68960ff9ebdb60da7f90b43f",
  "6896101fc43b308957767b11",
  "6899f808456d404b04a0add2",
  "68ad765428faf92fab08a2fc",
  "68ad768c6d241ce9ab44e357",
  "68ad76cc0f0bab4dd6e14874",
  "68c2a5693f1b4cdb81fc3be8",
  "68c3d6b4c9724de6fac2346f",
  "68c3d8c1ab3b1275d77f98a9",
  "68c439cb1077d56c08fc8850",
  "68cacf4f0ca8cfca6479f821",
  "68dbb8cae8dc2bafc065257f",
  "68dbc9e4754892c1e40cd13a",
  "68dbca2da848a163bac54b84",
  "68dbca9b5740fbbbe7964ef4",
  "68dbcac9b4c1806a563622cb",
  "68dbcafba5a15657a2d2bda7",
  "68dbcb1f539287ab92598116",
  "68dbcb4fb4edf51b7ff08ec2",
  "68dbd062319f263c76cb378c",
  "68dbd0953623b13b15e55435",
  "68ee0bbfe1346340498431b5",
  "68ee77ecc7e824a5314f95cb",
  "68ee78bed32c88d58683dc18",
  "68ee794a1d00d9f7a21e220f",
  "68ef6c85d1f6042ef55c0a15",
  "68ef89eb9e2ea666ed90a62a",
  "68ef8a449874e0e3a8d88021",
  "68f0e20a224dd8f5f05fdcf9",
  "68f12f5535eb57b2bf3200db",
  "68f5fc750c1d4a977c8d7709",
  "68f5fee258fc7575415944e9",
  "68f60b571692b345dfe9b069",
  "68f61c1cc0e75ac027465eaf",
  "68f62cb8a91883ef6ade3db8",
  "68f758187f0efdfc7a8019d5",
  "690c7a5d9b68cfee8f8fa59a",
  "6912fdda03712f538016f368",
  "6913016003712f538016f443",
  "6913048ee0885979be077630",
  "6913054f800999e987685621",
  "6913056ec4421bc560702549",
  "6913059bcead931137e9ebfb",
  "691305b7034ed97a7ea0642e",
  "691305d20f19d0599df31f68",
  "691307b83bd9260dd1424919",
  "691308b4abf2372e22c6c470",
  "691309096dc0a341731ca9e5",
  "6913094b1024f2e837dcb5f7",
  "691309aa806c99ebd25240d2",
  "69130abd56f8453f70d2aff5",
  "69130b04c96943b7fe96e513",
  "691315150f19d0599df32348",
  "69131555116bf5d590aed7b4",
  "6913158b0f19d0599df32364",
  "69135395b2fe9f4f81cb97da",
  "691353c6e0885979be078b51",
  "691353fbbdee8b321b4f733b",
  "691354252b2205a782b4d268",
  "6913555c0f19d0599df33355",
  "6913559de0885979be078c33",
  "691355eb0f19d0599df33380",
  "691356178700c179efe3c321",
  "69135665a06a6ce19c21f041",
  "691754a5d070e6f61887dc17",
  "691754d5d8657ee55e9dc151",
  "69175500d1ba299f271f6699",
  "6917552c7833c58641393af8",
  "69175551c94e979bb0ba03c8",
  "6917556fa21b35300d5d8573",
  "69175591bdee8b321b50d15e",
  "69175631180263cf991c0a8c",
  "69175653875205d6c4e38287",
  "69175677392629b383795ad0",
  "691756a5875f21b226420ea7",
  "6917579f806c99ebd2539dfb",
  "691757c4bb4a0630fd7eca69",
  "691757dd806c99ebd2539e2e",
  "69175800c96943b7fe98459e",
  "691759191cc6e8c9e1d65a22",
  "6917593fac20e1ca3353ffc6",
  "6936a931a0db66d2a2988103",
  "6936a95f94b532328d2a4cc6",
  "6936a96fd54b781a93869e72",
  "696a59882a7bf55dc58108ff",
  "697005ed834d493eddd4b93b",
  "697b3936351f7c47f231e754",
  "697e871ed3339a4f9740568c",
];

const BASE = "https://app.360learning.com";
const CACHE_URL =
  "https://script.google.com/macros/s/AKfycbyXDLwx_32YNHnDpoVUX4KOYhAUs8805GRokb8REjriyvo7VfpCLtL8XgmX17rlefth/exec";

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const MAX_PAGES = 40;

const FETCH_HEADERS = (accessToken) => ({
  Authorization: `Bearer ${accessToken}`,
  "360-api-version": "v2.0",
  accept: "application/json",
});

// Returns the page's items and the next-page URL (null when there is none)
async function fetchPage(url, accessToken) {
  const res = await fetch(url, { headers: FETCH_HEADERS(accessToken) });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} for ${url.split("?")[0]}: ${await res.text()}`);
  }
  const body = await res.json();
  const match = (res.headers.get("Link") || "").match(/<([^>]+)>;\s*rel="next"/);
  return {
    items: Array.isArray(body) ? body : body.data ?? [],
    next: match ? new URL(match[1], BASE).href : null,
  };
}

async function getLearners(accessToken) {
  const learners = new Map(); // userId -> Set of group names
  for (const [groupId, groupName] of Object.entries(GROUP_IDS)) {
    let next = `${BASE}/api/v2/groups/${groupId}/roles`;
    while (next) {
      const page = await fetchPage(next, accessToken);
      for (const m of page.items) {
        if (m.role !== "learner") continue;
        if (!learners.has(m.userId)) learners.set(m.userId, new Set());
        learners.get(m.userId).add(groupName);
      }
      next = page.next;
    }
  }

  const usersById = new Map();
  try {
    const cacheRes = await fetch(CACHE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "getLearnerCache" }),
      redirect: "follow",
    });
    const cacheBody = cacheRes.ok ? await cacheRes.json() : {};
    if (cacheBody.success && cacheBody.cache) {
      for (const [id, info] of Object.entries(cacheBody.cache)) usersById.set(id, info);
    } else {
      console.warn("Apps Script cache returned no data:", cacheBody.error || cacheRes.status);
    }
  } catch (error) {
    console.error("Apps Script cache fetch threw:", error.message);
  }

  return [...learners].map(([userId, groups]) => {
    const user = usersById.get(userId);
    return {
      userId,
      name: user && user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : "Unknown",
      email: user ? user.email || user.mail || "" : "",
      groups: [...groups].sort(),
    };
  });
}

async function getStats(accessToken, cursor) {
  // Brackets must not be encoded
  const first = `${BASE}/api/v2/paths/stats?${PATH_IDS.map((id, i) => `pathId[in][${i}]=${id}`).join("&")}`;
  let next = cursor || first;
  // The bearer token is only ever sent to the stats endpoint
  if (!next.startsWith(`${BASE}/api/v2/paths/stats`)) throw new Error("Invalid cursor");

  const byUser = new Map();
  const statusCounts = {};
  let records = 0;
  let pages = 0;
  while (next && pages < MAX_PAGES) {
    const page = await fetchPage(next, accessToken);
    pages++;
    records += page.items.length;
    for (const s of page.items) {
      const type = s.status?.type ?? "none";
      statusCounts[type] = (statusCounts[type] || 0) + 1;
      let u = byUser.get(s.userId);
      if (!u) {
        u = { u: s.userId, active: false, enrolments: 0, pathIds: new Set(), enrolledAt: null };
        byUser.set(s.userId, u);
      }
      // Any activity counts, including on unenrolled records, so lost progress is never hidden
      if ((s.progress ?? 0) > 0 || (s.timeSpent ?? 0) > 0 || s.startedAt) u.active = true;
      if (!s.unenrolledAt) u.enrolments++;
      u.pathIds.add(s.pathId);
      if (s.enrolledAt && (!u.enrolledAt || s.enrolledAt < u.enrolledAt)) u.enrolledAt = s.enrolledAt;
    }
    next = page.next;
  }

  return {
    records,
    pages,
    statusCounts,
    next,
    users: [...byUser.values()].map((u) => ({
      u: u.u,
      active: u.active,
      enrolments: u.enrolments,
      enrolledAt: u.enrolledAt,
      // Path lists are only needed to report on users with no activity
      pathIds: u.active ? undefined : [...u.pathIds],
    })),
  };
}

export async function onRequestGet({ request, env }) {
  const params = new URL(request.url).searchParams;
  if ((await sha256Hex(params.get("key") || "")) !== KEY_SHA256) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const mode = params.get("mode");
  if (mode !== "learners" && mode !== "stats") {
    return Response.json({ error: "mode must be learners or stats" }, { status: 400 });
  }

  try {
    const tokenRes = await fetch(`${BASE}/api/v2/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: env.CLIENT_ID,
        client_secret: env.CLIENT_SECRET,
      }),
    });
    if (!tokenRes.ok) {
      console.error("OAuth token fetch failed:", tokenRes.status);
      return Response.json({ error: "Failed to authenticate with 360Learning" }, { status: 502 });
    }
    const { access_token: accessToken } = await tokenRes.json();

    if (mode === "learners") {
      const learners = await getLearners(accessToken);
      return Response.json({ total: learners.length, learners, fetchedAt: new Date().toISOString() });
    }
    return Response.json(await getStats(accessToken, params.get("cursor")));
  } catch (error) {
    console.error("Unexpected error in no-progress function:", error);
    return Response.json({ error: "An unexpected error occurred", detail: error.message }, { status: 500 });
  }
}
