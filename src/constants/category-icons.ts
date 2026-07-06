import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

export type IoniconName = ComponentProps<typeof Ionicons>['name'];

// Keyed by lowercase category name. Covers both the wizard's category templates
// and the legacy section names used in the sample/mobile finance config.
const CATEGORY_ICONS: Record<string, IoniconName> = {
  essentials: 'home-outline',
  housing: 'home-outline',
  home: 'home-outline',
  rent: 'home-outline',
  mortgage: 'home-outline',
  utilities: 'flash-outline',
  transportation: 'car-outline',
  'food and dining': 'restaurant-outline',
  food: 'restaurant-outline',
  dining: 'restaurant-outline',
  groceries: 'restaurant-outline',
  shopping: 'cart-outline',
  health: 'heart-outline',
  entertainment: 'tv-outline',
  'subscriptions & fun': 'tv-outline',
  travel: 'airplane-outline',
  'kids & family': 'gift-outline',
  'kids and family': 'gift-outline',
  debt: 'card-outline',
  savings: 'trending-up-outline',
  education: 'school-outline',
  pets: 'paw-outline',
  giving: 'leaf-outline',
  insurance: 'shield-checkmark-outline',
  income: 'cash-outline',
  transfers: 'swap-horizontal-outline',
};

const FALLBACK_ICON: IoniconName = 'pricetag-outline';

/** Best-effort icon lookup for a user-facing category/section name. */
export function iconForCategory(name: string): IoniconName {
  const key = name.trim().toLowerCase();
  if (CATEGORY_ICONS[key]) return CATEGORY_ICONS[key];
  for (const [candidate, icon] of Object.entries(CATEGORY_ICONS)) {
    if (key.includes(candidate) || candidate.includes(key)) return icon;
  }
  return FALLBACK_ICON;
}
