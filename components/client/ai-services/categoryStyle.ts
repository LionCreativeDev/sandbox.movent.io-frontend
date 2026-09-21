import { IconType } from 'react-icons';
import {
  HiGlobeAlt, HiDevicePhoneMobile, HiPaintBrush, HiMegaphone, HiShoppingCart,
  HiWrenchScrewdriver, HiShieldCheck, HiSparkles, HiCloud, HiPuzzlePiece,
  HiBuildingOffice2, HiCube,
} from 'react-icons/hi2';

export interface CategoryStyle {
  bucket: string;
  icon: IconType;
  // Bundled local mockup illustration for this category (laptop/phone/
  // dashboard scene, not a stock photo — see public/images/ai-services) —
  // rendered as the card/hero image itself.
  image: string;
}

const IMG = '/images/ai-services';
// Bundled general IT-services image — tier 3 of the image-selection order
// (existing service image → category image → this) for a category that
// matches no bucket below, and the <img onError> fallback if a bucket's own
// image file is ever missing.
export const GENERIC_SERVICE_IMAGE = `${IMG}/generic.svg`;

// AI Suggested Services' `category` is free text (either from the AI model or
// the static fallback catalog — see App\Services\AiServiceCatalogService) —
// there's no fixed enum to switch on, so this matches keywords rather than
// exact values, and buckets near-duplicate categories ("Website Redesign",
// "Web Development") under one filter tab/icon. Order matters: checked top
// to bottom, first match wins.
//
// Badge/card styling is intentionally NOT per-category (see theme.ts) — the
// reference design uses one neutral navy-tinted badge for every category,
// so only `bucket` (tab label), `icon` (badge glyph) and `image` vary here.
const CATEGORY_BUCKETS: (CategoryStyle & { match: RegExp })[] = [
  { match: /web|website|cms|landing/i,             bucket: 'Web',            icon: HiGlobeAlt,          image: `${IMG}/web.svg` },
  { match: /app|mobile|ios|android/i,              bucket: 'Apps',           icon: HiDevicePhoneMobile, image: `${IMG}/apps.svg` },
  { match: /design|ui|ux|brand/i,                  bucket: 'Design',         icon: HiPaintBrush,        image: `${IMG}/design.svg` },
  { match: /marketing|seo|content|copy|advertis/i, bucket: 'Marketing',      icon: HiMegaphone,         image: `${IMG}/marketing.svg` },
  { match: /commerce|shop|store|retail/i,          bucket: 'E-commerce',     icon: HiShoppingCart,      image: `${IMG}/ecommerce.svg` },
  { match: /support|maintenance|operations/i,      bucket: 'Support',        icon: HiWrenchScrewdriver, image: `${IMG}/support.svg` },
  { match: /security|cyber|audit|risk/i,           bucket: 'Security',       icon: HiShieldCheck,       image: `${IMG}/security.svg` },
  { match: /\bai\b|automation|chatbot|\bml\b/i,    bucket: 'AI',             icon: HiSparkles,          image: `${IMG}/ai.svg` },
  { match: /cloud|infra|devops|hosting|server/i,   bucket: 'Infrastructure', icon: HiCloud,             image: `${IMG}/infrastructure.svg` },
  { match: /integrat|\bapi\b/i,                    bucket: 'Integrations',   icon: HiPuzzlePiece,       image: `${IMG}/integrations.svg` },
  { match: /business|crm|erp|system/i,             bucket: 'Business',       icon: HiBuildingOffice2,   image: `${IMG}/business.svg` },
];

const DEFAULT_CATEGORY_STYLE: CategoryStyle = { bucket: 'Other', icon: HiCube, image: GENERIC_SERVICE_IMAGE };

export function aiServiceCategoryStyle(category: string): CategoryStyle {
  const found = CATEGORY_BUCKETS.find(c => c.match.test(category));
  return found ?? DEFAULT_CATEGORY_STYLE;
}
