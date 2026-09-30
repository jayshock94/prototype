# Glizzy Lovers — PRD, draft v0

Status: **DRAFT, revision 2, pending Jay's sign-off.** Nothing gets built until this is approved. Concept and evidence: `CONCEPT.md`, `research/`.

Evidence labels: `[verified]` confirmed this session; `[unverified]` real source, page not opened here; `[panel judgment]` opinion, not a finding. Numeric thresholds in the gates are chosen targets `[panel judgment]`, not measured requirements; they exist so a gate can fail.

## 1. Problem

Jay wants a game that runs in desktop and mobile browsers, that friends join by a code with no account, that is genuinely funny and feels well made, and that uses raccoons as enemies, ridden unicorns, avatar creation, and collections and outfits. Nothing exists yet and no core toy has been proven.

The first problem is narrow and has two halves, tested in this order: **is four unicorns roped to one cart carrying a giant hot dog funny at all** (testable locally in the first two weeks), and **does it still feel like weight rather than lag on phones over real networks** (testable in the following two). Everything else waits on those answers. If either is no, the fallback (Raccoon Rush, an Overcooked-style stand with tap-on-target verbs) keeps the raccoons, the unicorns and the boss.

## 2. Success criteria

Gates are pass/fail with a fail branch each. Real devices: an iPhone SE-class phone and a mid-range Android over cellular, every week, never only desktop emulation. Nobody who built the game rates a gate.

