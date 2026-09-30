# Glizzy Lovers — PRD, draft v0

Status: **DRAFT, pending Jay's sign-off.** Nothing gets built until this is approved. Concept and evidence: `CONCEPT.md`, `research/`.

Evidence labels: `[verified]` confirmed this session; `[unverified]` real source, page not opened here; `[panel judgment]` opinion, not a finding.

## 1. Problem

Jay wants a game that runs in desktop and mobile browsers, that friends join by a code with no account, that is genuinely funny and feels well made, and that uses raccoons as enemies, ridden unicorns, avatar creation, and collections and outfits. Nothing exists yet and no core toy has been proven.

The first problem is narrow: **does four unicorns roped to one cart carrying a giant hot dog produce out-loud laughs on phones, over real networks, with no voice channel?** Everything else waits on that answer. If it is no, the fallback (Raccoon Rush, an Overcooked-style stand with target-snapped verbs) keeps the raccoons, the unicorns and the boss.

## 2. Success criteria

Gates are pass/fail. Each has a fail branch. Test on a real iPhone SE-class device and a mid-range Android over cellular, never only on desktop emulation.

- **Gate A, physics (end of the slice, expected week 2 to 4).** The rope and cart still feel like weight, not lag, at 150 ms round-trip with 30 ms jitter; a first-timer steers and bonks within 10 seconds with no text; a laptop player with keyboard completes a delivery in the same room. *Fail once:* five days on the formation model (cart follows the crew's weighted centroid, same visual ropes). *Fail twice:* pivot to Raccoon Rush's verbs.
- **Gate B, laughs (one to two weeks after A).** Four people who did not build it, with no voice channel, laugh out loud three or more times per delivery and ask for another without prompting; tap-to-riding under 30 seconds on 4G; the cart tipping is what they talk about afterwards. Run once with the iPhone silent switch on. Also run one remote session over a recorded video call, because co-located friends laugh at each other, not the game. *Fail after two tuning passes:* the toy works but is not funny. Stop, or pivot to Raccoon Rush. This is the more likely failure and it needs an honest call.
- **Gate C, mobile hardening (v0 midpoint).** No session lost to an iOS background-and-return across 20 trials; the readability gate (entity cap and minimum silhouette size on a 375-pixel-wide screen) passes at 4 players; a decision is made on 6.
- **Gate D, friends release (end of v0, five friend groups).** Median time to first bonk under 45 seconds; at least 60% tap "one more" after a run; first-delivery completion at 70% or better (a native-app vendor floor `[unverified]`, used as a floor, not a target); day-one return measured and reported, not targeted; at least one THAT press per delivery. *Fail:* do not build v1 content; re-examine the loop.
- **Ongoing instrument.** Laughs per delivery against confusion per delivery is how raccoon caps, cart mass and rope stiffness get tuned.

## 3. Scope

### In: the slice (proves the toy)

Code join (4-letter code, alphabet without 0/O/1/I, blocklist), display name in local storage, one 3-minute park route with one fork, floating-stick steer, verlet ropes and one rigid cart with a tilt threshold, bonk with auto-aim and hit-stop, hold-release boost, one raccoon archetype (Grabber) with lurk, snatch, taunt, flee and faint, the Grand Glizzy with three faces, topping spill, the picnic line, a results card with per-player pulls, bonks and toppings, an in-client latency throttle, a bot unicorn for solo, desktop keyboard controls, reconnect-on-visible with a 60-second seat hold. Roughly 30 sprites on one atlas, one tileset, a dozen sound effects, no music, no voice.

Explicitly **not** in the slice: the creator (pick a colour and one of three hats), Supabase and accounts, Relish and collections, Chonk, Spooker, Hat Thief, the Bin Baron, the route vote, emote wheel, replay, share card, PWA, Discord, THAT button, blooper still, Alarm meter, Swarm, soggy timer, pillion. Several of these were in the panel's slice; they are v0 polish riding inside a proof, and they come out.

### In: v0 (shippable to friends)

- Players 2 to 4 (2 to 6 only if Gate C passes); solo with the bot.
- One park route with three segments and two forks; a Cookout Run of three deliveries with rising quota, Overtime, a firing letter built from stats, PROBATION name tags.
- Raccoons: Grabber, Chonk, Spooker, Hat Thief, Bin Baron. Grand Glizzy with six faces.
- Inputs: drag, tap, hold-release on the canvas; four small buttons (honk, hitch/unhitch, emote wheel with ping inside, THAT clip marker). Desktop keyboard equivalents.
- Systems: tension rings, pillion on knock-off and on disconnect, Alarm meter and final-stretch Swarm, soggy timer, unicorn appetite at Topping Stops, hat swaps on spooks, aggro weighted to the top bonker, a dogpile a teammate clears (auto-clears after 5 seconds), mid-delivery drop-in with auto-hitch.
- Topping Stop: contribution icons at equal size, slow-motion replay of the biggest tip with a blame vote, fork vote.
- Creator: 3 bodies, 6 faces, 8 hair, 6 hats, 4 tops, unicorn coat and mane; palette swaps and layered pieces only. First hat and coat are gifts.
- Meta: Relish at fixed visible prices; sticker book starting at 2 of 12; field guide; stickers only for rooms of 4 or more; two failure-tied unlocks; the nemesis Hat Thief on a lobby Wanted Board.
- Identity: anonymous Supabase user created after the first delivery (not on join); rewards written server-side from that moment; username and password linking with a one-time recovery code; row-level security; a persistent "Save your hat" button in the lobby; prompt shown once.
- Rooms: host token in server state with transfer to the longest-connected player after 60 seconds; host lock and kick; per-IP join rate limit; profanity filter on names with unicode normalization; private-by-code only.
- Operations: graceful drain on deploy, protocol version check with a refresh message, health check, "room full" lobby state, a load test of rooms per machine.
- Client: PWA manifest with Android install prompt and an iOS hint; in-app-webview banner; subtitles for every walkie line; reduce-motion and shake-off toggles; telemetry (time to first bonk, delivery completion, session length, day-one and day-seven return, THAT presses).
- Legal: privacy policy, terms, account deletion, analytics consent for EU visitors, a stated minimum age for accounts.
- Host settings for tuning numbers. Share card.

### Explicitly out of v1

In-browser voice; PvP or any versus mode; public matchmaking; spectator or audience modes; Discord Activity (client stays iframe-safe so it can come later); second and third biomes (first drops); flick-toss; crew-level persistent collections; daily missions, streaks, a battle pass, ads or any monetization; 3D; bespoke animated outfits; horn sounds, emote packs and cart decorations as purchasables (v1); a story mode or cutscenes; claim codes for webview identity (v1.1); portal builds for Poki or CrazyGames; the Tiny raccoon if art slips; a report button (v1).

## 4. Constraints

- Mobile-first portrait; one thumb; three canvas gestures plus at most four small buttons. Works on desktop with keyboard in the same room.
- iPhone Safari realities: no orientation lock, no fullscreen, no vibration, the socket dies when backgrounded `[verified for the socket; the rest unverified but widely reported]`, the silent switch mutes web audio `[unverified]`.
- First interactive payload under 5 MB. Fixed-timestep simulation.
- Content rules: no firearm imagery anywhere, no eating innuendo, no "gobbler" copy, "Glizzy" as an in-world proper noun, always the full two-word title with a mascot.
- No loot boxes, near-misses, appointment mechanics, invite pyramids or forced accounts. Deterministic cosmetics only. Any future purchase has a confirm step.
- Supabase anonymous sign-in is limited to 30 per hour per IP and Supabase recommends a Turnstile challenge on it `[verified]`; the join path never touches it.
- Username-only accounts forfeit email password reset `[verified]`; "no recovery without the code" is a stated support policy.
- Rooms are private by code; the room server is authoritative for everything persistent.
- Assumed team: one developer with AI tooling, no dedicated artist (to be confirmed by Jay). Infrastructure during v0 roughly the price of one streaming subscription per month; a public launch adds a second machine and a paid database tier.
- Real-device testing every week.

## 5. Plan (riskiest first)

Timeline is for one developer with AI tooling. The panel's estimates ran optimistic and this plan says so: the expected case for v0 is four to five months; eight to ten weeks is possible only with a second person on art.

1. **Days 1 to 2, in parallel with everything.** USPTO search, domain and handle checks, Jay's one-page lore input, decision on audience age and AI art.
2. **Weeks 1 to 4: the slice.** Shared simulation module, Colyseus room, 2 to 4 phones on a Vercel preview URL with a QR code, latency throttle. Tune the cart heavy and damped; predict your own unicorn, interpolate the rest, cart is server-authoritative. **Gate A.**
3. **Weeks 4 to 6: make it funny.** Grabber reaction states, bonk and boost juice, toppings, results card, the bot, the scripted first 60 seconds for a solo guest. **Gate B.** If it fails twice, stop here and decide.
4. **Weeks 6 to 8: mobile hardening.** Reconnect, wake lock, audio unlock, memory budget, viewport layout, readability gates, six-player test, load test, room-full state, health check, graceful drain, version check. **Gate C.**
5. **Weeks 8 to 13: the run.** Run structure, quota, Chonk, Spooker, Hat Thief, Bin Baron, Alarm meter, appetite, hat swaps, pillion, drop-in, Topping Stop replay and blame vote, firing letter, PROBATION tags, host settings, host token and moderation.
6. **Weeks 13 to 18: identity and meta.** Creator, Supabase anonymous-then-link flow with recovery code and row-level security, Relish and stickers, nemesis board, share card, PWA prompt, webview banner, subtitles and accessibility pass, telemetry, name filters, policy pages. **Gate D** with five friend groups.
7. **After Gate D only: v1 drops.** Second and third biomes, cosmetic sets, feat unlocks, Tiny, desktop spotter polish, claim codes, Discord Activity evaluation, portal evaluation, first named drop.

Art is the long pole throughout: five raccoon archetypes with about seven animations each, six Grand Glizzy faces, the creator, unicorn coats and a route. One raccoon rig with props and palette swaps, layered paper-doll riders, and reaction states scheduled before any cosmetic set.

## 6. Open questions

Must be answered before build (see `CONCEPT.md` section 8 for why):

1. Who is building this, with how much time and money, and by when?
2. What is the friend group actually like: how many at once, where in the world, how do they talk, and is real-time same-time play required or would turn-based or asynchronous play satisfy the brief?

Have defaults, confirm or override: tone at 7 of 10 absurd; rating E10+ with zero innuendo and zero firearm imagery; premise as drafted in `CONCEPT.md`; 2D cartoon art; club-of-friends framing; Glizzy Lovers is the fan club.

Open, no default: monetization ever; Discord Activity; portal distribution; AI-generated art acceptable; audience age for accounts and the privacy approach; whether the phrase "Glizzy Lovers" itself is fine at the chosen rating; domain, handles and trademark results; existing lore or in-jokes to include.
