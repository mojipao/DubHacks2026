# Square sandbox setup

Verified against the live Square docs and the code on `main` on 2026-10-17. Pinned to the installed SDK: `square@46.0.0` (`apps/server/package.json`), which sends `Square-Version: 2026-09-16` on every request (`apps/server/node_modules/square/BaseClient.js`). That is also the version the Square API reference currently shows, so SDK and docs agree today.

Owner of these files and of the Square account: lane 2 (mojipao). This doc is reference only; it changes no code.

## What this unblocks

The payment half of the demo loop. The owner approves a reply, the server creates **one** Square payment link covering every order in that reply (both halves of the 24 Sat + 24 Sun counteroffer sit behind a single link), texts the URL to the customer, and then flips those orders to `paid` and deducts ingredients when Square's `payment.updated` webhook arrives. Without Square keys the server still runs: `features.square` is false, `createLink` returns `https://simulated.invalid/pay/<proposalId>`, and nothing settles from a payment. Read the limitation in step 8 before planning the demo around a real tap — **sandbox payment links cannot be paid in a browser**.

## Who has to do what

Needs a human in a browser, no API path exists:

1. Create the Square developer account (sign-up form).
2. Create the application, if the signup one isn't reused.
3. Read the **sandbox** access token off the Credentials page (`Show` + copy).
4. Read the sandbox Location ID off the Locations page (or get it by curl once you have the token — step 5 is the API path).
5. Create the webhook subscription and reveal its signature key.
6. Start ngrok and keep it running (terminal, but a human still has to copy the domain into two places).

Can be done without the dashboard:

- The Location ID, once the token exists: `GET /v2/locations` (step 5).
- Webhook subscriptions, in principle, via the Webhook Subscriptions API (`https://developer.squareup.com/docs/webhooks/webhook-subscriptions-api`) — but the signature key is only shown in the dashboard on create, so there is no gain. Use the dashboard.
- Everything after the credentials are in `.env`: `pnpm seed` creates the Square customers itself (`ensureSquareCustomer`, idempotency key `customer:<uuid>`), and the server creates payment links.

So: roughly ten minutes of clicking by one person, then the four values travel in the shared `.env`.

## Step by step

Env var names below are exactly the ones `apps/server/src/env.ts` parses. Blank (`KEY=`) counts as unset. `features.square` needs only `SQUARE_ACCESS_TOKEN` **and** `SQUARE_LOCATION_ID`; the webhook route separately needs `SQUARE_WEBHOOK_SIGNATURE_KEY` **and** `SQUARE_WEBHOOK_URL` or it answers `503`.

### 1. Developer account

Open `https://squareup.com/signup?v=developers` (the "Square Developer sign-up page"). It asks for name, email, password, country, a business name, and an application name — one form, no card, no partner approval. When it finishes, Square opens the new application in the Developer Console. Nothing here needs to be a real business; the application name can be anything ("Back of House").

If someone on the team already has a Square account, skip the signup: sign in at `https://developer.squareup.com/apps` and create the app from the **Applications** page instead.

Do **not** run `https://squareup.com/activation` (production account activation). We never take a live payment.

### 2. Sandbox access token → `SQUARE_ACCESS_TOKEN`

1. `https://developer.squareup.com/apps` → choose **Open** on the application.
2. At the **top of the page**, set the environment toggle to **Sandbox**. This is the whole ballgame: the same **Credentials** page serves production or sandbox values depending on this toggle, and they are different secrets for different, fully isolated accounts.
3. Left pane → **Credentials**.
4. On the **Sandbox access token**, choose **Show**, copy it.
5. `SQUARE_ACCESS_TOKEN=<that value>` in the root `.env`.

The same page carries the application's default **Sandbox API version**. Leave it alone; the SDK pins `2026-09-16` per request anyway, which overrides the default.

Square's own warning, worth internalising: "Using the wrong access token for the production or Sandbox environment results in an `AUTHENTICATION_ERROR` error with the `UNAUTHORIZED` error code."

### 3. `SQUARE_ENVIRONMENT`

