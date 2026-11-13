import type { MetadataRoute } from "next";

/**
 * Restrict search crawlers from indexing authenticated workspace views,
 * API route handlers, or OAuth callback endpoints.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: [
          "/api/",
          "/auth/",
          "/dashboard",
          "/create",
          "/drafts",
          "/history",
          "/templates",
          "/calendar",
          "/connections",
          "/settings",
        ],
      },
    ],
  };
}
