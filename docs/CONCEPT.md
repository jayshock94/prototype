# Glizzy Lovers — concept recommendation

Status: proposal for Jay's review, 2026-09-30. Nothing here is decided until the PRD (`PRD.md`) is signed off.

How this was produced: four sourced research sweeps (what makes games fun, the friendslop genre and browser party games, mobile-web multiplayer tech, name and IP), a citation-verification pass, six independent concept pitches written from different angles, three comparative judges with different rubrics, a synthesis, and a critic pass. All of it was done by AI agents; the judges' scores are structured opinions, not measurements. Raw material is in `research/PRINCIPLES.md` and `research/PITCHES.md`.

**Evidence labels used below.** `[verified]` = confirmed from a live page or registry this session. `[unverified]` = the source is real and well known, or was seen in search excerpts, but the page could not be opened here (the sandbox blocked most fetches). `[panel judgment]` = a design or engineering opinion, not a research finding. Do not quote an `[unverified]` number publicly without re-reading the primary source.

## 1. The idea menu

Six concepts were pitched. One-line versions:

| # | Concept | What it is | Fun / retention | Friendslop feel | Mobile feasibility | Avg |
|---|---|---|---|---|---|---|
| 6 | **The Grand Delivery** (recommended) | Four friends on unicorns roped to one cart hauling a giant, terrified hot dog past raccoons | 9 | 9 | 6.5 | **8.2** |
| 1 | Backyard Siege | Portrait lane-defense: cook, throw, place condiment traps, bonk raccoon waves | 8 | 7 | 6 | 7.0 |
| 5 | Raccoon Rush | Overcooked-style hot dog stand with one unicorn delivery route | 7 | 6 | 7.5 | 6.8 |
| 2 | Night Shift | Lethal Company for hot dogs: sneak into the dump, steal glizzies back, escape on unicorns | 6 | 8 | 5 | 6.3 |
| 3 | Cookout Run | One-thumb unicorn derby; wipe out and you ride pillion on a friend | 5 | 5.5 | 8.5 | 6.3 |
| 4 | Cookout Cover-Up | Social deduction: one of you is a raccoon in a hot dog costume | 4 | 5 | 5.5 | 4.8 |

Scores are 1 to 10 from three AI judges, each scoring all six comparatively on one lens. Full rationales and each judge's "what nobody got right" notes are in `research/PITCHES.md`.

## 2. Recommendation: Glizzy Lovers, The Grand Delivery

**Pitch.** Four friends ride rented unicorns roped to one wobbly cart. On the cart is the Grand Glizzy, a parade-float-sized hot dog with a face who is terrified of everything. Haul him from the grill to the picnic line before the bun goes soggy, while raccoons steal toppings, sit on the cart, spook the unicorns and wear your hat. Because every rope pulls the same object, moving *is* the co-op: pull together and the cart glides, pull apart and it twangs, spins, tips, and the hot dog screams. One thumb steers, one tap bonks. Join by four-letter code, no account, phone or laptop.

**Why it won.** `[panel judgment]` Interdependence is the movement verb rather than a bolted-on mechanic, which is what the co-op research rewards. Both of Jay's fantasy pillars are load-bearing: unicorns are the engine, raccoons are the whole comedy engine. Its silhouette (four unicorns roped to a screaming hot dog) reads in a ten-second clip. It was the only pitch scoped at months rather than half a year. The feasibility judge's dissent, that the whole game rests on one shared physics object driven by four continuous inputs over phone networks, is the reason the plan starts with a pass/fail physics gate and builds nothing else until it passes.

### The loop