`SQUARE_ENVIRONMENT=sandbox`. It is already the schema default and already `sandbox` in `.env.example`, so this is a no-op — but it is what makes `apps/server/src/square/client.ts` pick `SquareEnvironment.Sandbox`, i.e. base URL `https://connect.squareupsandbox.com` instead of `https://connect.squareup.com`. Only ever set `production` if you intend to charge a real card, which we do not.

### 4. Sandbox Location ID → `SQUARE_LOCATION_ID`

Still with the toggle on **Sandbox**: left pane → **Locations**. Copy the location's ID. The default sandbox test account comes with one location, which is the one to use.

The dashboard route is documented as the Locations page per application; the API route in step 5 is the one to trust if the two ever disagree.

`SQUARE_LOCATION_ID=<that value>`. Every payment link we create sets `order.locationId` to it (`apps/server/src/square/payments.ts`), so a wrong value fails link creation, not something later.

### 5. Verify token + location by curl (no server needed)

```bash
export SQUARE_ACCESS_TOKEN='...'   # paste in a throwaway shell; do not echo it
curl -s https://connect.squareupsandbox.com/v2/locations \
  -H "Square-Version: 2026-09-16" \
  -H "Authorization: Bearer $SQUARE_ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

A good response lists `locations[]` with `id`, `name`, `status`, `currency`, `capabilities`. The `id` you see is what `SQUARE_LOCATION_ID` must equal. If you get `AUTHENTICATION_ERROR` / `UNAUTHORIZED`, the token is production, or stale, or the environment toggle was on Production when you copied it. If the host is `connect.squareup.com` instead, a sandbox token will fail there too — the host is half the test.

### 6. ngrok → `SQUARE_WEBHOOK_URL`

Square only accepts an HTTPS notification URL that it can reach, so `http://localhost:8787` is not an option. Start a tunnel to the server port (8787 by default):

```bash
ngrok http 8787            # or: ngrok http --domain=<your-static-domain> 8787
```

The route is mounted at `/webhooks` + `/square` (`apps/server/src/app.ts`, `apps/server/src/routes/webhooks.ts`), so the notification URL is:

```
https://<your-ngrok-domain>/webhooks/square
```

Put that exact string in `SQUARE_WEBHOOK_URL`, character for character, including scheme, no trailing slash, same casing. Square computes the HMAC over **the signature key, the notification URL as registered, and the raw request body**, so a URL that differs by one character makes every event fail verification with `403` and no other symptom. Use a free ngrok **static domain** if you can; a random ngrok domain changes on every restart and then both Square's subscription and `SQUARE_WEBHOOK_URL` have to be edited again.

`SQUARE_WEBHOOK_URL` is per-machine (see `scripts/env-doctor.ts`): only the demo host sets it. Do not copy a teammate's.

### 7. Webhook subscription → `SQUARE_WEBHOOK_SIGNATURE_KEY`

1. `https://developer.squareup.com/apps` → **Open** the application.
2. Environment toggle at the top of the subscriptions page → **Sandbox**. Sandbox and production subscriptions are separate lists with separate signature keys.
3. Left pane, under **Webhooks** → **Subscriptions**.
4. **Add subscription**.
5. Name it anything ("boh demo host").
6. **URL**: the exact `https://<your-ngrok-domain>/webhooks/square` from step 6. HTTPS is required; if Square can't reach it you get "Your webhook for webhook was not created. URL is not valid" when you save, so start ngrok *before* this step.
7. Choose an **API version** that includes the events you want, then tick the events. Tick **`payment.updated`**. Tick **`payment.created`** as well — `apps/server/src/routes/webhooks.ts` accepts either, and it costs nothing. Pick API version `2026-09-16` so the payload matches what the SDK speaks.
8. **Save**.
9. Choose the subscription's name under **Subscriptions** to open **Endpoint Details**. In the **Signature Key** box choose **Show** and copy it.
10. `SQUARE_WEBHOOK_SIGNATURE_KEY=<that value>`.

