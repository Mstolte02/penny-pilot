# Penny Pilot Design System — "Aviation at Dusk"

This document supersedes the "light, white-background" visual direction in
`penny-pilot-v1-brief.md`. The app is a calm instrument panel at dusk, and setup is
the one place magic is allowed.

## The Wizard-to-Pilot Arc

Penny appears on the welcome screen as **Penny the Wizard** — pointy hat, robe, wand —
because this is the Setup Wizard, and she leans into the joke: *"Every app has a setup
wizard. I'm just the only one who dresses for it."*

Each wizard step is a **spell**:

- Connecting your bank is **summoning** your transactions.
- Auto-categorization is Penny waving her wand over the imported pile (*"a little
  organizational magic"*).
- Detected subscriptions are revealed with a **"reveal hidden enchantments"** flourish.

The magic framing does real UX work: it sets the expectation that *the app does the
work*. The user isn't filling out forms; they're watching a spell get cast on their own
data.

The payoff: once the flight plan is approved — *"Setup's done — the magic part is over.
From here on out, we fly on real numbers."* The hat swaps for a pilot cap, the wand
becomes a headset, contrail animation, and the app transitions to the pilot theme
permanently. Setup is automated magic; daily life is honest navigation. Re-running
setup brings Wizard Penny briefly back (*"you rang?"*).

Implementation: `src/app/setup.tsx`, script in `src/constants/penny-voice.ts`,
completion flag `penny:setupComplete` in AsyncStorage.

## App Layout

Bottom tab bar, 4 tabs + 1 action button (`src/components/app-tabs.tsx`):

| Tab | Route | Serves |
| --- | --- | --- |
| **Cockpit** | `/` | One number: **Safe to Spend Today**, huge, upper third. Below it the altitude gauge (month progress vs. budget burn), then a compact card stack: next bill, active goal, Penny's one insight of the day. No transaction list — readable in two seconds, never an accusation. |
| **Radar** | `/transactions` | Auto-synced feed grouped by day with Penny's category guess; confirm is one gold tap (with contrail flick), tap the row to recategorize. Segmented toggle to **Subscriptions**: every recurring charge by due day, monthly burn up top, cancel-reminder flag on each. |
| **$? (center)** | `/afford` | "Can I afford this?" — amount + optional label → verdict card: **Clear for takeoff / Proceed with caution / Grounded**, one-line reason. Deserves the most valuable real estate in the app. |
| **Flight Plan** | `/budget` | Category envelopes as horizontal **fuel gauges** ("fuel remaining", not "you overspent"). Goals as **destination cards** with projected arrival dates. "Move fuel" reallocates between tanks. |
| **Logbook** | `/logbook` | Monthly flight reports, net worth trendline, and the education projection ($100/week at 7% as a compounding curve). |

Settings, notifications, and account hide behind **Penny's avatar** in the top corner —
tap Penny on any screen (`/auth`).

## Palette (`src/constants/theme.ts`)

Aviation at dusk. **No bright red anywhere** — over-budget states use muted coral plus
a Penny message, never a red screen. Stress-avoiders are the audience; color is the
fastest way to trigger or defuse.

| Token | Value | Role |
| --- | --- | --- |
| `background` | `#0F1B2D` | Deep navy primary surface |
| `backgroundElement` | `#16263C` | Cards |
| `backgroundSelected` | `#1F3350` | Selected / inset surfaces |
| `primary` | `#F5B841` | Gold — Penny's color, the safe-to-spend number, every positive affordance |
| `accent` | `#7FB6E8` | Soft sky-blue, informational |
| `warning` | `#E8A06B` | Soft amber-coral heads-up |
| `danger` | `#E4796B` | Muted coral — the only "bad" color |
| `success` | `#5FC49C` | Soft mint, "ahead of plan" text |
| `ink` | `#0A1524` | Deepest panel (tab bar, summary bars) |
| `onPrimary` | `#13233B` | Text on gold fills |

`WizardColors` is the brief violet/starfield variant of the same palette used only
during setup, so the theme swap to navy/gold reads as a costume change, not a
different app.

## Typography

One rounded-but-professional sans: **Nunito** on web (via `global.css`), SF Pro
Rounded on iOS. Three sizes do most of the work (`TypeScale`):

- **Hero** 48pt/800 — the Safe to Spend number, tabular figures so digits don't jitter.
- **Section** 20pt/700 — headers.
- **Body** 15pt/500.

Tabular numerals everywhere money is displayed (`ThemedText type="money"` /
`type="hero"`) — reads as trustworthy, keeps columns aligned.

## Components

- Cards: 18px radius, soft elevation, generous breathing room — instrument panel, not
  spreadsheet (`Card` in `penny-ui.tsx`).
- Gauges and arcs over bar charts wherever possible: `FuelGauge` (horizontal fuel
  remaining) and `AltitudeArc` (semicircular burn vs. date gauge) in `penny-ui.tsx`.
- **Penny**: flat/geometric mascot assets in `assets/mascot/`, expression set: neutral,
  happy, on-track, thinking, concerned (her floor — never angry or disappointed),
  celebrating, plus the wizard variant. Subtle idle float, disabled under reduced
  motion.
- Her dialogue always appears in the `SpeechBubble` component — users learn **gold
  bubble = Penny talking to me**.

## Motion

Micro-animations on exactly three moments, everything else stays still:

1. Transaction confirm — small contrail flick (`RadarRow` in `transactions.tsx`).
2. Goal milestones — Penny celebration.
3. The wizard→pilot transformation — the one big animation budget item (`setup.tsx`).

All motion respects the OS reduce-motion setting (`useReducedMotion`).

## Notifications (copy ready, delivery later)

Gold-on-navy, one line, factual and kind. **Never a shame notification, ever** — the
moment a push makes someone feel bad they turn them all off and the retention loop is
gone. Templates live in `src/constants/penny-voice.ts`:

- Morning briefing (8am): *"Safe to spend today: $34. Skies are clear. ✈️"*
- Turbulence: *"Heads up — Spotify ($11.99) hits tomorrow."*

## Empty & error states

Penny owns all of them (`emptyStates` in `penny-voice.ts`): failed sync is *"Lost radio
contact with your bank — retrying,"* an empty radar is a clear scope, never a blank
screen. These are cheap to build and they're where personality pays off.
