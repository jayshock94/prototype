# Glizzy Lovers — project notes

Running record for this project. Three lists, kept current: context, decisions, open threads.

## Context (facts and constraints from Jay, plus what was found)

- 2026-09-30: Jay asked for game concept ideas for **Glizzy Lovers** and for guidance on how much storyline they need to supply.
- Must run in desktop browser **and** mobile browser. Build is **mobile-first**.
- Profiles are **optional**: username + password if the player wants progress saved. Guest play with no account must work.
- Tone: fun, "feels like a really well-done game," but light-hearted and funny.
- Wants a **friendslop** feel: friends play at the same time, joining via something like a room code.
- Wanted ingredients: raccoons as the baddies, riding unicorns, player creation, item collections and outfits.
- Jay's working rules: nothing gets built before a signed-off PRD; check what exists first; pushback wanted; reversibility gate on destructive or outward-facing actions.
- Unknown and not assumed: team size, budget, timeline, monetization, target age or rating, whether real-time sync is required, art style, existing lore.
- Repo `jayshock94/prototype` on GitHub is an unrelated Next.js + Drizzle project (has `main` plus other `claude/*` branches). The session's local clone was empty, so this work sits on an orphan branch `claude/awesome-brown-yecwn9` there as a temporary parking spot; no PR is possible against `main` (no shared history).
- 2026-09-30: Jay reconnected GitHub and said a new repo may be created for this project. The Claude GitHub App cannot create repositories (API returned 403), so Jay creates it; suggested name `glizzy-lovers`, private.
- Connectors available in this workspace: Supabase (auth incl. anonymous sign-in, Postgres, Realtime), Vercel (hosting), ElevenLabs (voice/SFX/image gen), Figma and Adobe (art), Three.js viewer.
- Panel findings (2026-09-30): see `CONCEPT.md` for the digest; `research/PRINCIPLES.md` and `research/PITCHES.md` for raw material. Key limits: the sandbox blocked page fetches on most domains, so research came from search excerpts and most citations are marked unverified. Verified this session: npm versions (Phaser 4.2.1, Colyseus 0.18.8, PixiJS 8.21.0), Supabase anonymous sign-in rate limit (30/hour/IP) and linking flow, and that email confirmation can be disabled (enables username-only accounts, loses email reset).
- The judges in the panel were AI agents with different rubrics; their scores are structured opinions.

## Decisions

- 2026-09-30: Research and concept work first; no code until Jay signs off a PRD (per Jay's rules).
- 2026-09-30: Concept selection run as a panel (4 research sweeps with verification, 6 pitches, 3 judges, synthesis, critic). Rationale: Jay asked for "based on research," so claims need real sources, and independent pitches beat one iterated idea when the design space is wide.
- 2026-09-30: **Proposed, not decided:** recommend "The Grand Delivery" (unicorn-drawn co-op cart hauling). Won two of three judge lenses; the feasibility dissent becomes the first build gate. Designated fallback: Raccoon Rush. Rejected for now: social deduction (dead at 2-3 players), racing (parallel play), stealth extraction (back-loaded fun, near-clone).
- 2026-09-30: Docs revised against the critic's findings: evidence labels on every claim outside the research section; schedule restated honestly (4-5 months expected for one developer to v0); slice cut to the minimum; fail branches on every gate; host, moderation, legal, iOS audio, deploy and discoverability items added; Supabase Realtime dropped from v0; the second must-answer question changed from tone to friend-group reality.
- 2026-09-30: Docs live in `docs/` in the repo: `CONCEPT.md` (idea menu and recommendation), `PRD.md` (draft v0), `research/` (evidence), this file.

## Open threads

- [ ] **Jay:** answer the two must-answer questions (`PRD.md` section 6): who builds, time, money, deadline; and friend-group reality (headcount, region, voice, is real-time required).
- [ ] **Jay:** confirm or override the defaults (tone 7/10, E10+, premise, 2D art, club framing) and provide the one-page lore input (`CONCEPT.md` section 5).
- [ ] **Jay:** decide audience age for accounts (legal/privacy), whether AI-generated art is acceptable, and whether the phrase "Glizzy Lovers" is fine at the chosen rating.
- [ ] **Jay:** create the `glizzy-lovers` repo on GitHub (private suggested); then this branch moves there and a draft PR is opened against its `main`.
- [ ] **Jay:** sign off the PRD before any build starts.
- [ ] USPTO search, domain (.com/.gg/.io) and handle checks for "Glizzy Lovers" (one day; not done).
- [ ] Re-read primary sources for any research claim before it is quoted publicly (all `[unverified]` items in `CONCEPT.md`).
- [ ] If Jay wants a different concept from the menu, re-run the PRD for it rather than patching this one.