- **Gate B-lite, is the toy funny (end of week 2).** The local toy (four thumbs on one tablet, or four phones on local wifi with a simulated 150 ms delay), no network code yet. One co-located group of four who did not build it, microphones irrelevant. Laughs are counted per person from a recording by someone other than the developer. Pass: the median player laughs at least twice per three-minute delivery, and at least three of four say yes to "another one?" unprompted. *Fail after two tuning passes with fresh groups:* stop before writing any network code, and decide between Raccoon Rush and stopping.
- **Gate A, physics over the network (end of week 4).** Objective: on device with a 150 ms round-trip and 30 ms jitter applied by the in-client throttle, thumb-movement-to-visible-cart-response delay measured under 250 ms, and visible correction snaps fewer than two per minute of play. Blind: six first-time testers each play one delivery at zero added delay and one at 150/30 in random order; pass if at least four of six either cannot say which was throttled or rate both as "heavy" rather than "laggy" on a forced choice. Plus: a first-timer steers and bonks within 10 seconds with no text, and a laptop player with keyboard completes a delivery in the same room as phones. *Fail once:* five days on one alternative model (client prediction of the rider with the rope as a soft spring, or the formation model where the cart follows the crew's weighted centroid). *Fail twice:* pivot to Raccoon Rush.
- **Gate B, laughs with the real thing (end of week 6).** Two fresh groups of four per pass, neither group reused across passes; one co-located, one remote over a recorded video call with microphones muted so the game carries itself. Laughs counted per person from the recordings by a non-developer. Pass in both groups: median player laughs at least twice per delivery; at least three of four want another run unprompted; tap-to-riding under 30 seconds on 4G; on a one-question exit survey ("what moment would you tell a friend about?") at least half name the cart or the hot dog. One session per pass is run with the iPhone silent switch on. *Fail after two tuning passes:* the toy works but is not funny. Stop, or pivot to Raccoon Rush. This is the more likely failure than Gate A, which is why it is tested first in lite form.
- **Gate C, hardening (end of week 8).** No session lost across 20 iOS background-and-return trials; the readability gate passes at four players on a 375-pixel-wide screen (entity cap respected, minimum raccoon silhouette 24 pixels); a desktop-only room of four completes a Cookout Run with keyboard at 1280 by 720; the six-player test is run and its result recorded. *Fail:* reconnect failures block Gate D until fixed; a readability failure lowers the raccoon cap before the run structure is built; a desktop failure fixes the wide layout before v0; a six-player failure means v0 ships 2 to 4 and the title screen says so.
- **Gate D, friends release (end of the plan, five friend groups, at least one including a desktop player).** Median time to first bonk under 45 seconds; "one more" tapped after at least 60% of completed runs; at least 70% of started first deliveries are completed (a threshold we own; a native-app vendor figure of the same size exists but is `[unverified]` and not the reason); day-one return measured and reported, not targeted; median of at least one THAT press per delivery. *Fail:* no v1 content; re-examine the loop with the telemetry.
- **Ongoing instrument.** Laughs per delivery against confusion per delivery is how raccoon caps, cart mass and rope stiffness get tuned.

## 3. Scope

### In: the slice (weeks 1 to 4, proves the toy)

Minimal by design. Week 1 to 2, local only: rope and cart physics (verlet ropes, one rigid cart with a tilt threshold, no rope-to-rope collision, a five-second zero-progress unstick), drag-to-steer with a floating stick, tap-to-bonk with auto-aim, one raccoon archetype (Grabber: lurk, snatch, taunt, flee, faint), the Grand Glizzy with one face, a picnic line, a simulated-latency switch. Week 3 to 4, networked: code join (four letters from A to Z minus I and O, blocklist), a display name in local storage, the Colyseus room running the same simulation module, the in-client latency throttle, reconnect-on-visible with a 60-second seat hold (needed to run Gate A on real phones at all), keyboard controls on desktop.

Not in the slice: hold-release boost, topping spill, results card, bot unicorn, any second raccoon, a route fork, extra Glizzy faces, Supabase and accounts, Relish and collections, the creator in any form, emote wheel, replay, share card, PWA, Discord, THAT button, Alarm meter and Swarm, the soggy timer, pillion.

### In: v0 (shippable to friends)

- Players 2 to 4 (2 to 6 only if Gate C passes); solo runs in a server room with a bot unicorn so rewards stay server-authoritative; an offline local mode exists as "practice" and earns nothing.
- One park route with three segments, one per delivery, one fork each; a Cookout Run of three deliveries with rising quota, Overtime, a firing letter built from stats, PROBATION name tags.
- Raccoons: Grabber, Chonk, Spooker, Hat Thief, Bin Baron. Grand Glizzy with six faces.
- Inputs: drag, tap, hold-release on the canvas; five small buttons (honk, hitch/unhitch, emote wheel with ping inside, THAT clip marker, boost as a tap alternative). One-thumb bonking releases the pull for that instant; two-thumb bonking does not. Desktop keyboard and mouse equivalents; the desktop view is the same world through a wider 16:9 camera.
- Systems: tension rings, pillion on knock-off and on disconnect, Alarm meter and final-stretch Swarm (every raccoon on the route wakes when the meter fills), the soggy timer (a delivery clock shown as the bun getting wetter), unicorn appetite at Topping Stops, hat swaps on spooks, aggro weighted to the top bonker, a dogpile a teammate clears (auto-clears after five seconds), mid-delivery drop-in with auto-hitch, headcount scaling (cart mass, raccoon cap and quota scale with hitched riders and re-evaluate on every seat change; an expired seat hold or a quit unhitches the rider and lightens the cart).
- Topping Stop: contribution icons at equal size, slow-motion replay of the biggest tip with a blame vote, telemetry blooper titles, fork vote.
- Creator (built last): 3 bodies, 6 faces, 8 hair, 6 hats, 4 tops, unicorn coat and mane; palette swaps and layered pieces only. First hat and coat are gifts.
- Meta: Relish at fixed visible prices; sticker book starting at 2 of 12; field guide; stickers only for rooms of four or more; two failure-tied unlocks; the nemesis Hat Thief on a lobby Wanted Board.
- Identity: anonymous Supabase user created after the first delivery, not on join; the room server holds delivery-one rewards until it exists, retries at the next Topping Stop, and drops them with a message if sign-in never succeeds; rewards written server-side from then on; username and password linking with a one-time recovery code; row-level security; a six-character claim code shown after the first reward to re-bind the anonymous identity on any device or browser; a persistent "Save your hat" button in the lobby; the prompt itself shown once; the iOS install hint shown only after an account exists or the claim code has been shown.
- Rooms: host token in server state with transfer to the longest-connected player after 60 seconds; host lock and kick, and a kicked player cannot rejoin that room; per-IP join rate limit; emote and ping cooldown of one per two seconds; profanity filter on names with unicode and leetspeak normalization, applied to share cards too; private-by-code only.
- Operations: graceful drain on deploy, protocol version check with a refresh message, health check, "room full" lobby state, a load test of rooms per machine including solo rooms.
- Client: PWA manifest with an Android install prompt; in-app-webview banner; subtitles for every walkie line; reduce-motion, shake-off and photosensitivity toggles; colour-blind-safe tension rings; minimum tap targets; telemetry (time to first bonk, delivery completion, session length, day-one and day-seven return, THAT presses), aggregate-only with no persistent identifier for guests.
- A landing page with a ten-second loop and the supported-regions notice on the title screen.
- Legal: privacy policy, terms, account deletion, analytics consent for EU visitors, 13+ stated.
- Host settings for tuning numbers. Share card.

### Explicitly out of v0, with the earliest release each is planned for

v1: second and third biomes; cosmetic sets and bespoke animated outfits; horn sounds, emote packs and cart decorations as purchasables; feat unlocks beyond the first two; Tiny (a raccoon too cute to bonk, lured with a topping); a report button; desktop spotter polish beyond the wide view; Discord Activity evaluation (the client stays iframe-safe so it can come later); portal builds for Poki or CrazyGames. Later or never: in-browser voice; PvP or any versus mode; public matchmaking; spectator or audience modes; flick-toss; crew-level persistent collections; daily missions, streaks, a battle pass, ads or any monetization; 3D; a story mode or cutscenes.

## 4. Constraints

- Mobile-first portrait; one thumb; three canvas gestures plus five small buttons. Works on desktop with keyboard, alone or mixed with phones, and that is gated (Gate A and Gate C).
- iPhone Safari realities: the socket dies when backgrounded `[verified by the panel's checker]`; no orientation lock, no fullscreen, no vibration, and the silent switch mutes web audio `[unverified, widely reported]`.
- Netcode in v0: server-authoritative simulation at 20 patches per second, every body interpolated on every client with a 100 ms buffer, no client prediction, latency hidden by instant local feedback, cosmetic rope particles and cart mass. Rope endpoints are synced; rope particles are not.
- First interactive payload under 5 MB. Fixed-timestep simulation.
- Content rules: no firearm imagery anywhere, no eating innuendo, no "gobbler" copy, "Glizzy" as an in-world proper noun, always the full two-word title with a mascot. Default rating 13+.
- No loot boxes, near-misses, appointment mechanics, invite pyramids or forced accounts. Deterministic cosmetics only. Any future purchase has a confirm step. No reward is ever written from a client-run simulation.
- Supabase anonymous sign-in is limited to 30 per hour per IP and Supabase recommends a CAPTCHA or Turnstile challenge on it `[verified]`; the join path never touches it.
- Username-only accounts forfeit email password reset `[verified]`; "no recovery without the code" is a stated support policy.
- Rooms are private by code; the room server is authoritative for everything persistent.
- Assumed team: one developer with AI tooling and AI-assisted art (to be confirmed by Jay). Infrastructure during v0 about $10 to $20 a month for one always-on machine plus Supabase's free tier; a public launch adds a second machine and Supabase Pro, about $45 to $65 a month `[unverified pricing]`.
- Spend outside infrastructure `[unverified figures]`: test devices if not already owned (a used iPhone SE-class phone and a mid-range Android, roughly $100 to $150 each); domains, roughly $10 to $40 a year per ending; USPTO self-search is free, an attorney clearance is optional at roughly $500 to $1,500; voice and sound generation inside the existing ElevenLabs plan; playtesting is unpaid friends, with two fresh groups needed per Gate B pass, so lining them up is a lead-time item, not a cost.
- Real-device testing every week.

## 5. Plan (riskiest first)

Timeline is for one developer with AI tooling and AI-assisted art. Expected case: about 21 weeks to v0, including three weeks of slack for gate failures. There is no shorter number; an artist does not shorten the code schedule.

1. **Days 1 to 2, in parallel with everything.** USPTO search, domain and handle checks, Jay's one-page lore input.
2. **Weeks 1 to 2: the local toy and Gate B-lite.** Rope, cart, steer, bonk, one raccoon, picnic line, simulated latency, on one tablet or local wifi. If nobody laughs after two passes, stop here.
3. **Weeks 3 to 4: netcode and Gate A.** Shared simulation module in a Colyseus room, code join, throttle, reconnect, keyboard, 2 to 4 phones plus at least one laptop on a Vercel preview URL with a QR code. Blind test and delay measurement.
4. **Weeks 5 to 6: make it funny for real, and Gate B.** Grabber reaction states, bonk and boost juice, toppings and spill, results card, bot unicorn in a server room, the scripted first 60 seconds for a solo guest. Two fresh groups per pass.
5. **Weeks 7 to 8: hardening and Gate C.** Reconnect, wake lock, audio unlock, memory budget, viewport layout, readability gate, desktop-only room, six-player test, load test, room-full state, health check, graceful drain, version check.
6. **Weeks 9 to 13: the run.** Run structure, quota, Chonk, Spooker, Hat Thief, Bin Baron, Alarm meter and Swarm, soggy timer, appetite, hat swaps, pillion, drop-in, headcount scaling, Topping Stop replay, blame vote and blooper titles, firing letter, PROBATION tags, host token, moderation, host settings. Audience-age and legal decisions confirmed before the next step.
7. **Weeks 14 to 18: identity and meta, then Gate D.** Creator, Supabase anonymous-then-link flow with recovery code, claim code and row-level security, Relish and stickers, nemesis board, share card, PWA prompt, webview banner, subtitles and the accessibility items, telemetry, name filters, landing page, policy pages. Five friend groups.
8. **Weeks 19 to 21: slack**, spent on whichever gate needed a second pass.
9. **After Gate D only: v1 drops**, in the order listed under "out of v0".

**Art track, in parallel** `[panel judgment on rates]`: AI-assisted, targeting about ten finished sprites or animation frames a week after cleanup. Weeks 1 to 4: placeholder shapes only. Weeks 5 to 8: the raccoon rig, Grabber's seven states, three Glizzy faces, one unicorn rig with palette swaps. Weeks 9 to 13: Chonk, Spooker, Hat Thief, Bin Baron, the remaining Glizzy faces, the route tileset. Weeks 14 to 18: creator pieces, six hats, four tops, coats and manes, UI screens, sticker icons. If art falls behind, reaction states are kept and cosmetics are cut, never the reverse.

## 6. Open questions

Must be answered before build:

1. Who is building this, with how much time and money, and by when?
2. How many friends do you actually play with at once, and where in the world are they?

Defaults we proceed on unless Jay objects: real-time same-time play; tone 7 of 10; 13+ with zero innuendo and zero firearm imagery; the premise as drafted in `CONCEPT.md`; satirical bad-job frame with Glizzy Lovers as the co-op the players belong to; 2D cartoon art, AI-assisted and disclosed; Discord or FaceTime assumed for voice, game tested silent; no monetization in v0 or v1; no Discord Activity or portal builds until after v0; guest telemetry aggregate-only.

Everything else is parked in `NOTES.md` and is settled by a search or a measurement, not by asking Jay.