- **First 30 seconds.** Open the link, type a name (blank gets a pun), tap Ride. You're on a unicorn in a parking-lot lobby that is already a toy: ride, honk, bonk hats off friends. Drag anywhere to steer (a floating stick appears under the thumb; your rope is tied to the cart, so steering is pulling). Tap to bonk the nearest raccoon (auto-aim, big radius, hit-stop, stiff faint with tongue out). Hold half a second and release for a boost that yanks the cart. Every rider's pull direction and rope tension is drawn as a public ring, so the person pulling the wrong way is visible to everyone.
- **One delivery (3 to 5 minutes).** Haul the cart along a route with one fork (Safe: longer and calmer; Spicy: shorter, more raccoons, bonus Relish). Raccoons: Grabber (lurks until nobody faces it, snatches a topping, taunts), Chonk (sits on the cart and adds a puller's worth of weight), Spooker (screams; every unicorn in earshot bucks and hats land on the wrong heads), Hat Thief (steals your hat and wears it until bonked). Honks, boosts and spills feed an Alarm meter; at full, every raccoon on the route wakes and the last stretch is a getaway. A rider knocked off lands as a passenger on the nearest teammate's unicorn and can still grab spilled toppings and bonk until re-hitched. Cross the picnic line: confetti, delivery graded on toppings intact and time to spare. Then a 20-second Topping Stop: equal-sized contribution icons per player (pulls, bonks, toppings saved, revives, hats recovered), a slow-motion replay of the delivery's biggest tip on everyone's screen with a blame button, and a fork vote.
- **A session (a Cookout Run, roughly 10 to 16 minutes).** Three deliveries; the Grillmaster's quota rises each time; the third adds the Bin Baron, a boss that takes two riders to shove aside. Late friends trot in from the screen edge mid-delivery and auto-hitch (the cart lurches). Pass: Overtime and a "one more?" prompt. Fail: a one-to-five star cookout review, a firing letter assembled from the run's stats ("you lost 11 toppings, 2 hats and, briefly, the unicorn"), and everyone wears a PROBATION name tag on the retry. Nothing persistent is ever lost.
- **Meta.** Relish earned per delivery buys hats, tops, unicorn coats and manes at fixed, visible prices; no randomness anywhere. A Topping Sticker Book that starts at 2 of 12; a Raccoon Field Guide; some stickers only exist for rooms of four or more; some unlocks are earned by failing (a Lifeguard hat after the crew loses 20 toppings to the pond). The Hat Thief that took your hat persists as a named nemesis on the lobby Wanted Board until your crew gets it back. An optional username and password syncs everything across devices; it is offered once after the first delivery, and a "Save your hat" button stays in the lobby forever after so a player who said no can opt in any time. Post-launch: three or four named drops (new route, new raccoon, cosmetic set), not a live service.

### Ingredients from the other five pitches that are being kept

- From Cookout Run: wipeout-to-pillion, and automatic pillion when a phone goes dark, so the friend who takes a call becomes a joke and a helper instead of an anchor. Stickers only earnable in rooms of four or more.
- From Night Shift: the public pull-direction ring; the Alarm meter that guarantees a climax on the final stretch; telemetry-driven "blooper" titles with a graph; unicorn appetite (an unattended cart at a Topping Stop gets its toppings eaten); the nemesis Wanted Board.
- From Backyard Siege: equal-size per-player contribution icons on every delivery card; solo and bots running the same simulation locally with no room server; mid-delivery drop-in; rules that teach through a laugh (a raccoon hit by a thrown topping eats it and leaves fatter); raccoon aggro weighted toward whoever bonks most, so the strong player draws the heat.
- From Raccoon Rush: the firing letter built from stats, PROBATION tags, the bureaucratic boss; failure-tied unlocks.
- From Cookout Cover-Up: Spooker screams launch hats onto the wrong heads; tuning numbers exposed as host settings.

Rejected for v1: a flick-toss gesture (the gesture set is already the feasibility judge's top complaint), spectator and audience modes, crew-level persistent collections, six players as a hard requirement (it's a test, not a promise), and a double-tap honk (it delays every bonk by a recognition window). Honk, hitch/unhitch, emote wheel (ping inside it) and the THAT clip-marker become four small buttons in the bottom-right corner, leaving exactly three canvas gestures: drag, tap, hold-release. Whether four buttons is too many is a playtest question.

### Controls and platform

Portrait-first because iPhone Safari cannot lock landscape `[unverified, widely reported]`, one-handed play works standing at an actual cookout, and the route runs up the screen so progress is legible. Camera locked on the cart so everyone sees the same thing and callouts work; it zooms out as ropes spread. Desktop is the same client with a wider view: WASD or arrows steer, Space bonks, Shift boosts, E hitches, Q honks; the laptop player naturally becomes the spotter. A desktop-only group must work too; that is a gate, not a hope.

## 3. Ranked alternatives, and when to pick them instead

- **Backyard Siege (7.0).** The richest raccoon reaction table on the panel and fully playable solo and offline. Lost because it is three games stacked (cooking stations, lanes, a mount layer) with twelve verbs, the largest content bill, and a portrait field that doesn't fit on a 375-pixel-wide phone. Pick it if the rope gate fails twice and Jay wants clear roles and strong solo play.
- **Raccoon Rush (6.8).** Overcooked for one thumb; every verb is target-snapped and server-resolved, so it survives 250 ms of lag. Lost because station busywork competes with the comedy and the riding fantasy is rationed to one seat. **This is the designated fallback** if the shared-cart physics cannot be made to feel right on phones: it keeps unicorns, raccoons and the walkie-talkie boss.
- **Night Shift (6.3).** Second on friendslop feel; lost because stealth back-loads the fun (a quiet first minute), needs a joystick-deflection scheme that is fragile under a thumb, and is a one-to-one skeleton of Lethal Company. Pick it if Jay's group are committed Lethal Company players who want that exact rhythm.
- **Cookout Run (6.3).** Won feasibility (input model native to phones, lightest netcode, 2 to 8 players) and lost both experience lenses: parallel play in a racing frame that reads competition-first. Pick it if the priority becomes a solo-capable, portal-friendly mobile game over a friend game.
- **Cookout Cover-Up (4.8).** The single best comedic tell on the panel (the tail pops out when Trash Urge peaks), and it lost hardest: dead at two or three players, competitive among friends, and Among Us already exists free on the same platform. Only if Jay reliably has six to eight people online and wants a party game rather than a co-op.

## 4. The research filter

Research is a filter, not a generator. Nothing below says whether four unicorns roped to a hot dog is funny. It rules out bad ideas and tells us what to measure. The hit, if there is one, comes from a tight core loop iterated with playtests until strangers laugh in a silent room.

Principles this design is built on, with what implements them:

1. **Competence, autonomy and relatedness each predict enjoyment and intent to keep playing.** Ryan, Rigby and Przybylski 2006, *Motivation and Emotion* `[unverified; correlational]`. Implemented: per-player contribution icons at equal size (competence); Safe/Spicy fork and hitch-or-chase (autonomy); the shared cart and pillion revive (relatedness by construction).
2. **Cooperation and interdependence raise relatedness, enjoyment and trust.** Depping and Mandryk 2017, CHI PLAY `[unverified]`. Implemented: the rope. One rider can't move the cart at full speed; boosts only launch it when synchronized; the Bin Baron needs two.
3. **Competition declines with age and is linked to aggression in lab studies; co-op is the safer default for adult friends.** Quantic Foundry 2016 survey and Emmerich and Masuch 2013 `[both unverified; the "safer default" is a panel judgment]`. Implemented: co-op against raccoons is the only mode; in-team comparison is limited to affectionate blame and telemetry titles.
4. **Flow needs clear goals, immediate feedback and challenge matched to skill; let players pick difficulty implicitly.** Chen 2007, CACM `[unverified; an essay]`. Implemented: fork votes, aggro weighted to the strongest bonker, host-exposed tuning numbers, no popups mid-delivery.
5. **Endowed progress: a head start increases persistence.** Nunes and Drèze 2006, *Journal of Consumer Research* `[unverified]`. Implemented: sticker book starts at 2 of 12; first hat and unicorn coat are gifts; guest progress persists so an account is "save what I have".
6. **Avatar customization raises identification and motivation; avatar appearance changes behaviour.** Birk et al. 2016; Turkay and Kinzer 2014; Yee and Bailenson 2007 `[all unverified; the "carries over afterwards" claim belongs to a 2009 follow-up]`. Implemented: a 60-second creator for guests, outfits visible to teammates, and the hat as a gameplay object raccoons steal and wear.
7. **Systemic comedy outlasts scripted jokes.** Practitioner accounts from Untitled Goose Game and Octodad; Dormann and Biddle 2009 `[unverified; practitioner opinion]`. Implemented: raccoon reaction states fired by triggers, unruly unicorn physics, a cargo character with face states, and only about forty walkie-talkie lines in the whole game.
8. **Failure works when it is cheap and shared.** Juul 2013, *The Art of Failure*; Lethal Company's designer on "laughing at death" `[unverified]`. Implemented: pillion instead of death, review card and firing letter, instant retry, nothing persistent lost.
9. **No loot boxes, near-misses or dark patterns.** Zendle and Cairns 2018; Drummond and Sauer 2018; Zagal, Björk and Lewis 2013 `[unverified; the first is correlational, the last is a taxonomy]`. Implemented: fixed visible prices, no randomized items, no streaks, the account prompt appears once, any future purchase has a confirm step.
10. **The first session decides retention; keep a round inside a typical mobile session.** GameAnalytics 2025 benchmarks `[unverified vendor figures for native apps; the panel found no browser-game benchmark]`. Implemented: tap-to-riding under 30 seconds, a lobby that is already a toy, 3-to-5-minute deliveries, teach-in-play first delivery.
11. **The Lethal Company lineage runs on a quota, a bounded run, a shared physical burden and a faceless boss.** Lethal Company wiki; coverage of R.E.P.O. and PEAK `[unverified]`. PEAK has neither a quota nor a boss, so this is a lineage pattern, not a genre law. Implemented: the Grillmaster's rising quota, three deliveries with a hard end, the cart, and "does this make the group talk?" as the gate on every mechanic.
12. **Mobile Safari closes the WebSocket when the tab is backgrounded.** Apple Developer Forums thread 696310 `[verified by the panel's checker]`. Implemented: reconnect-on-visible with a 60-second seat hold, pillion on disconnect.

Pitfalls designed around: forced accounts or reading before play; parallel co-op; competition-first framing; reflex precision as the skill gate on phones; a fixed-position virtual joystick; loot boxes and near-miss animations; appointment mechanics and invite pyramids; scripted jokes on timers; punishing failure; over-juicing without reduce-motion and shake-off toggles; empty collections; 100vh, the Fullscreen API, orientation lock and vibrate on iPhone; audio before a user gesture; Supabase Realtime or Vercel Functions as the game server; a host-elected client holding persistent rewards; trope-only cloning of the genre.

## 5. What we need from Jay on story

**Direct answer: about one page, written in one sitting, and no plot.** For this kind of game, systems and social play carry the fun and story is seasoning. Lazzaro's paper on the four keys to fun is titled "more emotion without story" `[unverified]`, the MDA framework treats narrative as one of eight kinds of fun `[unverified]`, and every game in the Lethal Company lineage ships a one-paragraph premise, a boss voice and a quota. More story does not add fun in v1 and would cost the art and voice budget that the raccoon reaction states need.

Minimum input from Jay:

1. **Tone and rating.** A dial from 1 (cozy) to 10 (absurd), and Everyone, E10+, or Teen. This decides raccoon menace, how sarcastic the boss is, whether player names get a strict filter, and whether the word "glizzy" is said constantly or played straight as a proper noun. Default if unanswered: absurd at 7, E10+ safe.
2. **The poster line.** One sentence under the title. Default: "Four unicorns. One giant hot dog. Too many raccoons."
3. **The premise, or a veto of ours.** Draft: the Glizzy Lovers are the fan club who volunteer every year to deliver the Grand Glizzy, Frankie, to the county cookout. The raccoons of Trashwood Creek want the toppings. The only transport left is UniShare, a gig-economy unicorn rental. The Grillmaster, an unseen and permanently disappointed catering boss, sets the quota over a walkie-talkie.
4. **Must-have characters and jokes.** Three to five names with one trait each, any real-friend cameos with permission, and 10 to 20 slapstick things Jay actually finds funny, in any form (memories, memes, video links). That list calibrates the raccoon reaction table better than any design document.
5. **Anything Jay hates.** Words, gags, tones, art styles, references to avoid.
6. **Two yes/no calls.** Is the frame "satirical bad job with a demanding boss" or "club of friends on a mission"? Is Glizzy Lovers the fan club the players belong to, or the company they work for?

The team invents and Jay vetoes: route names and layouts, raccoon names, the Grand Glizzy's faces, the walkie-talkie lines, sticker and item names, cosmetic set themes, review and firing-letter copy, the crew-name generator, the boss's voice. Not needed for v1, and discouraged: chapters, cutscenes, dialogue trees, backstories longer than a line, a story mode. If Jay wants a storyline later, the slot the format supports is one 20-second radio message per new route in a content drop.

## 6. Pushback

Ranked by impact. Each has a proposed resolution; none is decided.

1. **Scope is the real risk, and the panel's own estimates are optimistic.** Five of six pitches came in at four to six months for one developer. Two of the genre's breakouts were jam games (PEAK in about a month, Content Warning in about six weeks `[unverified]`), but Lethal Company and R.E.P.O. were not. Resolution: a genuinely minimal slice first (code join, rope, cart, tip threshold, one raccoon, finish line, a latency throttle), then a v0 shippable to friends. Honest expectation for one developer with AI tooling and no dedicated artist: three to six weeks to a trustworthy physics-and-laugh verdict, and four to five months to the v0 described in the PRD. Eight to ten weeks only if a second person owns art.

2. **The whole game is one physics toy that has to feel right on phones over cellular.** The panel's engineering judgment, not a cited result, is that jointly-controlled physics is the co-op case that degrades worst with lag, and the fallback (cart follows the crew's centroid) is a less funny game `[panel judgment]`. Resolution: the first thing built is a pass/fail gate: the rope and cart must still feel like weight, not lag, at 150 ms round-trip with 30 ms jitter on real devices. The cart is tuned heavy and damped so late input reads as mass; each client predicts its own unicorn and interpolates the rest; the cart is server-authoritative. If the gate fails twice, pivot to Raccoon Rush's target-snapped verbs. No content is built on an unproven toy.

