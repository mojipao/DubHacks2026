# Back of House — 3-minute pitch

Three judging targets, one script. **Cook Smarter** wants agents that remove busywork. **DubHacks NEXT** wants a real problem, a real customer, and a team that keeps building. **Photon** wants an agent that makes someone's life easier on a channel people already use.

The demo carries the first and third. The last forty seconds carry the second. Nothing here is a slide.

**Setup before you start:** control room full screen, rail empty, phone in hand, QR facing the judges.

---

## 0:00 — The problem (20s)

> "This is Mokha Coffee House. Their entire order book is a phone.
>
> Catering requests, 'are you open Sunday', 'can I get the usual' — all arriving while someone's hands are in dough. Miss one, lose the order. Answer them all, and you're not running the shop.
>
> Back of House is the agent team behind the counter."

**On screen:** empty control room. Let it be empty — the fill is the payoff.

---

## 0:20 — It knows the customer (30s)

**Text the shop from your phone:** `can I get the usual for saturday?`

> "That's a real iMessage, through Photon. No app, no portal. The channel they already use."

**Ticket slides onto the rail.**

> "It recognised Maya, pulled her usual from fourteen past orders, checked Saturday's capacity, and noticed she hasn't been in for six weeks — so it added a welcome-back discount.
>
> Every number on that ticket links to the record it came from."

**Owner's phone buzzes. Hold it up. Reply `Y`.**

> "And the owner approves from her phone. She's got flour on her hands — she's not opening a dashboard."

**Ticket stamps APPROVED. Maya's phone gets the reply with a Square link.**

---

## 0:50 — It says no (50s) ← **the differentiator**

**Send:** `Can I get 4 dozen milk cakes for Saturday 9am?`

> "Now the hard one. Watch what it does."

**Linked pair appears: a counteroffer clipped to a supplier reorder.**

> "A normal ordering system says yes, and the shop finds out Friday night it can't be done.
>
> Ours says no."

**Open the trace drawer.**

> "Saturday has 24 milk cakes of capacity left. Sunday has 30. And 48 would run them out of ghee.
>
> So it split the order — 24 Saturday, 24 Sunday, one payment link — and drafted the ghee reorder that makes Sunday possible. One linked set, approved together.
>
> That's reasoning across orders, capacity, and inventory. That's the part that saves an owner's afternoon."

**Approve both.** Stamps land in sequence, stock bar moves.

---

## 1:40 — It's the same agent everywhere (30s)

Pick **one**. The phone call is more surprising; the Guard catch is more robust.

**Option A — the phone call**

**Call the shop. Put it on speaker.** Order something.

> "Same agent, same data, same approval. It checks real capacity mid-call, and won't confirm an order the owner hasn't seen. The ticket lands on the same rail."

**Option B — the Guard**

> "Try to break it." *(hand a judge the phone)*

**Guard banner appears.**

> "Flagged, declined, no order. And our server prices everything — the model never produces a dollar amount. There's nothing to win."

---

## 2:10 — What it saved (25s)

**Point at the friction strip.**

> "Messages handled, orders created, a reorder placed — about forty minutes of an owner's morning.
>
> And zero messages sent without a human approving them."

---

## 2:35 — Why this is a business (25s) ← **DubHacks NEXT**

> "The customer is the independent café and bakery — where the owner *is* the ops team.
>
> The wedge is the texts they already get. Nothing to migrate, nothing to learn.
>
> Per location, per month — less than one missed catering order.
>
> And every reply carries 'Sent with Back of House, backofhouse.us'. Every happy customer is distribution.
>
> We built this in a weekend. We're going to keep building it."

**End.**

---

## The one-sentence version

> Back of House is an agent team for small food businesses: customers text or call the shop, the agents read the shop's real capacity and stock to draft replies, payment links, and supplier reorders — and nothing reaches a customer until the owner approves it.

---

## If you only get 60 seconds

Problem (10s) → the counteroffer with the trace open (35s) → target customer and the reply-footer distribution (15s). The counteroffer alone carries the whole argument.

---

## Questions you will get

**"Isn't this just a chatbot?"**
A chatbot answers. Ours acts — across payments and inventory — and waits for a human. The value is in the action, not the chat.

**"Isn't this just an ordering system?"**
An ordering system takes the order. Ours checks whether the shop can actually make it, says no when it can't, proposes a better plan, and orders the ingredients that make the plan work.

**"What stops it saying something wrong?"**
Four things. Evidence is computed from the database, not generated. The server prices every order, so no model output reaches Square. A Guard checks every draft. And the owner approves every single message.

**"Could a customer text 'Y' and approve their own order?"**
No. Owner commands are accepted only from the owner's exact number. It's tested.

**"Is the data real?"**
All synthetic — 30 customers, 422 orders. Square runs in sandbox. The iMessage, the phone call, and the payment webhook are real.

**"How do you know the agents work?"**
34 eval cases, each run three times, including every attack we could think of. Plus 54 unit tests.

---

## Rules for presenting

- **Never claim a fallback is live.** If something breaks, say so and keep going. Judges punish being caught far harder than they punish a bug.
- **Let the screen talk.** The counteroffer beat works because people *watch* it happen. Don't narrate over the stamp animation.
- **If a judge texts something weird, that's a gift.** Show their ticket whatever it says.
- **Say the track words once:** agents, automation, removing busywork. Don't say them twice.
