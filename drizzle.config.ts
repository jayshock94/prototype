import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// drizzle-kit runs outside Next.js, so it does not pick up .env.local on its
// own. Load it explicitly, falling back to .env.
config({ path: ".env.local" });
config({ path: ".env" });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  // Prints the SQL before applying it, so nothing runs against your database
  // without you seeing it first.
  verbose: true,
  strict: true,
});
