---
name: Back of House
description: The control room of an Old Sana'a coffee house, where the owner approves what the agents drafted.
colors:
  sand-cream: "#f6eee3"
  sand-deep: "#ede2d3"
  paper: "#fffcf7"
  hairline: "#e3d3bf"
  hairline-strong: "#cbb59b"
  coffee-ink: "#2b1a10"
  roast-muted: "#6b4f3c"
  shell-brown: "#3a2215"
  brew: "#5a3016"
  qishr-gold: "#c9971f"
  qishr-ink: "#7d5a0c"
  qamariya-red: "#8e2328"
  terrace-green: "#3f6b45"
  bubble-in: "#f6ead2"
typography:
  display:
    fontFamily: "Marcellus, ui-serif, Georgia, serif"
    fontSize: "34px"
    fontWeight: 400
    lineHeight: 1.12
    letterSpacing: "-0.005em"
  headline:
    fontFamily: "Marcellus, ui-serif, Georgia, serif"
    fontSize: "30px"
    fontWeight: 400
    lineHeight: 1.12
  title:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "21px"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.4
  arabic:
    fontFamily: "Reem Kufi, Geeza Pro, serif"
    fontSize: "19px"
    fontWeight: 400
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  pill: "999px"
spacing:
  gutter: "32px"
  row: "16px"
  section: "48px"
components:
  button-primary:
    backgroundColor: "{colors.brew}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    height: "42px"
    padding: "0 20px"
  button-outline:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.coffee-ink}"
    rounded: "{rounded.pill}"
    height: "42px"
    padding: "0 20px"
  top-band:
    backgroundColor: "{colors.shell-brown}"
    textColor: "{colors.sand-cream}"
    height: "64px"
  queue-row-selected:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.coffee-ink}"
    padding: "16px 24px"
  input-field:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.coffee-ink}"
    rounded: "{rounded.pill}"
    height: "40px"
  bubble-customer:
    backgroundColor: "{colors.bubble-in}"
    textColor: "{colors.coffee-ink}"
    rounded: "{rounded.xl}"
    padding: "8px 16px"
  bubble-shop:
    backgroundColor: "{colors.sand-deep}"
    textColor: "{colors.coffee-ink}"
    rounded: "{rounded.xl}"
    padding: "8px 16px"
---

# Design System: Back of House

## Overview

**Creative North Star: "The Menu Board at Mokha"**

The control room is the back wall of an Old Sana'a coffee house. The walls are sand-cream, a coffee-brown band runs across the top, and the work sits on paper. Every order reads like a line on a hand-lettered menu: the item, a dotted leader, the price. The owner is busy mid-service and decides one thing at a time, so the screen shows one decision at full size and keeps everything else as quiet text.

The density is calm, not sparse. Information sits in plain rows divided by hairline rules, never in cards, chips, or stat tiles. Colour carries meaning and nothing else: gold says something is waiting, red says risk, green says sent or paid. Anything that needs no attention stays brown on cream.

The first-surface composition (Orders queue beside a detail pane) is recorded in `.impeccable/surfaces/apps-web-src-app-page-tsx.md`. This file holds only the world those surfaces share.

**Key Characteristics:**
- Sand-cream ground, a coffee-brown band, paper for the active work.
- A dotted menu leader from every line item and pickup to its price.
- Three meaning colours (gold, red, green) and no blue anywhere.
- Marcellus only for names and titles; Manrope for everything you act on.
- One Yemeni motif: the Sana'a gypsum frieze under the band.
- Hairlines instead of containers; no shadows at rest.

## Colors

Warm earth throughout: roasted browns on sand, with three small spice-coloured signals.

### Primary
- **Brew** (brew): the one action colour. Used for the solid Approve / Send pill, focus rings, the text caret, and the underline on the active tab.
- **Shell Brown** (shell-brown): the top band and nothing else. It frames the room the way a carved wooden lintel frames a doorway.

### Secondary
- **Qishr Gold** (qishr-gold): *waiting*. Used for the Orders count badge, the "An order is waiting for you" strip (as a 14% tint on paper), the frieze dots, and the Arabic wordmark. **Qishr Ink** (qishr-ink) is its readable text form: "due" amounts, "on order" stock, "Customer pays".

### Tertiary
- **Qamariya Red** (qamariya-red): *risk*. Used for Guard catches, allergy flags, and stock below its par level. It is named after the stained-glass fanlights of Sana'a houses.
- **Terrace Green** (terrace-green): *done*. Used for paid amounts, "Sent", and approved events in the log.

### Neutral
- **Sand Cream** (sand-cream): page ground, the queue column, and the band's text.
- **Sand Deep** (sand-deep): hover rows, the shop's message bubbles, and menu highlights.
- **Paper** (paper): the active work surface (detail pane, People thread) and the selected queue row, so the selection reads as the paper pulled forward.
- **Coffee Ink** (coffee-ink): all primary text.
- **Roast Muted** (roast-muted): secondary text such as timestamps, captions, and help lines.
- **Hairline** / **Hairline Strong** (hairline, hairline-strong): row dividers and pane edges. The strong form is used for input strokes and the dotted leaders.
- **Bubble In** (bubble-in): the customer's message bubbles, a warm gold tint so their words stand apart from the shop's.

### Named Rules
**The Three Spices Rule.** Gold means waiting, red means risk, green means done. A fourth hue, or one of these three used for decoration, is a bug.

**The No Blue Rule.** Nothing cool enters the room. Links are Brew with an underline, and the simulator's phone is the only dark surface.

## Typography

**Display Font:** Marcellus (with Georgia, serif)
**Body Font:** Manrope (with system-ui, sans-serif)
**Arabic:** Reem Kufi (with Geeza Pro)

