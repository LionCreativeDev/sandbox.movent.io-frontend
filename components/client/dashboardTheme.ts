// Navy / cream / muted-gold palette for the Client Portal DASHBOARD VIEW
// ONLY (/client/dashboard). Every other portal page (Projects, Invoices,
// Services, ...) keeps the existing green theme — see the `isDashboard`
// check in app/client/layout.tsx, which is the single place deciding where
// this applies. Sampled from the client-supplied reference screenshot
// (deep navy sidebar, warm cream surfaces, muted gold highlights), not
// Movent's site-wide green.
export const DASHBOARD_THEME = {
  navy: '#081B2D',
  navyActive: '#203750',
  pageBg: '#FAF8F3',
  cardBg: '#FFFFFF',
  gold: '#B49A60',
  goldBg: '#F3ECDA',
  textPrimary: '#15283C',
  textSecondary: '#626975',
  border: '#E6E2D9',
  subtleBg: '#F0EEE8',
  badgeBg: '#E9EDF2',
} as const;
