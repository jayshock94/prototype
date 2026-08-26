import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      /**
       * Prototype HTML does NOT come through here -- the browser uploads it
       * straight to Blob storage, and the server action receives only the
       * resulting URL. See src/app/api/prototype-upload/route.ts.
       *
       * So this limit only has to cover the form's text fields plus an optional
       * markdown knowledge base, which MAX_KNOWLEDGE_BASE_BYTES caps at 1 MB.
       * 2 MB leaves room without inviting anything large back through a path
       * that Vercel caps at 4.5 MB regardless.
       */
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
