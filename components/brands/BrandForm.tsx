'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { brandService, Brand } from '@/lib/services/brandService';
import { getAuthType } from '@/lib/auth';
import { handleNotFound } from '@/lib/notFound';
import { inp, lbl, card } from '@/components/admin/projects/shared';
import PhoneInput, { isValidPhoneNumber } from '@/components/ui/PhoneInput';
import { ALL_COUNTRIES } from '@/lib/countries';
import type { Country } from 'react-phone-number-input';
import { HiArrowLeft } from 'react-icons/hi2';
import toast from 'react-hot-toast';

// The Add Brand / Edit Brand screen — a full page in both portals, not a
// dialog, so it has room for the logo preview and reads the same way as Add
// User next door. Both routes render this: /brands/new (brandId omitted) and
// /brands/{id}/edit, each re-exported under /admin/brands/* for the Company
// Admin. brandService picks the right API for whoever is signed in.

const errText = (err: unknown, fallback: string) => {
  const ex = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
  const fieldErrors = ex.response?.data?.errors;
  if (fieldErrors) return Object.values(fieldErrors).flat().join(' · ');
  return ex.response?.data?.message ?? fallback;
};

export default function BrandForm({ brandId }: { brandId?: number }) {
  const router = useRouter();
  const editing = brandId !== undefined;
  const isAdmin = getAuthType() === 'admin';
  const brandsRoot = isAdmin ? '/admin/brands' : '/brands';

  // Permission gating reads cookies/API, neither available server-side — hold
  // the first paint until mounted so both renders agree.
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true); }, []);

  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState<Brand | null>(null);
  const [companies, setCompanies] = useState<{ id: number; name: string }[]>([]);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  // Shown in the "Billed From" block on every customer-facing copy of a Brand
  // Invoice. Typed however the user likes ("acme.com" is fine) — the backend
  // normalises it to a real URL on save (App\Support\Website), so it comes
  // back here already carrying https://.
  const [website, setWebsite] = useState('');
  // Country is picked from the shared list (ISO code), and the phone field is
  // bound to it: choosing a country switches the phone input to that
  // country's format and length, and typing a number with a different dial
  // code moves the dropdown to match. Same pairing the registration and Add
  // Company forms already use.
  const [countryCode, setCountryCode] = useState<Country>('US');
  const [address, setAddress] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [companyId, setCompanyId] = useState<number | undefined>(undefined);
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // A Company Admin holds all four brand rights implicitly (the admin guard
  // is the gate); a staff member is asked.
  useEffect(() => {
    if (isAdmin) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAllowed(true);
      brandService.companyOptions()
        .then(list => { setCompanies(list); setCompanyId(prev => prev ?? list[0]?.id); })
        .catch(() => setCompanies([]));
      return;
    }
    brandService.permissions()
      .then(p => setAllowed(editing ? p.can_edit : p.can_create))
      .catch(() => setAllowed(false));
  }, [isAdmin, editing]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!editing) { setLoading(false); return; }
    brandService.getOne(brandId!)
      .then(b => {
        setExisting(b);
        setName(b.name);
        setEmail(b.email ?? '');
        setPhone(b.phone ?? '');
        setWebsite(b.website ?? '');
        // Stored as the country NAME (that's what the column holds and what
        // invoices display), so map it back to its ISO code for the picker.
        // An older brand saved with free text that matches nothing keeps the
        // default rather than blanking the field.
        if (b.country) {
          const match = ALL_COUNTRIES.find(c => c.name === b.country || c.code === b.country);
          if (match) setCountryCode(match.code);
        }
        setAddress(b.address ?? '');
        setIsActive(b.is_active);
        setCompanyId(b.company_id);
      })
      .catch(err => { if (!handleNotFound(err, router)) toast.error(errText(err, 'Failed to load brand')); })
      .finally(() => setLoading(false));
  }, [brandId, editing]); // eslint-disable-line react-hooks/exhaustive-deps

  // Local preview of the file just picked, so the choice is visible before
  // saving. Revoked on replace/unmount — an object URL leaks otherwise.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!logo) { setLogoPreview(null); return; }
    const url = URL.createObjectURL(logo);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logo]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Brand name is required'); return; }
    // Same check the backend's ValidPhoneNumber rule applies (both are
    // libphonenumber) — caught here so the error lands before the save
    // rather than as a 422 afterwards.
    if (phone.trim() && !isValidPhoneNumber(phone.trim())) {
      const label = ALL_COUNTRIES.find(c => c.code === countryCode)?.name ?? 'the selected country';
      toast.error(`Enter a valid phone number for ${label}`);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        email: email.trim() || null,
        // E.164 out of PhoneInput ("+923001234567"), which is exactly what
        // the backend's ValidPhoneNumber rule expects.
        phone: phone.trim() || null,
        website: website.trim() || null,
        // The readable name, not the ISO code — this goes straight onto the
        // invoice under the brand's address block.
        country: ALL_COUNTRIES.find(c => c.code === countryCode)?.name ?? null,
        address: address.trim() || null,
        is_active: isActive,
        logo,
        // Only on create, and only where there's a choice — the staff API
        // ignores it and files the brand under the company they're in.
        ...(!editing && companies.length > 1 && companyId ? { company_id: companyId } : {}),
      };
      if (editing) await brandService.update(brandId!, payload);
      else await brandService.create(payload);
      toast.success(editing ? 'Brand updated' : 'Brand created');
      router.push(brandsRoot);
    } catch (err) {
      toast.error(errText(err, editing ? 'Failed to update brand' : 'Failed to create brand'));
    } finally {
      setSaving(false);
    }
  };

  const title = editing ? 'Edit Brand' : 'Add Brand';

  if (!mounted || allowed === null || loading) {
    return (
      <DashboardLayout title={title}>
        <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
      </DashboardLayout>
    );
  }

  if (!allowed) {
    return (
      <DashboardLayout title={title}>
        <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>
          You don&apos;t have permission to {editing ? 'edit' : 'add'} brands.
        </div>
      </DashboardLayout>
    );
  }

  const shownLogo = logoPreview ?? existing?.logo_url ?? null;

  return (
    <DashboardLayout title={title}>
      <div style={{ maxWidth: 760 }}>
        <button
          onClick={() => router.push(brandsRoot)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 13.5 }}
        >
          <HiArrowLeft size={15} /> Back to Brands
        </button>

        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 4px' }}>
          {editing ? existing?.name ?? 'Edit Brand' : 'Add Brand'}
        </h1>
        <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20 }}>
          These details are what appear on invoices raised under this brand.
        </div>

        <form onSubmit={submit} style={card}>
          {!editing && companies.length > 1 && (
            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Company *</label>
              <select value={companyId} onChange={e => setCompanyId(Number(e.target.value))} style={{ ...inp, maxWidth: 380 }}>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={{ flex: '1 1 260px' }}>
              <label style={lbl}>Brand Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} style={inp} placeholder="Acme Studios" />
            </div>
            <div style={{ flex: '1 1 240px' }}>
              <label style={lbl}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inp} placeholder="billing@acme.com" />
            </div>
          </div>

          {/* Country first, then Phone: picking a country re-formats the
              phone field to that country's pattern and enforces its length,
              so the number can only be entered in the right shape. Typing a
              number that starts with another dial code moves this dropdown
              instead — the two stay in step either way. */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={{ flex: '1 1 220px' }}>
              <label style={lbl}>Country</label>
              <select value={countryCode} onChange={e => setCountryCode(e.target.value as Country)} style={inp}>
                {ALL_COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>{c.name} (+{c.callingCode})</option>
                ))}
              </select>
            </div>
            <div style={{ flex: '1 1 220px' }}>
              <label style={lbl}>Phone Number</label>
              {/* key={countryCode}: remounts so a country change re-applies
                  the placeholder/format to an empty field too. */}
              <PhoneInput
                key={countryCode}
                value={phone}
                onChange={setPhone}
                defaultCountry={countryCode}
                onCountryChange={c => c && setCountryCode(c)}
              />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Website</label>
            <input value={website} onChange={e => setWebsite(e.target.value)} style={inp} placeholder="acme.com" />
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
              Shown in the &quot;Billed From&quot; block on this brand&apos;s invoices. No need to type
              https:// — it&apos;s added on save.
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Address</label>
            <textarea value={address} onChange={e => setAddress(e.target.value)} rows={3} style={{ ...inp, resize: 'vertical' }} placeholder="Street, city, postal code" />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Logo (optional)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              {shownLogo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shownLogo} alt="" style={{ width: 60, height: 60, borderRadius: 10, objectFit: 'cover', border: '1px solid #f1f5f9', background: '#fff' }} />
              )}
              <div>
                {/* Any real image the server can identify — the rule is
                    mimetypes:image/*, not a hand-written list, so phone
                    photos (HEIC), AVIF and TIFF all work. SVG is allowed too
                    and is served back under a locked-down CSP so an embedded
                    script can't run — see Api\PublicFileController. */}
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => setLogo(e.target.files?.[0] ?? null)}
                  style={{ fontSize: 12.5, color: '#64748b' }}
                />
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 5 }}>
                  Any image up to 2 MB — PNG, JPG, WEBP, SVG, GIF, HEIC and so on.{editing ? ' Leave empty to keep the current logo.' : ''}
                </div>
              </div>
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderRadius: 10, border: `1.5px solid ${isActive ? '#2563eb40' : '#e2e8f0'}`, background: isActive ? '#eff6ff' : '#fafafa', marginBottom: 22, cursor: 'pointer' }}>
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#2563eb', cursor: 'pointer' }} />
            <div>
              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13.5 }}>Active</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Inactive brands stay on invoices already raised, but aren&apos;t offered on new ones.</div>
            </div>
          </label>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => router.push(brandsRoot)} style={{ padding: '10px 22px', borderRadius: 9, border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 13.5, cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving} style={{ padding: '10px 26px', borderRadius: 9, border: 'none', background: saving ? '#93c5fd' : '#2563eb', color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Brand'}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
