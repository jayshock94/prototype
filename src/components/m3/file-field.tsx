"use client";

/**
 * File picker, styled the Material 3 way.
 *
 * Material 3 has no file input component, and a browser's native one cannot be
 * restyled. The usual workaround applies: the real input is visually hidden but
 * still present and still focusable, and a styled row sits in front of it. The
 * input keeps its native keyboard behaviour and its name, so a plain form
 * submit still carries the file.
 *
 * It reports the chosen file's name and size, because "did it actually pick up
 * my file" is the main question this control has to answer.
 *
 * Validation happens here, on selection, rather than on submit. That is not
 * just for speed: a browser will not let JavaScript put a file back into a file
 * input, so a form that round-trips to the server and comes back with an error
 * has silently lost the user's file and they have to find it again. Catching
 * the obvious problems -- too big, not the right kind of file -- at the moment
 * of choosing avoids that entirely. The server still re-checks everything.
 */

import { useId, useRef, useState, type ChangeEvent } from "react";

import { formatBytes } from "@/components/m3/format";

export interface FileFieldProps {
  name: string;
  label: string;
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
}

export function FileField({
  name,
  label,
  accept,
  required = false,
  supportingText,
  error = false,
  maxBytes,
  validateHead,
}: FileFieldProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  function reject(input: HTMLInputElement, message: string) {
    // Clearing the input stops a file we have already rejected from being
    // submitted anyway.
    input.value = "";
    setFileName(null);
    setFileSize(null);
    setLocalError(message);
  }

  async function onChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const file = input.files?.[0];

    if (!file) {
      setFileName(null);
      setFileSize(null);
      setLocalError(null);
      return;
    }

    if (maxBytes && file.size > maxBytes) {
      reject(
        input,
        `That file is ${formatBytes(file.size)}. The limit is ${formatBytes(maxBytes)}.`,
      );
      return;
    }

    if (validateHead) {
      const head = await file.slice(0, 4096).text();
      const problem = validateHead(head, file);
      if (problem) {
        reject(input, problem);
        return;
      }
    }

    setFileName(file.name);
    setFileSize(file.size);
    setLocalError(null);
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
          ref={inputRef}
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
            {fileName ? (
              <>
                {fileName}
                {fileSize !== null ? (
                  <span className="text-on-surface-variant"> · {formatBytes(fileSize)}</span>
                ) : null}
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
