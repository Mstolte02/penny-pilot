# Penny Pilot V1 Brief

## Product Direction

Penny Pilot is a friendly personal finance app for young professionals and broader App Store users. It helps people create a flexible budget, categorize synced transactions, understand spending and saving habits, and track progress toward major financial goals.

The core brand promise:

> We'll help you navigate your finances.

Penny Pilot should feel approachable, optimistic, and helpful. It should avoid judgmental money language and use Penny, the pilot mascot, as a calm guide who organizes the user's finances behind the scenes.

## Visual Direction

The working app direction is light, friendly, and consumer-app approachable:

- White primary background
- Navy/dark text
- Cream cards and selected states
- Copper primary actions
- Green progress
- Sky-blue supporting mascot details

The app should feel bright and clear rather than like a dark dashboard. Dark mode can come later, but V1 exploration should prioritize the white-background experience.

## Target Audience

- Primary: young professionals who want structure without feeling trapped in a rigid budgeting system.
- Secondary: anyone who wants a simpler, friendlier way to understand spending, saving, and goal progress.

## V1 Product Pillars

1. Create a flexible budget.
2. Track spending and saving habits from synced bank transactions or private bank-export uploads.
3. Track progress toward home buying and other major goals.
4. Make transaction categorization feel fast, friendly, and low-stress.
5. Keep users in control of their own categories, subcategories, and budget choices.

## Core App Structure

### Setup Wizard

The first-run experience should personalize Penny Pilot before the user reaches the full app.

Setup should collect:

- Budget style preference
- Category and subcategory preferences
- Initial goal templates
- Guidance tone and helpfulness preferences
- Bank sync readiness
- Whether the user prefers automatic sync or private bank-export import

During setup, Penny can appear as a friendly wizard/helper. After setup, Penny shifts into the full pilot identity. This gives onboarding a distinct emotional arc: "let's build your map" before "let's fly the plan."

### Today

The app's daily cockpit. Penny summarizes the user's current financial status in plain language:

- Month-to-date spending
- Budget pace
- Savings pace
- Transactions needing review
- Goal progress
- Friendly alerts and celebrations

### Budget

A guided but flexible budget builder.

The app suggests a budget from income, fixed expenses, variable expenses, and spending history, but the user has final control. Penny should guide without forcing a specific doctrine.

Required budget concepts:

- Fixed expenses
- Variable expenses
- Custom categories
- Custom subcategories
- Income lines
- Savings/debt lines
- User-adjustable category amounts

### Transactions

A transaction inbox with two user-selectable data paths:

- Bank sync for users who want automatic updates.
- Private bank export for users who do not want to link an account.

Both paths should feed the same Quizlet-style categorization flow.

The free version must include:

- Transaction review cards
- AI-assisted category predictions
- Approve/change interactions
- Create category or subcategory during review
- Merchant learning rules
- Confidence-based review queue
- CSV/XLS/XLSX bank-export import
- Simple in-app guidance for downloading transaction exports from a bank or credit card website

The experience should feel quick and encouraging. Penny can say things like:

- "I think this one is Food > Coffee."
- "Want me to remember that for next time?"
- "Nice, that's one more transaction sorted."

### Goals

A generic goal engine with friendly templates.

V1 goal templates:

- Home down payment
- Car purchase
- Emergency fund
- Vacation
- Wedding
- Moving
- Loan payoff
- Credit card payoff
- Custom goal

Under the hood, goals should share a common model so new templates are easy to add.

## Category System

Categories and subcategories are user-owned.

Penny Pilot may ship starter templates, but users must be able to:

- Add categories
- Add subcategories
- Rename categories/subcategories
- Reorder categories
- Hide categories
- Delete unused categories
- Mark categories or budget lines as fixed, variable, income, savings, debt, or transfer

AI predictions must map transactions into the user's personal category system, not a rigid global category list.

## Transaction Data Options

Penny Pilot should make setup feel like a choice, not a trust ultimatum.

### Bank Sync

Bank syncing is the convenience path for V1.

Recommended provider:

- Plaid

Plaid integration requires a backend because the app must create link tokens, exchange public tokens, and protect API secrets server-side.

### Private Bank Export

Private bank export is the no-link privacy path.

Users can download transactions from their bank or credit card site and import them into Penny Pilot without connecting a live account. V1 should support common CSV/XLS/XLSX exports and normalize flexible column names such as Date, Transaction Date, Description, Merchant, Amount, Debit, Credit, Money In, and Money Out.

The upload flow should:

