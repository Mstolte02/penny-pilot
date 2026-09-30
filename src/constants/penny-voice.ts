/**
 * Penny's voice, in one place. Two rules govern every line:
 * 1. Never a shame message — "concerned" is Penny's floor, and turbulence copy
 *    stays factual and kind. The moment a notification makes someone feel bad,
 *    they turn them all off and the retention loop is gone.
 * 2. Penny owns every empty and error state, so personality pays off exactly
 *    where other fintech tools go generic.
 */

export const SETUP_COMPLETE_KEY = 'penny:setupComplete';
export const BUDGET_STYLE_KEY = 'penny:budgetStyle';
export const NOTIFICATION_PREFS_KEY = 'penny:notificationPrefs';
export const WIZARD_STATE_KEY = 'penny:wizardState';

/** Verdicts for the "Can I afford this?" forecast. */
export const affordVerdicts = {
  clear: {
    title: 'Clear for takeoff',
    penny: 'Plenty of runway. This fits your flexible budget with room to spare.',
  },
  caution: {
    title: 'Proceed with caution',
    penny: 'It fits, but the rest of the month gets tight. Your call, captain.',
  },
  grounded: {
    title: 'Grounded',
    penny: 'This would put you over plan. Try a goal transfer, or wait for next month.',
  },
} as const;

/** Empty and error states — Penny owns all of them. */
export const emptyStates = {
  syncFailed: 'Lost radio contact with your bank. Trying again.',
  noTransactions: 'Nothing on the radar yet. New transactions show up here to review.',
  allReviewed: 'All clear. Every transaction is sorted.',
  noSubscriptions: "No recurring charges spotted yet. I'll keep looking.",
} as const;

/**
 * Notification copy (wired up when push lands): gold-on-navy, one line, factual
 * and kind. Never a shame notification, ever.
 */
export const notificationTemplates = {
  morningBriefing: (safeToday: string) => `Safe to spend today: ${safeToday}. Skies are clear. ✈️`,
  billHeadsUp: (name: string, amount: string) => `${name} (${amount}) is due tomorrow.`,
  turbulence: (category: string) =>
    `${category} is running ahead of plan this month. A quiet week would even it out.`,
  weeklyReport: (net: string) => `Weekly recap: ${net} net this week. Full report in the Logbook.`,
  goalMilestone: (goal: string, pct: number) => `${goal} just passed ${pct}%. Nice work!`,
} as const;

/** The wizard's script — each setup step is a spell. */
export const wizardScript = {
  welcome: "Every app has a setup wizard. I'm just the only one who dresses for it.",
  summon: 'First spell: summoning your transactions.',
  sort: 'Now a little sorting magic.',
  reveal: 'Revealing hidden enchantments…',
  flightPlan: 'Last one: charting your flight plan.',
  transform: "Setup's done. No more magic from here, just real numbers.",
  rerun: 'You rang? The hat still fits.',
} as const;
