# Social Working Manager — Comprehensive Project Report

**Project Name:** Social Working Manager  
**Version:** 1.0.0  
**Architecture:** Next.js 14 App Router (Full-Stack TypeScript) + Supabase (PostgreSQL & Auth with RLS) + Multi-Provider AI Engine  

---

## 1. Executive Summary

**Social Working Manager** is a production-grade, AI-assisted social media and editorial content workspace built to satisfy all **44 Functional Requirements (FR-1 … FR-44)** and **18 Non-Functional Requirements (NFR-1 … NFR-18)** of the Software Requirements Specification (SRS).

Users can enter a rough topic, idea, keywords, or draft, choose a target platform (**LinkedIn**, **X / Twitter**, or **Blog**) and tone (**Professional**, **Casual**, **Informative**, or **Friendly**), and generate platform-tailored content through a **two-pass AI pipeline** (generation pass + editorial refinement pass). Users retain full editorial control to edit every word, refine flow on demand, save and manage drafts, reuse customizable templates, inspect generation history (comparing raw vs. refined outputs), schedule posts on a visual content calendar, track activity analytics, and publish either via **Direct OAuth 2.0 API** or a **zero-credential One-Click Transfer workflow**.

---

## 2. Complete Technology Stack

### 2.1 Frontend & UI Layer
| Category | Technology | Version | Purpose |
|---|---|---|---|
| **Framework** | Next.js (App Router) | `^14.2.33` | Hybrid Server Components (RSC) + Client Components + Route Handlers |
| **Language** | TypeScript (Strict Mode) | `^5.9.3` | End-to-end static typing across UI, API routes, and DB models |
| **UI Library** | React / React DOM | `^18.3.1` | Interactive client views, state management, and transitions |
| **Styling** | Tailwind CSS + `tailwindcss-animate` | `3.4` | Custom editorial design system (`Navy + Cream + Coral` tokens) |
| **Primitives** | Radix UI (`Dialog`, `AlertDialog`, `DropdownMenu`, `Select`, `Tabs`, `Slot`, `Label`) | Latest | Accessible, keyboard-navigable modal, dropdown, and tab primitives |
| **Forms & Validation** | `react-hook-form` + `@hookform/resolvers` + `zod` | `^7.92.0` / `^3.25.76` | Client and server schema validation |
| **Data Visualization** | `recharts` | `^3.10.1` | Dashboard "Posts per Platform" bar chart |
| **Markdown Rendering** | `react-markdown` | `^9.1.0` | Live Markdown preview for Blog articles |
| **Icons & Toasts** | `lucide-react` + `sonner` | `^1.72.0` / `^2.0.8` | Editorial iconography and non-intrusive toast notifications |
| **Date Utilities** | `date-fns` | `^4.4.0` | Month-grid calendar calculation and timestamp formatting |
| **Typography** | Google Fonts (`Fraunces` & `Inter`) | `next/font/google` | Editorial serif headings (`Fraunces`) + clean UI sans (`Inter`) |

### 2.2 Backend, Database & Security Layer
| Category | Technology | Version | Purpose |
|---|---|---|---|
| **Database** | Supabase PostgreSQL | Managed Postgres | 8 user-scoped tables, 5 custom enums, 9 composite indexes, PL/pgSQL triggers |
| **Authentication** | Supabase Auth (`@supabase/ssr`, `@supabase/supabase-js`) | `^0.12.7` / `^2.119.0` | Cookie-based SSR authentication, session refresh middleware, and user isolation |
| **Data Isolation** | PostgreSQL Row-Level Security (RLS) + Column Grants | SQL Migrations `001` & `002` | Enforces `user_id = auth.uid()` on every row and revokes client access to encrypted OAuth tokens |
| **Token Encryption** | Node.js `crypto` (`AES-256-GCM`) | Built-in (`lib/crypto.ts`) | Server-side authenticated encryption with random 12-byte IV and 16-byte auth tag |
| **Server-Only Guard** | `server-only` | `^0.0.1` | Prevents accidental bundling of secret-handling modules (`lib/llm.ts`, `lib/crypto.ts`, `lib/connections.ts`) into client code |
| **Security Headers** | Next.js Custom Headers (`next.config.mjs`) | Built-in | Enforces `Strict-Transport-Security` (HSTS), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and `Permissions-Policy` |

