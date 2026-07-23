import type { NextConfig } from "next";

// DEMO_STATIC=1 builds the static GitHub Pages demo (scripts/build-demo.sh);
// PAGES_BASE_PATH is "/<repo>" when deploying to a project Pages site.
const nextConfig: NextConfig =
  process.env.DEMO_STATIC === "1"
    ? {
        output: "export",
        basePath: process.env.PAGES_BASE_PATH || "",
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {};

export default nextConfig;
