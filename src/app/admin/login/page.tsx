import type { Metadata } from "next";

import { Card } from "@/components/m3/card";
import { LockIcon } from "@/components/m3/icons";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in · Prototype Review Portal" };

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
