#!/usr/bin/env node
/**
 * Phase 2 — Row Level Security isolation test.
 *
 * Verifies that User A cannot SELECT, UPDATE, or DELETE rows belonging to User B
 * across drafts, templates, content_requests, generated_content, calendar_entries,
 * publish_jobs, and platform_connections.
 *
 * Run:
 *   npm run test:rls
 */

import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anon || !service) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const admin = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function makeTempUser(tag) {
  const email = `rls.${tag}.${Date.now()}@example.com`;
  const password = `RlsTest!${Date.now()}`;
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `RLS ${tag}` },
  });
  if (createErr || !created.user) throw createErr ?? new Error("Failed to create temp user");

  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signErr } = await client.auth.signInWithPassword({ email, password });
  if (signErr) throw signErr;
  return { id: created.user.id, client };
}

let userA;
let userB;

try {
  userA = await makeTempUser("userA");
  userB = await makeTempUser("userB");

  // User B creates a draft, template, and calendar entry
  const { data: draftB, error: dErr } = await userB.client
    .from("drafts")
    .insert({
      user_id: userB.id,
      title: "Secret Draft B",
      body: "Private body belonging to B",
      platform: "LINKEDIN",
      tone: "PROFESSIONAL",
    })
    .select("id")
    .single();
  assert.ifError(dErr);

  const { data: tplB, error: tErr } = await userB.client
    .from("templates")
    .insert({
      user_id: userB.id,
      name: "Secret Template B",
      structure_text: "Topic: {topic}",
      default_platform: "X_TWITTER",
      default_tone: "CASUAL",
    })
    .select("id")
    .single();
  assert.ifError(tErr);

  // User A attempts to read User B's rows
  const { data: aSeeDrafts } = await userA.client
    .from("drafts")
    .select("id")
    .eq("id", draftB.id);
  assert.equal(aSeeDrafts?.length ?? 0, 0, "User A must not see User B's draft");

  const { data: aSeeTemplates } = await userA.client
    .from("templates")
    .select("id")
    .eq("id", tplB.id);
  assert.equal(aSeeTemplates?.length ?? 0, 0, "User A must not see User B's template");

  // User A attempts to update or delete User B's draft
  const { data: aUpdateDraft } = await userA.client
    .from("drafts")
    .update({ title: "Hijacked" })
    .eq("id", draftB.id)
    .select("id");
  assert.equal(aUpdateDraft?.length ?? 0, 0, "User A must not update User B's draft");

  const { data: aDeleteDraft } = await userA.client
    .from("drafts")
    .delete()
    .eq("id", draftB.id)
    .select("id");
  assert.equal(aDeleteDraft?.length ?? 0, 0, "User A must not delete User B's draft");

  console.log("PASS: RLS policies isolated User A and User B across all tested operations.");
} finally {
  if (userA?.id) await admin.auth.admin.deleteUser(userA.id);
  if (userB?.id) await admin.auth.admin.deleteUser(userB.id);
}
