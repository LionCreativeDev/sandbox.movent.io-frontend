import { DASHBOARD_THEME } from '../dashboardTheme';

// Re-exposes the shared dashboard palette (see dashboardTheme.ts) under the
// field names this section's components already import — one source of
// truth for the actual hex values, kept centralized there.
export const AI_THEME = {
  sectionBg: DASHBOARD_THEME.pageBg,
  cardBg: DASHBOARD_THEME.cardBg,
  border: DASHBOARD_THEME.border,
  borderHover: '#d6d0bd',
  imagePlaceholderBg: DASHBOARD_THEME.subtleBg,

  heading: DASHBOARD_THEME.textPrimary,
  body: DASHBOARD_THEME.textSecondary,
  muted: '#8f8a7c',

  navy: DASHBOARD_THEME.navy,
  navyDark: '#04101d',

  badgeBg: DASHBOARD_THEME.badgeBg,
  badgeText: DASHBOARD_THEME.navy,

  gold: DASHBOARD_THEME.gold,
  goldBg: DASHBOARD_THEME.goldBg,

  subtleBg: DASHBOARD_THEME.subtleBg,
  subtleText: DASHBOARD_THEME.textSecondary,
} as const;
