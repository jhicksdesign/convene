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
