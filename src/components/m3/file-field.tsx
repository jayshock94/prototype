"use client";

/**
 * File picker, styled the Material 3 way.
 *
 * Material 3 has no file input component, and a browser's native one cannot be
 * restyled. The usual workaround applies: the real input is visually hidden but
 * still present and still focusable, and a styled row sits in front of it.
 *
 * Two modes:
 *
 *  - Give it a `name` and it behaves like a normal form field: the file is
 *    serialised with the form on submit. Right for small files.
 *  - Give it `onFileChange` and no `name` and the chosen File is handed to the
 *    parent instead, and never serialised with the form. Right for anything
 *    large, which needs to go straight to storage rather than through a server
 *    action, and right whenever the selection has to survive a failed submit --
 *    a browser will not let JavaScript put a file back into a file input, but
 *    a File held in React state is unaffected.
 *
 * Validation happens on selection rather than on submit, so an obviously wrong
 * file is caught before anything is sent anywhere.
 */

import { useId, useState, type ChangeEvent } from "react";

import { formatBytes } from "@/components/m3/format";

export interface FileFieldProps {
  label: string;
  /** Serialise with the form under this name. Omit when using onFileChange. */
  name?: string;
  accept?: string;
  required?: boolean;
  supportingText?: string;
  error?: boolean;
  /** Reject and report anything larger, before the form is submitted. */
  maxBytes?: number;
  /**
   * Inspect the start of the file and return an error message, or null if it
   * is fine. Receives the first few kilobytes decoded as text, which is enough
   * to tell an HTML document from something that merely got named ".html".
   */
  validateHead?: (head: string, file: File) => string | null;
  /** Called with the accepted file, or null when cleared or rejected. */
  onFileChange?: (file: File | null) => void;
  /**
   * The file to display. Pass this alongside onFileChange so the control still
   * shows the selection after a failed submit has cleared the input itself.
   */
  value?: File | null;
}

export function FileField({
  label,
  name,
  accept,
  required = false,
  supportingText,
  error = false,
  maxBytes,
  validateHead,
  onFileChange,
  value,
}: FileFieldProps) {
  const inputId = useId();
  const [ownFile, setOwnFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  // The parent's file wins when it is managing the selection.
  const file = onFileChange ? (value ?? null) : ownFile;

  function accept_(next: File | null) {
    setOwnFile(next);
    setLocalError(null);
    onFileChange?.(next);
  }

  function reject(input: HTMLInputElement, message: string) {
    // Clearing the input stops a file we have already rejected from being
    // submitted anyway.
    input.value = "";
    setOwnFile(null);
    setLocalError(message);
    onFileChange?.(null);
  }

  async function onChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const chosen = input.files?.[0];

    if (!chosen) {
      accept_(null);
      return;
    }

    if (maxBytes && chosen.size > maxBytes) {
      reject(
        input,
        `That file is ${formatBytes(chosen.size)}. The limit is ${formatBytes(maxBytes)}.`,
      );
      return;
    }

    if (validateHead) {
      const head = await chosen.slice(0, 4096).text();
      const problem = validateHead(head, chosen);
      if (problem) {
        reject(input, problem);
        return;
      }
    }

    accept_(chosen);
  }

  const showError = error || Boolean(localError);
  const message = localError ?? supportingText;
  const describedBy = message ? `${inputId}-supporting` : undefined;

  return (
    <div className="w-full">
      <div
        className={[
          "relative flex items-center gap-4 rounded-xs border px-4 py-3",
          "transition-colors duration-[--md-sys-motion-duration-short] ease-standard",
          showError
            ? "border-error"
            : "border-outline focus-within:border-2 focus-within:border-primary hover:border-on-surface",
        ].join(" ")}
      >
        <input
          id={inputId}
          type="file"
          name={name}
          accept={accept}
          required={required}
          onChange={onChange}
          aria-describedby={describedBy}
          // Not `hidden` and not display:none -- either would take it out of the
          // tab order and stop it being focusable.
          className="absolute inset-0 cursor-pointer opacity-0"
        />
        <span
          aria-hidden
          className="m3-state-layer inline-flex h-9 shrink-0 items-center rounded-full border border-outline px-4 text-label-large text-primary"
        >
          Choose file
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-body-small text-on-surface-variant">{label}</span>
          <span className="block truncate text-body-medium text-on-surface">
            {file ? (
              <>
                {file.name}
                <span className="text-on-surface-variant"> · {formatBytes(file.size)}</span>
              </>
            ) : (
              <span className="text-on-surface-variant">No file chosen</span>
            )}
          </span>
        </span>
      </div>

      {message ? (
        <p
          id={describedBy}
          className={[
            "mt-1 px-4 text-body-small",
            showError ? "text-error" : "text-on-surface-variant",
          ].join(" ")}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