What the server does with an event: reads the raw body as text, calls `WebhooksHelper.verifySignature({ requestBody, signatureHeader: x-square-hmacsha256-signature, signatureKey, notificationUrl })`, returns `403` on failure, otherwise answers `200` immediately and settles in the background. On `payment.updated` (or `payment.created`) with `data.object.payment.status === "COMPLETED"` and an `order_id`, it marks **every** order row sharing that `square_order_id` paid — which is how both halves of a split counteroffer flip at once.

### 8. The sandbox payment-link limitation — read this before the demo

**Verified live, 2026-10-17 (lane 2):** the server's real path works end to end in the sandbox. Use **`POST /dev/square-pay/:orderId`** (header `x-owner-token`, sandbox only), not the curl below. Two things the curl gets wrong:

- Payment-link orders are **`DRAFT`**, and `CreatePayment` answers `400 "The order must be OPEN to be paid."` (it still authorizes and then voids the card). The route updates the order to `OPEN` first.
- After a failed attempt, reusing the payment's idempotency key replays the voided payment (`"Payment … is in state CANCELED"`). The route's key includes the order version.

Run: Jun's 48-croissant counteroffer → one `sandbox.square.link` link, one Square order, two pickup-day lines, $216.00 → `/dev/square-pay` → payment `COMPLETED` → Square's signed `payment.updated` came in through ngrok → both orders `paid` at the same instant, stock deducted. Payment links still can't be paid in a browser; the route is the demo's "customer pays" step.


**Confidence note (checked 2026-10-17):** Square's official sandbox pages say *nothing at all* about payment links — neither `/docs/devtools/sandbox/testing` nor `/docs/devtools/sandbox/payments` mentions them, and `cnon:card-nonce-ok` is confirmed there only for the Payments and Cards APIs. So treat the paragraph below as likely but undocumented: it rests on Square staff forum answers. Plan around it, because being wrong the other way costs a demo beat at 3 AM, and settle it with one real link the moment a sandbox token exists.

Square's sandbox hosted checkout page is **preview only**. The card fields and the Pay button are disabled; sandbox payment link URLs are on `sandbox.square.link/u/...` and land on a sandbox testing panel that states card entry is not allowed. Square staff: "This is the expected behavior in sandbox. Payment links created with the Checkout API only allow for a preview in sandbox." A developer asking for a workaround in September 2026 is still unanswered.

Consequences:

- Creating the link works, the URL is real and textable, and it opens. **Nobody can tap through to pay it in sandbox.** Do not build the demo narrative on a judge paying from their phone.
- The sandbox card numbers in the next section are for the Payments API and the Web Payments SDK, not for this page.
- To fire a genuine `payment.updated` / `COMPLETED` webhook through the whole verified path, pay the link's **order** through the Payments API with a sandbox token instead. Take `square_order_id` from the `orders` row (or `payment_link.order_id` from the create response) and the order total in cents:

  ```bash
  curl -s https://connect.squareupsandbox.com/v2/payments \
    -H "Square-Version: 2026-09-16" \
    -H "Authorization: Bearer $SQUARE_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "idempotency_key": "demo-pay-1",
      "source_id": "cnon:card-nonce-ok",
      "order_id": "<square_order_id>",
      "location_id": "<SQUARE_LOCATION_ID>",
      "amount_money": { "amount": 21600, "currency": "USD" },
      "autocomplete": true
    }'
  ```

  `cnon:card-nonce-ok` is Square's documented sandbox token that "results in a successful request" with `CreatePayment`; `order_id` "associates a previously created order with this payment". This is assembled from the two reference pages, not from a Square-published payment-links recipe — **try it once before the demo** rather than at 3 AM. `amount_money` must match the order total or Square rejects it.
- The guaranteed fallback already exists in the repo and does not involve Square at all: `POST /dev/mark-paid/:orderId` with header `x-owner-token: $OWNER_TOKEN` runs the same `settlePaid` path, including the both-halves-at-once behaviour. Treat it as the demo path and the webhook as the thing you show working once, offline.

### 9. Fill `.env` and check

Four values go in the shared root `.env` (never in git; `.env.example` has the blanks):

