import type { Metadata } from "next";

import { Card } from "@/components/m3/card";
import { ErrorIcon } from "@/components/m3/icons";
import { hasBlobToken } from "@/lib/env";
import {
  MAX_KNOWLEDGE_BASE_BYTES,
  MAX_PROTOTYPE_BYTES,
  MULTIPART_THRESHOLD_BYTES,
} from "@/lib/prototype-storage";
import { NewPrototypeForm } from "./new-prototype-form";

export const metadata: Metadata = { title: "New prototype · Admin" };

/**
 * Rendered per request, not prerendered at build. The page checks at runtime
 * whether a Blob store is connected, and a prerendered page would freeze that
 * answer at build time -- so connecting the store afterwards would leave the
 * warning showing until the next deploy.
 */
export const dynamic = "force-dynamic";

export default function NewPrototypePage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <div>
        <h1 className="text-headline-medium text-on-surface">New prototype</h1>
        <p className="mt-1 text-body-medium text-on-surface-variant">
          Upload the HTML and the portal gives you a link to send reviewers.
        </p>
      </div>

      {/* Checked before the form rather than on submit, so a missing Blob store
          is not discovered only after everything has been filled in. */}
      {!hasBlobToken() ? (
        <Card variant="outlined" className="border-error/40 p-6">
          <div className="flex gap-4">
            <span className="mt-0.5 shrink-0 text-error">
              <ErrorIcon />
            </span>
            <div>
              <h2 className="text-title-medium text-on-surface">
                File storage is not connected yet
              </h2>
              <p className="mt-2 text-body-medium text-on-surface-variant">
                Uploads need a Vercel Blob store. In the Vercel dashboard go to
                Storage, create a Blob store, and connect it to this project.
                Then run <code className="text-body-medium">vercel env pull</code>{" "}
                to copy <code className="text-body-medium">BLOB_READ_WRITE_TOKEN</code>{" "}
                into your <code className="text-body-medium">.env.local</code>.
                README.md has the full steps.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {/* Limits are passed in from the server: the module that defines them
          is server-only, because it also holds the Blob credentials. */}
      <NewPrototypeForm
        maxBytes={MAX_PROTOTYPE_BYTES}
        multipartThreshold={MULTIPART_THRESHOLD_BYTES}
        maxKnowledgeBaseBytes={MAX_KNOWLEDGE_BASE_BYTES}
      />
    </div>
  );
}