3. **The name has three separate risks.** (a) "Glizzy" also means a Glock in older slang, and there are live trademark filings for "GLIZZY GUN" toys and "GLIZZY GVNG" clothing `[unverified, seen as search snippets]`. (b) "Glizzy gobbler" is a TikTok innuendo `[unverified]`, and "Glizzy Lovers" as a phrase is in the same neighbourhood; if the rating is Everyone, that is a conversation with Jay, not a content rule. (c) National food brands now use the word in headlines `[unverified]`, which usually means the slang is peaking. Resolution: the first screen shows the hot dog; zero firearm imagery or "clip" gags; no "gobbler" or eating innuendo; "Glizzy" becomes an in-world proper noun (Glizzy County) so the title survives the slang cooling; always brand as the full two words with a mascot; and before spending on a wordmark, one day of work that is not done yet: a USPTO search and a domain and handle check.

4. **Username-only accounts have no password recovery.** Supabase needs an email on a password account; a synthetic one with email confirmation switched off works, but that forfeits the built-in reset flow `[verified from Supabase docs]`. Resolution: show a one-time recovery code at signup with plain copy ("lose the password and the code and the closet is gone"), offer optional real-email linking later, and treat "no recovery" as a stated support policy. Also: the anonymous sign-in endpoint is rate-limited to 30 per hour per IP and Supabase recommends a Turnstile challenge on it `[verified]`, so the anonymous user is created after the first delivery, never on the join tap, and a whole office or dorm behind one IP never hits it while joining together.

