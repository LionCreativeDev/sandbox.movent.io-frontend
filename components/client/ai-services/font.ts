import { Fraunces } from 'next/font/google';

// Editorial serif for THIS section's headings only (hero title, "AI
// Suggested IT Services") — applied narrowly via `serif.className` on
// individual elements, never on <body>, so nothing else in the app's
// typography changes.
export const serif = Fraunces({
  subsets: ['latin'],
  weight: ['600', '700'],
  display: 'swap',
});
