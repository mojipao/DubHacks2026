# Demo and submission

Everyone reads this by Sunday 6:00 AM. Lane 3's agent drafts the written submission in `submission/`; the humans present.

## Rubric map (Cook Smarter)

| Criterion | Weight | How we earn 7 to 8 |
| --- | --- | --- |
| Functionality | 30% | A real iMessage from a judge's phone becomes an approved reply with a working Square payment link, and paying it changes the dashboard. No slides during the loop. |
| Track applicability | 30% | Say the track words out loud: agents and automation that remove an owner's busywork across messaging, payments, scheduling, and inventory. |
| Design | 20% | "The pass": tickets on a rail, stamps, live stock bars. Readable from two meters. |
| Creativity | 20% | Evidence on every ticket, the visible agent trace, the human approval gate, and the kitchen metaphor. Not a chatbot: the agent knows when to wait for the owner. |

## Demo setup checklist (15 minutes before)

- [ ] Demo host on power, `caffeinate -dimsu` running, notifications off (Focus mode).
- [ ] `pnpm reset --yes` run, then `pnpm demo:host` running; `GET /health` shows Photon connected, Square sandbox, agents live.
- [ ] ngrok static domain up; send one test Square webhook from the Square dashboard.
- [ ] Control room open full-screen at 1440×900 equivalent; browser zoom tested on the actual screen.
- [ ] Phone simulator tested once, then closed.
- [ ] Maya's phone (a teammate's) charged, iMessage on, conversation with the shop number open.
- [ ] `/join/qr` open on a second device.
- [ ] Backup video downloaded locally (not streaming).
- [ ] Square sandbox test card details on a sticky note.

## The 3-minute script

| Time | Who | What happens | What we say |
| --- | --- | --- | --- |
| 0:00 | Presenter | Control room on screen, rail empty | "Small bakeries run on texts. Orders, catering, questions, all landing on the owner's phone while she's elbow-deep in dough. Back of House is the agent team behind her counter." |
| 0:20 | Maya's phone | Texts the real iMessage number: "can I get the usual for Saturday 9am?" | "This is a real iMessage, through Photon." |
| 0:30 | Screen | Conversation lights up, Intake dot pulses, ticket slides onto the pass | "The Intake agent recognized Maya from her order history, found her usual, checked Saturday's capacity and stock, and noticed she hasn't been in for six weeks." |
| 0:45 | Presenter | Opens the drawer: evidence and trace | "Every claim on this ticket links to the data it came from. No made-up facts, and here's each step the agent took." |
| 1:00 | Presenter | Presses A. SENT stamp. | "Nothing goes out until the owner says so." |
| 1:05 | Maya's phone | Reply arrives with a welcome-back perk and a Square link; pays with the sandbox card | "She pays right in the text." |
| 1:20 | Screen | Order flips to paid, stock bars drop | "Square tells us it's paid, and the shop's inventory updates itself." |
| 1:30 | Jun (simulator or second phone) | "need 40 almond croissants for our office this saturday" | "Now a catering order." |
| 1:40 | Screen | Two linked tickets: a careful reply and an Ops reorder for almond flour | "The Ops agent found that 40 croissants would run us out of almond flour, so it drafted a supplier reorder alongside the reply. One approval, and both are handled." |
| 2:00 | Presenter | Approves both; stock bar shows on-order hatching | |
| 2:10 | Presenter | Opens `/audit` | "Every action is logged. Zero messages have ever gone out without a human approving them. VEYZL audits every pull request against AI controls, and it changed what we shipped:" one sentence on the real finding. |
| 2:30 | Presenter | Points to the reply footer | "Every reply says 'Sent with Back of House,' so every satisfied customer is our distribution." |
| 2:40 | Presenter | Invites the judge | "Scan this, and text the bakery yourself." |
| 3:00 | | End | |

If judges allow more time, the judge's own text is the strongest possible ending. Have them join at 2:40 and keep talking while their ticket arrives.

For Priya (allergy) keep it in your pocket for Q&A: "What if a customer has an allergy?" Text it live and show the Allergy flag and the careful reply.

## Failure plan

| Failure | Detect | Switch to | Say |
| --- | --- | --- | --- |
| Photon message doesn't arrive in 15 s | No conversation highlight | Phone simulator with the same line | "Venue network is slow, so here is the same message through our simulator; the iMessage path is the same code after receipt." |
| Agent slow or erroring | Intake dot pulsing over 10 s | Wait once; then `AGENT_MODE=stub` restart (canned drafts) | Be honest if asked. |
| Square webhook doesn't arrive | Order stays awaiting payment | Dev "mark paid" route | "Normally Square's webhook flips this; here's the same update." |
| Laptop dies | | Backup video | |

Never pretend a fallback is live. Judges respect honesty and punish being caught.

## Q&A prep

- **Why not just a chatbot?** Chatbots answer; ours works across the shop's real data and waits for approval. The value is in the action, not the chat.
- **What stops it saying something wrong?** Evidence is computed from data, prices are set by the server, a Guard checks every draft, and the owner approves every message.
- **Isn't this Podium or a unified inbox?** Unified inboxes show messages. We act on them across payments and inventory.
- **What about Toast, Instagram, SMS?** The data model is channel-independent. Photon also supports other channels; POS integrations like Toast need partner access we'd pursue next.
- **Why does the judge have to register first?** Photon's shared beta lines only hear assigned senders; a production shop gets a dedicated line.
- **Is the data real?** All customers and history are synthetic. Square runs in sandbox.

## Devpost checklist

- [ ] Project name, tagline: "The agent team behind a small bakery's counter."
- [ ] Description from `submission/devpost.md`.
- [ ] Demo video, 2 to 3 minutes, uploaded unlisted, recorded from a real run (screen plus phone).
- [ ] Repo link (public, or access granted per organizer rules).
- [ ] Screenshots from lane 1's Phase 5 list.
- [ ] Built with: Next.js, TypeScript, Supabase, Photon 2.0, Square, Vercel AI SDK, VEYZL, Hono.
- [ ] Title track: Cook Smarter.
- [ ] Sponsored tracks: Photon, VEYZL, SideShift (confirm allowed count).
- [ ] All team members added on Devpost.

## Per-track proof

**Photon**
- [ ] Built on Photon 2.0 beta (`@photon-ai/api`, `api.photon.codes`).
- [ ] Live on iMessage in the demo and in the video.
- [ ] One sentence on the architecture: Socket.IO event stream with replay cursors, idempotent sends.

**VEYZL**
- [ ] VEYZL GitHub app installed; checks visible on PRs.
- [ ] `submission/veyzl.md`: each real finding, the control it maps to, the fix PR, before and after.
- [ ] A screenshot of a failed or warning check and of the later passing check on the fix PR.
- [ ] 30-second walkthrough in the video or at the table: the issue, the fix, why it matters.

**SideShift**
- [ ] Startup slide or Devpost section from `submission/sideshift.md`: customer, wedge, distribution via the reply footer, pricing.

## After submission

- [ ] Tag `v-submitted` on `main`.
- [ ] Update `docs/STATUS.md`: every lane `idle`, with a final handoff line.
- [ ] Keep the demo host running and charged for judging.
