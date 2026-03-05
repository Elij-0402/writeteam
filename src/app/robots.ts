import type { MetadataRoute } from "next"

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://writeteam.app"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/login", "/signup"],
      disallow: ["/dashboard", "/editor", "/series", "/canvas", "/settings", "/api"],
    },
    sitemap: `${appUrl}/sitemap.xml`,
  }
}
