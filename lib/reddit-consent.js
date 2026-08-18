import crypto from "node:crypto";

const REDDIT_AUTHORIZE_URL = "https://www.reddit.com/api/v1/authorize";
const REDDIT_TOKEN_URL = "https://www.reddit.com/api/v1/access_token";
const REDDIT_OAUTH_ORIGIN = "https://oauth.reddit.com";
const ALLOWED_REDDIT_HOSTS = new Set([
  "reddit.com",
  "www.reddit.com",
  "old.reddit.com",
  "new.reddit.com",
  "np.reddit.com",
  "m.reddit.com",
  "redd.it",
]);

function redditApiError(label, response, bodyText = "") {
  const suffix = bodyText ? ` (${bodyText.slice(0, 180)})` : "";
  return new Error(`${label} failed with HTTP ${response.status}${suffix}`);
}

async function fetchRedditJson(url, options, label, fetchImpl = fetch) {
  const response = await fetchImpl(url, options);
  const bodyText = await response.text();
  if (!response.ok) throw redditApiError(label, response, bodyText);

  try {
    return JSON.parse(bodyText);
  } catch {
    throw new Error(`${label} returned invalid JSON`);
  }
}

export function normalizeRedditPostUrl(input) {
  let parsed;
  try {
    parsed = new URL(String(input || "").trim());
  } catch {
    throw new Error("Enter a valid Reddit post URL");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (parsed.protocol !== "https:" || !ALLOWED_REDDIT_HOSTS.has(hostname)) {
    throw new Error("Enter a valid Reddit post URL");
  }

  const parts = parsed.pathname.split("/").filter(Boolean);
  let postId = null;

  if (hostname === "redd.it") {
    postId = parts[0] || null;
  } else {
    const commentsIndex = parts.findIndex(part => part.toLowerCase() === "comments");
    postId = commentsIndex >= 0 ? parts[commentsIndex + 1] || null : null;
  }

  if (!postId || !/^[a-z0-9_-]{3,16}$/i.test(postId)) {
    throw new Error("Enter a valid Reddit post URL");
  }

  const normalizedId = postId.toLowerCase();
  return {
    postId: normalizedId,
    canonicalUrl: `https://www.reddit.com/comments/${normalizedId}`,
  };
}

export function buildRedditAuthorizeUrl({ clientId, redirectUri, state }) {
  if (!clientId || !redirectUri || !state) throw new Error("Reddit OAuth is not configured");
  const url = new URL(REDDIT_AUTHORIZE_URL);
  url.search = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    state,
    redirect_uri: redirectUri,
    duration: "temporary",
    scope: "identity read",
  }).toString();
  return url.toString();
}

export function hashOAuthState(state) {
  return crypto.createHash("sha256").update(String(state)).digest("hex");
}

export async function exchangeRedditAuthorizationCode({
  code,
  clientId,
  clientSecret,
  redirectUri,
  userAgent,
  fetchImpl = fetch,
}) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const payload = await fetchRedditJson(REDDIT_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": userAgent,
    },
    body,
  }, "Reddit authorization", fetchImpl);

  if (!payload.access_token || payload.token_type?.toLowerCase() !== "bearer") {
    throw new Error("Reddit authorization returned no temporary access token");
  }
  return payload.access_token;
}

export async function fetchVerifiedRedditPost({
  accessToken,
  postId,
  userAgent,
  fetchImpl = fetch,
}) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "User-Agent": userAgent,
  };
  const [owner, postListing] = await Promise.all([
    fetchRedditJson(`${REDDIT_OAUTH_ORIGIN}/api/v1/me`, { headers }, "Reddit identity lookup", fetchImpl),
    fetchRedditJson(`${REDDIT_OAUTH_ORIGIN}/api/info?id=t3_${encodeURIComponent(postId)}`, { headers }, "Reddit post lookup", fetchImpl),
  ]);

  const post = postListing?.data?.children?.[0]?.data;
  if (!owner?.name || !owner?.id) throw new Error("Reddit identity response was incomplete");
  if (!post?.id || post.id.toLowerCase() !== postId.toLowerCase()) {
    throw new Error("Reddit could not find that post");
  }

  return {
    owner: { id: owner.id, name: owner.name },
    post,
    isOwner: typeof post.author === "string" && post.author.toLowerCase() === owner.name.toLowerCase(),
  };
}

export function sanitizeRedditPost(post) {
  return {
    id: String(post.id),
    subreddit: String(post.subreddit || ""),
    title: String(post.title || "").slice(0, 300),
    body: String(post.selftext || "").slice(0, 40000),
    createdUtc: Number(post.created_utc) || 0,
    permalink: String(post.permalink || "").slice(0, 1000),
  };
}
