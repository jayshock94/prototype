# Glizzy Lovers — PRD, draft v0

Status: **DRAFT, revision 3, pending Jay's sign-off.** Nothing gets built until this is approved. Concept and evidence: `CONCEPT.md`, `research/`.

Evidence labels: `[verified]` confirmed this session; `[unverified]` real source, page not opened here; `[panel judgment]` opinion, not a finding. Numeric thresholds in the gates are chosen targets `[panel judgment]`, not measured requirements; they exist so a gate can fail.

## 1. Problem

Jay wants a game that runs in desktop and mobile browsers, that friends join by a code with no account, that is genuinely funny and feels well made, and that uses raccoons as enemies, ridden unicorns, avatar creation, and collections and outfits. Nothing exists yet and no core toy has been proven.

The first problem is narrow and has two halves, tested in this order: **is four unicorns roped to one cart carrying a giant hot dog funny at all** (testable on one tablet in the first two weeks, with no network), and **does it still feel like weight rather than lag on phones over real networks** (testable in the following two). Everything else waits on those answers. If either is no, the fallback (Raccoon Rush, an Overcooked-style stand with tap-on-target verbs) keeps the raccoons, the unicorns and the boss.

## 2. Success criteria

Gates are pass/fail with a fail branch each. Real devices: an iPhone SE-class phone and a mid-range Android over cellular, every week, never only desktop emulation. Nobody who built the game rates a gate. A session at any laugh gate is three deliveries, and the per-delivery numbers are medians across the three.

