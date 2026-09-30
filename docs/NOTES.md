# Glizzy Lovers — project notes

Running record for this project. Three lists, kept current: context, decisions, open threads.
Durable decisions also belong in memory; per-project threads live here.

## Context (facts and constraints from Jay)

- 2026-09-30: Jay asked for game concept ideas for **Glizzy Lovers** and for guidance on how much storyline they need to supply.
- Must run in desktop browser **and** mobile browser. Build is **mobile-first**.
- Profiles are **optional**: username + password if the player wants progress saved. Guest play with no account must work.
- Tone: fun, "feels like a really well-done game," but light-hearted and funny.
- Wants a **friendslop** feel: friends play at the same time, joining via something like a room code.
- Wanted ingredients: raccoons as the baddies, riding unicorns, player creation, item collections and outfits.
- Jay's working rules: nothing gets built before a signed-off PRD; check what exists first; pushback wanted; reversibility gate on destructive or outward-facing actions.
- Repo `jayshock94/prototype` on GitHub is an unrelated Next.js + Drizzle project (has `main` plus other `claude/*` branches). The session's local clone was empty, so this work sits on an orphan branch `claude/awesome-brown-yecwn9` there as a temporary parking spot; no PR is possible against `main` (no shared history).
- 2026-09-30: Jay reconnected GitHub and said a new repo may be created for this project. The Claude GitHub App cannot create repositories (API returned 403), so Jay creates it; suggested name `glizzy-lovers`, private.
- Connectors available in this workspace: Supabase (auth incl. anonymous sign-in, Postgres, Realtime), Vercel (hosting), ElevenLabs (voice/SFX/image gen), Figma and Adobe (art), Three.js viewer.
- Unknown and not assumed: team size, budget, timeline, monetization, target age or rating, whether real-time sync is required, art style, existing lore.

## Decisions

- 2026-09-30: Research and concept work first; no code until Jay signs off a PRD (per Jay's rules).
- 2026-09-30: Concept selection is being run as a panel: 4 research sweeps (fun research, friendslop and browser party games, mobile-web tech, name/IP) with citation verification, 6 independent pitches, 3 comparative judges, synthesis, critic. Rationale: Jay asked for "based on research," so claims need real sources, and independent pitches beat one iterated idea when the design space is wide.

## Open threads

- [ ] Panel results pending (workflow running).
- [ ] Jay to create the `glizzy-lovers` repo on GitHub (private suggested); then this branch moves there and the draft PR is opened against its `main`.
- [ ] Concept doc and draft PRD to be written from the panel output → `docs/CONCEPT.md`, `docs/PRD.md`.
- [ ] Jay to answer the two highest-leverage questions (to be listed in the PRD).
- [ ] Jay to sign off the PRD before any build starts.
