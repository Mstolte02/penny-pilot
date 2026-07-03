# Penny Pilot Design System — Warm Copper

This document supersedes the "light, white-background" direction in
`penny-pilot-v1-brief.md` **and** the earlier navy/gold "aviation at dusk" pass. The
app is a finance app first: warm ivory surfaces, penny-copper brand color, and a light
touch of pilot personality carried by Penny herself rather than by aviation jargon.

## The Wizard-to-Pilot Arc

Penny appears on the welcome screen as **Penny the Wizard** — pointy hat, robe, wand —
because this is the Setup Wizard, and she leans into the joke: *"Every app has a setup
wizard. I'm just the only one who dresses for it."*

Each wizard step is a **spell**: connecting your bank is *summoning* your
transactions, auto-categorization is *a little organizational magic*, and detected
subscriptions get a *"reveal hidden enchantments"* flourish. The framing sets the
expectation that the app does the work — the user watches a spell get cast on their
own data.

The payoff: once setup is approved — *"Setup's done — the magic part is over. From
here on out, we fly on real numbers."* Hat becomes pilot cap, wand becomes headset,
contrail animation, and the app hands over to the everyday theme. Re-running setup
brings Wizard Penny briefly back (*"you rang?"*).

Implementation: `src/app/setup.tsx`, script in `src/constants/penny-voice.ts`,
completion flag `penny:setupComplete` in AsyncStorage.

## App Layout

Bottom tab bar, 4 tabs + 1 action button (`src/components/app-tabs.tsx`):

| Tab | Route | Serves |
| --- | --- | --- |
| **Overview** | `/` | One number: **Safe to Spend Today**. Below it the month-progress gauge (fill = % of flexible budget spent, pin = today) with an explicit caption, then next bill, goal progress, and Penny's one insight. No transaction list. |
| **Transactions** | `/transactions` | Read-only synced feed grouped by day with Penny's guess + a **confidence pill** per row. Reviewing happens only in the quizlet-style modal ("Review transactions") — nothing confirms on a stray tap. Segmented toggle to **Subscriptions**: true subscriptions only (rent/utilities/loans are bills, not subscriptions), sorted by cost, with cancel reminders and a "Not in current budget → Add to Plan" flow. |
| **$? (center)** | `/afford` | "Can I afford this?" — amount + optional label → **Clear for takeoff / Proceed with caution / Grounded** with a one-line reason. |
| **Plan** | `/budget` | Budget envelopes as horizontal gauges with "Move money" reallocation. Each line is **Fixed** (you set it) or **Flexible** (Penny sets it from history — n-month average or EWMA α 0.35, explained in a picker popup). Goals as **destination cards** ("arrival by …") with an actual-vs-budgeted savings projection line chart. |
| **Logbook** | `/logbook` | Monthly reports with a fully drillable breakdown (category → subcategory → individual transactions), net worth line chart, and the compounding-curve projection with plain-language guidance on where those returns actually come from. |

Settings, notifications, and account hide behind **Penny's avatar** in the top corner
of every screen (`/auth`).

## Palette (`src/constants/theme.ts`)

Penny-colored: warm copper on ivory, with a true warm-dark mode. Brick red appears
only for overspending, and always with kind copy — never a red screen.

| Role | Light | Dark | Use |
| --- | --- | --- | --- |
| Primary | `#B87333` Warm Copper | `#D18A45` | Brand, buttons, highlights, safe-to-spend |
| Primary hover | `#A35F28` | `#B87333` | Hover/focus states |
| Accent | `#D58B45` Fresh Penny | `#D58B45` | Charts, badges |
| Secondary | `#7A4A24` Deep Bronze | `#C89B6E` | Headers, icons |
| Background | `#FAF7F2` Warm Ivory | `#161311` | App background |
| Surface / cards | `#FFFFFF` | `#211C19` | Cards |
| Border | `#DDD5CA` | `#352C24` | Dividers |
| Text | `#2E2E2E` Charcoal | `#F6F2EC` | Primary text |
| Muted text | `#6B6B6B` Slate | `#B9AEA1` | Secondary text |
| Success | `#2E7D32` Forest | `#5FA463` | Positive money |
| Warning | `#D69E2E` Amber | `#E0B14E` | Alerts |
| Danger | `#C94C4C` Brick | `#D96C6C` | Overspending |

Chart palette (`chartPalette`): Copper `#B87333`, Gold `#D4A24C`, Olive `#7A8F4E`,
Sage `#9BB58A`, Steel Blue `#5D7C96`, Teal `#3F8A89`, Plum `#82658C`, Brick `#C06A52`.

`WizardColors` is the brief violet/starfield variant used only during setup — copper
stays, so the swap reads as a costume change.

## Typography

One rounded-but-professional sans: **Nunito** on web (via `global.css`), SF Pro
Rounded on iOS. Three sizes do most of the work (`TypeScale`): hero 48pt/800 with
tabular figures, section 20pt/700, body 15pt/500. Tabular numerals everywhere money is
displayed (`ThemedText type="money"` / `type="hero"`).

## Components

- Cards: 18px radius, soft elevation, generous breathing room (`Card` in `penny-ui.tsx`).
- Gauges over raw tables: `FuelGauge` (budget remaining), `AltitudeArc` (month-pace
  gauge with a self-explaining center label), `LineChart` in `mini-charts.tsx`
  (solid actual line with soft area fill, dashed plan line, planned-expense markers —
  the finance_tracker chart style).
- **Penny**: expression set — neutral, happy, on-track, thinking, concerned (her
  floor — never angry), celebrating, wizard. Subtle idle float, off under reduced
  motion. Her dialogue always renders in `SpeechBubble` — copper bubble = Penny.

## Motion

Micro-animations on the moments that matter, nothing else: the review-complete
celebration, goal milestones, and the wizard→pilot transformation (the one big
animation). All motion respects the OS reduce-motion setting (`useReducedMotion`).

## Notifications (copy ready, delivery later)

One line, factual and kind. **Never a shame notification, ever.** Templates live in
`src/constants/penny-voice.ts` (morning briefing, bill heads-up, turbulence).

## Empty & error states

Penny owns all of them (`emptyStates` in `penny-voice.ts`): failed sync is *"Lost
radio contact with your bank — retrying,"* an empty queue is a celebration, never a
blank screen.
