/**
 * Shared domain constants & types. Mirrors the Postgres enums in
 * supabase/migrations/001_init.sql.
 */

export const PLATFORMS = ["LINKEDIN", "X_TWITTER", "BLOG"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const TONES = ["PROFESSIONAL", "CASUAL", "INFORMATIVE", "FRIENDLY"] as const;
export type Tone = (typeof TONES)[number];

export type PublishMode = "DIRECT_API" | "TRANSFER_REDIRECT";

export const CONNECTION_STATES = [
  "DISCONNECTED",
  "CONNECTING",
  "CONNECTED",
  "TOKEN_EXPIRED",
  "AUTH_FAILED",
] as const;
export type ConnectionState = (typeof CONNECTION_STATES)[number];

export const CALENDAR_STATUSES = ["PLANNED", "PUBLISHED", "CANCELLED"] as const;
export type CalendarStatus = (typeof CALENDAR_STATUSES)[number];

export const PLATFORM_LABEL: Record<Platform, string> = {
  LINKEDIN: "LinkedIn",
  X_TWITTER: "X",
  BLOG: "Blog",
};

export const TONE_LABEL: Record<Tone, string> = {
  PROFESSIONAL: "Professional",
  CASUAL: "Casual",
  INFORMATIVE: "Informative",
  FRIENDLY: "Friendly",
};

export const CONNECTION_STATE_LABEL: Record<ConnectionState, string> = {
  DISCONNECTED: "Disconnected",
  CONNECTING: "Connecting",
  CONNECTED: "Connected",
  TOKEN_EXPIRED: "Token expired",
  AUTH_FAILED: "Auth failed",
};

/** URL slug <-> enum mapping used by /api/connections/[platform]/… routes. */
export const PLATFORM_SLUG: Record<Platform, string> = {
  LINKEDIN: "linkedin",
  X_TWITTER: "x",
  BLOG: "blog",
};

export function platformFromSlug(slug: string): Platform | null {
  const entry = (Object.entries(PLATFORM_SLUG) as [Platform, string][]).find(([, s]) => s === slug);
  return entry ? entry[0] : null;
}

/** X posts are separated by a line containing only `---` in the editor body. */
export const X_POST_SEPARATOR = "\n---\n";
export const X_MAX_CHARS = 280;

// ---- Row types (subset of DB columns used by the UI) ----

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  default_platform: Platform;
  default_tone: Tone;
  blog_cms_url: string | null;
  created_at: string;
}

export interface GeneratedContent {
  id: string;
  user_id: string;
  request_id: string;
  raw_body: string;
  refined_body: string;
  platform: Platform;
  tone: Tone;
  version: number;
  created_at: string;
}

export interface Draft {
  id: string;
  user_id: string;
  content_id: string | null;
  title: string;
  body: string;
  platform: Platform;
  tone: Tone;
  updated_at: string;
  created_at: string;
}

export interface Template {
  id: string;
  user_id: string;
  name: string;
  structure_text: string;
  default_platform: Platform;
  default_tone: Tone;
  created_at: string;
}

export interface PlatformConnectionPublic {
  platform: Platform;
  status: ConnectionState;
  external_account: string | null;
  expires_at: string | null;
  updated_at: string | null;
  /** Whether OAuth client credentials exist on the server for this platform. */
  configured: boolean;
  supportsDirectPublish: boolean;
}

export interface CalendarEntry {
  id: string;
  user_id: string;
  draft_id: string | null;
  title: string;
  platform: Platform;
  scheduled_for: string;
  status: CalendarStatus;
  created_at: string;
}

export interface PublishJob {
  id: string;
  content_id: string | null;
  draft_id: string | null;
  platform: Platform;
  mode: PublishMode;
  status: string;
  external_post_id: string | null;
  external_url: string | null;
  error: string | null;
  published_at: string | null;
  created_at: string;
}