5. **Solo play is the most common first session and every pitch called it "practice".** Resolution: solo runs the same simulation locally with a bot unicorn, earns stickers, and ends on the share link with "this is funnier with three more people". The literal first 60 seconds for a solo guest is a design deliverable, not an afterthought. Do not market solo.

6. **Silent groups may be the majority on mobile web.** This is an assumption, not a finding; in-browser voice on iOS Safari is unreliable `[unverified]` and the panel assumed Discord or FaceTime. Resolution: ask Jay how their group actually talks (see questions); the laugh test runs with no voice channel; tension rings, pings, the THAT button and emotes are first-class; in-browser voice is out of v1.

7. **Headcount.** Friend groups on a call are often five or six, and no co-op pitch supports six. Resolution: test six during the slice (it costs no content, only ropes and a zoom-out); ship 2 to 6 only if the phone-readability gate passes, otherwise 2 to 4 and say so on the title screen.

8. **Guest progress is not "forever" on iPhone.** Safari can evict script-writable storage after seven days without a visit `[unverified]`; links opened inside Discord, iMessage, Instagram or TikTok run in webviews with separate storage; and a site added to the iOS home screen gets storage separate from Safari `[unverified]`. Resolution: pre-link state is only a display name and creator choices; every reward lives server-side from the first delivery; the early "save your hat" prompt; a banner in detected in-app webviews ("open in Safari or Chrome to keep your hat"); a short claim code to re-bind an anonymous user is a v1 item.

