import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { dbError, jsonError, parseBody } from "@/lib/api";
import { getConnectionWithToken, getValidToken, setConnectionState } from "@/lib/connections";
import { getPlatformAdapter } from "@/lib/platforms";
import { countChars, splitXPosts } from "@/lib/text";
import { PLATFORM_LABEL, X_MAX_CHARS, type PublishMode } from "@/lib/types";
import { publishSchema } from "@/lib/validators";

export const runtime = "nodejs";
export const maxDuration = 60;

export type PublishResult =
  | { mode: "DIRECT_API"; jobId: string | null; postId?: string; url?: string; message: string }
  | {
      mode: "TRANSFER_REDIRECT";
      jobId: string | null;
      url: string;
      instructions: string;
      /** Why we fell back to transfer (null when transfer was the plan from the start). */
      reason: string | null;
      message: string;
      postId?: string;
      liveUrl?: string;
      failedPart?: number;
    };

/**
 * POST /api/publish
 *  1. verify session + ownership of the content/draft
 *  2. load connection, check status + token validity
 *  3. connected & direct-capable → publishPost(), record DIRECT_API job
 *  4. otherwise → Transfer/Redirect fallback, record TRANSFER_REDIRECT job
 *  5. API error (rate limit / expired token) → automatic fallback to 4 with a clear reason
 */
export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth;

  const parsed = await parseBody(req, publishSchema);
  if (!parsed.ok) return parsed.response;
  const { body, platform, contentId, draftId, forceTransfer } = parsed.data;

  // ---- 1. Ownership ----
  if (contentId) {
    const { data } = await supabase.from("generated_content").select("id").eq("id", contentId).eq("user_id", user.id).maybeSingle();
    if (!data) return jsonError("Content not found.", 404);
  }
  if (draftId) {
    const { data } = await supabase.from("drafts").select("id").eq("id", draftId).eq("user_id", user.id).maybeSingle();
    if (!data) return jsonError("Draft not found.", 404);
  }

  if (platform === "X_TWITTER") {
    const posts = splitXPosts(body);
    const over = posts.findIndex((p) => countChars(p) > X_MAX_CHARS);
    if (over >= 0) {
      return jsonError(
        `Post ${over + 1} is ${countChars(posts[over])} characters — X allows ${X_MAX_CHARS}. Shorten it or split it with a line containing ---.`,
        400
      );
    }
  }

  const { data: profile } = await supabase.from("profiles").select("blog_cms_url").eq("id", user.id).maybeSingle();
  const adapter = getPlatformAdapter(platform, { blogCmsUrl: (profile?.blog_cms_url as string | null) ?? null });
  const label = PLATFORM_LABEL[platform];

  const recordJob = async (row: {
    mode: PublishMode;
    status: string;
    connection_id?: string | null;
    external_post_id?: string | null;
    external_url?: string | null;
    error?: string | null;
    published_at?: string | null;
  }) => {
    const { data, error } = await supabase
      .from("publish_jobs")
      .insert({ user_id: user.id, content_id: contentId ?? null, draft_id: draftId ?? null, platform, ...row })
      .select("id")
      .single();
    if (error) console.error("[publish] could not record job", error.message);
    return (data?.id as string | undefined) ?? null;
  };

  // ---- 2/3. Direct publish attempt ----
  let fallbackReason: string | null = null;
  let connectionId: string | null = null;
  let partialPostId: string | undefined;
  let partialLiveUrl: string | undefined;
  let partialFailedPart: number | undefined;

  if (!forceTransfer && adapter.supportsDirectPublish()) {
    const conn = await getConnectionWithToken(user.id, platform);
    connectionId = conn?.id ?? null;

    if (conn && (conn.status === "CONNECTED" || (conn.status === "TOKEN_EXPIRED" && conn.refreshToken))) {
      const validToken = await getValidToken(user.id, platform);
      if (!validToken) {
        fallbackReason = `Your ${label} connection has expired, so we switched to transfer mode. Reconnect in Connections to publish directly.`;
      } else {
        const result = await adapter.publishPost(body, validToken);
        if (result.ok) {
          const jobId = await recordJob({
            mode: "DIRECT_API",
            status: "PUBLISHED",
            connection_id: conn.id,
            external_post_id: result.postId ?? null,
            external_url: result.url ?? null,
            published_at: new Date().toISOString(),
          });
          if (draftId) {
            await supabase
              .from("calendar_entries")
              .update({ status: "PUBLISHED" })
              .eq("user_id", user.id)
              .eq("draft_id", draftId)
              .eq("status", "PLANNED");
          }
          const out: PublishResult = {
            mode: "DIRECT_API",
            jobId,
            postId: result.postId,
            url: result.url,
            message: `Published to ${label}.`,
          };
          return NextResponse.json(out);
        }
        // ---- 5. API failure → fall back ----
        if (result.status === 401) await setConnectionState(user.id, platform, "TOKEN_EXPIRED");
        partialPostId = result.postId;
        partialLiveUrl = result.url;
        partialFailedPart = result.failedPart;
        await recordJob({
          mode: "DIRECT_API",
          status: "FAILED",
          connection_id: conn.id,
          external_post_id: result.postId ?? null,
          external_url: result.url ?? null,
          error: result.error ?? "Unknown error",
        });
        fallbackReason = `${result.error ?? `${label} publishing failed.`} We switched to transfer mode so you can still post it.`;
      }
    } else if (conn && (conn.status === "TOKEN_EXPIRED" || conn.status === "AUTH_FAILED")) {
      fallbackReason = `Your ${label} connection needs attention (${conn.status === "TOKEN_EXPIRED" ? "token expired" : "authorization failed"}). Using transfer mode instead.`;
    }
  }

  // ---- 4. Transfer / Redirect fallback (always available; no credentials needed) ----
  const link = adapter.buildTransferLink(body);
  const jobId = await recordJob({
    mode: "TRANSFER_REDIRECT",
    status: "TRANSFERRED",
    connection_id: connectionId,
    error: fallbackReason,
    published_at: new Date().toISOString(),
  });
  if (!jobId && !fallbackReason) {
    // Transfer still works client-side; just tell the user the log entry failed.
    console.warn("[publish] transfer job not recorded");
  }
  const out: PublishResult = {
    mode: "TRANSFER_REDIRECT",
    jobId,
    url: link.url,
    instructions: link.instructions,
    reason: fallbackReason,
    message: `Ready to transfer to ${label}.`,
    postId: partialPostId,
    liveUrl: partialLiveUrl,
    failedPart: partialFailedPart,
  };
  return NextResponse.json(out);
}

// Keep dbError referenced for consistency with other routes' error helpers.
void dbError;
