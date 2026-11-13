#!/usr/bin/env node
/**
 * Mocked tests for the X (Twitter) integration. No network, no real credentials.
 * Run with: npm run test:x
 *
 * Covers:
 *   1. Token refresh success + refresh-token rotation (new tokens + expiry saved, encrypted)
 *   2. Valid (non-expiring) token is returned without calling X
 *   3. Refresh failure -> TOKEN_EXPIRED + null
 *   4. Thread partial failure message (failed part, first post id/url, live parts)
 *   5. Error mapping for 401 / 402 / credits / 403 duplicate / 403 permission / 429 (+ reset header)
 *   6. X_MOCK behaviour (on in dev, never in production)
 *   7. No token value appears in any console output
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import ts from "typescript";

const nodeRequire = createRequire(import.meta.url);

function loadTsModule(relPath, mocks = {}) {
  const src = fs.readFileSync(path.resolve(process.cwd(), relPath), "utf8");
  const { outputText } = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const mod = { exports: {} };
  const req = (id) => {
    if (id in mocks) return mocks[id];
    if (id.startsWith("node:")) return nodeRequire(id);
    throw new Error(`Unexpected import: ${id}`);
  };
  vm.runInThisContext(`(function(exports, require, module) { ${outputText} })`)(mod.exports, req, mod);
  return mod.exports;
}

// ---- Environment (fake values only) ----
process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
process.env.X_CLIENT_ID = "test-client-id";
process.env.X_CLIENT_SECRET = "test-client-secret";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
delete process.env.X_MOCK;
process.env.NODE_ENV = "test";

// ---- Capture all console output to verify no tokens are logged ----
const logs = [];
const origConsole = { log: console.log, error: console.error, warn: console.warn };
for (const level of ["log", "error", "warn"]) {
  console[level] = (...args) => {
    logs.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
  };
}
const out = (...args) => origConsole.log(...args);

// ---- Load modules ----
const typesMod = loadTsModule("lib/types.ts");
const textMod = loadTsModule("lib/text.ts", { "@/lib/types": typesMod });
const platformTypes = loadTsModule("lib/platforms/types.ts", { "@/lib/types": typesMod });
const xMod = loadTsModule("lib/platforms/x.ts", {
  "@/lib/platforms/types": platformTypes,
  "@/lib/text": textMod,
});
const cryptoMod = loadTsModule("lib/crypto.ts", { "server-only": {} });

// In-memory fake of the Supabase service-role client (one platform_connections row).
const store = { row: null, upserts: [] };
function makeAdmin() {
  return {
    from() {
      const q = {
        _op: null,
        _row: null,
        select() { return q; },
        eq() { return q; },
        upsert(row) { q._op = "upsert"; q._row = row; return q; },
        async maybeSingle() { return { data: store.row ? { ...store.row } : null, error: null }; },
        async single() {
          if (q._op === "upsert") {
            store.row = { ...(store.row ?? {}), ...q._row, id: store.row?.id ?? "conn-1" };
            store.upserts.push(q._row);
            return { data: { id: store.row.id }, error: null };
          }
          return { data: store.row, error: null };
        },
      };
      return q;
    },
  };
}

const connMod = loadTsModule("lib/connections.ts", {
  "server-only": {},
  "@/lib/crypto": cryptoMod,
  "@/lib/platforms": {
    getPlatformAdapter: () => new xMod.XTwitterAdapter(),
    isOAuthCapable: platformTypes.isOAuthCapable,
  },
  "@/lib/supabase/server": { createAdminClient: makeAdmin, hasAdminClient: () => true },
  "@/lib/types": typesMod,
});

// ---- Fetch mock ----
let fetchCalls = [];
let fetchHandler = null;
globalThis.fetch = async (url, init = {}) => {
  fetchCalls.push({ url: String(url), init });
  return fetchHandler(String(url), init, fetchCalls.length);
};
function jsonResponse(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

const { encryptToken, decryptToken } = cryptoMod;
const SECRETS = [
  "old-access-SECRET-aaa",
  "refresh-1-SECRET-bbb",
  "new-access-SECRET-ccc",
  "refresh-2-SECRET-ddd",
  "thread-token-SECRET-eee",
];

let passed = 0;
async function test(name, fn) {
  fetchCalls = [];
  fetchHandler = () => { throw new Error("unexpected fetch"); };
  await fn();
  passed++;
  out(`PASS: ${name}`);
}

// 1. Refresh success + rotation
await test("token refresh success saves rotated refresh token + new expiry (encrypted)", async () => {
  store.row = {
    id: "conn-1",
    status: "CONNECTED",
    expires_at: new Date(Date.now() + 60_000).toISOString(), // within 5-minute window
    access_token_enc: encryptToken(SECRETS[0]),
    refresh_token_enc: encryptToken(SECRETS[1]),
  };
  fetchHandler = () =>
    jsonResponse(200, { access_token: SECRETS[2], refresh_token: SECRETS[3], expires_in: 7200 });

  const token = await connMod.getValidToken("user-1", "X_TWITTER");
  assert.equal(token, SECRETS[2]);
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, "https://api.x.com/2/oauth2/token");
  const body = new URLSearchParams(String(fetchCalls[0].init.body));
  assert.equal(body.get("grant_type"), "refresh_token");
  assert.equal(body.get("refresh_token"), SECRETS[1]);
  assert.equal(store.row.status, "CONNECTED");
  assert.equal(decryptToken(store.row.access_token_enc), SECRETS[2]);
  assert.equal(decryptToken(store.row.refresh_token_enc), SECRETS[3], "rotated refresh token must be saved");
  assert.ok(!String(store.row.refresh_token_enc).includes("SECRET"), "refresh token must be stored encrypted");
  assert.ok(new Date(store.row.expires_at).getTime() > Date.now() + 60 * 60 * 1000, "expiry must be updated");
});

// 2. Valid token, no refresh
await test("valid token far from expiry is returned without calling X", async () => {
  store.row = {
    id: "conn-1",
    status: "CONNECTED",
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    access_token_enc: encryptToken(SECRETS[2]),
    refresh_token_enc: encryptToken(SECRETS[3]),
  };
  const token = await connMod.getValidToken("user-1", "X_TWITTER");
  assert.equal(token, SECRETS[2]);
  assert.equal(fetchCalls.length, 0);
});

// 3. Refresh failure
await test("refresh failure marks TOKEN_EXPIRED and returns null", async () => {
  store.row = {
    id: "conn-1",
    status: "CONNECTED",
    expires_at: new Date(Date.now() - 1000).toISOString(),
    access_token_enc: encryptToken(SECRETS[0]),
    refresh_token_enc: encryptToken(SECRETS[1]),
  };
  fetchHandler = () =>
    jsonResponse(400, { error: "invalid_request", error_description: "Value passed for the token was invalid." });
  const token = await connMod.getValidToken("user-1", "X_TWITTER");
  assert.equal(token, null);
  assert.equal(store.row.status, "TOKEN_EXPIRED");
});

await test("expired token with no refresh token marks TOKEN_EXPIRED without calling X", async () => {
  store.row = {
    id: "conn-1",
    status: "CONNECTED",
    expires_at: new Date(Date.now() - 1000).toISOString(),
    access_token_enc: encryptToken(SECRETS[0]),
    refresh_token_enc: null,
  };
  const token = await connMod.getValidToken("user-1", "X_TWITTER");
  assert.equal(token, null);
  assert.equal(store.row.status, "TOKEN_EXPIRED");
  assert.equal(fetchCalls.length, 0);
});

// 4. Thread partial failure
await test("thread partial failure reports failed part, first post id/url and live parts", async () => {
  const adapter = new xMod.XTwitterAdapter();
  fetchHandler = (url, init, n) => {
    assert.equal(url, "https://api.x.com/2/tweets");
    if (n === 1) return jsonResponse(201, { data: { id: "111" } });
    if (n === 2) return jsonResponse(201, { data: { id: "222" } });
    return jsonResponse(403, { title: "Forbidden", detail: "You are not allowed to create a Tweet with duplicate content." });
  };
  const res = await adapter.publishPost("1/3 first\n---\n2/3 second\n---\n3/3 third", SECRETS[4]);
  assert.equal(res.ok, false);
  assert.equal(res.failedPart, 3);
  assert.equal(res.postId, "111");
  assert.equal(res.url, "https://x.com/i/web/status/111");
  assert.match(res.error, /Part 3 of 3 failed/);
  assert.match(res.error, /parts 1–2 are already live/);
  assert.match(res.error, /duplicate/);
  // reply chain
  assert.equal(JSON.parse(fetchCalls[1].init.body).reply.in_reply_to_tweet_id, "111");
  assert.equal(JSON.parse(fetchCalls[2].init.body).reply.in_reply_to_tweet_id, "222");
});

await test("thread failure on part 2 says part 1 is already live", async () => {
  const adapter = new xMod.XTwitterAdapter();
  fetchHandler = (_u, _i, n) =>
    n === 1 ? jsonResponse(201, { data: { id: "999" } }) : jsonResponse(429, { title: "Too Many Requests" });
  const res = await adapter.publishPost("a\n---\nb", SECRETS[4]);
  assert.equal(res.failedPart, 2);
  assert.match(res.error, /Part 2 of 2 failed/);
  assert.match(res.error, /part 1 is already live/);
});

// 5. Error mapping
await test("error mapping 401 / 402 / credits / 403 duplicate / 403 permission / 429", async () => {
  const map = xMod.mapXPublishError;
  assert.match(map(401, {}), /token expired/i);
  assert.match(map(402, {}), /no API credits or the app is not enrolled/);
  assert.match(
    map(403, { title: "Client Forbidden", reason: "client-not-enrolled" }),
    /no API credits or the app is not enrolled/
  );
  assert.match(map(403, { detail: "Your account has depleted its credits" }), /no API credits/);
  assert.equal(
    map(403, { detail: "You are not allowed to create a Tweet with duplicate content." }),
    "X rejected this as a duplicate post. Change the text and try again."
  );
  assert.equal(
    map(403, { title: "Forbidden", detail: "You are not permitted to perform this action." }),
    "Set your X app permissions to Read and write, then reconnect."
  );
  const reset = Math.floor(Date.now() / 1000) + 900;
  const msg429 = map(429, {}, new Headers({ "x-rate-limit-reset": String(reset) }));
  assert.match(msg429, /^X rate limit reached/);
  assert.ok(msg429.includes(new Date(reset * 1000).toISOString()), "429 must include reset time");
  assert.equal(map(429, {}), "X rate limit reached.");
});

await test("publishPost single post 401 returns status 401 for refresh/reconnect", async () => {
  const adapter = new xMod.XTwitterAdapter();
  fetchHandler = () => jsonResponse(401, { title: "Unauthorized" });
  const res = await adapter.publishPost("hello", SECRETS[4]);
  assert.equal(res.ok, false);
  assert.equal(res.status, 401);
  assert.match(res.error, /token expired/i);
});

// 6. Mock mode
await test("X_MOCK=true simulates success in dev and is ignored in production", async () => {
  process.env.X_MOCK = "true";
  process.env.NODE_ENV = "development";
  const adapter = new xMod.XTwitterAdapter();
  assert.equal(xMod.isXMockEnabled(), true);
  const res = await adapter.publishPost("hello", "anything");
  assert.equal(res.ok, true);
  assert.ok(res.postId && res.url);
  assert.equal(await adapter.fetchAccountLabel("x"), "@mock_user");
  const ex = await adapter.exchangeCode({ code: "c", redirectUri: "r" });
  assert.ok(ex.accessToken && ex.refreshToken);
  assert.equal(fetchCalls.length, 0, "mock mode must not call X");

  process.env.NODE_ENV = "production";
  assert.equal(xMod.isXMockEnabled(), false, "mock mode must never be active in production");
  delete process.env.X_MOCK;
  process.env.NODE_ENV = "test";
});

// 7. No tokens in logs
await test("no token value appears in console output", async () => {
  assert.ok(logs.length > 0, "expected at least one captured log line (refresh failure)");
  for (const line of logs) {
    for (const secret of SECRETS) {
      assert.ok(!line.includes(secret), `token leaked into logs: ${line.slice(0, 80)}`);
    }
    assert.ok(!line.includes("test-client-secret"), "client secret leaked into logs");
  }
});

Object.assign(console, origConsole);
out(`\nAll ${passed} X tests passed (${logs.length} log lines checked for token leaks).`);