9. **Genre churn is structural.** One tracker reports most players gone within days `[unverified]`. Resolution: define success as a few great evenings per friend group plus steady new groups, budget three or four named drops, and promise nobody longevity. Measure day-one return rather than targeting a native-app benchmark.

10. **Server operations for one person.** One always-on machine is a single point of failure; redeploying it kills every live room mid-delivery; a cached client can talk to a newer server after a deploy. Resolution: graceful drain on deploy (stop creating rooms, let deliveries finish, cap at ten minutes), a protocol version check with a "please refresh" message, a health check and a second machine before any public link, a "room full, try again" lobby state, and a load test of how many rooms one machine holds.

11. **Who is the host, and what about strangers?** Colyseus rooms have no built-in host. Resolution: the room creator holds a host token stored in server room state, transferable, and passed to the longest-connected player if the host is gone for 60 seconds; settings live on the server so a host's phone going dark changes nothing. Four letters from a 28-letter alphabet is about 600 thousand codes, which a script can enumerate, so: per-IP join rate limiting, host can lock the room, host can kick, a blocklist for rude codes, a profanity filter on display names with unicode normalization, private-by-code only at launch. A report button is v1.

12. **Legal and privacy are not optional once there are accounts and analytics.** Username and password accounts plus telemetry mean a privacy policy, terms, an account-deletion flow, and analytics consent for EU visitors; an Everyone rating with accounts raises COPPA questions in the US. Resolution: decide the audience age with the rating question; if under-13s are in scope, accounts need a different design; otherwise state 13+ for accounts and ship the policy pages with v0.

