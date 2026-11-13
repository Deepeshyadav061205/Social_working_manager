# Functional & Non-Functional Requirements Traceability Matrix

Every requirement (FR-1…FR-44 and NFR-1…NFR-18) from the SRS is mapped to the source file(s) that implement it.

## Functional Requirements (FR-1 … FR-44)

| ID | Requirement Summary | Implementing File(s) |
|---|---|---|
| **FR-1** | Create account | `app/(auth)/register/page.tsx`, `components/auth/register-form.tsx`, `lib/validators.ts` (`registerSchema`), `supabase/migrations/001_init.sql` (`handle_new_user`) |
| **FR-2** | Log in | `app/(auth)/login/page.tsx`, `components/auth/login-form.tsx`, `app/auth/callback/route.ts`, `lib/validators.ts` (`loginSchema`) |
| **FR-3** | Prevent unauthorized access to protected features | `middleware.ts`, `lib/supabase/middleware.ts` (`updateSession`), `lib/auth.ts` (`requireUser`, `getCurrentUser`), `app/(app)/layout.tsx` |
| **FR-4** | Log out | `components/layout/app-shell.tsx` (`logout`) |
| **FR-5** | Separate data per authenticated user | `supabase/migrations/001_init.sql` (RLS policies), `supabase/migrations/002_protect_tokens.sql`, `lib/auth.ts`, `scripts/test-rls.mjs` |
| **FR-6** | Show error message when authentication fails | `lib/auth-errors.ts` (`friendlyAuthError`), `components/auth/login-form.tsx`, `components/auth/register-form.tsx` |
| **FR-7** | Enter topic/idea/description/keywords/existing content | `components/create/create-workspace.tsx`, `app/(app)/create/page.tsx`, `lib/validators.ts` (`generateSchema`) |
| **FR-8** | Select target platform | `components/create/create-workspace.tsx`, `components/ui/chip.tsx` (`ChipGroup`), `lib/types.ts` (`PLATFORMS`), `lib/validators.ts` (`platformSchema`) |
| **FR-9** | LinkedIn generation | `lib/prompts.ts` (`PLATFORM_RULES.LINKEDIN`, `buildGeneratePrompt`), `app/api/generate/route.ts` |
| **FR-10** | X (Twitter) generation | `lib/prompts.ts` (`PLATFORM_RULES.X_TWITTER`, `buildGeneratePrompt`), `lib/text.ts` (`enforceXLimits`, `splitXPosts`), `app/api/generate/route.ts`, `components/create/content-editor.tsx` |
| **FR-11** | Blog-style generation | `lib/prompts.ts` (`PLATFORM_RULES.BLOG`, `buildGeneratePrompt`), `app/api/generate/route.ts`, `components/create/content-editor.tsx` (Markdown preview) |
| **FR-12** | Select tone | `components/create/create-workspace.tsx`, `components/ui/chip.tsx` (`ChipGroup`), `lib/types.ts` (`TONES`), `lib/validators.ts` (`toneSchema`) |
| **FR-13** | Generate from user input | `app/api/generate/route.ts`, `lib/llm.ts` (`generateText`), `lib/prompts.ts` (`buildGeneratePrompt`), `components/create/create-workspace.tsx` |
| **FR-14** | Consider platform | `lib/prompts.ts` (`PLATFORM_RULES`, `buildGeneratePrompt`, `buildRefinePrompt`), `app/api/generate/route.ts` |
| **FR-15** | Consider tone | `lib/prompts.ts` (`TONE_RULES`, `buildGeneratePrompt`, `buildRefinePrompt`), `app/api/generate/route.ts` |
| **FR-16** | Refine for readability and natural flow | `lib/prompts.ts` (`buildRefinePrompt`, `cleanModelOutput`), `app/api/generate/route.ts`, `app/api/refine/route.ts`, `components/create/content-editor.tsx` (`handleRefine`) |
| **FR-17** | Display in editable interface | `components/create/content-editor.tsx`, `components/create/create-workspace.tsx` |
| **FR-18** | Regenerate | `components/create/content-editor.tsx`, `components/create/create-workspace.tsx` (`runGeneration`), `app/api/generate/route.ts` |
| **FR-19** | Error message if generation fails | `app/api/generate/route.ts`, `lib/llm.ts` (`LlmError`), `components/create/create-workspace.tsx` (`apiError` alert + toast) |
| **FR-20** | Edit generated content | `components/create/content-editor.tsx` |
| **FR-21** | Modify content before publishing | `components/create/content-editor.tsx`, `components/connections/publish-dialog.tsx` |
| **FR-22** | Save as draft | `components/drafts/save-draft-dialog.tsx`, `components/create/content-editor.tsx`, `app/api/drafts/route.ts` (`POST`) |
| **FR-23** | View saved drafts | `app/(app)/drafts/page.tsx`, `components/drafts/drafts-view.tsx`, `app/api/drafts/route.ts` (`GET`) |
| **FR-24** | Edit existing drafts | `app/(app)/drafts/[id]/page.tsx`, `components/drafts/draft-editor-view.tsx`, `components/create/content-editor.tsx` |
| **FR-25** | Update saved drafts | `components/drafts/draft-editor-view.tsx` (`saveChanges`), `components/drafts/save-draft-dialog.tsx`, `app/api/drafts/[id]/route.ts` (`PATCH`) |
| **FR-26** | Delete drafts | `components/drafts/drafts-view.tsx`, `components/drafts/draft-editor-view.tsx`, `components/ui/confirm-dialog.tsx`, `app/api/drafts/[id]/route.ts` (`DELETE`) |
| **FR-27** | Access only own drafts | `supabase/migrations/001_init.sql` (`drafts_*` RLS policies), `app/api/drafts/route.ts`, `app/api/drafts/[id]/route.ts`, `app/(app)/drafts/page.tsx`, `app/(app)/drafts/[id]/page.tsx`, `scripts/test-rls.mjs` |
| **FR-28** | Connect supported platforms | `app/(app)/connections/page.tsx`, `components/connections/connections-view.tsx`, `app/api/connections/[platform]/connect/route.ts`, `app/api/connections/[platform]/callback/route.ts`, `app/api/connections/[platform]/disconnect/route.ts`, `lib/oauth.ts` |
| **FR-29** | Display connection status | `components/connections/connections-view.tsx`, `app/(app)/connections/page.tsx`, `app/api/connections/route.ts`, `lib/connections.ts` (`listConnections`) |
| **FR-30** | Publish or Transfer option | `components/create/content-editor.tsx`, `components/drafts/drafts-view.tsx`, `components/connections/publish-dialog.tsx`, `app/api/publish/route.ts` |
| **FR-31** | Verify platform before publishing | `app/api/publish/route.ts`, `lib/connections.ts` (`getConnectionWithToken`), `lib/platforms/linkedin.ts` (`verifyConnection`), `lib/platforms/x.ts` (`verifyConnection`), `lib/platforms/blog.ts` (`verifyConnection`) |
| **FR-32** | Direct publishing when permissions available | `app/api/publish/route.ts`, `lib/platforms/linkedin.ts` (`publishPost`), `lib/platforms/x.ts` (`publishPost`) |
| **FR-33** | Simplified transfer/redirect workflow when direct publishing unsupported | `app/api/publish/route.ts`, `components/connections/publish-dialog.tsx`, `lib/platforms/linkedin.ts` (`buildTransferLink`), `lib/platforms/x.ts` (`buildTransferLink`), `lib/platforms/blog.ts` (`buildTransferLink`) |
| **FR-34** | Feedback on publish/transfer result | `components/connections/publish-dialog.tsx`, `app/api/publish/route.ts` |
| **FR-35** | Edit content before publishing | `components/connections/publish-dialog.tsx` (`publish-final-body` textarea), `components/create/content-editor.tsx` |
| **FR-36** | Maintain history of generated/saved content | `supabase/migrations/001_init.sql` (`content_requests`, `generated_content`, `drafts`), `app/api/generate/route.ts`, `app/api/history/route.ts` |
| **FR-37** | View previous content | `app/(app)/history/page.tsx`, `components/history/history-view.tsx`, `app/api/history/route.ts` |
| **FR-38** | Create reusable templates | `components/templates/templates-view.tsx`, `app/api/templates/route.ts` (`POST`), `lib/validators.ts` (`templateSchema`) |
| **FR-39** | View saved templates | `app/(app)/templates/page.tsx`, `components/templates/templates-view.tsx`, `app/api/templates/route.ts` (`GET`), `supabase/migrations/001_init.sql` (`seed_starter_templates`) |
| **FR-40** | Reuse templates during creation | `components/create/create-workspace.tsx` (`applyTemplate`), `app/(app)/create/page.tsx`, `components/templates/templates-view.tsx` ("Use template" link) |
| **FR-41** | Modify or delete templates | `components/templates/templates-view.tsx`, `app/api/templates/[id]/route.ts` (`PATCH`, `DELETE`), `components/ui/confirm-dialog.tsx` |
| **FR-42** | Content calendar of planned content | `app/(app)/calendar/page.tsx`, `components/calendar/calendar-view.tsx`, `app/api/calendar/route.ts`, `app/api/calendar/[id]/route.ts` |
| **FR-43** | Activity overview | `app/(app)/dashboard/page.tsx`, `components/dashboard/platform-chart.tsx` |
| **FR-44** | Calendar and activity shown only for logged-in user | `app/(app)/calendar/page.tsx`, `app/api/calendar/route.ts`, `app/api/calendar/[id]/route.ts`, `app/(app)/dashboard/page.tsx`, `supabase/migrations/001_init.sql` (RLS policies) |

