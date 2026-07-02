/**
 * Penny's voice, in one place. Two rules govern every line:
 * 1. Never a shame message — "concerned" is Penny's floor, and turbulence copy
 *    stays factual and kind. The moment a notification makes someone feel bad,
 *    they turn them all off and the retention loop is gone.
 * 2. Penny owns every empty and error state, so personality pays off exactly
 *    where other fintech tools go generic.
 */

export const SETUP_COMPLETE_KEY = 'penny:setupComplete';

/** Verdicts for the "Can I afford this?" forecast. */
export const affordVerdicts = {
  clear: {
    title: 'Clear for takeoff',
    penny: 'Plenty of runway. This fits your flexible budget with room to spare.',
  },
  caution: {
    title: 'Proceed with caution',
    penny: 'It fits, but the rest of the month gets snug. Worth it? Your call, captain.',
  },
  grounded: {
    title: 'Grounded',
    penny: 'This one would overdraw the flight plan. A goal transfer or next month works better.',
  },
} as const;

/** Empty and error states — Penny owns all of them. */
export const emptyStates = {
  syncFailed: 'Lost radio contact with your bank — retrying.',
  noTransactions: 'Nothing on the radar yet. New transactions will show up here for review.',
  allReviewed: 'Radar is clear — every transaction is sorted.',
  noSubscriptions: 'No recurring charges spotted yet. Penny keeps scanning.',
} as const;

/**
 * Notification copy (wired up when push lands): gold-on-navy, one line, factual
 * and kind. Never a shame notification, ever.
 */
export const notificationTemplates = {
  morningBriefing: (safeToday: string) => `Safe to spend today: ${safeToday}. Skies are clear. ✈️`,
  billHeadsUp: (name: string, amount: string) => `Heads up — ${name} (${amount}) hits tomorrow.`,
  turbulence: (category: string) =>
    `${category} is running ahead of plan this month. A quiet week levels it out.`,
} as const;

/** The wizard's script — each setup step is a spell. */
export const wizardScript = {
  welcome: "Every app has a setup wizard. I'm just the only one who dresses for it.",
  summon: 'First spell: summoning your transactions.',
  sort: 'Now, a little organizational magic.',
  reveal: 'Revealing hidden enchantments…',
  flightPlan: 'Last one — charting your flight plan.',
  transform: "Setup's done — the magic part is over. From here on out, we fly on real numbers.",
  rerun: 'You rang? The hat still fits.',
} as const;