13. **iPhone audio.** The ring/silent switch mutes web audio in Safari `[unverified, widely reported]`, so the boss's walkie-talkie and the raccoon screams will be silent for many players. Resolution: subtitles for every walkie line, comedy that reads visually first, and the laugh test run once with the switch on silent. Colour-blind-safe tension rings, a photosensitivity toggle, and minimum tap targets belong in the same accessibility pass.

14. **Art provenance.** "One developer with AI tooling" implies AI-generated art. That has copyright and disclosure implications for any later store or portal listing. Resolution: Jay decides whether that is acceptable before the art brief.

15. **Discoverability.** A browser game has no store page, no ratings and no install prompt on iOS beyond a hint. The genre spreads by clips, and someone has to make the first one. Resolution: a landing page with a ten-second loop, Jay's own group as the seed, Discord Activity and portals evaluated after v0. This is not yet a plan.

16. **Regions.** One server location means a cross-continent friend group gets the full round-trip. Resolution: ask where Jay's friends live; state supported regions on the title screen.

## 7. Suggested stack

**Stack A (recommended): Phaser 4 client, Colyseus room server on one always-on Fly.io machine, Supabase for auth and Postgres only, static client on Vercel.** Versions `[verified against the npm registry 2026-09-30]`: Phaser 4.2.1 (4.0.0 shipped 2026-04-10), Colyseus 0.18.8. Fits because a single shared physics body with four inputs needs one authoritative simulation; Colyseus provides state patches at 20 per second, private rooms with custom four-letter IDs, seat holds for reconnection and SDK auto-reconnect `[unverified; from Colyseus docs excerpts]`. The shared TypeScript simulation runs on the server for rooms and locally for solo. Supabase Realtime is not used in v0; Colyseus already knows who is in the room. Expected cost: one small machine plus Supabase's free tier during v0, roughly the price of a streaming subscription per month; a second machine and Supabase Pro for a public launch, roughly two to three times that `[unverified pricing]`.