- **Gate B-lite, is the toy funny (end of week 2).** The couch version: four thumbs on one tablet, each in its own quadrant input zone (throwaway code; the phone controls are not what is being tested), zero added delay, no network code. It proves the physics gag, not the controls. One group of four who did not build it; laughs counted per person from a video recording by someone other than the developer. Pass: the median player laughs at least twice per delivery and at least three of four say yes to "another one?" unprompted. A second session with 150 ms of simulated delay is run for information only and feeds Gate A; it cannot fail B-lite. *Fail after one tuning pass with a fresh group:* stop before writing any network code, and decide between Raccoon Rush and stopping.
- **Gate A, physics over the network (end of week 4).** The model under test: server tick 20 per second, 60 ms interpolation buffer, no client prediction. The arithmetic floor at 150 ms round-trip is about 75 ms up, 0 to 50 ms waiting for a tick, 75 ms down, the 60 ms buffer and a render frame: roughly 230 to 280 ms `[panel judgment]`. Objective: thumb-movement-to-visible-cart-response measured on device under 300 ms at 150 ms round-trip with 30 ms jitter, and buffer-underrun stutters fewer than two per minute at that jitter. Blind: six first-time testers each play four paired trials (zero delay versus 150/30, random order) and must say which of each pair was throttled; pass if pooled accuracy is at most 15 of 24. Plus: a first-timer steers, bonks and boosts within 10 seconds with no text, and a laptop player with keyboard completes a delivery in the same room as phones. *Fail once:* five days on one alternative (a 40 ms buffer accepting more stutter, or client prediction of the rider with the rope as a soft spring, or the formation model where the cart follows the crew's weighted centroid). *Fail twice:* pivot to Raccoon Rush.
- **Gate B, laughs with the real thing (end of week 6).** Two fresh groups of four per pass, neither reused from any earlier gate; one co-located, one remote. In the remote session the call is live only for coordination before play and muted between players during deliveries, and each person records their own audio locally, synced with a clap, so laughs are counted the same way in both sessions. Pass in both groups: median player laughs at least twice per delivery; at least three of four want another delivery unprompted; tap-to-riding under 30 seconds on 4G; on a one-question exit survey ("what moment would you tell a friend about?") at least half name the cart or the hot dog. One session per pass is run with the iPhone silent switch on. *Fail after two tuning passes:* the toy works but is not funny. Stop, or pivot to Raccoon Rush.
- **Gate C1, hardening (end of week 8).** No session lost across 20 iOS background-and-return trials; wake lock, audio unlock and viewport layout verified on both test phones; a load test reports rooms per machine; a desktop-only room of four completes one delivery with keyboard at 1280 by 720. *Fail:* reconnect or desktop failures block Gate D until fixed.
- **Gate C2, density (end of week 14, once the run exists).** Readability on a 375-pixel-wide screen at the v0 entity cap with placeholder sprites for anything not yet drawn: minimum raccoon silhouette 24 pixels, all four archetypes and the Swarm on screen. Passes at four players; the same check at six with six ropes drawn decides 2-to-6 versus 2-to-4. A desktop-only room of four completes a full Cookout Run. *Fail:* lower the raccoon cap before the meta is built; ship 2 to 4 and say so on the title screen if six fails.
- **Gate D, friends release (end of the plan, five friend groups, at least one including a desktop player).** Median time to first bonk under 45 seconds; "one more" tapped after at least 60% of completed runs; at least 70% of started first deliveries are completed (a threshold we own; a native-app vendor figure of the same size exists but is `[unverified]` and not the reason); day-one return measured and reported, not targeted; median of at least one THAT press per delivery. *Fail:* no v1 content; re-examine the loop with the telemetry.
- **Ongoing instrument.** Laughs per delivery against confusion per delivery is how raccoon caps, cart mass and rope stiffness get tuned.

**Testers the gates consume**, all people who did not build the game and have not seen it at an earlier gate: B-lite 4 (plus 4 if retested); Gate A 6; Gate B 8 per pass, up to 16; Gate D about 20. Roughly 50 people over the plan, about 30 of them by week 6. They come from Jay's friends, friends-of-friends and a Discord; this is a resource Jay has to name under question 1.

## 3. Scope

### In: the slice (weeks 1 to 4, proves the toy)

Minimal by design. Weeks 1 to 2, local only: rope and cart physics (verlet ropes, one rigid cart with a tilt threshold, no rope-to-rope collision, a five-second zero-progress unstick), drag-to-steer with a floating stick, tap-to-bonk with auto-aim, a boost button, one raccoon archetype (Grabber: lurk, snatch, taunt, flee, faint), the Grand Glizzy with one face, a picnic line, quadrant input zones for the tablet, a simulated-delay switch. Weeks 3 to 4, networked: code join (four letters from A to Z minus I and O, 24 symbols, about 330 thousand codes, blocklist), a display name in local storage, the Colyseus room running the same simulation module, the in-client latency throttle, reconnect-on-visible with a 60-second seat hold (needed to run Gate A on real phones at all), keyboard controls on desktop.

Not in the slice: the hold-release boost gesture (Gate A decides whether it is worth adding), topping spill, results card, bot unicorn, any second raccoon, a route fork, extra Glizzy faces, Supabase and accounts, Relish and collections, the creator in any form, emote wheel, replay, share card, PWA, Discord, THAT button, pillion, any run structure.

### In: v0 (shippable to friends)

Each item is marked **core** (in the minimum v0 that still runs Gate D) or *cuttable* (dropped first if week 14 or week 20 arrives half done).

- **Core.** Players 2 to 4 (2 to 6 only if the six-player readability check at Gate C2 passes); solo runs in a server room with a bot unicorn so rewards stay server-authoritative; an offline local mode exists as "practice" and earns nothing.
- **Core.** One park route with three segments, one per delivery, one fork each; a Cookout Run of three deliveries with rising quota, Overtime, a firing letter built from stats, PROBATION name tags.
- **Core.** Raccoons Grabber and Chonk. *Cuttable, in this order:* Spooker, Hat Thief, Bin Baron. Grand Glizzy with three faces core, six *cuttable*.
- **Core.** Inputs: drag (steer), tap (bonk), and five small buttons (honk, hitch/unhitch, emote wheel with ping inside, THAT clip marker, boost). One-thumb bonking releases the pull for that instant; two-thumb bonking does not. The hold-release boost gesture, if Gate A adds it, is a *stationary* hold: the thumb must not have moved more than a small threshold for 300 ms, the charge indicator shows only while stationary, and lifting a moving steering thumb never boosts. Desktop keyboard and mouse equivalents; the desktop view is the same world through a wider 16:9 camera.
- **Core.** Tension rings, pillion on knock-off and on disconnect, the soggy timer (a delivery clock shown as the bun getting wetter), aggro weighted to the top bonker, mid-delivery drop-in with auto-hitch, headcount scaling (cart mass, raccoon cap and quota scale with hitched riders and re-evaluate on every seat change; an expired seat hold or a quit unhitches the rider and lightens the cart). *Cuttable:* Alarm meter and final-stretch Swarm (every raccoon on the route wakes when the meter fills), unicorn appetite at Topping Stops, hat swaps on spooks, the dogpile a teammate clears.
- **Core.** Topping Stop with contribution icons at equal size and the fork vote. *Cuttable:* slow-motion replay of the biggest tip with a blame vote; telemetry blooper titles.
- **Core.** Identity: anonymous Supabase user created after the first delivery, not on join; the room server holds delivery-one rewards until it exists, retries at the next Topping Stop, and drops them with a message if sign-in never succeeds; rewards written server-side from then on; username and password linking with a one-time recovery code; row-level security; a six-character claim code shown after the first reward to re-bind the anonymous identity on any device or browser; a persistent "Save your hat" button in the lobby; the prompt itself shown once.
- **Core.** Meta: Relish at fixed visible prices; sticker book starting at 2 of 12; the first hat and unicorn coat as gifts; two more hats and two coats to buy. *Cuttable:* field guide; stickers only for rooms of four or more; the two failure-tied unlocks; the nemesis Hat Thief on a lobby Wanted Board.
- *Cuttable.* Creator (built last): 3 bodies, 6 faces, 8 hair, 6 hats, 4 tops, unicorn coat and mane; palette swaps and layered pieces only. Minimum v0 replaces it with "pick a colour and a hat".
- **Core.** Rooms: host token in server state with transfer to the longest-connected player after 60 seconds; host lock and kick, and a kicked player cannot rejoin that room; per-IP join rate limit; emote and ping cooldown of one per two seconds; profanity filter on names with unicode and leetspeak normalization, applied to share cards too; private-by-code only.
- **Core.** Operations: graceful drain on deploy, protocol version check with a refresh message, health check, "room full" lobby state, a load test of rooms per machine including solo rooms.
- **Core.** Client: subtitles for every walkie line; reduce-motion, shake-off and photosensitivity toggles; colour-blind-safe tension rings; minimum tap targets; telemetry (time to first bonk, delivery completion, session length, day-one and day-seven return, THAT presses), aggregate-only with no persistent identifier for guests; in-app-webview banner. *Cuttable:* PWA manifest with an Android install prompt (the iOS install hint, if shipped, appears only after an account exists or the claim code has been shown); share card; landing page with a ten-second loop.
- **Core.** The supported-regions notice on the title screen. Legal: privacy policy, terms, account deletion, analytics consent for EU visitors, 13+ stated.
- **Core.** Host settings for tuning numbers.

**Minimum v0**, if everything cuttable is cut: a three-delivery run with Grabber and Chonk, pillion, a Topping Stop with icons and a fork vote, anonymous identity with claim code and username linking, three hats and three coats, a sticker book, moderation, reconnect, subtitles, telemetry and policy pages. It still runs Gate D.

### Explicitly out of v0, with the earliest release each is planned for

v1: second and third biomes; cosmetic sets and bespoke animated outfits; horn sounds, emote packs and cart decorations, bought with Relish; feat unlocks beyond the first two; Tiny (a raccoon too cute to bonk, lured with a topping); a report button; desktop spotter polish beyond the wide view; Discord Activity evaluation (the client stays iframe-safe so it can come later); portal builds for Poki or CrazyGames. Later or never: in-browser voice; PvP or any versus mode; public matchmaking; spectator or audience modes; flick-toss; crew-level persistent collections; daily missions, streaks, a battle pass, ads or any monetization; 3D; a story mode or cutscenes.

## 4. Constraints

- Mobile-first portrait; one thumb; two canvas gestures in the slice (drag, tap), a third (stationary hold-release) only if Gate A adds it; five small buttons. Works on desktop with keyboard, alone or mixed with phones, and that is gated (Gates A, C1 and C2).
- iPhone Safari realities: the socket dies when backgrounded `[verified by the panel's checker]`; no orientation lock, no fullscreen, no vibration, and the silent switch mutes web audio `[unverified, widely reported]`.
- Netcode in v0: server-authoritative simulation, 20 ticks and 20 state patches per second, every body interpolated on every client with a 60 ms buffer, no client prediction, latency hidden by instant local feedback (thumb ring, unicorn lean, sound), cosmetic rope particles and cart mass. Rope endpoints are synced; rope particles are not. Expected thumb-to-cart delay at 150 ms round-trip is 230 to 280 ms `[panel judgment]`.
- First interactive payload under 5 MB. Fixed-timestep simulation.
- Content rules: no firearm imagery anywhere, no eating innuendo, no "gobbler" copy, "Glizzy" as an in-world proper noun, always the full two-word title with a mascot. Default rating 13+.
- No loot boxes, near-misses, appointment mechanics, invite pyramids or forced accounts. Deterministic cosmetics only. Any future purchase has a confirm step. No reward is ever written from a client-run simulation.
- Supabase anonymous sign-in is limited to 30 per hour per IP and Supabase recommends a CAPTCHA or Turnstile challenge on it `[verified]`; the join path never touches it.
- Username-only accounts forfeit email password reset `[verified]`; "no recovery without the code" is a stated support policy.
- Rooms are private by code; the room server is authoritative for everything persistent.
- Team is assumed in section 5 as either one person doing code and art, or a developer plus a part-time artist; Jay's answer to question 1 picks the column. Infrastructure during v0 about $10 to $20 a month for one always-on machine plus Supabase's free tier; a public launch adds a second machine and Supabase Pro, about $45 to $65 a month `[unverified pricing]`.
- Spend outside infrastructure `[unverified figures]`: test devices if not already owned (a used iPhone SE-class phone and a mid-range Android, roughly $100 to $150 each); domains, roughly $10 to $40 a year per ending; USPTO self-search is free, an attorney clearance is optional at roughly $500 to $1,500; voice and sound generation inside the existing ElevenLabs plan; playtesting is unpaid, about 50 people over the plan as counted in section 2.
- Real-device testing every week.

## 5. Plan (riskiest first)

**How long.** Code, with one developer full-time on it, is about 20 working weeks plus 3 weeks of slack that covers gate failures and overrun alike. Art is about 115 units at the rates below, roughly 11 to 12 weeks of one person's time. So:

| Team | Full v0 | Minimum v0 |
|---|---|---|
| Developer plus a part-time artist working the art track in parallel | about 23 weeks | about 17 weeks |
| One person doing code and art | about 35 weeks | about 21 weeks |

The two things that shorten it are a second person on art, or shipping the minimum v0. Nothing else does. The one-person figures assume the art weeks are added to the code weeks, not squeezed into them.

**Code track** (weeks are developer weeks; a one-person team stretches each window by the art inside it).

1. **Days 1 to 2, in parallel with everything.** USPTO search, domain and handle checks. Jay's one-page lore input is due before week 5, when the first raccoon gets its personality; nothing before that needs it.
2. **Weeks 1 to 2: the couch toy and Gate B-lite.** Rope, cart, steer, bonk, boost button, one raccoon, picnic line, quadrant zones on one tablet, simulated-delay switch. If nobody laughs after a retest with a fresh group, stop here.
3. **Weeks 3 to 4: netcode and Gate A.** Shared simulation module in a Colyseus room, code join, throttle, reconnect, keyboard, 2 to 4 phones plus at least one laptop on a Vercel preview URL with a QR code. Paired blind trials and the on-device delay measurement.
4. **Weeks 5 to 6: make it funny for real, and Gate B.** Grabber reaction states, bonk and boost juice, toppings and spill, results card, bot unicorn in a server room, the scripted first 60 seconds for a solo guest. Two fresh groups per pass.
5. **Weeks 7 to 8: hardening and Gate C1.** Reconnect, wake lock, audio unlock, memory budget, viewport layout, load test, room-full state, health check, graceful drain, version check, a desktop-only room completing one delivery.
6. **Weeks 9 to 14: the run, core first, then Gate C2.** Run structure, quota, Chonk, pillion, soggy timer, drop-in, headcount scaling, Topping Stop with icons and fork vote, firing letter, PROBATION tags, host token, moderation, host settings; then, as time allows in this order, Spooker, Hat Thief, Bin Baron, Alarm meter and Swarm, appetite, hat swaps, dogpile, replay and blame vote, blooper titles. Audience-age and legal decisions confirmed before the next step.
7. **Weeks 15 to 20: identity and meta, core first, then Gate D.** Supabase anonymous-then-link flow with recovery code, claim code and row-level security, Relish, three hats and coats, sticker book, subtitles and the accessibility items, telemetry, name filters, regions notice, policy pages, webview banner; then, as time allows, field guide, four-plus stickers, failure unlocks, nemesis board, share card, PWA, landing page, creator. Five friend groups.
8. **Weeks 21 to 23: slack**, spent on whichever gate needed a second pass or whichever window overran.
9. **After Gate D only: v1 drops**, in the order listed under "out of v0".

**Art track** `[panel judgment on rates]`. The unit is one rig clip (one animation state on a rigged, tweened character), one face, one tile, one UI screen or one icon set of about ten; AI-assisted generation with manual cleanup at about ten units a week. Weeks 1 to 4: placeholder shapes only. Weeks 5 to 8, about 40 units: the raccoon rig, Grabber's seven clips, three Glizzy faces, one unicorn rig with five clips and palette swaps, a placeholder tileset. Weeks 9 to 14, about 60 units: Chonk, Spooker, Hat Thief and Bin Baron at seven clips each plus three boss extras, three more Glizzy faces, the park tileset as four units, props as two, cart and hats as six. Weeks 15 to 20, about 50 units: 27 creator pieces, coats and manes as three, eight UI screens, three icon sets. If art falls behind, the cut order is the same as the code's: cosmetics and the creator first, then the third and fourth archetypes, never Grabber and Chonk.

## 6. Open questions

Must be answered before build:

1. Who is building this, with how much time and money, and by when? The plan is written for two columns (one person, or developer plus part-time artist); tell us which, and where roughly 50 playtesters over the plan will come from.
2. How many friends do you actually play with at once, and where in the world are they?

Defaults we proceed on unless Jay objects: real-time same-time play; tone 7 of 10; 13+ with zero innuendo and zero firearm imagery; the premise as drafted in `CONCEPT.md`; satirical bad-job frame with Glizzy Lovers as the co-op the players belong to; 2D cartoon art, AI-assisted and disclosed; Discord or FaceTime assumed for voice, game tested with player-to-player audio muted; no monetization in v0 or v1; no Discord Activity or portal builds until after v0; guest telemetry aggregate-only.

Everything else is parked in `NOTES.md` and is settled by a search or a measurement, not by asking Jay.
