#!/usr/bin/env node
/**
 * Diagnostic script for Social Working Manager.
 * Run with: npm run check:setup
 *
 * Checks:
 * 1. Environment variables (names only -> "set" or "missing", never prints secrets)
 * 2. Reachability of all 8 Supabase tables using SUPABASE_SERVICE_ROLE_KEY
 * 3. on_auth_user_created trigger verification (every auth.users row has a profiles row)
 * 4. Live Gemini / LLM API call ("Reply with the word OK") with model name & latency
 */

import { createClient } from "@supabase/supabase-js";

const REQUIRED_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "LLM_PROVIDER",
  "GEMINI_API_KEY",
  "TOKEN_ENCRYPTION_KEY",
  "NEXT_PUBLIC_APP_URL",
];

const OPTIONAL_ENV = [
  "LLM_MODEL",
  "LLM_MAX_OUTPUT_TOKENS",
  "LLM_REFINE_ENABLED",
  "NEXT_PUBLIC_BASIC_UI",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "LINKEDIN_CLIENT_ID",
  "LINKEDIN_CLIENT_SECRET",
  "X_CLIENT_ID",
  "X_CLIENT_SECRET",
];

const TABLES = [
  "profiles",
  "templates",
  "content_requests",
  "generated_content",
  "drafts",
  "platform_connections",
  "publish_jobs",
  "calendar_entries",
];

function isSet(name) {
  const val = (process.env[name] ?? "").split("#")[0].trim();
  return val.length > 0;
}

