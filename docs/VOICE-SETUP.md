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

## Part 1 — Photon (about 5 minutes)

1. **Buy the number.** Dashboard at `app.beta.photon.codes` → project `dubhack` → **SMS** → purchase a number, country **US**, area code **206**. Note the number in E.164 (`+1206…`).
2. **Create the Voice profile.** Go to **Voice**, select the new number, choose a **SIP** profile. Create the default profile if prompted.
3. **Enable outbound.** Open **Outbound calls** → digest algorithm **SHA-256 (recommended)** → **Enable outbound**.
   **Copy the generated password immediately — it is shown once.** Put it straight in `.env` as `PHOTON_SIP_PASSWORD`, never in git or chat. Also note the SIP connection host, `sip.photon.codes:5061`, and the username shown.
4. **Configure inbound.** Under **Inbound calls**:
   - SIP destination: `sips:sip.rtc.elevenlabs.io:5061`
   - Transport: **TLS**
   - Credentials: leave empty
   - Enable inbound
5. **Media encryption:** set to **Auto**.

## Part 2 — ElevenLabs (about 15 minutes)

6. **Sign up** at `elevenlabs.io`. The free tier is enough for a demo; check the included minutes before relying on it.
7. **Create the agent.** Conversational AI → new agent. Give it the bakery's voice and the hard rules below.
8. **Import the number.** Phone Numbers → **Deploy** → **Import number** → **From SIP Trunk**, and enter the Photon number in international format (`+1206…`).
9. **Inbound config:** Media Encryption **Allowed**. Leave allowed numbers, IPs, domains and credentials empty for now.
10. **Outbound config:**
    - Address: `sip.photon.codes:5061`
    - Transport: **TLS**
    - Media Encryption: **Allowed**
    - SIP Trunk Username and Password: from step 3
    - Keep the **G.722, PCMU, PCMA** codecs selected
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
