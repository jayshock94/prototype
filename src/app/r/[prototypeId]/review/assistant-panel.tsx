"use client";

import { useEffect, useRef, useState } from "react";

import { IconButton } from "@/components/m3/icon-button";
import { ChevronRightIcon, SendIcon, SparkIcon } from "@/components/m3/icons";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

/**
 * The assistant panel.
 *
 * Collapsible on desktop so the prototype can have the full width; stacked
 * below the prototype and always open on mobile, where there is no room to put
 * it beside anything.
 *
 * Answers stream in. The panel appends an empty assistant message as soon as
 * the request is sent and fills it in as text arrives, so the reviewer sees
 * something happening within a moment rather than watching a blank space.
 */
export function AssistantPanel({
  prototypeId,
  initialMessages,
  configured,
}: {
  prototypeId: string;
  initialMessages: ChatMessage[];
  /** False when ANTHROPIC_API_KEY is missing on the server. */
  configured: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Keep the newest message in view as it streams in.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;

    setDraft("");
    setSending(true);

    const userMessage: ChatMessage = {
      id: `local-user-${Date.now()}`,
      role: "user",
      content: text,
    };
    const replyId = `local-assistant-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      userMessage,
      { id: replyId, role: "assistant", content: "" },
    ]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prototypeId, message: text }),
      });

      if (!response.ok || !response.body) {
        const problem = await response
          .json()
          .then((d) => d.error as string)
          .catch(() => "Something went wrong.");
        setMessages((prev) =>
          prev.map((m) => (m.id === replyId ? { ...m, content: problem } : m)),
        );
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      // Append each chunk as it arrives rather than waiting for the whole
      // answer, which is the entire point of streaming.
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === replyId ? { ...m, content: m.content + chunk } : m,
          ),
        );
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === replyId
            ? { ...m, content: "The assistant could not be reached. Please try again." }
            : m,
        ),
      );
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  return (
    <aside
      className={[
        "flex shrink-0 flex-col border-outline-variant bg-surface-container-low",
        "max-lg:w-full max-lg:border-t",
        "lg:h-full lg:border-l",
        open ? "lg:w-[clamp(20rem,32%,28rem)]" : "lg:w-14",
        "transition-[width] duration-[--md-sys-motion-duration-medium] ease-emphasized",
      ].join(" ")}
    >
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-outline-variant px-3">
        {open ? (
          <>
            <span className="text-primary">
              <SparkIcon className="size-5" />
            </span>
            <h2 className="flex-1 text-title-medium text-on-surface">Assistant</h2>
          </>
        ) : null}

        <IconButton
          aria-label={open ? "Collapse assistant panel" : "Expand assistant panel"}
          onClick={() => setOpen((v) => !v)}
          className="max-lg:hidden"
        >
          <ChevronRightIcon
            className={[
              "size-6 transition-transform duration-[--md-sys-motion-duration-medium] ease-emphasized",
              open ? "" : "rotate-180",
            ].join(" ")}
          />
        </IconButton>
      </div>

      {open ? (
        <>
          <div
            ref={listRef}
            className="flex-1 overflow-y-auto px-4 py-4 max-lg:max-h-[45dvh]"
          >
            {!configured ? (
              <p className="rounded-md bg-error-container px-4 py-3 text-body-small text-on-error-container">
                The assistant is not set up on the server yet. Ask Jay to add an
                ANTHROPIC_API_KEY and redeploy.
              </p>
            ) : messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-2 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-surface-container-highest text-on-surface-variant">
                  <SparkIcon />
                </span>
                <p className="text-title-small text-on-surface">
                  Ask about this prototype
                </p>
                <p className="text-body-small text-on-surface-variant">
                  It knows what this prototype is meant to do. It cannot see your
                  screen yet, so say which part you mean.
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {messages.map((m) => (
                  <li
                    key={m.id}
                    className={m.role === "user" ? "flex justify-end" : "flex"}
                  >
                    <div
                      className={[
                        "max-w-[85%] rounded-lg px-4 py-2 text-body-medium whitespace-pre-wrap",
                        m.role === "user"
                          ? "bg-primary-container text-on-primary-container"
                          : "bg-surface-container-highest text-on-surface",
                      ].join(" ")}
                    >
                      {m.content || (
                        // Streaming has not produced anything yet.
                        <span className="text-on-surface-variant">Thinking…</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="shrink-0 border-t border-outline-variant p-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  // Enter sends; Shift+Enter is a newline, as in every chat app.
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={1}
                disabled={!configured}
                placeholder="Ask about this prototype…"
                aria-label="Message the assistant"
                className={[
                  "max-h-32 min-h-11 flex-1 resize-none rounded-lg border border-outline px-4 py-2.5",
                  "bg-transparent text-body-medium text-on-surface",
                  "placeholder:text-on-surface-variant",
                  "focus:border-primary focus:outline-none",
                  "disabled:cursor-not-allowed disabled:text-on-surface/38",
                ].join(" ")}
              />
              <IconButton
                aria-label="Send message"
                onClick={() => void send()}
                disabled={!configured || sending || !draft.trim()}
                className="bg-primary text-on-primary disabled:bg-on-surface/12"
              >
                <SendIcon className="size-5" />
              </IconButton>
            </div>
          </div>
        </>
      ) : null}
    </aside>
  );
}