### 2.3 AI / LLM & External Platform Integrations
| Category | Technology / Provider | Configuration | Purpose |
|---|---|---|---|
| **Google Gemini** | REST API (`v1beta`) | `LLM_PROVIDER=gemini` (Default: `gemini-3.5-flash-lite`) | Primary default LLM provider |
| **OpenAI** | REST API (`/v1/chat/completions`) | `LLM_PROVIDER=openai` (Default: `gpt-4o-mini`) | Alternative LLM provider (supports custom `OPENAI_BASE_URL` and `LLM_MODEL` override) |
| **Anthropic Claude** | REST API (`/v1/messages`) | `LLM_PROVIDER=anthropic` (Default: `claude-3-5-haiku-latest`) | Alternative LLM provider |
| **LinkedIn Adapter** | OAuth 2.0 + UGC Posts API | `lib/platforms/linkedin.ts` | Direct API publishing (`w_member_social`) + one-click share redirect fallback |
| **X (Twitter) Adapter** | OAuth 2.0 with PKCE + v2 Tweets API | `lib/platforms/x.ts` | Direct API tweet publishing + pre-filled `x.com/intent/tweet` composer fallback |
| **Blog CMS Adapter** | Markdown Download + CMS Redirect | `lib/platforms/blog.ts` | `.md` file download, clipboard copy, and optional user CMS URL redirect |

---

## 3. System Architecture & Design System

### 3.1 Editorial Design System ("Navy + Cream + Coral")
Defined in `app/globals.css` and `tailwind.config.ts`:
- **Deep Editorial Navy (`--navy-900: #0B1F3A`, `--navy-800: #122B4D`, `--navy-700: #1C3A63`)**: Used for primary text, sidebar navigation, and active selection chips.
- **Warm Cream Surfaces (`--cream-50: #FAF6F0`, `--cream-100: #F3ECE1`, `--cream-200: #E6DDD0`)**: Used for page backgrounds, elevated cards, and subtle borders.
- **Vibrant Coral Accents (`--coral-500: #FF6B5B`, `--coral-600: #E85545`, `--coral-100: #FFE3DF`)**: Used for primary CTAs, active indicators, and highlights.

### 3.2 Two-Pass AI Generation & Refinement Pipeline
1. **Rate Limit Check (`lib/rate-limit.ts`)**: Verifies the authenticated user has not exceeded **20 generations per hour** (counted via `content_requests`).
2. **Pass 1 — Draft Generation (`lib/prompts.ts` → `buildGeneratePrompt`)**: Generates platform-specific content obeying strict platform rules (LinkedIn hook + paragraph spacing; X `≤ 280` char limit or `---`-separated thread; Blog Markdown headings) and tone rules, without fabricating facts.
3. **Pass 2 — Automatic Editorial Refinement (`lib/prompts.ts` → `buildRefinePrompt`)**: Polishes rhythm, sentence variety, and clarity while preserving exact facts, names, and numbers.
4. **Output Sanitization (`cleanModelOutput` & `enforceXLimits`)**: Strips any `<think>...</think>` reasoning blocks, markdown code fences, or wrapping quotes, and enforces X 280-character post boundaries.
5. **Persistence**: Stores the request in `content_requests` and both `raw_body` and `refined_body` in `generated_content`.

### 3.3 Database Schema (8 Tables, 5 Enums)
- **Enums**: `platform_t` (`LINKEDIN`, `X_TWITTER`, `BLOG`), `tone_t` (`PROFESSIONAL`, `CASUAL`, `INFORMATIVE`, `FRIENDLY`), `publish_mode_t` (`DIRECT_API`, `TRANSFER_REDIRECT`), `connection_state_t` (`DISCONNECTED`, `CONNECTING`, `CONNECTED`, `TOKEN_EXPIRED`, `AUTH_FAILED`), `calendar_status_t` (`PLANNED`, `PUBLISHED`, `CANCELLED`).
- **Tables**:
  1. `profiles` — User profile, default platform/tone preferences, and optional `blog_cms_url`.
  2. `templates` — Reusable content structures with `{placeholder}` variables (4 starter templates auto-seeded on user signup via `handle_new_user()` trigger).
  3. `content_requests` — Audit log of prompts, selected platform/tone, and template reference.
  4. `generated_content` — Stores both `raw_body` (Pass 1) and `refined_body` (Pass 2) with version tracking.
  5. `drafts` — User-saved editable drafts with search, filter, and `updated_at` auto-touch trigger.
  6. `platform_connections` — Per-user OAuth connection status and AES-256-GCM encrypted `access_token_enc`.
  7. `publish_jobs` — Audit trail of every `DIRECT_API` or `TRANSFER_REDIRECT` action.
  8. `calendar_entries` — Scheduled content items linked to drafts with `PLANNED`, `PUBLISHED`, or `CANCELLED` status.

