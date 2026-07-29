import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  assetPrefix: "/static",
  poweredByHeader: false,
  images: { unoptimized: true },
};

export default nextConfig;