1. Explain how to download a transaction export in plain language.
2. Parse the export locally when possible.
3. Auto-guess categories using merchant rules and category history.
4. Send imported rows into the same review-card queue as synced transactions.
5. Let users re-upload periodically to stay current.

## Recommended Stack

### Mobile App

- Expo
- Expo Router
- React Native
- Development builds for native Plaid support
- Local SQLite cache for fast/offline reads

### Backend

- Supabase Auth
- Supabase Postgres
- Supabase Edge Functions or server functions for Plaid token exchange and sync jobs
- Row Level Security on all user-owned financial data

### Auth

- Apple sign-in
- Google sign-in

Apple sign-in is important for App Store expectations, and Google sign-in is useful for cross-platform user familiarity.

## Forecasting And Goal Tracking

Penny should hide most methodology from free users and expose advanced model details as part of paid features later.

Forecasting approach:

1. Start with simple moving average when user data is limited.
2. Add EWMA once enough behavior history exists.
3. Add random walk with drift when trend-based behavior matters.
4. Backtest available models against the user's own historical data.
5. Choose the model with the lowest recent forecast error.

Free users should see friendly outputs:

- "You're on pace to reach this goal around March 2027."
- "Your savings pace improved this month."
- "This goal may need a small monthly boost."

Paid users can later see:

- Forecast confidence
- Scenario planning
- Best/base/worst ranges
- Model explanations
- What changed since last month

## AI Categorization

Transaction categorization should use a layered classifier:

1. User merchant rules
2. Normalized merchant matching
3. Plaid category metadata
4. User category/subcategory list
5. Penny Pilot global defaults where privacy allows
6. Backend AI fallback for ambiguous cases
7. Confidence score

High-confidence transactions can be categorized automatically. Medium- and low-confidence transactions should go to the review queue.

AI requests should use the smallest practical payload, for example:

```json
{
  "merchant": "SQ BLUE BOTTLE COFFEE",
  "amount": 6.42,
  "plaidCategory": ["Food and Drink", "Restaurants", "Coffee Shop"],
  "userCategories": [
    {
      "name": "Food",
      "subcategories": ["Groceries", "Dining Out", "Coffee"]
    }
  ]
}
```

## Free Non-Negotiables

These must remain free:

- Bank sync
- Private bank-export import
- Custom categories and subcategories
- Fixed vs variable budget model
- Quizlet-style transaction categorization
- AI-assisted category suggestions
- Merchant learning rules
- Basic spending/saving trends
- At least one active budget
- A limited number of active goals
- Personalized setup wizard

## Mascot States

Penny should support multiple app states:

- Setup wizard
- Pilot/default
- Happy
- On track
- Thinking
- Concerned
- Celebrating

The first generated project assets are:

- `assets/mascot/penny-wizard-cropped.png`
- `assets/mascot/penny-pilot-cropped.png`
- `assets/mascot/penny-happy-cropped.png`
- `assets/mascot/penny-on-track-cropped.png`
- `assets/mascot/penny-thinking-cropped.png`
- `assets/mascot/penny-concerned-cropped.png`
- `assets/mascot/penny-celebrating-cropped.png`

Penny should have subtle idle motion in the app. Default motion should be a gentle float/tilt, not a distracting loop. Future states can add short one-shot animations for milestones, transaction approvals, and setup completion.

## Paid Feature Candidates

Potential freemium upgrades:

- Unlimited goals
- Advanced forecasting
- Scenario planning
- Subscription detection
- Bill reminders
- Debt payoff strategy comparison
- Advanced category automation
- Export/history tools
- Household/shared budgeting
- Deeper Penny explanations and methodology

## Initial Build Sequence

1. Scaffold Expo app with Expo Router.
2. Set up shared domain types for users, accounts, transactions, categories, budgets, and goals.
3. Add Supabase auth shell with Apple and Google sign-in placeholders.
4. Define Supabase schema and Row Level Security policies.
5. Stub Plaid Link flow and backend token endpoints.
6. Add private CSV/XLS/XLSX bank-export import as the no-link setup path.
7. Build starter tab navigation: Today, Budget, Transactions, Goals.
8. Build the budget setup prototype with fixed and variable expenses.
9. Build transaction review cards with sample data.
10. Build custom category/subcategory management.
11. Build the first generic goal model and home/car templates.

## Open Decisions

- Final app icon and Penny mascot direction
- Exact V1 pricing and subscription tiers
- Whether free users get one goal or multiple limited goals
- Whether transaction auto-categorization happens before review or only after explicit approval
- Whether Plaid sync is real in the first local prototype or mocked until backend setup is ready
- Whether private import runs fully on-device in the mobile app or uses a backend parser for difficult bank formats
