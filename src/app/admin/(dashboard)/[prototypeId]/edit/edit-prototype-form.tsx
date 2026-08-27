"use client";

/**
 * The edit form.
 *
 * Deliberately laid out in the same four sections as the create form, so the
 * two read as the same screen twice rather than as two different tools. The
 * differences are all in what the fields start out holding, plus two rules
 * that only make sense when a record already exists:
 *
 *   - The password field starts empty and means "change it to this". Blank
 *     leaves the existing password alone.
 *   - Everything else starts filled in with what is stored, and saving writes
 *     back exactly what is on screen.
 *
 * There is no file upload here, so unlike the create form this posts straight
 * to the server action with no browser-side upload step in front of it.
 */

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button, ButtonLink } from "@/components/m3/button";
import { Card } from "@/components/m3/card";
import { FileField } from "@/components/m3/file-field";
import { ErrorIcon } from "@/components/m3/icons";
import { TextArea } from "@/components/m3/text-area";
import { TextField } from "@/components/m3/text-field";
import { updatePrototype, type EditPrototypeState } from "./actions";

export interface EditPrototypeInitialValues {
  name: string;
  ticket: string;
  description: string;
  reviewerNames: string;
  knowledgeBaseText: string;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save changes"}
    </Button>
  );
}

export function EditPrototypeForm({
  prototypeId,
  initial,
  maxKnowledgeBaseBytes,
  hasCurrentVersion,
}: {
  prototypeId: string;
  initial: EditPrototypeInitialValues;
  maxKnowledgeBaseBytes: number;
  /** False only if a prototype somehow has no version at all. */
  hasCurrentVersion: boolean;
}) {
  /*
   * The id travels with the action rather than as a hidden input. Next
   * encrypts bound arguments, so the browser cannot rewrite it to point the
   * save at a different prototype.
   */
  const [state, formAction] = useActionState<EditPrototypeState, FormData>(
    updatePrototype.bind(null, prototypeId),
    {},
  );

  const fieldError = (field: string) => state.fieldErrors?.[field];

  /*
   * What a field should show. After a rejected submit React has cleared the
   * uncontrolled inputs, so the values that came back from the action win;
   * on a first render there are none, and the stored record shows instead.
   */
  const value = (field: keyof EditPrototypeInitialValues) =>
    state.values?.[field] ?? initial[field];

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
              <p className="mt-2 text-on-surface-variant">
                Nothing has been saved yet. Your changes are still on screen.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      <section className="flex flex-col gap-6">
        <div>
          <h2 className="text-title-medium text-on-surface">What is it</h2>
          <p className="text-body-small text-on-surface-variant">
            Shown to reviewers at the top of the review page, and given to the
            assistant as context.
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
          label="New reviewer password"
          type="text"
          minLength={6}
          autoComplete="off"
          error={Boolean(fieldError("password"))}
          supportingText={
            fieldError("password") ??
            "Leave blank to keep the current password. Changing it does not sign out a reviewer who is part-way through -- their access lasts until they close the browser, or eight hours, whichever comes first."
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
            "Removing a name only takes it out of the picker. Feedback already left under that name is kept."
          }
        />
      </section>

      <section className="flex flex-col gap-6">
        <div>
          <h2 className="text-title-medium text-on-surface">Knowledge base</h2>
          <p className="text-body-small text-on-surface-variant">
            Context the AI assistant uses to answer reviewers&rsquo; questions.
            This is attached to the current version, so editing it here does not
            change what older versions were reviewed against. Paste it below, or
            upload a markdown file -- if you do both, the file wins. Clearing the
            box and uploading nothing removes it.
          </p>
        </div>

        {hasCurrentVersion ? null : (
          <Card variant="outlined" className="border-error/40 p-4">
            <p className="text-body-medium text-on-surface-variant">
              This prototype has no current version, so there is nowhere to
              store a knowledge base yet. The rest of this form still saves.
            </p>
          </Card>
        )}

        <TextArea
          id="knowledgeBaseText"
          name="knowledgeBaseText"
          label="Knowledge base (markdown)"
          rows={12}
          disabled={!hasCurrentVersion}
          defaultValue={value("knowledgeBaseText")}
        />

        <FileField
          name="knowledgeBaseFile"
          label="Or replace it with a markdown file"
          accept=".md,.markdown,text/markdown"
          maxBytes={maxKnowledgeBaseBytes}
          error={Boolean(fieldError("knowledgeBaseFile"))}
          supportingText={fieldError("knowledgeBaseFile")}
        />
      </section>

      <div className="flex items-center gap-2">
        <SubmitButton />
        <ButtonLink href={`/admin/${prototypeId}`} variant="text">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