```
SQUARE_ACCESS_TOKEN=
SQUARE_LOCATION_ID=
SQUARE_ENVIRONMENT=sandbox
SQUARE_WEBHOOK_SIGNATURE_KEY=
SQUARE_WEBHOOK_URL=
```

Then:

```bash
pnpm tsx scripts/env-doctor.ts          # names and fingerprints only, no values
pnpm --filter @boh/server dev
curl -s localhost:8787/health
```

`/health` should show `"squareMode": "sandbox"` (not `"unconfigured"`) and `"squareWebhook": true`. Share the token and signature key by hand, the way the team shares the rest; `env-doctor`'s fingerprints tell you whether two laptops hold the same string without anyone pasting it.

## Verification

| What | How | Good result |
| --- | --- | --- |
| Access token + environment | the `GET /v2/locations` curl in step 5 | JSON with `locations[]` |
| Location ID | that same response | the `id` equals `SQUARE_LOCATION_ID` |
| Both, as the server sees them | `curl -s localhost:8787/health` | `"squareMode": "sandbox"` |
| Signature key + URL present | same `/health` | `"squareWebhook": true` |
| Tunnel reaches the route | `curl -i https://<domain>/webhooks/square -X POST -d '{}'` | `403 Invalid signature` — that is success: it reached the handler and the fake signature was rejected. `503` means the two webhook env vars aren't both set; anything from ngrok means the tunnel or port is wrong. |
| Square can reach it | Developer Console → the subscription's **Endpoint Details** after sending a test event | delivery recorded, no URL error on save |
| Link creation end to end | approve a reply proposal with orders in the control room | the orders row gets `square_order_id`, `square_payment_link_id`, and a `payment_url` on `sandbox.square.link` |
| Settlement | the `CreatePayment` curl in step 8, else `POST /dev/mark-paid/:orderId` | both orders `paid`, `order.paid` + `inventory.deducted` events |
| Square customers | `pnpm seed` with Square configured | the summary counts `squareCustomers` instead of `skipped` |

## Sandbox test cards

For the Payments API and the Web Payments SDK. **Not** usable on a sandbox payment link page (step 8). Any future expiry; USD needs a valid postal code (any valid one, e.g. `98101`).

| Brand | Number | CVV |
| --- | --- | --- |
| Visa (the success case) | `4111 1111 1111 1111` | `111` |
| Mastercard | `5105 1051 0510 5100` | `111` |
| Discover | `6011 0000 0000 0004` | `111` |
| American Express | `3400 000000 00009` | `1111` |
| JCB | `3569 9900 1009 5841` | `111` |
| Declined card | `4000 0000 0000 0002` | `111` |

Failure simulation on an otherwise-good card: CVV `911` → CVV incorrect, postal code `99999` → postal code incorrect, expiry `01/40` → expiration incorrect.

Server-side payment tokens (`source_id` for `CreatePayment`): `cnon:card-nonce-ok` (success), `cnon:card-nonce-declined`, `cnon:card-nonce-rejected-cvv`, `cnon:card-nonce-rejected-postalcode`, `cnon:card-nonce-rejected-expiration`, `cnon:card-nonce-already-used`.

## Gotchas

