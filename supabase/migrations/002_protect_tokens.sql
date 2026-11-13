-- =====================================================================
-- Social Working Manager — Migration 002: Protect Encrypted OAuth Tokens
-- Run after 001_init.sql in the Supabase SQL editor.
--
-- Ensures encrypted OAuth tokens (access_token_enc and any refresh token
-- columns) can never be read by the anon or authenticated roles, while
-- keeping non-secret status metadata readable via RLS (NFR-2, NFR-7).
-- =====================================================================

-- 1. Revoke table-level SELECT on platform_connections from client roles.
revoke select on public.platform_connections from anon, authenticated;

-- 2. Re-grant SELECT only on safe status/metadata columns (excluding
--    access_token_enc and any refresh token columns) to authenticated.
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
