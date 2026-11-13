"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Info, Plug, RefreshCw, Settings, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PlatformIcon } from "@/components/ui/platform-icon";
import {
  CONNECTION_STATE_LABEL,
  PLATFORM_LABEL,
  PLATFORM_SLUG,
  type ConnectionState,
  type Platform,
  type PlatformConnectionPublic,
} from "@/lib/types";
import { apiFetch } from "@/lib/utils";

function statusTone(state: ConnectionState): "success" | "yellow" | "danger" | "muted" {
  switch (state) {
    case "CONNECTED":
      return "success";
    case "CONNECTING":
      return "yellow";
    case "TOKEN_EXPIRED":
    case "AUTH_FAILED":
      return "danger";
    case "DISCONNECTED":
      return "muted";
  }
}

const DESCRIPTIONS: Record<Platform, string> = {
  LINKEDIN:
    "Connect your LinkedIn account via OAuth 2.0 to publish directly from the editor, or use one-click transfer with zero credentials.",
  X_TWITTER:
    "Connect your X account via OAuth 2.0 (PKCE) to publish single posts and threads directly, or use the X intent composer.",
  BLOG:
    "Blogs use Markdown export (.md download + clipboard copy) and an optional CMS link configured in Settings.",
};

export function ConnectionsView({
  initialConnections,
  blogCmsUrl,
  flashConnected,
  flashError,
}: {
  initialConnections: PlatformConnectionPublic[];
  blogCmsUrl: string | null;
  flashConnected?: string | null;
  flashError?: string | null;
}) {
  const [connections, setConnections] = useState<PlatformConnectionPublic[]>(initialConnections);
  const [busyPlatform, setBusyPlatform] = useState<Platform | null>(null);
  const [verifyingPlatform, setVerifyingPlatform] = useState<Platform | null>(null);

  useEffect(() => {
    if (flashConnected) {
      toast.success(`Connected to ${flashConnected === "x" ? "X" : "LinkedIn"}.`);
    }
    if (flashError) {
      const messages: Record<string, string> = {
        not_configured:
          "OAuth client credentials are not configured on the server yet. Transfer mode remains ready to use.",
        denied: "Authorization was cancelled.",
        state_mismatch: "Security state check failed. Please try connecting again.",
        auth_failed: "Authorization failed with the provider. Please try again.",
        save_failed: "Could not store the connection token.",
      };
      toast.error(messages[flashError] ?? "Could not complete connection.");
    }
  }, [flashConnected, flashError]);

  const disconnect = async (platform: Platform) => {
    const slug = PLATFORM_SLUG[platform];
    setBusyPlatform(platform);
    try {
      await apiFetch(`/api/connections/${slug}/disconnect`, { method: "POST" });
      setConnections((prev) =>
        prev.map((c) =>
          c.platform === platform
            ? { ...c, status: "DISCONNECTED", external_account: null, expires_at: null }
            : c
        )
      );
      toast.success(`Disconnected from ${PLATFORM_LABEL[platform]}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not disconnect.");
    } finally {
      setBusyPlatform(null);
    }
  };

  const verifyConnection = async (platform: Platform) => {
    const slug = PLATFORM_SLUG[platform];
    setVerifyingPlatform(platform);
    try {
      const res = await apiFetch<{
        ok: boolean;
        connection: PlatformConnectionPublic | null;
        message: string;
      }>(`/api/connections/${slug}/verify`, { method: "POST" });
      if (res.connection) {
        setConnections((prev) =>
          prev.map((c) => (c.platform === platform ? res.connection! : c))
        );
      }
      if (res.ok) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not verify connection.");
    } finally {
      setVerifyingPlatform(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Platform connections</h1>
        <p className="mt-1 text-sm text-muted">
          Connect accounts for direct API publishing, or publish anytime using Transfer mode.
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-card border border-line bg-surface-1 p-4 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue" aria-hidden />
        <p className="text-muted">
          <strong className="text-foreground">Always demoable:</strong> Even when a platform is{" "}
          <em>Disconnected</em> (or OAuth keys are not set), clicking{" "}
          <strong className="text-foreground">Publish / Transfer</strong> in the editor copies your content,
          opens the platform composer, and guides you step by step.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {connections.map((conn) => {
          const slug = PLATFORM_SLUG[conn.platform];
          const label = PLATFORM_LABEL[conn.platform];
          const isBlog = conn.platform === "BLOG";
          const connected = conn.status === "CONNECTED";
          const needsReconnect =
            conn.status === "TOKEN_EXPIRED" || conn.status === "AUTH_FAILED";

          return (
            <Card key={conn.platform} className="flex flex-col justify-between">
              <div>
                <CardHeader>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-control border border-line bg-surface-2 text-foreground">
                      <PlatformIcon platform={conn.platform} className="h-5 w-5" />
                    </span>
                    <Badge tone={isBlog ? "yellow" : statusTone(conn.status)}>
                      {isBlog ? "Transfer & Markdown ready" : CONNECTION_STATE_LABEL[conn.status]}
                    </Badge>
                  </div>
                  <CardTitle>{label}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted">{DESCRIPTIONS[conn.platform]}</p>
                  {conn.external_account && (
                    <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden />
                      Account: {conn.external_account}
                    </p>
                  )}
                  {conn.expires_at && (
                    <p className="text-xs text-muted">
                      Token expiry:{" "}
                      <span className="font-medium text-foreground">
                        {new Date(conn.expires_at).toLocaleString()}
                      </span>
                    </p>
                  )}
                  {isBlog && (
                    <p className="text-xs text-muted">
                      CMS URL:{" "}
                      <span className="font-medium text-foreground">
                        {blogCmsUrl || "Not set (configure in Settings)"}
                      </span>
                    </p>
                  )}
                  {!isBlog && !conn.configured && (
                    <p className="rounded-control border border-line bg-surface-2 px-2.5 py-1.5 text-xs text-muted">
                      OAuth keys not set in environment — Transfer mode is active by default.
                    </p>
                  )}
                </CardContent>
              </div>

              <CardFooter className="flex-wrap justify-between gap-2 border-t border-line pt-3">
                {isBlog ? (
                  <Button asChild size="sm" variant="secondary">
                    <Link href="/settings">
                      <Settings /> Configure CMS URL
                    </Link>
                  </Button>
                ) : (
                  <>
                    {!connected && (
                      <Button asChild size="sm" variant="primary">
                        <a href={`/api/connections/${slug}/connect`}>
                          {needsReconnect ? <RefreshCw /> : <Plug />}
                          {needsReconnect ? "Reconnect" : "Connect"}
                        </a>
                      </Button>
                    )}
                    {connected && (
                      <Button asChild size="sm" variant="secondary">
                        <a href={`/api/connections/${slug}/connect`}>
                          <RefreshCw /> Reconnect
                        </a>
                      </Button>
                    )}
                    {(connected || needsReconnect) && (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        loading={verifyingPlatform === conn.platform}
                        onClick={() => verifyConnection(conn.platform)}
                      >
                        <CheckCircle2 /> Test connection
                      </Button>
                    )}
                    {(connected || needsReconnect || conn.status === "CONNECTING") && (
                      <ConfirmDialog
                        title={`Disconnect ${label}?`}
                        description={`Stored OAuth tokens for ${label} will be removed immediately.`}
                        confirmLabel="Disconnect"
                        onConfirm={() => disconnect(conn.platform)}
                      >
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          loading={busyPlatform === conn.platform}
                        >
                          <Unplug /> Disconnect
                        </Button>
                      </ConfirmDialog>
                    )}
                  </>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
