'use client';
import BrandForm from '@/components/brands/BrandForm';

// Add Brand. Re-exported at /admin/brands/new for the Company Admin — the
// form itself picks the right API from who is signed in.
export default function NewBrandPage() {
  return <BrandForm />;
}
