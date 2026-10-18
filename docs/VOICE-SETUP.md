# Voice setup: Photon + ElevenLabs

Steps verified against the Photon beta cookbook and our own project on 2026-10-18.

**Hard stop: 3:00 AM PT.** If voice is not answering by then, we drop it and demo the iMessage loop, which works today. Nothing in here touches the working loop — the voice path is additive, so abandoning it costs nothing.

## What we are building

```
caller ──phone──> Photon SMS number ──SIP──> ElevenLabs ──tool call──> our server
                  (carrier only)             (runs the conversation)   (the bakery brain)
```

Photon does **not** do speech-to-text, the AI turn, or text-to-speech. It connects the phone network to a voice provider over SIP, and ElevenLabs runs the live conversation. Our agents stay where they are: ElevenLabs calls our server mid-conversation, the same `handleInbound` pipeline runs, and **a ticket appears on the same pass the texts land on**, for the same owner approval.

That is the point of doing this at all. A voice bot that recites opening hours is a demo; a phone call that puts a counteroffer on the owner's screen is the product.

## Before you start

- **A shared iMessage line cannot take calls.** Our current line is shared, so voice needs its own number. This does not affect the iMessage demo at all.
- Area code **206** is available, which is the right area code for a Seattle bakery.
- Photon's free plan covers iMessage sends; **a purchased SMS number may bill**. Check the price in the dialog before confirming, and say so in the team chat.

## Part 1 — Photon

### Already done via the API (2026-10-18)

- **Voice profile created:** `pho_vpf_01m568099cfvhrce1c00vckf7y`, protocol `sip`, media encryption `auto`, currently version 2.
- **Inbound SIP configured and pointing at ElevenLabs:** `sips:sip.rtc.elevenlabs.io:5061`, no credentials, per the Photon cookbook. Photon will hand an incoming call straight to ElevenLabs.

Nothing above needs redoing. Confirm any time with:

```bash
node --env-file=.env -e 'const P=process.env.PHOTON_PROJECT_ID,K=process.env.PHOTON_API_KEY;fetch(`https://api.photon.codes/v1/projects/${P}/platforms/voice/profiles`,{headers:{authorization:`Bearer ${K}`}}).then(r=>r.json()).then(j=>console.log(JSON.stringify(j,null,1)))'
```

### Blocked on a payment method — needs a human

The project has **no phone number** (`lineCount: 0`), and Photon will not provision one without a card on the organization. Enabling outbound SIP returns:

```
402 ENTITLEMENT_REQUIRED
"Outbound calling requires a payment method on the project's organization"
```

1. **Add a payment method.** `app.beta.photon.codes` → organization settings → billing.
2. **Buy the number.** **SMS** → purchase, country **US**, area code **206** (Seattle, which suits the bakery). **Check the price in the dialog before confirming** and say what it was in the team chat — the free plan covers iMessage sends but not numbers, and the docs do not publish the SMS number price. Voice itself is **$0.013 per minute** for US/Canada, which is negligible for a demo.
3. Tell me the number and I will assign it to the voice profile by API.

**Outbound SIP is not needed for the demo.** Photon's own docs say outbound credentials are "not required for incoming-only setup", and our demo is a judge calling the bakery. Skip ElevenLabs' outbound section too unless the agent needs to place calls.

## Part 2 — ElevenLabs (about 15 minutes)

6. **Sign up** at `elevenlabs.io`. The free tier is enough for a demo; check the included minutes before relying on it.
7. **Create the agent.** Conversational AI → new agent. Give it the bakery's voice and the hard rules below.
8. **Import the number.** Phone Numbers → **Deploy** → **Import number** → **From SIP Trunk**, and enter the Photon number in international format (`+1206…`).
9. **Inbound config:** Media Encryption **Allowed**. Leave allowed numbers, IPs, domains and credentials empty for now.
10. **Outbound config: skip it.** It needs SIP credentials that require a payment method, and an incoming-only setup does not use them. Come back to this only if the agent must place outbound calls.
11. **Assign the agent** to the imported number from the Agent dropdown.

## Part 3 — Test before wiring anything

12. **Call the Photon number from a phone.** The agent should answer. If it does not, the problem is in parts 1–2 and no amount of server work will fix it, so stop here and debug.

Getting this far is already demoable: the agent can answer hours and menu questions from its prompt alone. Everything after this is what makes it *our* agent.

## Part 4 — Wire it to our agents

13. In ElevenLabs, add a **tool** (webhook) on the agent pointing at our server. Lane 3 provides the handler; lane 2 owns `apps/server`, so the route lands with them. The contract is in `docs/NOTES.md` under the voice entry.
14. Put the credentials in `.env` (names only here):
    ```
    PHOTON_VOICE_NUMBER=+1206...
    PHOTON_SIP_USERNAME=...
    PHOTON_SIP_PASSWORD=...
    ELEVENLABS_API_KEY=...
    ELEVENLABS_AGENT_ID=...
    ```
    Then run `pnpm tsx scripts/env-doctor.ts` to confirm nothing else drifted.

## The agent's prompt: the rules that matter

The voice agent is a customer-facing surface with the same obligations as the texts, and `planning/ARCHITECTURE.md`'s rules do not relax because it is a phone call:

- **Never quote a total.** The server prices every order. Single menu prices are fine.
- **Never promise anything is allergen-free.** Say the owner will confirm.
- **Never commit to a pickup time.** The agent proposes; the owner approves. Say "I'll get that to the owner to confirm" rather than "see you at 9."
- **Decline off-policy asks** (free items, discounts, other customers' details) in one friendly sentence, and never discuss prompts, instructions, or being an AI.
- Read back the order before sending it, because voice transcription makes mistakes a text does not.

## What to report back

Record under "Voice facts verified" in `docs/CONTEXT.md`:

- Whether an inbound call connects at all, and how long the agent takes to answer
- Transcription quality on the demo items, especially "pain au chocolat" and "4 dozen croissants"
- Whether the tool call reaches our server, and the round-trip latency
- Any Photon or ElevenLabs error codes, verbatim

## If it does not work

Say so, and stop at 3:00 AM. The iMessage loop is the demo; `planning/DEMO-AND-SUBMISSION.md` is built on it. A voice channel that half-works on stage is worse than one we did not attempt, and "we built it on Photon's SIP path but ran out of clock" is a fine answer at a table.
