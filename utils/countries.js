/**
 * Country names for the checkout delivery-address <select>.
 *
 * Plain data — no dependency on a locale library. Grenada is floated to the
 * top for convenience since Bahama Mama is Grenada-based, then the rest run
 * alphabetically. Values are the display names; a future Supabase order can
 * store the name as-is or be mapped to ISO codes server-side.
 */
const REST = [
  'Antigua and Barbuda', 'Argentina', 'Aruba', 'Australia', 'Austria', 'Bahamas',
  'Barbados', 'Belgium', 'Belize', 'Bermuda', 'Brazil', 'British Virgin Islands',
  'Canada', 'Cayman Islands', 'Chile', 'China', 'Colombia', 'Costa Rica', 'Cuba',
  'Curaçao', 'Denmark', 'Dominica', 'Dominican Republic', 'Ecuador', 'Finland',
  'France', 'Germany', 'Ghana', 'Greece', 'Guadeloupe', 'Guatemala', 'Guyana',
  'Haiti', 'Iceland', 'India', 'Ireland', 'Israel', 'Italy', 'Jamaica', 'Japan',
  'Kenya', 'Martinique', 'Mexico', 'Montserrat', 'Netherlands', 'New Zealand',
  'Nigeria', 'Norway', 'Panama', 'Peru', 'Portugal', 'Puerto Rico',
  'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Vincent and the Grenadines',
  'Singapore', 'South Africa', 'Spain', 'Sweden', 'Switzerland', 'Trinidad and Tobago',
  'Turks and Caicos Islands', 'United Arab Emirates', 'United Kingdom',
  'United States', 'United States Virgin Islands', 'Uruguay', 'Venezuela',
  'Other'
]

export const COUNTRIES = ['Grenada', ...REST]
