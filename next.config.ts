import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      /**
       * Prototype HTML is uploaded through a server action, and the default
       * limit for that is 1 MB -- easily exceeded by a self-contained file with
       * images inlined as base64.
       *
       * 4.5 MB is the ceiling worth setting, because that is Vercel's own limit
       * on a serverless function's request body. Raising this number further
       * would not help: the platform would reject the request before our code
       * ran. src/lib/prototype-storage.ts checks the size up front so an
       * oversized file gets a clear message instead of a bare 413, and notes
       * what to switch to if prototypes outgrow this.
       */
      bodySizeLimit: "4.5mb",
    },
  },
};

export default nextConfig;
