import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Produces .next/standalone with a self-contained server.js — exactly what
  // our Docker image runs. Required for the Railway container deploy.
  output: "standalone",

  serverExternalPackages: ["@prisma/client", "@aws-sdk/client-s3"],

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.r2.dev" },
      { protocol: "https", hostname: "**.cloudflarestorage.com" },
      { protocol: "https", hostname: "imagedelivery.net" },
      // R2 served behind a Cloudflare custom domain — set R2_PUBLIC_HOSTNAME
      // (e.g. "media.convene.com") so next/image will accept it.
      ...(process.env.R2_PUBLIC_HOSTNAME
        ? [{ protocol: "https" as const, hostname: process.env.R2_PUBLIC_HOSTNAME }]
        : []),
    ],
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  tunnelRoute: "/monitoring",
  disableLogger: true,
  telemetry: false,
});