---

## 4. Complete History of Changes Made Till Now

### Stage 1: Full 7-Phase Core Application Build
1. **Phase 1 — Foundation & Authentication**:
   - Built marketing landing page (`app/(marketing)/page.tsx`), Login (`app/(auth)/login/page.tsx`), Registration (`app/(auth)/register/page.tsx`), OAuth callback (`app/auth/callback/route.ts`), friendly error mapper (`lib/auth-errors.ts`), responsive sidebar shell (`components/layout/app-shell.tsx`), and SSR route protection (`middleware.ts`, `lib/supabase/middleware.ts`, `lib/auth.ts`).
2. **Phase 2 — Database Schema & Row-Level Security**:
   - Authored `supabase/migrations/001_init.sql` with all 8 tables, RLS policies (`user_id = auth.uid()`), signup trigger (`on_auth_user_created`), and starter template seeding (`seed_starter_templates`).
   - Built `scripts/test-rls.mjs` (automated two-user cross-tenant isolation verifier) and `scripts/seed-templates.mjs`.
3. **Phase 3 — AI Generation & Create Workspace**:
   - Built `lib/llm.ts`, `lib/prompts.ts`, `lib/text.ts`, `app/api/generate/route.ts`, and `app/api/refine/route.ts`.
   - Built split-pane Create Workspace (`components/create/create-workspace.tsx` and `components/create/content-editor.tsx`) with `sessionStorage` unsaved-work protection, live word/character counters, per-post X thread counters/copy buttons, and Blog Markdown preview.
4. **Phase 4 — Drafts, History & Templates**:
   - Built Drafts list, search/filter/sort, and detail editor (`app/(app)/drafts/page.tsx`, `app/(app)/drafts/[id]/page.tsx`, `app/api/drafts/**`).
   - Built Generation History viewer with raw-vs-refined toggle (`app/(app)/history/page.tsx`, `app/api/history/route.ts`).
   - Built Templates manager with create/edit/delete and one-click "Use template" prefill (`app/(app)/templates/page.tsx`, `app/api/templates/**`).
5. **Phase 5 — Platform Connections & Publishing / Transfer**:
   - Built modular `PlatformApi` adapters (`lib/platforms/types.ts`, `linkedin.ts`, `x.ts`, `blog.ts`), AES-256-GCM token encryption (`lib/crypto.ts`), OAuth PKCE/state cookie helpers (`lib/oauth.ts`), OAuth routes (`app/api/connections/**`), and unified Publish/Transfer modal (`components/connections/publish-dialog.tsx`, `app/api/publish/route.ts`).
6. **Phase 6 — Content Calendar & Activity Dashboard**:
   - Built interactive month-grid + mobile list Calendar (`app/(app)/calendar/page.tsx`, `components/calendar/calendar-view.tsx`, `app/api/calendar/**`).
   - Built user-scoped Activity Dashboard (`app/(app)/dashboard/page.tsx`, `components/dashboard/platform-chart.tsx`) displaying KPI cards, platform distribution chart, and recent activity feed.
7. **Phase 7 — Settings, Hardening & SRS Documentation**:
   - Built Settings page (`app/(app)/settings/page.tsx`, `app/api/settings/route.ts`), hourly rate limiting (`lib/rate-limit.ts`), HTTP security headers (`next.config.mjs`), loading skeletons, error boundaries, `README.md`, `docs/DEMO_SCRIPT.md`, and `docs/FR_TRACEABILITY.md`.

