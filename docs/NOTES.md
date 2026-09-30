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
- Panel findings (2026-09-30): see `CONCEPT.md` for the digest; `research/PRINCIPLES.md` and `research/PITCHES.md` for raw material. Key limits: the sandbox blocked page fetches on most domains, so research came from search excerpts and most citations are marked unverified. Verified by me this session from live sources: npm versions (Phaser 4.2.1 with 4.0.0 published 2026-04-10, Colyseus 0.18.8, PixiJS 8.21.0, PlayroomKit 0.0.97, partyserver 0.5.10, KAPLAY 3001.0.19, three 0.186.1, socket.io 4.8.4); from the Supabase docs: the anonymous sign-in IP rate limit of 30 per hour, the recommendation to enable invisible CAPTCHA or Cloudflare Turnstile on it, the linking flow (add email, then password), and that email confirmation can be disabled (enables username-only accounts, loses email reset). Verified by the panel's checker but not re-opened by me: Apple Developer Forums thread 696310 (Safari closes WebSockets when backgrounded).
- The judges in the panel were AI agents with different rubrics; their scores are structured opinions.

## Decisions

- 2026-09-30: Research and concept work first; no code until Jay signs off a PRD (per Jay's rules).
- 2026-09-30: Concept selection run as a panel (4 research sweeps with verification, 6 pitches, 3 judges, synthesis, critic). Rationale: Jay asked for "based on research," so claims need real sources, and independent pitches beat one iterated idea when the design space is wide.
- 2026-09-30: **Proposed, not decided:** recommend "The Grand Delivery" (unicorn-drawn co-op cart hauling). Won two of three judge lenses; the feasibility dissent becomes the first build gate. Designated fallback: Raccoon Rush. Rejected for now: social deduction (dead at 2-3 players), racing (parallel play), stealth extraction (back-loaded fun, near-clone).
- 2026-09-30: Docs revised twice, against a critic pass and then against three reviewers. Revision 2 changes: netcode model fixed to interpolation-only with no client prediction (a roped body cannot have its two ends predicted in different time frames); Gate A and Gate B made measurable (blind test with six testers, on-device delay under 250 ms, laughs counted per person from recordings, two fresh groups per pass); a local laugh test (Gate B-lite) put before any network code because "not funny" is the likelier failure; slice cut to the critic's minimum; schedule restated as about 21 weeks to v0 with slack, and the "8-10 weeks with an artist" claim deleted; solo moved into a server room so rewards are never client-reported; claim codes pulled into v0 so iPhone guests can recover identity; desktop-only room gated; headcount scaling rule stated; the 13+ default chosen to simplify the innuendo and privacy questions; the question list cut to exactly two must-answers plus a defaults list; evidence labels extended to the remaining bare claims, and the code alphabet fixed at 24 letters (about 330 thousand codes) in both docs.
- 2026-09-30: Docs live in `docs/` in the repo: `CONCEPT.md` (idea menu and recommendation), `PRD.md` (draft v0), `research/` (evidence), this file.
- 2026-09-30: Defaults adopted pending Jay's objection (listed in `PRD.md` section 6): real-time play, tone 7/10, 13+, drafted premise, bad-job frame, 2D AI-assisted art disclosed, voice assumed external but game tested silent, no monetization through v1, no Discord Activity or portals before v0, guest telemetry aggregate-only.

## Open threads

- [ ] **Jay:** answer the two must-answer questions (`PRD.md` section 6): who builds, time, money, deadline; and how many friends at once and where they live.
- [ ] **Jay:** object to any default in `PRD.md` section 6 (silence means we proceed on them) and send the one-page lore input (`CONCEPT.md` section 5).
- [ ] **Jay:** create the `glizzy-lovers` repo on GitHub (private suggested); then this branch moves there and a draft PR is opened against its `main`.
- [ ] **Jay:** sign off the PRD before any build starts.
- [ ] USPTO search, domain (.com/.gg/.io) and handle checks for "Glizzy Lovers" (one day; not done).
- [ ] Parked, settled by search or measurement rather than by asking Jay: exact rooms per Fly machine (load test, week 8); rope-state bandwidth over cellular (measure at Gate A); floating stick vs tap-to-steer default (Gate A); one-thumb vs two-thumb bonk default (Gate A); cart mass, rope stiffness and raccoon cap (the laugh-vs-confusion instrument); whether Colyseus Cloud tiers or PlayroomKit pricing matter (only if the fallback is needed); Hathora's status (irrelevant unless a hosted vendor is wanted); COPPA/GDPR specifics (a lawyer, before v0 ships, only if Jay overrides 13+).
- [ ] Legal claims in the docs are labelled not-legal-advice; a real review is needed before any public link.
- [ ] Switching to another concept from the menu costs about a day to re-run the PRD.
- [ ] Re-read primary sources for any research claim before it is quoted publicly (all `[unverified]` items in `CONCEPT.md`).
- [ ] If Jay wants a different concept from the menu, re-run the PRD for it rather than patching this one.