---

## Non-Functional Requirements (NFR-1 … NFR-18)

| ID | Requirement Summary | Implementing File(s) |
|---|---|---|
| **NFR-1** | All traffic over HTTPS | `next.config.mjs` (`Strict-Transport-Security` + security headers), `lib/supabase/server.ts` (`secureCookieDefaults`) |
| **NFR-2** | Secrets/tokens/keys handled server-side only | `lib/llm.ts`, `lib/crypto.ts` (AES-256-GCM), `lib/connections.ts`, `lib/supabase/server.ts`, `supabase/migrations/001_init.sql`, `supabase/migrations/002_protect_tokens.sql` |
| **NFR-3** | Verify auth token on every protected API route | `middleware.ts`, `lib/supabase/middleware.ts` (`updateSession`), `lib/auth.ts` (`requireUser`) |
| **NFR-4** | Clean logout/session invalidation | `components/layout/app-shell.tsx` (`logout`), `lib/supabase/client.ts`, `lib/supabase/server.ts` |
| **NFR-5** | Strict per-user data isolation | `supabase/migrations/001_init.sql` (RLS enabled + owner policies on all tables), `scripts/test-rls.mjs` |
| **NFR-6** | DB queries scoped by userId | `app/api/**/*.ts`, `app/(app)/**/*.tsx`, `lib/connections.ts`, `lib/rate-limit.ts` |
| **NFR-7** | Never share credentials or unpublished drafts across users | `supabase/migrations/001_init.sql`, `supabase/migrations/002_protect_tokens.sql`, `lib/connections.ts`, `app/api/drafts/route.ts`, `app/api/drafts/[id]/route.ts`, `scripts/test-rls.mjs` |
| **NFR-8** | Clean responsive GUI with clear navigation | `app/globals.css`, `tailwind.config.ts`, `components/layout/app-shell.tsx`, `components/layout/nav-items.ts`, `components/ui/*` |
| **NFR-9** | AI text editable before saving/publishing | `components/create/content-editor.tsx`, `components/connections/publish-dialog.tsx` |
| **NFR-10** | Clear success feedback and meaningful error messages | `app/layout.tsx` (`Toaster`), `lib/api.ts`, `lib/auth-errors.ts`, `lib/llm.ts`, `components/**/*.tsx` |
| **NFR-11** | Browser-based on Windows/macOS/Linux | `app/layout.tsx`, `next.config.mjs`, `package.json` |
| **NFR-12** | Works across modern browsers and devices | `app/globals.css`, `tailwind.config.ts`, `components/layout/app-shell.tsx`, `components/ui/*` |
| **NFR-13** | Graceful handling of external failures without losing unsaved editor text | `lib/llm.ts` (60s timeout + 1 retry), `components/create/create-workspace.tsx` (`sessionStorage` persistence + non-destructive error state), `components/create/content-editor.tsx` |
| **NFR-14** | Transfer/redirect fallback when direct publishing unavailable | `app/api/publish/route.ts`, `components/connections/publish-dialog.tsx`, `lib/platforms/*.ts` |
| **NFR-15** | Save draft any time after generation | `components/create/content-editor.tsx`, `components/drafts/save-draft-dialog.tsx`, `components/history/history-view.tsx` |
| **NFR-16** | REST + JSON for external services | `lib/llm.ts`, `lib/platforms/linkedin.ts`, `lib/platforms/x.ts` |
| **NFR-17** | Modular `PlatformApi` adapters so new platforms need no core changes | `lib/platforms/types.ts` (`PlatformApi`), `lib/platforms/index.ts`, `lib/platforms/linkedin.ts`, `lib/platforms/x.ts`, `lib/platforms/blog.ts` |
| **NFR-18** | Responsive UI with loading indicators during async calls | `components/ui/skeleton.tsx` (`Skeleton`, `Spinner`), `components/create/content-editor.tsx`, `components/ui/button.tsx` (`loading` prop), `app/(app)/loading.tsx` |
