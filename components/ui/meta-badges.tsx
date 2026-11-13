import { Badge } from "@/components/ui/badge";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { PLATFORM_LABEL, TONE_LABEL, type Platform, type Tone } from "@/lib/types";

const PLATFORM_TONE: Record<Platform, "blue" | "white" | "yellow"> = {
  LINKEDIN: "blue",
  X_TWITTER: "white",
  BLOG: "yellow",
};

export function PlatformBadge({ platform }: { platform: Platform }) {
  return (
    <Badge tone={PLATFORM_TONE[platform]}>
      <PlatformIcon platform={platform} />
      {PLATFORM_LABEL[platform]}
    </Badge>
  );
}

export function ToneBadge({ tone }: { tone: Tone }) {
  return <Badge tone="muted">{TONE_LABEL[tone]}</Badge>;
}
