import { useState } from 'react';
import { GENERIC_SERVICE_IMAGE } from './categoryStyle';

// Local-only fallback: if a category's bundled illustration is ever missing
// from public/images/ai-services, this swaps to the generic bundled IT
// image instead of a broken <img>. Never fetches anything over the network.
export default function CategoryImage({ src, alt }: { src: string; alt: string }) {
  const [errored, setErrored] = useState(false);

  return (
    <img
      src={errored ? GENERIC_SERVICE_IMAGE : src}
      alt={alt}
      onError={() => setErrored(true)}
      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
    />
  );
}
