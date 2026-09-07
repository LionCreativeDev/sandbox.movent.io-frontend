'use client';
import { useParams } from 'next/navigation';
import BrandForm from '@/components/brands/BrandForm';

export default function EditBrandPage() {
  const { id } = useParams<{ id: string }>();
  return <BrandForm brandId={Number(id)} />;
}