**Stack B: PixiJS 8 client, partyserver on Cloudflare Durable Objects, Supabase.** Idle rooms cost nothing with hibernation. But the arithmetic matters: a four-player room at 20 updates per second is about 4 billable requests per second, roughly 345 thousand per day for one room, which exceeds the free tier's 100 thousand per day in a few hours of play `[unverified billing ratio]`, so it is paid from the first evening. You also hand-roll the tick loop, state diffing and reconnection that Colyseus provides, and partyserver's README still calls itself work in progress `[unverified]`. Right choice only if idle cost matters more than developer time, or for a later turn-based mode.

**Rejected.** PlayroomKit (host-elected simulation lives on one friend's phone, which iOS suspends when they check a text; rewards forgeable; pricing unverifiable). Supabase Realtime as the movement channel (message quotas are far below one room's needs `[unverified]`). Vercel Functions for rooms (WebSockets now exist there in beta but die at the function duration limit and are not pinned to an instance `[unverified]`). Hathora (reported shut down in May 2026 `[unverified]`).

**Client rules regardless of stack** `[panel judgment]`: portrait-first, no orientation lock, viewport sized with small-viewport units and safe-area insets, touch-action none, Pointer Events, audio context resumed synchronously inside the Join tap, Screen Wake Lock re-acquired on visibility change, fixed-timestep simulation so a 30 fps low-power phone doesn't change game speed, device pixel ratio capped at 2, 2048-pixel atlases, first interactive payload under 5 MB, reduce-motion and shake-off toggles, subtitles for all voice.

**Not confirmed by the tech research**: PlayroomKit pricing; whether Phaser 4 has a WebGPU path; the real iOS Safari memory ceiling; Colyseus Cloud tiers; whether Cloudflare's location hint reliably places a room near the host; Phaser's "16x faster on mobile" marketing claim; Vercel's WebSocket beta specifics.

## 8. Questions

**The two Jay must answer before anything is built.**

1. **Who is building this, with how much time and money, and by when?** It decides whether the target is a slice and a friends-only v0 or a full v1, whether a server on Fly.io is an acceptable ops burden, and whether a part-time artist exists (the raccoon reaction states are the long pole). Default if unanswered: one developer with AI tooling and no dedicated artist; build the slice, then the v0, and treat everything beyond as drops.

2. **What is your friend group actually like when you play?** How many at once, where in the world, on Discord or FaceTime or silent, and is same-time real-time play actually required, or would turn-based or asynchronous play with friends satisfy "play at the same time if they want"? There is no safe default: the answers change headcount support, server region, voice design, and possibly the whole real-time architecture. The recommendation assumes real-time, 2 to 4 players, same continent, some voice.

Tone and rating also matter, but they have a usable default (absurd at 7 of 10, E10+ safe, zero innuendo, zero firearm imagery) and so are not blockers.

**Remaining open questions, grouped.**

- *Product.* Is monetization ever intended (cosmetics-only is the only acceptable model)? Is a Discord Activity front door wanted, and when? Portal distribution (Poki and CrazyGames impose payload and content-security constraints that are cheaper to meet early)? 2D cartoon art, or does Jay picture 3D (roughly doubles art and adds device risk)? Is AI-generated art acceptable?
- *Story and IP.* Existing lore, names or friend in-jokes? Bad job with a boss, or club on a mission? Club or company? Domain and handle availability? USPTO search result? Is the phrase "Glizzy Lovers" itself acceptable at the chosen rating?
- *Legal.* Audience age for accounts; who hosts the privacy policy and terms; analytics consent approach.
- *Technical, to measure not debate.* Rooms per machine; bandwidth of rope state over cellular; floating stick versus tap-to-steer default; cart mass, rope stiffness and raccoon cap (the laugh-versus-confusion instrument); whether the two-player game needs its own tuning; whether the desktop player gets a real spotter role or just a wider view.