**Character:** Marcellus has the incised, lapidary look of a carved shop sign. Manrope is plain and readable in a rush. The pairing feels like a sign over the door above a clearly written order pad.

### Hierarchy
- **Display** (Marcellus 400, 34px, 1.12): page titles such as the date on Today and "People".
- **Headline** (Marcellus 400, 24–30px, 1.12): the shop name in the band and the name of the person in view.
- **Title** (Manrope 700, 19–21px): section heads (Pickups, Stock, What happened, Our reply).
- **Body** (Manrope 400, 15px, 1.55): messages, rationale, rows. Prose is capped at about 70 characters per line.
- **Label** (Manrope 500, 13px): timestamps, captions, menu labels. Always sentence case.
- **Money** uses tabular figures so totals line up down a column.

### Named Rules
**The Signboard Rule.** Marcellus appears only on the shop name, page titles, and a person's name. Buttons, numbers, and labels are always Manrope.

**The No Kicker Rule.** No small uppercase labels stacked above headings, and no letter-spaced eyebrows. A heading stands on its own.

## Layout

- The band is 64px tall and full width, with the frieze (9px) directly beneath it.
- **Orders** is master-detail: the queue takes about 40% on cream, the detail about 60% on paper, and each pane scrolls on its own. The action bar (Approve / Write my own / Skip) is pinned to the foot of the detail pane.
- **Today** sits in a 1152px max-width column: a date title, one sentence of totals, then a two-column grid (1.2fr / 1fr). Pickups and What happened sit on the left. Stock stays on the right and is pinned while the log scrolls.
- **People** mirrors Orders: the contact list on cream, the thread on paper, and a composer pinned to the foot.
- Side gutter is 32px on desktop and 16–24px on phones. Rows have 16px of vertical padding. Sections are 48px apart.
- Below `lg` the panes stack. Tapping a queue row scrolls its detail into view, and the action bar stays sticky at the bottom of the viewport. Today stacks as Pickups, then Stock, then What happened. The Phone button folds into the menu, and the wordmark shortens to "Mokha".

## Elevation & Depth

The room is flat. Depth comes from tone: cream recedes and paper comes forward. The selected queue row turns paper, and the active pane is paper beside a cream column. Panes are separated by hairlines, not shadows. Only floating layers that sit over the room get a shadow.

### Shadow Vocabulary
- **Floating menu** (`box-shadow: 0 12px 32px -12px rgba(43,26,16,0.35)`): the band's dropdown menu, tooltips, and dialogs.

### Named Rules
**The Paper Forward Rule.** To raise something, make it paper. Never add a shadow to an element that sits in the page flow.

## Shapes

Corners are soft but restrained: inputs and buttons are full pills (999px), message bubbles are 12px, menus 12px, and small controls 6–8px. Rows and panes have no radius at all, only straight hairline rules, like the ruled lines of a menu board. The one ornamental form is the frieze: a 16px-period zigzag of cream hairline with a gold dot in each peak.

## Components

### Buttons
- **Shape:** full pill (999px), 42px tall, 20px side padding, Manrope semibold 15px.
- **Primary:** solid Brew with Paper text. There is one per view, for the decision (Approve, Send).
- **Outline:** Paper with a Hairline Strong stroke and Coffee Ink text (Write my own, Send this, Customer pays).
- **Text:** Brew text with no fill (Skip, Show them, Load earlier messages, Open it).
- **Hover / Focus:** colour shifts over 150ms, with a 2px Brew focus outline offset 2px. No glow and no lift.

### Inputs / Fields
- **Style:** Paper fill, Hairline Strong stroke, pill radius, placeholder in muted roast.
- **Focus:** a 2px Brew outline, with the Brew caret.

### Navigation
- Text tabs sit inside the brown band: Sand Cream at 70% when inactive, full when active, with a 2px Qishr Gold underline on the active tab. Orders carries a gold count badge. Keys 1/2/3 switch tabs, and the view is kept in `?tab=`.
- The band's menu (≡) holds the secondary tools and the demo controls under a muted "Demo controls" label.

### Menu Row (signature)
The item name, a 2px dotted Hairline Strong leader filling the gap, then the price. The leader sits a third of an em above the baseline so it reads like a printed menu. It is used for queue rows, order lines, pickups, and agent evidence.

### Message Bubbles
The customer's bubbles are left-aligned in Bubble In. The shop's bubbles are right-aligned in Sand Deep. Both use a 12px radius with a muted timestamp underneath. No avatars.

### Stock Bar
A 6px track in Sand Deep. The fill is Qamariya Red when below par and Roast Muted otherwise. Stock already on order shows as a Qishr Ink diagonal hatch past the fill. Only items that need attention are listed, and the rest collapse into one line ("10 other ingredients are fine").

### Sana'a Frieze
An authored SVG pattern under the band. It is used once per page and never repeated as a divider elsewhere.

## Do's and Don'ts

### Do:
- **Do** put a dotted leader between every item and its price.
- **Do** use gold, red, and green only for waiting, risk, and done.
- **Do** write plain verbs on controls: Approve, Skip, Write my own, Send this.
- **Do** collapse what needs no attention into one sentence ("10 other ingredients are fine").
- **Do** raise the active thing by making it Paper, not by adding a shadow.

### Don't:
- **Don't** use cards, chips, stat tiles, or bordered boxes to group content. Use hairline rows.
- **Don't** introduce blue or any cool colour, gradients, glows, or glassmorphism.
- **Don't** set buttons, numbers, or labels in Marcellus.
- **Don't** stack uppercase kickers or eyebrows above headings.
- **Don't** show demo plumbing (platform, internal ids, stage codes) in owner-facing copy.
- **Don't** repeat the frieze or add other ornament. The room has exactly one motif.