- **Sandbox payment links can't be paid.** The single biggest one. See step 8. Plan the demo around `/dev/mark-paid` or the `CreatePayment` curl.
- **Production token in `SQUARE_ACCESS_TOKEN`.** The Credentials page looks identical in both modes; only the toggle differs. Symptom: `UNAUTHORIZED` on everything, including `pnpm seed`. Re-copy with the toggle on Sandbox.
- **Sandbox location ID with a production token, or the reverse.** The environments are fully isolated — "Account credentials and resources from one environment cannot be used with or accessed from the other." A sandbox location ID is meaningless to production and vice versa; you get an `INVALID_REQUEST_ERROR` about the location, which reads like a typo and isn't.
- **`SQUARE_WEBHOOK_URL` off by one character** (trailing slash, `http://`, stale ngrok domain, `/webhook` instead of `/webhooks/square`). Every event returns `403 Invalid signature` and the logs say nothing else. Compare the env var against the subscription's URL field letter by letter before debugging anything else.
- **ngrok restarted.** A free random domain changes, so the registered URL and `SQUARE_WEBHOOK_URL` both go stale at once. Use a static domain, or expect to edit both.
- **Webhook subscription made in Production by accident.** Sandbox and production keep separate subscription lists. A sandbox payment then fires nothing, and the Production subscription sits there looking correct.
- **Signature key confusion.** The signature key is per **subscription**, not per application. Delete and recreate the subscription and the key changes. Rotating it in the dashboard also invalidates the old one.
- **API version skew.** The SDK sends `2026-09-16` regardless of the application's pinned default, so a subscription created under a much older API version can deliver a payload shaped for that version. The fields the server reads (`type`, `event_id`, `data.object.payment.{id,status,order_id}`) are stable, but pick `2026-09-16` on the subscription anyway and remove the variable.
- **`features.square` is only token + location.** The server will happily create real payment links while the webhook stays unconfigured (`503`) — orders then sit in `awaiting_payment` forever with no error anywhere. `/health`'s `squareWebhook` is the only tell.
- **`.env` is read from the repo root only** (`apps/server/src/env.ts` loads `../../../.env` relative to itself). A `.env` inside `apps/server` does nothing.
- **Idempotency keys are derived, not random.** The payment link key is `proposal:<proposalId>` and the customer key is `customer:<uuid>`. Re-approving the same proposal, or re-running `pnpm seed`, returns the original object instead of making a second one — that is deliberate, so do not "fix" a link that looks stale by retrying and expecting a new URL. `POST /proposals/:id/retry` reuses the stored link for the same reason.
- **Two people running `pnpm seed` against one sandbox account** is fine (idempotent), but two people running `ngrok` and both editing the one subscription is not. One demo host owns the webhook.
- **Don't activate the production account.** The signup flow nudges toward it. There is no reason to, and a live payment is the one mistake with real money attached.

## Sources

Fetched 2026-10-17:

- https://developer.squareup.com/docs/get-started/create-account-and-application
- https://developer.squareup.com/docs/devtools/developer-dashboard
- https://developer.squareup.com/docs/devtools/sandbox/overview
- https://developer.squareup.com/docs/devtools/sandbox/payments
- https://developer.squareup.com/docs/devtools/sandbox/testing
- https://developer.squareup.com/docs/testing/test-values
- https://developer.squareup.com/docs/build-basics/access-tokens
- https://developer.squareup.com/docs/build-basics/versioning-overview
- https://developer.squareup.com/docs/webhooks/step2subscribe
- https://developer.squareup.com/docs/webhooks/step3validate
- https://developer.squareup.com/reference/square/payments-api/webhooks/payment.updated
- https://developer.squareup.com/reference/square/checkout-api/create-payment-link
- https://developer.squareup.com/reference/square/payments-api/create-payment
- https://developer.squareup.com/reference/square/locations-api/list-locations
- https://developer.squareup.com/reference/square/customers-api/search-customers
- https://developer.squareup.com/reference/square/objects/CustomerFilter
- https://developer.squareup.com/forums/t/issue-with-credit-card-fields-and-pay-button-disabled-in-square-checkout-api-in-sandbox-enviornment/21045
- https://developer.squareup.com/forums/t/checkout-api-in-sandbox-test/8789

Ambiguities, stated rather than guessed:

- The sandbox credentials page is documented as "the **Credentials** page" with the environment toggle "at the top of the page"; Square's text never spells out the toggle's own label beyond the words **Sandbox** and **Production**.
- `https://developer.squareup.com/docs/devtools/developer-dashboard` does not document the button that creates a new application; `create-account-and-application` only says new applications are created from the **Applications** page.
- Neither the Checkout API overview nor the sandbox testing page mentions payment links at all. The preview-only behaviour and the `sandbox.square.link` domain come from Square staff answers in the forums, not from reference docs — so they could change without a doc change.
- The `CreatePayment`-against-a-payment-link-order recipe in step 8 is inferred from the `CreatePayment` reference plus the sandbox test values page. Square does not publish it as a payment-links testing procedure.
