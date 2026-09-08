'use client';
import { useParams } from 'next/navigation';
import BrandDetail from '@/components/brands/BrandDetail';

// Brand view page. Re-exported at /admin/brands/{id} for the Company Admin —
// the component picks the right API from who is signed in.
export default function BrandViewPage() {
  const { id } = useParams<{ id: string }>();
  return <BrandDetail brandId={Number(id)} />;
}
