"use client";

import { useState } from "react";

import { Button } from "@/components/m3/button";

/**
 * Shows a link and copies it to the clipboard.
 *
 * The reviewer link is the thing you actually send people, so the useful
 * action is "copy", not "open". Falls back to selecting the text if the
 * clipboard is unavailable -- it needs a secure context, so it is missing over
 * plain http in local development.
 */
export function CopyLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    // Built in the browser so it carries whatever domain this is being viewed
    // on, rather than a domain hardcoded at build time.
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <code className="min-w-0 flex-1 truncate rounded-xs bg-surface-container px-3 py-2 text-body-small text-on-surface-variant">
        {path}
      </code>
      <Button variant="outlined" onClick={copy}>
        {copied ? "Copied" : "Copy link"}
      </Button>
    </div>
  );
}
