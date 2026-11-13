import type { Platform } from "@/lib/types";
import { BlogCmsAdapter } from "@/lib/platforms/blog";
import { LinkedInAdapter } from "@/lib/platforms/linkedin";
import { XTwitterAdapter } from "@/lib/platforms/x";
import type { AdapterOptions, PlatformAdapter } from "@/lib/platforms/types";

/**
 * Adapter registry. To add a platform: create an adapter implementing
 * PlatformApi (and optionally OAuthCapable) and add one line here.
 */
const registry: Record<Platform, (opts: AdapterOptions) => PlatformAdapter> = {
  LINKEDIN: () => new LinkedInAdapter(),
  X_TWITTER: () => new XTwitterAdapter(),
  BLOG: (opts) => new BlogCmsAdapter(opts),
};

export function getPlatformAdapter(platform: Platform, opts: AdapterOptions = {}): PlatformAdapter {
  return registry[platform](opts);
}

export { isOAuthCapable } from "@/lib/platforms/types";
export type { PlatformApi, PlatformAdapter } from "@/lib/platforms/types";
