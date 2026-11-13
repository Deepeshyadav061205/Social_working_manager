-- =====================================================================
-- Social Working Manager — Migration 003: Encrypted OAuth Refresh Token
-- Run after 002_protect_tokens.sql in the Supabase SQL editor.
--
-- Adds refresh_token_enc to public.platform_connections and ensures
-- anon/authenticated cannot read it (only service_role may read it).
-- Safe to run multiple times.
-- =====================================================================

alter table public.platform_connections
  add column if not exists refresh_token_enc text;

-- Ensure table-level SELECT remains revoked and refresh_token_enc is never granted
-- to anon or authenticated (only safe metadata columns are granted to authenticated).
revoke select on public.platform_connections from anon, authenticated;

grant select (
  id,
  user_id,
  platform,
  status,
  expires_at,
  external_account,
  created_at,
  updated_at
) on public.platform_connections to authenticated;
