---
version: 1
slug: "apps-web-src-app-shop-page-tsx"
primary_target: "apps/web/src/app/shop/page.tsx"
related_targets: ["apps/web/src/components/control-room.tsx"]
---

# Control room surface brief

Scope: `/shop` control room (Orders, Today, People). Visitor mode: Operate. Users: a small coffee house owner mid-service; judges watching a short demo. Job: clear agent-drafted orders one at a time, see the day, find a person. Constraints: PRODUCT.md; data layer unchanged; standard web controls.

## Direction contract

THESIS: One order at a time, read like a line on a coffee house menu, decided in place. Refuses the category default: a dashboard of cards, chips, stat tiles, and a drawer for the details.

OWN-WORLD: Old Sana'a coffee house. Sand-cream ground #F6EEE3, coffee-brown shell band #3A2215 carrying a cream Marcellus wordmark with قهوة المخا in qishr gold, paper-white work pane #FFFCF7, ink #2B1A10, tinted secondary #6B4F3C. Three meaning colours and no others: qishr gold only for "waiting", qamariya red #8E2328 for Guard and risk, terrace green #3F6B45 for sent and paid; no blue anywhere in the room. Manrope for all UI; Marcellus only for the shop name, page titles, and the name of the person in view. One Yemeni motif: a hairline Sana'a gypsum frieze, authored SVG, along the foot of the band. Hairline rules, no cards, no chips, no glow.

STORY: A text arrives; the owner sees who asked, the agents' plan in one sentence, the total, the evidence and steps beside it, and presses Approve, picks another wording, or writes their own.

FIRST VIEWPORT: Brown band (wordmark left; Orders 4 / Today / People as text tabs; Phone button right). Left 40%: the queue as menu rows on cream. Right 60% on paper: the selected order — conversation, our reply with alternatives, order lines with leaders to the total, "How we got here" steps, and a fixed action bar (Approve, Write my own, Skip) at the bottom.

FORM: master-detail queue; signature move is menu-board leaders, dotted from every order line and pickup to its price. Position 1 of 1 (direction pinned by the user: Arwa scheme and layout, Yemeni coffee themed). seed:953d4420065561ed (direction pinned by the user; the roll's assignment was not built)

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
