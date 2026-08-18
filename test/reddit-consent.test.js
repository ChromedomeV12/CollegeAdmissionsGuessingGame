import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRedditAuthorizeUrl,
  exchangeRedditAuthorizationCode,
  fetchVerifiedRedditPost,
  hashOAuthState,
  normalizeRedditPostUrl,
  sanitizeRedditPost,
} from "../lib/reddit-consent.js";

test("normalizes supported Reddit post URLs without retaining tracking parameters", () => {
  assert.deepEqual(
    normalizeRedditPostUrl("https://www.reddit.com/r/collegeresults/comments/abc123/a_title/?utm_source=share"),
    {
      postId: "abc123",
      canonicalUrl: "https://www.reddit.com/comments/abc123",
    },
  );
  assert.deepEqual(normalizeRedditPostUrl("https://redd.it/Z9_x-7"), {
    postId: "z9_x-7",
    canonicalUrl: "https://www.reddit.com/comments/z9_x-7",
  });
});

test("rejects non-Reddit, profile, comment-only, and malformed URLs", () => {
  for (const value of [
    "https://example.com/r/collegeresults/comments/abc123/title",
    "https://www.reddit.com/user/someone",
    "https://www.reddit.com/r/collegeresults/comments/",
    "not a url",
  ]) {
    assert.throws(() => normalizeRedditPostUrl(value), /Reddit post URL/i);
  }
});

test("builds temporary least-privilege Reddit OAuth authorization URLs", () => {
  const url = new URL(buildRedditAuthorizeUrl({
    clientId: "client-id",
    redirectUri: "https://app.example.com/api/submissions/reddit/callback",
    state: "secret-state",
  }));

  assert.equal(url.origin + url.pathname, "https://www.reddit.com/api/v1/authorize");
  assert.equal(url.searchParams.get("client_id"), "client-id");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("duration"), "temporary");
  assert.equal(url.searchParams.get("scope"), "identity read");
  assert.equal(url.searchParams.get("state"), "secret-state");
});

test("hashes OAuth state deterministically without storing the raw state", () => {
  assert.match(hashOAuthState("secret-state"), /^[a-f0-9]{64}$/);
  assert.equal(hashOAuthState("secret-state"), hashOAuthState("secret-state"));
  assert.notEqual(hashOAuthState("secret-state"), hashOAuthState("another-state"));
});

test("exchanges the Reddit authorization code using HTTP Basic and form encoding", async () => {
  let seen;
  const fetchImpl = async (url, options) => {
    seen = { url, options };
    return new Response(JSON.stringify({ access_token: "temporary-token", token_type: "bearer", expires_in: 3600 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const token = await exchangeRedditAuthorizationCode({
    code: "one-time-code",
    clientId: "client-id",
    clientSecret: "client-secret",
    redirectUri: "https://app.example.com/api/submissions/reddit/callback",
    userAgent: "AdmissionsOracle/1.0 by MJanW",
    fetchImpl,
  });

  assert.equal(token, "temporary-token");
  assert.equal(seen.url, "https://www.reddit.com/api/v1/access_token");
  assert.equal(seen.options.method, "POST");
  assert.equal(seen.options.headers.Authorization, `Basic ${Buffer.from("client-id:client-secret").toString("base64")}`);
  assert.match(seen.options.body.toString(), /grant_type=authorization_code/);
  assert.match(seen.options.body.toString(), /code=one-time-code/);
});

test("verifies ownership by comparing Reddit identity with the post author", async () => {
  const responses = new Map([
    ["https://oauth.reddit.com/api/v1/me", { name: "PostOwner", id: "t2_owner" }],
    ["https://oauth.reddit.com/api/info?id=t3_abc123", {
      data: { children: [{ data: { id: "abc123", author: "postowner", subreddit: "collegeresults", title: "My results", selftext: "Body", created_utc: 123, permalink: "/r/collegeresults/comments/abc123/my_results/" } }] },
    }],
  ]);
  const fetchImpl = async (url) => new Response(JSON.stringify(responses.get(url)), {
    status: responses.has(url) ? 200 : 404,
    headers: { "content-type": "application/json" },
  });

  const result = await fetchVerifiedRedditPost({
    accessToken: "temporary-token",
    postId: "abc123",
    userAgent: "AdmissionsOracle/1.0 by MJanW",
    fetchImpl,
  });

  assert.equal(result.owner.id, "t2_owner");
  assert.equal(result.post.id, "abc123");
  assert.equal(result.isOwner, true);
});

test("sanitizes the stored post snapshot and excludes the Reddit username", () => {
  assert.deepEqual(sanitizeRedditPost({
    id: "abc123",
    author: "PrivateHandle",
    subreddit: "collegeresults",
    title: "My results",
    selftext: "The post body",
    created_utc: 123,
    permalink: "/r/collegeresults/comments/abc123/my_results/",
    all_awardings: [{ name: "ignored" }],
  }), {
    id: "abc123",
    subreddit: "collegeresults",
    title: "My results",
    body: "The post body",
    createdUtc: 123,
    permalink: "/r/collegeresults/comments/abc123/my_results/",
  });
});