async function main() {
  const results = [];
  const fixes = [];

  console.log("=== 1. ENVIRONMENT VARIABLES (set / missing) ===");
  for (const name of REQUIRED_ENV) {
    const ok = isSet(name);
    console.log(`  [required] ${name.padEnd(30)} : ${ok ? "set" : "missing"}`);
    results.push({ check: `env:${name}`, status: ok ? "PASS" : "FAIL" });
    if (!ok) {
      if (name === "GEMINI_API_KEY") {
        fixes.push("Set GEMINI_API_KEY in .env.local (create a key at https://aistudio.google.com/app/apikey).");
      } else {
        fixes.push(`Set required environment variable ${name} in .env.local.`);
      }
    }
  }
  for (const name of OPTIONAL_ENV) {
    const ok = isSet(name);
    console.log(`  [optional] ${name.padEnd(30)} : ${ok ? "set" : "missing"}`);
  }

  console.log("\n=== 2. SUPABASE DATABASE TABLES (8 tables) ===");
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

  let admin = null;
  let missingTables = false;

  if (!supabaseUrl || !serviceKey) {
    for (const t of TABLES) {
      console.log(`  table ${t.padEnd(24)} : FAIL (missing Supabase URL or service-role key)`);
      results.push({ check: `table:${t}`, status: "FAIL" });
    }
    fixes.push("Configure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.");
  } else {
    admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    for (const t of TABLES) {
      const { error } = await admin.from(t).select("id").limit(1);
      if (error) {
        missingTables = true;
        console.log(`  table ${t.padEnd(24)} : FAIL (${error.code || "ERR"}: ${error.message})`);
        results.push({ check: `table:${t}`, status: "FAIL" });
      } else {
        console.log(`  table ${t.padEnd(24)} : PASS`);
        results.push({ check: `table:${t}`, status: "PASS" });
      }
    }

    if (missingTables) {
      fixes.push(
        "Open Supabase Dashboard -> SQL Editor -> New query, paste supabase/setup_all.sql, and click Run."
      );
    }
  }

  console.log("\n=== 3. AUTH TRIGGER & PROFILES BACKFILL CHECK ===");
  if (!admin) {
    console.log("  trigger on_auth_user_created   : FAIL (Supabase admin client unavailable)");
    results.push({ check: "trigger:on_auth_user_created", status: "FAIL" });
  } else {
    const { data: usersData, error: usersErr } = await admin.auth.admin.listUsers();
    const { data: profilesData, error: profErr } = await admin.from("profiles").select("id");

    if (usersErr || profErr) {
      const msg = usersErr?.message || profErr?.message || "Could not query auth.users or public.profiles";
      console.log(`  trigger on_auth_user_created   : FAIL (${msg})`);
      results.push({ check: "trigger:on_auth_user_created", status: "FAIL" });
      if (!missingTables) {
        fixes.push("Run supabase/setup_all.sql in the Supabase SQL Editor to create and backfill profiles.");
      }
    } else {
      const users = usersData?.users ?? [];
      const profileIds = new Set((profilesData ?? []).map((p) => p.id));
      const missingUsers = users.filter((u) => !profileIds.has(u.id));
      if (missingUsers.length > 0) {
        console.log(
          `  trigger on_auth_user_created   : FAIL (${missingUsers.length} of ${users.length} auth.users missing a profiles row)`
        );
        results.push({ check: "trigger:on_auth_user_created", status: "FAIL" });
        fixes.push("Run supabase/setup_all.sql in the Supabase SQL Editor to backfill missing profiles and starter templates.");
      } else {
        console.log(
          `  trigger on_auth_user_created   : PASS (${users.length}/${users.length} auth.users have profiles rows)`
        );
        results.push({ check: "trigger:on_auth_user_created", status: "PASS" });
      }
    }
  }

  console.log("\n=== 4. LIVE LLM / GEMINI CHECK ===");
  const provider = (process.env.LLM_PROVIDER || "gemini").trim().toLowerCase();
  const defaultModels = {
    gemini: "gemini-3.5-flash-lite",
    openai: "gpt-4o-mini",
    anthropic: "claude-3-5-haiku-latest",
  };
  const model = (process.env.LLM_MODEL || "").split("#")[0].trim() || defaultModels[provider] || "gemini-3.5-flash-lite";
  const maxTokens = Number.parseInt(process.env.LLM_MAX_OUTPUT_TOKENS ?? "", 10) || 8192;

  console.log(`  Provider : ${provider}`);
  console.log(`  Model    : ${model}`);

  const t0 = Date.now();
  try {
    if (provider === "gemini") {
      const key = (process.env.GEMINI_API_KEY ?? "").split("#")[0].trim();
      if (!key) {
        throw new Error("GEMINI_API_KEY is missing in .env.local");
      }
      const generationConfig = { temperature: 0, maxOutputTokens: maxTokens };
      if (/2\.5-flash/i.test(model)) {
        generationConfig.thinkingConfig = { thinkingBudget: 0 };
      }
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: "Reply with the word OK" }] }],
            generationConfig,
          }),
        }
      );
      const latency = Date.now() - t0;
      const bodyText = await res.text();
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} (${latency}ms): ${bodyText.slice(0, 200)}`);
      }
      const json = JSON.parse(bodyText);
      const reply = (json.candidates?.[0]?.content?.parts ?? [])
        .filter((p) => !p.thought)
        .map((p) => p.text ?? "")
        .join("")
        .trim();
      console.log(`  Latency  : ${latency}ms`);
      console.log(`  Response : ${reply || "(empty)"}`);
      console.log("  llm:generateContent            : PASS");
      results.push({ check: `llm:${provider}:${model}`, status: "PASS" });
    } else if (provider === "openai") {
      const key = (process.env.OPENAI_API_KEY ?? "").trim();
      if (!key) throw new Error("OPENAI_API_KEY is missing in .env.local");
      const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          max_tokens: 32,
          messages: [{ role: "user", content: "Reply with the word OK" }],
        }),
      });
      const latency = Date.now() - t0;
      const bodyText = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status} (${latency}ms): ${bodyText.slice(0, 200)}`);
      const json = JSON.parse(bodyText);
      const reply = (json.choices?.[0]?.message?.content ?? "").trim();
      console.log(`  Latency  : ${latency}ms`);
      console.log(`  Response : ${reply}`);
      console.log("  llm:generateContent            : PASS");
      results.push({ check: `llm:${provider}:${model}`, status: "PASS" });
    } else {
      throw new Error(`Unsupported or unconfigured provider: ${provider}`);
    }
  } catch (err) {
    const latency = Date.now() - t0;
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  Latency  : ${latency}ms`);
    console.log(`  llm:generateContent            : FAIL (${msg})`);
    results.push({ check: `llm:${provider}:${model}`, status: "FAIL" });
    if (!fixes.some((f) => f.includes("GEMINI_API_KEY"))) {
      fixes.push(
        "Paste a valid Google AI Studio API key into GEMINI_API_KEY= in .env.local and ensure LLM_MODEL (if set) is a valid Gemini model such as gemini-2.5-flash."
      );
    }
  }

  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;

  console.log("\n=== SUMMARY ===");
  for (const r of results) {
    console.log(`  ${r.status.padEnd(6)} ${r.check}`);
  }
  console.log(`\nTotal: ${passed} PASS, ${failed} FAIL`);

  if (fixes.length > 0) {
    console.log("\n=== EXACT FIXES FOR FAILED CHECKS ===");
    Array.from(new Set(fixes)).forEach((fix, idx) => {
      console.log(`  ${idx + 1}. ${fix}`);
    });
    process.exitCode = 1;
  }
}

main();
