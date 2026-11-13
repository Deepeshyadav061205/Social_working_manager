import type { AdapterOptions, PlatformApi } from "@/lib/platforms/types";

/**
 * Blog / CMS adapter.
 * There is no universal blog API, so publishing is always a transfer:
 * copy the Markdown, download a .md file, and optionally open the user's
 * CMS "new post" URL configured in Settings.
 */
export class BlogCmsAdapter implements PlatformApi {
  readonly platform = "BLOG" as const;

  constructor(private readonly opts: AdapterOptions = {}) {}

  async verifyConnection(): Promise<boolean> {
    // Nothing to verify — the blog flow needs no credentials.
    return true;
  }

  supportsDirectPublish(): boolean {
    return false;
  }

  async publishPost() {
    return { ok: false, error: "Direct publishing is not supported for blogs. Use transfer instead." };
  }

  buildTransferLink(_content: string) {
    void _content;
    const cms = this.opts.blogCmsUrl?.trim() || "";
    const steps = [
      "Your article (Markdown) has been copied to the clipboard.",
      "Use “Download .md” to save the file if your CMS supports Markdown import.",
      cms
        ? "Click “Open CMS” to start a new post, then paste the content."
        : "Open your blog editor (set a CMS URL in Settings to get a one-click link) and paste the content.",
      "Check the title, headings and formatting, then publish from your CMS.",
    ];
    return { url: cms, instructions: steps.join("\n") };
  }
}
