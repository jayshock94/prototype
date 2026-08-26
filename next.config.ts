import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Nothing exotic here on purpose. Chunk 2 will add the /p/[versionId] route
  // handler that serves prototype HTML from our own origin.
};

export default nextConfig;
