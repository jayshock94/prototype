"use client";

import { upload } from "@vercel/blob/client";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button, ButtonLink } from "@/components/m3/button";
import { Card } from "@/components/m3/card";
import { FileField } from "@/components/m3/file-field";
import { formatBytes } from "@/components/m3/format";
import { ErrorIcon } from "@/components/m3/icons";
import { LinearProgress } from "@/components/m3/linear-progress";
import { TextArea } from "@/components/m3/text-area";
import { TextField } from "@/components/m3/text-field";
import { looksLikeHtml } from "./looks-like-html";
import { createPrototype, type NewPrototypeState } from "./actions";

function SubmitButton({ uploading }: { uploading: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {uploading ? "Uploading…" : pending ? "Saving…" : "Create prototype"}
    </Button>
  );
}

export function NewPrototypeForm({
  maxBytes,
  multipartThreshold,
  maxKnowledgeBaseBytes,
}: {
  maxBytes: number;
  multipartThreshold: number;
  maxKnowledgeBaseBytes: number;
}) {
  /**
   * The prototype file is held here rather than left in the file input.
   *
   * Two reasons. It never gets serialised with the form, so an 8 MB prototype
   * does not have to squeeze through Vercel's 4.5 MB limit on a function
   * request body. And it survives a failed submit: React clears uncontrolled
   * form fields after an action runs, and a browser will not let JavaScript put
   * a file back into a file input -- but a File in state is untouched, so a
   * validation error no longer means hunting for the file again.
   */
  const [htmlFile, setHtmlFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  /**
   * Runs in the browser, then hands off to the server action.
   *
   * The file goes straight from here to Blob storage. The server never sees it
   * -- it receives only the resulting URL, and re-verifies that the blob really
   * exists in our store before writing anything.
   */
  async function submit(
    previous: NewPrototypeState,
    formData: FormData,
  ): Promise<NewPrototypeState> {
    const values = {
      name: String(formData.get("name") ?? ""),
      ticket: String(formData.get("ticket") ?? ""),
      description: String(formData.get("description") ?? ""),
      reviewerNames: String(formData.get("reviewerNames") ?? ""),
      knowledgeBaseText: String(formData.get("knowledgeBaseText") ?? ""),
    };

    if (!htmlFile) {
      return { fieldErrors: { html: "Choose the prototype's HTML file." }, values };
    }

    // The prototype's id is decided here so the file can be stored under it
    // before the row exists. The server checks that the blob it is told about
    // really does live under this id.
    const prototypeId = crypto.randomUUID();

    setProgress(0);
    try {
      const blob = await upload(`prototypes/${prototypeId}/v1.html`, htmlFile, {
        access: "private",
        contentType: "text/html",
        handleUploadUrl: "/api/prototype-upload",
        // Large files are split into parts sent in parallel, so one dropped
        // chunk is retried on its own instead of restarting the upload.
        multipart: htmlFile.size > multipartThreshold,
        onUploadProgress: ({ percentage }) => setProgress(percentage),
      });

      formData.set("prototypeId", prototypeId);
      formData.set("htmlBlobUrl", blob.url);
    } catch (error) {
      setProgress(null);
      return {
        error:
          "The file could not be uploaded. " +
          (error instanceof Error ? error.message : String(error)),
        values,
      };
    }

    setProgress(null);
    return createPrototype(previous, formData);
  }

  const [state, formAction] = useActionState<NewPrototypeState, FormData>(submit, {});

  const fieldError = (field: string) => state.fieldErrors?.[field];
  const value = (field: string) => state.values?.[field] ?? "";
  const rejected = Boolean(state.error) || Boolean(state.fieldErrors);
  const uploading = progress !== null;

  return (
    <form action={formAction} className="flex flex-col gap-8">
      {rejected ? (
        <Card variant="outlined" className="border-error/40 p-4">
          <div className="flex gap-3">
            <span className="mt-0.5 shrink-0 text-error">
              <ErrorIcon className="size-5" />
            </span>
            <div className="text-body-medium text-on-surface">
              {state.error ? <p>{state.error}</p> : <p>Some details need fixing.</p>}
              {/* React clears uncontrolled fields after an action runs. The
                  prototype file is kept in state so it survives, but the
                  password cannot be echoed back into the page. */}
              <p className="mt-2 text-on-surface-variant">
                Please re-enter the reviewer password. Your file is still
                selected.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      <section className="flex flex-col gap-6">
        <div>
          <h2 className="text-title-medium text-on-surface">What is it</h2>
          <p className="text-body-small text-on-surface-variant">
            Shown to reviewers at the top of the review page.
          </p>
        </div>

        <TextField
          id="name"
          name="name"
          label="Prototype name"
          required
          defaultValue={value("name")}
          error={Boolean(fieldError("name"))}
          supportingText={fieldError("name")}
        />

        <TextField
          id="ticket"
          name="ticket"
          label="Ticket (optional)"
          defaultValue={value("ticket")}
          supportingText="For example JIRA-1234."
        />

        <TextArea
          id="description"
          name="description"
          label="Description (optional)"
          rows={3}
          defaultValue={value("description")}
          supportingText="A sentence or two on what this prototype is for."
        />
      </section>

      <section className="flex flex-col gap-6">
        <div>
          <h2 className="text-title-medium text-on-surface">Who can see it</h2>
          <p className="text-body-small text-on-surface-variant">
            Reviewers enter this password, then pick their name from the list.
          </p>
        </div>

        <TextField
          id="password"
          name="password"
          label="Reviewer password"
          type="text"
          required
          minLength={6}
          autoComplete="off"
          error={Boolean(fieldError("password"))}
          supportingText={
            fieldError("password") ??
            "You will send this to reviewers, so make it easy to type."
          }
        />

        <TextArea
          id="reviewerNames"
          name="reviewerNames"
          label="Reviewer names, one per line"
          rows={5}
          required
          defaultValue={value("reviewerNames")}
          error={Boolean(fieldError("reviewerNames"))}
          supportingText={
            fieldError("reviewerNames") ??
            "Reviewers pick their name from this list. They can also enter one that is not here."
          }
        />
      </section>

      <section className="flex flex-col gap-6">
        <div>
          <h2 className="text-title-medium text-on-surface">The prototype</h2>
          <p className="text-body-small text-on-surface-variant">
            One self-contained HTML file, up to {formatBytes(maxBytes)}. This
            becomes version v1.
          </p>
        </div>

        {/* No `name`: the file is uploaded straight to storage from the browser
            and must never be serialised with the form. */}
        <FileField
          label="Prototype HTML"
          accept=".html,.htm,text/html"
          maxBytes={maxBytes}
          value={htmlFile}
          onFileChange={setHtmlFile}
          validateHead={(head) =>
            looksLikeHtml(head)
              ? null
              : "That does not look like an HTML file — no <html> tag was found in it."
          }
          error={Boolean(fieldError("html"))}
          supportingText={fieldError("html")}
        />

        {uploading ? (
          <LinearProgress
            value={progress ?? 0}
            label={`Uploading ${htmlFile?.name ?? "file"}`}
          />
        ) : null}
      </section>

      <section className="flex flex-col gap-6">
        <div>
          <h2 className="text-title-medium text-on-surface">Knowledge base</h2>
          <p className="text-body-small text-on-surface-variant">
            Context the AI assistant will use to answer reviewers&rsquo; questions.
            Optional now, and you can add it later. Paste it below, or upload a
            markdown file -- if you do both, the file wins.
          </p>
        </div>

        <TextArea
          id="knowledgeBaseText"
          name="knowledgeBaseText"
          label="Knowledge base (markdown)"
          rows={8}
          defaultValue={value("knowledgeBaseText")}
        />

        <FileField
          name="knowledgeBaseFile"
          label="Or upload a markdown file"
          accept=".md,.markdown,text/markdown"
          maxBytes={maxKnowledgeBaseBytes}
          error={Boolean(fieldError("knowledgeBaseFile"))}
          supportingText={fieldError("knowledgeBaseFile")}
        />
      </section>

      <div className="flex items-center gap-2">
        <SubmitButton uploading={uploading} />
        <ButtonLink href="/admin" variant="text">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