### Stage 2: LLM Provider Hardening, Token Security Hardening & SRS Re-Indexing
1. **Gemini & Multi-Provider LLM Hardening**:
   - Configured Google Gemini (`gemini-3.5-flash-lite`) as the primary default provider with configurable `LLM_MAX_OUTPUT_TOKENS` (default `8192`), `LLM_REFINE_ENABLED` (default `true`), defensive Gemini safety/finishReason parsing, and `thinkingConfig: { thinkingBudget: 0 }` on `2.5-flash` models for low latency.
   - Kept OpenAI (`OPENAI_BASE_URL` compatible) and Anthropic providers intact, raised LLM timeout to `60s` (`TIMEOUT_MS = 60_000`), and updated `cleanModelOutput` in `lib/prompts.ts` to strip multiline `<think>...</think>` blocks.
2. **Database Token Protection (`002_protect_tokens.sql`)**:
   - Added `supabase/migrations/002_protect_tokens.sql` to explicitly revoke table-level `SELECT` on `public.platform_connections` from `anon` and `authenticated` and grant column-level `SELECT` only on non-sensitive metadata columns (`id`, `user_id`, `platform`, `status`, `expires_at`, `external_account`, `created_at`, `updated_at`).
   - Verified `lib/connections.ts` uses an explicit column list in `listConnections()` and the server-only service-role client (`createAdminClient()`) in `getConnectionWithToken()`.
3. **Exact SRS Traceability Alignment**:
   - Rebuilt `docs/FR_TRACEABILITY.md` to map every exact SRS requirement ID (**FR-1 … FR-44** and **NFR-1 … NFR-18**) to its implementing source files.

### Stage 3: Environment Configuration, Diagnostics & Basic Test UI
1. **Environment Separation & Fix**:
   - Configured `.env.local` for Google Gemini (`LLM_PROVIDER=gemini`), preserved Supabase keys and `TOKEN_ENCRYPTION_KEY`, and kept `.env.example` as a clean, secret-free template.
2. **Project Zip Refresh (`social-working-manager.zip`)**:
   - Rebuilt `social-working-manager.zip` after cleaning `.env.example` and adding `docs/PROJECT_REPORT.md`, ensuring zero secret keys or build artifacts (`node_modules`, `.next`, `.env.local`) are inside the archive.

---

## 5. What Changes / Steps We Still Need to Make (Next Steps & Roadmap)

### 5.1 Immediate Manual Setup Steps (Required to Complete Live Setup)
1. **Execute SQL Migrations in Supabase Dashboard (Required Once)**:
   - Open your Supabase project's **SQL Editor** (`SQL Editor → New query`).
   - Copy and run [`supabase/migrations/001_init.sql`](../supabase/migrations/001_init.sql) to create all enums, tables, RLS policies, and the user signup trigger.
   - Copy and run [`supabase/migrations/002_protect_tokens.sql`](../supabase/migrations/002_protect_tokens.sql) to apply column-level token protection on `platform_connections`.
   - Run `npm run test:rls` locally to verify end-to-end database isolation.
2. **Optional — Configure Direct OAuth Publishing Keys**:
   - The app works immediately out of the box using the **One-Click Transfer** mode.
   - If you want **Direct API Publishing** to LinkedIn or X, register developer apps on LinkedIn / X Developer Portals and add `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `X_CLIENT_ID`, and `X_CLIENT_SECRET` to `.env.local`.
3. **Optional — Production Deployment on Vercel**:
   - Import the project into Vercel, configure the environment variables from `.env.example`, set `NEXT_PUBLIC_APP_URL` to your production domain, and add `https://<your-domain>/auth/callback` to Supabase **Authentication → URL Configuration → Redirect URLs**.

### 5.2 Potential Future Enhancements (v2.0 Roadmap)
- **Automated Background Scheduled Publishing**: Add a Vercel Cron / Supabase `pg_cron` worker to automatically publish `PLANNED` calendar entries at their `scheduled_for` timestamp when Direct API OAuth connections are active.
- **OAuth Refresh Token Rotation**: Extend `platform_connections` and `lib/connections.ts` to store encrypted refresh tokens and automatically refresh expired LinkedIn/X access tokens without re-prompting the user.
- **Rich Media & Image Attachments**: Allow uploading or generating post images in the Create workspace and attaching them via LinkedIn/X media upload endpoints.
- **Analytics & Engagement Metrics**: Pull post impressions, likes, and comments from LinkedIn and X APIs for posts published via `DIRECT_API`.
- **Collaborative Team Workspaces**: Add organization/team roles with shared draft approval workflows while preserving RLS boundaries.
