"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button, ButtonLink } from "@/components/m3/button";
import { Card } from "@/components/m3/card";
import { FileField } from "@/components/m3/file-field";
import { ErrorIcon } from "@/components/m3/icons";
import { TextArea } from "@/components/m3/text-area";
import { TextField } from "@/components/m3/text-field";
import { looksLikeHtml } from "./looks-like-html";
import { createPrototype, type NewPrototypeState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Uploading…" : "Create prototype"}
    </Button>
  );
}

export function NewPrototypeForm({ maxBytes }: { maxBytes: number }) {
  const [state, formAction] = useActionState<NewPrototypeState, FormData>(
    createPrototype,
    {},
  );

  const fieldError = (field: string) => state.fieldErrors?.[field];
  const value = (field: string) => state.values?.[field] ?? "";
  const rejected = Boolean(state.error) || Boolean(state.fieldErrors);

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
              {/* The browser clears a file input when the form comes back, and
                  JavaScript is not allowed to put the file back, so this has to
                  be said rather than fixed. */}
              <p className="mt-2 text-on-surface-variant">
                Your file selection and the reviewer password were cleared —
                please choose the file and re-enter the password.
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
            One self-contained HTML file. This becomes version v1.
          </p>
        </div>

        <FileField
          name="html"
          label="Prototype HTML"
          accept=".html,.htm,text/html"
          required
          maxBytes={maxBytes}
          validateHead={(head) =>
            looksLikeHtml(head)
              ? null
              : "That does not look like an HTML file — no <html> tag was found in it."
          }
          error={Boolean(fieldError("html"))}
          supportingText={fieldError("html")}
        />
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
          maxBytes={maxBytes}
          error={Boolean(fieldError("knowledgeBaseFile"))}
          supportingText={fieldError("knowledgeBaseFile")}
        />
      </section>

      <div className="flex items-center gap-2">
        <SubmitButton />
        <ButtonLink href="/admin" variant="text">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
