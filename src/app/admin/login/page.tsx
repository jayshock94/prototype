import type { Metadata } from "next";

import { Card } from "@/components/m3/card";
import { ErrorIcon, LockIcon } from "@/components/m3/icons";
import { hasAdminPassword } from "@/lib/env";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in · Prototype Review Portal" };

/**
 * Rendered per request. Whether an admin password is configured is a runtime
 * fact, and a prerendered page would freeze the answer at build time.
 */
export const dynamic = "force-dynamic";

/**
 * Shown when ADMIN_PASSWORD is not set.
 *
 * Without this the page renders a sign-in form that cannot possibly succeed:
 * submitting it throws deep in the server action and the visitor gets a bare
 * error page naming nothing. The dashboard already explains a missing database
 * this way; a missing password deserves the same treatment.
 */
function NotConfigured() {
  return (
    <Card variant="elevated" className="w-full max-w-md p-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-error-container text-on-error-container">
          <ErrorIcon />
        </span>
        <h1 className="text-headline-small text-on-surface">Not set up yet</h1>
        <p className="text-body-medium text-on-surface-variant">
          There is no admin password configured, so there is nothing to sign in
          with. Add an environment variable named{" "}
          <code className="text-body-medium">ADMIN_PASSWORD</code> with the
          password you want to use, then redeploy — environment variables only
          take effect on a new build.
        </p>
        <p className="text-body-small text-on-surface-variant">
          On Vercel: Project Settings → Environments → Production. README.md has
          the full steps.
        </p>
      </div>
    </Card>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  // Only accept a same-site path. The action re-checks this too -- a query
  // string is user input and cannot be trusted just because it looks harmless.
  const safeNext =
    next && next.startsWith("/") && !next.startsWith("//") ? next : "/admin";

  if (!hasAdminPassword()) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-surface-container-lowest px-4 py-12">
        <NotConfigured />
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface-container-lowest px-4 py-12">
      <Card variant="elevated" className="w-full max-w-sm p-8">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
            <LockIcon />
          </span>
          <div>
            <h1 className="text-headline-small text-on-surface">Prototype Review Portal</h1>
            <p className="mt-1 text-body-medium text-on-surface-variant">
              Admin area. Reviewers do not sign in here.
            </p>
          </div>
        </div>

        <LoginForm next={safeNext} />
      </Card>
    </main>
  );
}
