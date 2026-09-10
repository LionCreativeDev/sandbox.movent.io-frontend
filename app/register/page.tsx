// 'use client';
// import { Suspense, useEffect, useMemo, useState, useCallback } from 'react';
// import { useRouter, useSearchParams } from 'next/navigation';
// import Link from 'next/link';
// import LandingNavbar from '@/components/landing/Navbar';
// import LandingFooter from '@/components/landing/Footer';
// import { publicService } from '@/lib/services/publicService';
// import { setAuthData } from '@/lib/auth';
// import { PublicPackage } from '@/types';
// import toast from 'react-hot-toast';
// import { MODULE_CATALOG, validateModules, getSelectedInternalKeys } from '@/lib/moduleConfig';

// // ─── Seat & Company add-on options ───────────────────────────────────────────
// const SEAT_OPTIONS = [
//   { label: '10 Users', value: 10, price_pkr: 0, price_usd: 0 },
//   { label: '25 Users', value: 25, price_pkr: 800, price_usd: 3 },
//   { label: '50 Users', value: 50, price_pkr: 1500, price_usd: 6 },
//   { label: '100 Users', value: 100, price_pkr: 3000, price_usd: 12 },
//   { label: 'Unlimited', value: null, price_pkr: 6000, price_usd: 25 },
// ];

// const COMPANY_OPTIONS = [
//   { label: '1 Company', value: 1, price_pkr: 0, price_usd: 0 },
//   { label: '3 Companies', value: 3, price_pkr: 500, price_usd: 2 },
//   { label: '5 Companies', value: 5, price_pkr: 1000, price_usd: 4 },
//   { label: 'Unlimited', value: null, price_pkr: 2500, price_usd: 10 },
// ];

// const TIMEZONES = [
//   'Asia/Karachi', 'Asia/Kolkata', 'Asia/Dubai',
//   'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Asia/Singapore',
// ];

// function pwStrength(p: string): { label: string; color: string; pct: number } {
//   if (!p) return { label: '', color: '#e2e8f0', pct: 0 };
//   let s = 0;
//   if (p.length >= 8) s++;
//   if (/[A-Z]/.test(p)) s++;
//   if (/[0-9]/.test(p)) s++;
//   if (/[^a-zA-Z0-9]/.test(p)) s++;
//   if (s <= 1) return { label: 'Weak', color: '#ef4444', pct: 25 };
//   if (s === 2) return { label: 'Fair', color: '#f59e0b', pct: 50 };
//   if (s === 3) return { label: 'Good', color: '#3b82f6', pct: 75 };
//   return { label: 'Strong', color: '#22c55e', pct: 100 };
// }

// function RegisterContent() {
//   const router = useRouter();
//   const searchParams = useSearchParams();
//   const preSelectedPkg = searchParams.get('package');

//   const [step, setStep] = useState(1);
//   const [mode, setMode] = useState<'package' | 'custom'>('package');
//   const [currency, setCurrency] = useState<'PKR' | 'USD'>('PKR');
//   const [submitting, setSubmitting] = useState(false);

//   // Package mode
//   const [packages, setPackages] = useState<PublicPackage[]>([]);
//   const [loadingPackages, setLoadingPackages] = useState(true);
//   const [selectedPackage, setSelectedPackage] = useState<PublicPackage | null>(null);

//   // Custom mode
//   const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

//   // Seats & companies
//   const [seatIdx, setSeatIdx] = useState(0);
//   const [companyIdx, setCompanyIdx] = useState(0);
//   const seat = SEAT_OPTIONS[seatIdx];
//   const company = COMPANY_OPTIONS[companyIdx];

//   // Derived
//   const selectedCats = MODULE_CATALOG.filter(c => selectedCategories.includes(c.key));
//   const customModules = getSelectedInternalKeys(selectedCategories);
//   const customBasePkr = selectedCats.reduce((s, c) => s + c.price_pkr, 0);
//   const customBaseUsd = selectedCats.reduce((s, c) => s + c.price_usd, 0);
//   const validation = useMemo(() => validateModules(selectedCategories), [selectedCategories]);
//   const addonPkr = seat.price_pkr + company.price_pkr;
//   const addonUsd = seat.price_usd + company.price_usd;
//   const totalPkr = mode === 'package'
//     ? Number(selectedPackage?.price_pkr ?? 0) + addonPkr
//     : customBasePkr + addonPkr;
//   const totalUsd = mode === 'package'
//     ? Number(selectedPackage?.price_usd ?? 0) + addonUsd
//     : customBaseUsd + addonUsd;

//   const autoPackage = (): PublicPackage | null => {
//     if (!packages.length || !customModules.length) return null;
//     const sorted = [...packages].sort((a, b) => Number(a.price_pkr) - Number(b.price_pkr));
//     for (const pkg of sorted) {
//       if (customModules.every(m => (pkg.modules ?? []).includes(m))) return pkg;
//     }
//     return packages[packages.length - 1] ?? null;
//   };

//   // Step 1 fields
//   const [companyName, setCompanyName] = useState('');
//   const [name, setName] = useState('');
//   const [email, setEmail] = useState('');
//   const [emailOk, setEmailOk] = useState<boolean | null>(null);
//   const [emailChecking, setEmailChecking] = useState(false);
//   const [password, setPassword] = useState('');
//   const [confirm, setConfirm] = useState('');
//   const [phone, setPhone] = useState('');
//   const [timezone, setTimezone] = useState('Asia/Karachi');

//   useEffect(() => {
//     setLoadingPackages(true);
//     publicService.getPackages()
//       .then(pkgs => {
//         setPackages(pkgs);
//         if (preSelectedPkg) {
//           const found = pkgs.find(p => p.id === Number(preSelectedPkg));
//           if (found) { setSelectedPackage(found); return; }
//         }
//         setSelectedPackage(pkgs.find(p => p.is_popular) ?? pkgs[0] ?? null);
//       })
//       .catch(() => { })
//       .finally(() => setLoadingPackages(false));
//   }, [preSelectedPkg]);

//   const checkEmail = useCallback(async (val: string) => {
//     if (!val || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) { setEmailOk(null); return; }
//     setEmailChecking(true);
//     try { setEmailOk(await publicService.checkEmail(val)); }
//     catch { setEmailOk(null); }
//     finally { setEmailChecking(false); }
//   }, []);

//   useEffect(() => {
//     const t = setTimeout(() => checkEmail(email), 700);
//     return () => clearTimeout(t);
//   }, [email, checkEmail]);

//   const toggleCategory = (key: string) =>
//     setSelectedCategories(prev =>
//       prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
//     );

//   const step1Valid = !!(companyName && name && email && emailOk && password.length >= 8 && password === confirm);

//   const handleSubmit = async () => {
//     const pkgToUse = mode === 'package' ? selectedPackage : autoPackage();
//     const modulesToUse = mode === 'package' ? (selectedPackage?.modules ?? []) : customModules;
//     if (mode === 'package' && !selectedPackage) { toast.error('Please select a package'); return; }
//     if (mode === 'custom' && selectedCategories.length === 0) { toast.error('Please select at least one module'); return; }
//     if (!pkgToUse) { toast.error('No matching package found'); return; }

//     setSubmitting(true);
//     try {
//       const res = await publicService.register({
//         company_name: companyName,
//         name, email, password,
//         password_confirmation: confirm,
//         phone: phone || undefined,
//         package_id: pkgToUse.id,
//         selected_modules: modulesToUse,
//         currency,
//         start_type: 'paid',
//         timezone,
//         max_users: seat.value,
//         max_companies: company.value,
//       });
//       if (res.success) {
//         setAuthData(res.data.token, res.data.admin, 'admin');
//         // Save order summary for payment page
//         localStorage.setItem('pending_order', JSON.stringify({
//           package_name: pkgToUse.name,
//           modules: mode === 'custom' ? selectedCats.map(c => c.label) : [],
//           mode,
//           seats: seat.label,
//           companies: company.label,
//           total_pkr: totalPkr,
//           total_usd: totalUsd,
//           currency,
//           trial_days: pkgToUse.trial_days,
//         }));
//         router.push('/payment');
//       }
//     } catch (err: unknown) {
//       const e = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
//       const errs = e.response?.data?.errors;
//       if (errs) Object.values(errs).flat().forEach(m => toast.error(m));
//       else toast.error(e.response?.data?.message ?? 'Registration failed');
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   const strength = pwStrength(password);
//   const canSubmit = !submitting && (
//     mode === 'package'
//       ? !!selectedPackage
//       : selectedCategories.length > 0 && validation.isValid
//   );

//   const fmt = (pkr: number, usd: number) =>
//     currency === 'PKR' ? `PKR ${pkr.toLocaleString()}` : `$${usd}`;

//   const inputStyle: React.CSSProperties = {
//     width: '100%', padding: '11px 14px', border: '1.5px solid #e2e8f0',
//     borderRadius: 10, fontSize: 14, outline: 'none', background: '#f8fafc', boxSizing: 'border-box',
//   };
//   const labelStyle: React.CSSProperties = {
//     display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6,
//   };

//   // Pill option selector helper
//   const PillRow = ({
//     options, selectedIdx, onSelect, label,
//   }: {
//     options: { label: string; price_pkr: number; price_usd: number }[];
//     selectedIdx: number;
//     onSelect: (i: number) => void;
//     label: string;
//   }) => (
//     <div style={{ marginBottom: 16 }}>
//       <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
//       <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
//         {options.map((opt, i) => {
//           const active = selectedIdx === i;
//           return (
//             <button
//               key={i}
//               onClick={() => onSelect(i)}
//               style={{
//                 padding: '7px 14px', borderRadius: 50, border: `1.5px solid ${active ? '#2563eb' : '#e2e8f0'}`,
//                 background: active ? '#2563eb' : '#fff', color: active ? '#fff' : '#374151',
//                 fontSize: 12, fontWeight: active ? 700 : 500, cursor: 'pointer',
//                 transition: 'all 0.15s',
//               }}>
//               {opt.label}
//               {opt.price_pkr > 0 && (
//                 <span style={{ marginLeft: 5, fontSize: 11, opacity: 0.85 }}>
//                   +{currency === 'PKR' ? `PKR ${opt.price_pkr.toLocaleString()}` : `$${opt.price_usd}`}
//                 </span>
//               )}
//             </button>
//           );
//         })}
//       </div>
//     </div>
//   );

//   return (
//     <>
//       <LandingNavbar />
//       <div style={{ paddingTop: 88, background: '#f8fafc', minHeight: '100vh' }}>
//         <div style={{ maxWidth: step === 2 ? 1080 : 960, margin: '0 auto', padding: '32px 24px 64px' }}>

//           {/* Progress */}
//           <div style={{ marginBottom: 36 }}>
//             <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
//               {[1, 2].map(s => (
//                 <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
//                   <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
//                     <div style={{
//                       width: 38, height: 38, borderRadius: '50%',
//                       background: step >= s ? 'linear-gradient(135deg,#2563eb,#3b82f6)' : '#fff',
//                       border: step >= s ? 'none' : '2px solid #e2e8f0',
//                       color: step >= s ? '#fff' : '#94a3b8',
//                       display: 'flex', alignItems: 'center', justifyContent: 'center',
//                       fontWeight: 700, fontSize: 15,
//                       boxShadow: step === s ? '0 4px 12px rgba(37,99,235,0.3)' : 'none',
//                     }}>{step > s ? '✓' : s}</div>
//                     <span style={{ fontSize: 12, fontWeight: step >= s ? 700 : 400, color: step >= s ? '#2563eb' : '#94a3b8', whiteSpace: 'nowrap' }}>
//                       {s === 1 ? 'Company Info' : 'Select Plan'}
//                     </span>
//                   </div>
//                   {s < 2 && <div style={{ width: 100, height: 2, background: step > s ? '#2563eb' : '#e2e8f0', margin: '0 8px', marginBottom: 24 }} />}
//                 </div>
//               ))}
//             </div>
//           </div>

//           {/* ── STEP 1 ── */}
//           {step === 1 && (
//             <div style={{ background: '#fff', borderRadius: 18, border: '1.5px solid #e2e8f0', padding: 36, maxWidth: 600, margin: '0 auto' }}>
//               <h2 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>Company Information</h2>
//               <p style={{ color: '#64748b', fontSize: 14, marginBottom: 28 }}>Tell us about your business</p>

//               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
//                 <div>
//                   <label style={labelStyle}>Company Name *</label>
//                   <input style={inputStyle} value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Grands Digital" />
//                 </div>
//                 <div>
//                   <label style={labelStyle}>Your Full Name *</label>
//                   <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="Ahmed Khan" />
//                 </div>
//               </div>

//               <div style={{ marginBottom: 16 }}>
//                 <label style={labelStyle}>Email Address *</label>
//                 <div style={{ position: 'relative' }}>
//                   <input
//                     style={{ ...inputStyle, paddingRight: 40, borderColor: emailOk === false ? '#ef4444' : emailOk === true ? '#22c55e' : '#e2e8f0' }}
//                     type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com"
//                   />
//                   <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 16 }}>
//                     {emailChecking ? '⏳' : emailOk === true ? '✅' : emailOk === false ? '❌' : ''}
//                   </span>
//                 </div>
//                 {emailOk === false && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>This email is already registered</div>}
//                 {emailOk === true && <div style={{ fontSize: 12, color: '#22c55e', marginTop: 4 }}>Email is available</div>}
//               </div>

//               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
//                 <div>
//                   <label style={labelStyle}>Password *</label>
//                   <input style={inputStyle} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 characters" />
//                   {password && (
//                     <div style={{ marginTop: 6 }}>
//                       <div style={{ height: 4, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
//                         <div style={{ width: `${strength.pct}%`, height: '100%', background: strength.color, borderRadius: 4, transition: 'all 0.3s' }} />
//                       </div>
//                       <span style={{ fontSize: 11, color: strength.color, fontWeight: 600 }}>{strength.label}</span>
//                     </div>
//                   )}
//                 </div>
//                 <div>
//                   <label style={labelStyle}>Confirm Password *</label>
//                   <input
//                     style={{ ...inputStyle, borderColor: confirm && password !== confirm ? '#ef4444' : '#e2e8f0' }}
//                     type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat password"
//                   />
//                   {confirm && password !== confirm && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>Passwords do not match</div>}
//                 </div>
//               </div>

//               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
//                 <div>
//                   <label style={labelStyle}>Phone (Optional)</label>
//                   <input style={inputStyle} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" />
//                 </div>
//                 <div>
//                   <label style={labelStyle}>Timezone</label>
//                   <select style={inputStyle} value={timezone} onChange={e => setTimezone(e.target.value)}>
//                     {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
//                   </select>
//                 </div>
//               </div>

//               <button
//                 onClick={() => step1Valid && setStep(2)}
//                 disabled={!step1Valid}
//                 style={{
//                   width: '100%', padding: '13px',
//                   background: step1Valid ? 'linear-gradient(135deg,#2563eb,#3b82f6)' : '#e2e8f0',
//                   border: 'none', borderRadius: 10,
//                   color: step1Valid ? '#fff' : '#94a3b8',
//                   fontSize: 15, fontWeight: 700, cursor: step1Valid ? 'pointer' : 'not-allowed',
//                 }}>
//                 Next: Select Plan →
//               </button>
//               <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: '#94a3b8' }}>
//                 Already have an account?{' '}
//                 <Link href="/admin/login" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
//               </div>
//             </div>
//           )}

//           {/* ── STEP 2 ── */}
//           {step === 2 && (
//             <div>
//               {/* Header */}
//               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
//                 <div>
//                   <h2 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '0 0 4px' }}>Choose Your Plan</h2>
//                   <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>Select a ready-made package or build your own</p>
//                 </div>
//                 <div style={{ display: 'inline-flex', background: '#e2e8f0', borderRadius: 50, padding: 3 }}>
//                   {(['PKR', 'USD'] as const).map(c => (
//                     <button key={c} onClick={() => setCurrency(c)} style={{
//                       padding: '6px 18px', borderRadius: 50, border: 'none', cursor: 'pointer',
//                       background: currency === c ? '#fff' : 'transparent',
//                       color: currency === c ? '#2563eb' : '#64748b',
//                       fontWeight: currency === c ? 700 : 400, fontSize: 13, transition: 'all 0.15s',
//                     }}>{c}</button>
//                   ))}
//                 </div>
//               </div>

//               {/* Mode toggle */}
//               <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
//                 {[
//                   { val: 'package' as const, icon: '📦', label: 'Choose a Package', sub: 'Pre-built plans with fixed pricing' },
//                   { val: 'custom' as const, icon: '🎛️', label: 'Custom Modules', sub: 'Pick only what you need' },
//                 ].map(opt => {
//                   const active = mode === opt.val;
//                   return (
//                     <button key={opt.val} onClick={() => setMode(opt.val)} style={{
//                       display: 'flex', alignItems: 'center', gap: 12, padding: '14px 22px',
//                       border: `2px solid ${active ? '#2563eb' : '#e2e8f0'}`, borderRadius: 14, cursor: 'pointer',
//                       background: active ? '#eff6ff' : '#fff', transition: 'all 0.15s', textAlign: 'left',
//                       boxShadow: active ? '0 4px 14px rgba(37,99,235,0.15)' : 'none',
//                     }}>
//                       <span style={{ fontSize: 28 }}>{opt.icon}</span>
//                       <div>
//                         <div style={{ fontSize: 14, fontWeight: 700, color: active ? '#2563eb' : '#0f172a' }}>{opt.label}</div>
//                         <div style={{ fontSize: 12, color: active ? '#60a5fa' : '#94a3b8' }}>{opt.sub}</div>
//                       </div>
//                       {active && (
//                         <div style={{
//                           marginLeft: 'auto', width: 20, height: 20, borderRadius: '50%',
//                           background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center',
//                           justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0,
//                         }}>✓</div>
//                       )}
//                     </button>
//                   );
//                 })}
//               </div>

//               {/* Content + Summary */}
//               <div style={{ display: 'grid', gridTemplateColumns: '1fr 290px', gap: 20, alignItems: 'start' }}>

//                 {/* Left */}
//                 <div>

//                   {/* PACKAGE MODE */}
//                   {mode === 'package' && (
//                     loadingPackages
//                       ? <div style={{ color: '#94a3b8', fontSize: 14, padding: '40px 0', textAlign: 'center' }}>Loading packages...</div>
//                       : (
//                         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
//                           {packages.map(pkg => {
//                             const active = selectedPackage?.id === pkg.id;
//                             return (
//                               <div key={pkg.id} onClick={() => setSelectedPackage(pkg)} style={{
//                                 padding: '20px', borderRadius: 16,
//                                 border: `2px solid ${active ? '#2563eb' : '#e2e8f0'}`,
//                                 background: active ? '#eff6ff' : '#fff', cursor: 'pointer',
//                                 transition: 'all 0.15s', position: 'relative',
//                                 boxShadow: active ? '0 6px 20px rgba(37,99,235,0.15)' : '0 1px 3px rgba(0,0,0,0.05)',
//                               }}>
//                                 {pkg.is_popular && (
//                                   <div style={{
//                                     position: 'absolute', top: -1, right: 16,
//                                     background: '#2563eb', color: '#fff', fontSize: 10, fontWeight: 700,
//                                     padding: '2px 10px', borderRadius: '0 0 8px 8px',
//                                   }}>⭐ POPULAR</div>
//                                 )}
//                                 {active && (
//                                   <div style={{
//                                     position: 'absolute', top: 14, right: 14,
//                                     width: 22, height: 22, borderRadius: '50%',
//                                     background: '#2563eb', color: '#fff',
//                                     display: 'flex', alignItems: 'center', justifyContent: 'center',
//                                     fontSize: 12, fontWeight: 800,
//                                   }}>✓</div>
//                                 )}
//                                 <div style={{ fontWeight: 800, fontSize: 15, color: active ? '#2563eb' : '#0f172a', marginBottom: 8 }}>{pkg.name}</div>
//                                 <div style={{ fontWeight: 900, fontSize: 24, color: active ? '#2563eb' : '#0f172a', lineHeight: 1 }}>
//                                   {currency === 'PKR' ? `PKR ${Number(pkg.price_pkr).toLocaleString()}` : `$${pkg.price_usd}`}
//                                 </div>
//                                 <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 14 }}>/month · {pkg.trial_days}-day trial</div>
//                                 <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
//                                   {(pkg.modules ?? []).map(m => {
//                                     const cat = MODULE_CATALOG.find(c => c.internalKeys.includes(m));
//                                     return (
//                                       <span key={m} style={{
//                                         padding: '2px 6px', borderRadius: 6, fontSize: 9, fontWeight: 500,
//                                         background: cat ? cat.bg : '#f1f5f9',
//                                         color: cat ? cat.color : '#64748b',
//                                         border: `1px solid ${cat ? cat.border : '#e2e8f0'}`,
//                                       }}>{m.replace(/_/g, ' ')}</span>
//                                     );
//                                   })}
//                                 </div>
//                               </div>
//                             );
//                           })}
//                         </div>
//                       )
//                   )}

//                   {/* CUSTOM MODE */}
//                   {mode === 'custom' && (
//                     <div style={{ marginBottom: 24 }}>
//                       <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 14 }}>
//                         {MODULE_CATALOG.map(cat => {
//                           const active = selectedCategories.includes(cat.key);
//                           const hasError = active && !cat.canStandAlone && validation.blockingMessages.some(m => m.includes(cat.label));
//                           const badgeIsRequires = !cat.canStandAlone;
//                           return (
//                             <div key={cat.key} onClick={() => toggleCategory(cat.key)} style={{
//                               padding: '18px 14px', borderRadius: 14, cursor: 'pointer',
//                               border: `2px solid ${hasError ? '#dc2626' : active ? cat.color : '#e2e8f0'}`,
//                               background: active ? cat.bg : '#fff', transition: 'all 0.15s',
//                               position: 'relative', userSelect: 'none',
//                               boxShadow: hasError ? '0 0 0 3px #fecaca' : active ? `0 4px 14px ${cat.color}22` : '0 1px 3px rgba(0,0,0,0.04)',
//                             }}>
//                               {active && (
//                                 <div style={{
//                                   position: 'absolute', top: 10, right: 10,
//                                   width: 18, height: 18, borderRadius: '50%',
//                                   background: hasError ? '#dc2626' : cat.color, color: '#fff',
//                                   display: 'flex', alignItems: 'center', justifyContent: 'center',
//                                   fontSize: 10, fontWeight: 800,
//                                 }}>{hasError ? '!' : '✓'}</div>
//                               )}
//                               <div style={{ fontSize: 30, marginBottom: 8, lineHeight: 1 }}>{cat.icon}</div>
//                               <div style={{ fontSize: 13, fontWeight: 800, color: active ? cat.color : '#0f172a', marginBottom: 3 }}>{cat.label}</div>
//                               <div style={{ fontSize: 11, color: active ? cat.color + 'aa' : '#94a3b8', marginBottom: 8, lineHeight: 1.3 }}>{cat.desc}</div>
//                               {/* Dependency / standalone badges */}
//                               <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
//                                 <span style={{
//                                   padding: '2px 7px', borderRadius: 50, fontSize: 9, fontWeight: 700,
//                                   textTransform: 'uppercase', letterSpacing: '0.03em',
//                                   background: badgeIsRequires ? (active && hasError ? '#fef2f2' : '#fff7ed') : '#f0fdf4',
//                                   color: badgeIsRequires ? (active && hasError ? '#dc2626' : '#92400e') : '#166534',
//                                   border: `1px solid ${badgeIsRequires ? (active && hasError ? '#fca5a5' : '#fde68a') : '#a7f3d0'}`,
//                                 }}>{cat.badge}</span>
//                                 {cat.optionalBadge && !active && (
//                                   <span style={{
//                                     padding: '2px 7px', borderRadius: 50, fontSize: 9, fontWeight: 600,
//                                     background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0',
//                                   }}>{cat.optionalBadge}</span>
//                                 )}
//                               </div>
//                               <div style={{ fontWeight: 800, fontSize: 14, color: active ? cat.color : '#64748b' }}>
//                                 {fmt(cat.price_pkr, cat.price_usd)}
//                                 <span style={{ fontSize: 10, fontWeight: 400, color: active ? cat.color + '99' : '#94a3b8' }}>/mo</span>
//                               </div>
//                             </div>
//                           );
//                         })}
//                       </div>
//                       {selectedCategories.length > 0 && autoPackage() && (
//                         <div style={{ padding: '10px 14px', background: '#f0fdf4', border: '1px solid #a7f3d0', borderRadius: 10, fontSize: 12, color: '#065f46', display: 'flex', gap: 8 }}>
//                           <span>ℹ️</span>
//                           <span>Plan <strong>{autoPackage()?.name}</strong> will be applied for billing.</span>
//                         </div>
//                       )}
//                     </div>
//                   )}

//                   {/* ── Seats & Companies (always shown) ── */}
//                   <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: '18px 20px' }}>
//                     <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginBottom: 16 }}>
//                       👤 User Seats &amp; Companies
//                     </div>
//                     <PillRow
//                       label="Number of Users (Seats)"
//                       options={SEAT_OPTIONS}
//                       selectedIdx={seatIdx}
//                       onSelect={setSeatIdx}
//                     />
//                     <PillRow
//                       label="Number of Companies"
//                       options={COMPANY_OPTIONS}
//                       selectedIdx={companyIdx}
//                       onSelect={setCompanyIdx}
//                     />
//                   </div>

//                 </div>

//                 {/* ── Right: Order Summary ── */}
//                 <div style={{ position: 'sticky', top: 88 }}>
//                   <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #e2e8f0', padding: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
//                     <h4 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', margin: '0 0 16px' }}>Order Summary</h4>

//                     {/* Base price row */}
//                     {mode === 'package' && selectedPackage && (
//                       <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
//                         <span style={{ color: '#64748b' }}>📦 {selectedPackage.name}</span>
//                         <span style={{ fontWeight: 600 }}>
//                           {fmt(Number(selectedPackage.price_pkr), Number(selectedPackage.price_usd))}
//                         </span>
//                       </div>
//                     )}

//                     {mode === 'custom' && selectedCats.map(cat => (
//                       <div key={cat.key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
//                         <span style={{ color: '#64748b' }}>{cat.icon} {cat.label}</span>
//                         <span style={{ fontWeight: 600, color: cat.color }}>{fmt(cat.price_pkr, cat.price_usd)}</span>
//                       </div>
//                     ))}

//                     {mode === 'custom' && selectedCats.length === 0 && (
//                       <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '8px 0 12px' }}>
//                         Select modules to see pricing
//                       </div>
//                     )}

//                     {/* Blocking errors */}
//                     {mode === 'custom' && validation.blockingMessages.length > 0 && (
//                       <div style={{ marginBottom: 12 }}>
//                         {validation.blockingMessages.map((msg, i) => (
//                           <div key={i} style={{ padding: '9px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 12, color: '#dc2626', marginBottom: 6, lineHeight: 1.4 }}>
//                             ⚠️ {msg}
//                           </div>
//                         ))}
//                       </div>
//                     )}

//                     {/* Recommendations */}
//                     {mode === 'custom' && validation.isValid && validation.recommendations.length > 0 && (
//                       <div style={{ marginBottom: 12 }}>
//                         {validation.recommendations.map((rec, i) => (
//                           <div key={i} style={{ padding: '8px 12px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, fontSize: 11, color: '#0369a1', marginBottom: 5, lineHeight: 1.4 }}>
//                             💡 {rec}
//                           </div>
//                         ))}
//                       </div>
//                     )}

//                     {/* Seat addon */}
//                     {seat.price_pkr > 0 && (
//                       <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
//                         <span style={{ color: '#64748b' }}>👤 {seat.label}</span>
//                         <span style={{ fontWeight: 600, color: '#7c3aed' }}>+{fmt(seat.price_pkr, seat.price_usd)}</span>
//                       </div>
//                     )}

//                     {/* Company addon */}
//                     {company.price_pkr > 0 && (
//                       <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
//                         <span style={{ color: '#64748b' }}>🏢 {company.label}</span>
//                         <span style={{ fontWeight: 600, color: '#7c3aed' }}>+{fmt(company.price_pkr, company.price_usd)}</span>
//                       </div>
//                     )}

//                     {/* Total */}
//                     {(mode === 'package' ? !!selectedPackage : selectedCats.length > 0) && (
//                       <div style={{ borderTop: '1.5px dashed #e2e8f0', paddingTop: 12, marginTop: 8, marginBottom: 16 }}>
//                         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
//                           <span style={{ fontWeight: 800, color: '#0f172a', fontSize: 14 }}>Total</span>
//                           <div style={{ textAlign: 'right' }}>
//                             <div style={{ fontWeight: 900, fontSize: 22, color: '#2563eb' }}>
//                               {fmt(totalPkr, totalUsd)}
//                               <span style={{ fontSize: 12, fontWeight: 400, color: '#94a3b8' }}>/mo</span>
//                             </div>
//                             <div style={{ fontSize: 11, color: '#22c55e', fontWeight: 600 }}>
//                               14-day free trial included
//                             </div>
//                           </div>
//                         </div>
//                       </div>
//                     )}

//                     <button
//                       onClick={handleSubmit}
//                       disabled={!canSubmit}
//                       style={{
//                         width: '100%', padding: '13px',
//                         background: canSubmit ? 'linear-gradient(135deg,#2563eb,#3b82f6)' : '#e2e8f0',
//                         border: 'none', borderRadius: 10,
//                         color: canSubmit ? '#fff' : '#94a3b8',
//                         fontSize: 14, fontWeight: 700,
//                         cursor: canSubmit ? 'pointer' : 'not-allowed',
//                         boxShadow: canSubmit ? '0 4px 14px rgba(37,99,235,0.3)' : 'none',
//                         transition: 'all 0.15s',
//                       }}>
//                       {submitting ? 'Setting up...' : 'Continue to Payment →'}
//                     </button>
//                     <div style={{ textAlign: 'center', marginTop: 10, fontSize: 11, color: '#94a3b8' }}>
//                       🔒 Secure · 14-day free trial included
//                     </div>
//                   </div>
//                 </div>

//               </div>

//               <div style={{ marginTop: 24 }}>
//                 <button onClick={() => setStep(1)} style={{
//                   padding: '10px 22px', border: '1.5px solid #e2e8f0',
//                   borderRadius: 10, background: '#fff', color: '#64748b',
//                   fontWeight: 600, fontSize: 14, cursor: 'pointer',
//                 }}>← Back</button>
//               </div>

//             </div>
//           )}

//         </div>
//       </div>
//       <LandingFooter />
//     </>
//   );
// }

// export default function RegisterPage() {
//   return (
//     <Suspense fallback={
//       <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
//         <div style={{ color: '#64748b', fontSize: 15 }}>Loading...</div>
//       </div>
//     }>
//       <RegisterContent />
//     </Suspense>
//   );
// }

'use client';
import { Suspense, useEffect, useState, useCallback, ReactNode, InputHTMLAttributes, CSSProperties } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  HiCheckCircle, HiXCircle,
  HiUser, HiEnvelope, HiLockClosed, HiPhone,
  HiGlobeAlt, HiCheck, HiClock, HiCube, HiAdjustmentsHorizontal,
  HiUsers, HiShieldCheck,
  HiChevronLeft, HiArrowRight,
  HiEye, HiEyeSlash, HiStar,
  HiBuildingOffice2,
} from 'react-icons/hi2';
import { IconType } from 'react-icons';
import LandingNavbar from '../../components/landing/Navbar';
import LandingFooter from '../../components/landing/Footer';
// import Auth_HeroSection from '../../components/ui/Auth_HeroSection';
import { publicService, PublicModule } from '../../lib/services/publicService';
import { setAuthData } from '../../lib/auth';
import {
  CATEGORIES, moduleToCategory, moduleDependencyErrors,
  moduleKeysToCategoryKeys, requiredDependencyKeys, DEPENDENCY_ERRORS,
} from '../../lib/moduleCategories';
import toast from 'react-hot-toast';
import Container from '../../components/ui/Conatiner';
import SubmitButton from '../../components/ui/SubmitButton';
import LoadingOverlay from '../../components/ui/LoadingOverlay';
import PhoneInput from '../../components/ui/PhoneInput';
import { ALL_COUNTRIES } from '../../lib/countries';
import type { Country } from 'react-phone-number-input';
import { MdOutlineDone } from 'react-icons/md';

type SeatOption = {
  label: string;
  value: number | null;
  price_pkr: number;
  price_usd: number;
};

type CompanyOption = {
  label: string;
  value: number | null;
  price_pkr: number;
  price_usd: number;
};

// Null = the base monthly package. Non-null = a Super Admin-managed Billing
// Term companion (see /super-admin/billing-terms) — an arbitrary, addable
// list (Yearly, 2-Year, 5-Year, 18 Months, ...), not a fixed set.
type BillingTermRef = { id: number; name: string; months: number };

type Package = {
  id: number;
  name: string;
  tier: string;
  billing_cycle: string;
  billing_term: BillingTermRef | null;
  discount_percent: number;
  price_pkr: number | string;
  price_usd: number | string;
  trial_days: number;
  is_popular?: boolean;
  modules?: string[];
};

type Currency = 'USD';
type Mode = 'package' | 'custom';

const SEAT_OPTIONS: SeatOption[] = [
  { label: '10 Users', value: 10, price_pkr: 0, price_usd: 0 },
  { label: '25 Users', value: 25, price_pkr: 800, price_usd: 3 },
  { label: '50 Users', value: 50, price_pkr: 1500, price_usd: 6 },
  { label: '100 Users', value: 100, price_pkr: 3000, price_usd: 12 },
  { label: 'Unlimited', value: null, price_pkr: 6000, price_usd: 25 },
];

const COMPANY_OPTIONS: CompanyOption[] = [
  { label: '1 Company', value: 1, price_pkr: 0, price_usd: 0 },
  { label: '3 Companies', value: 3, price_pkr: 500, price_usd: 2 },
  { label: '5 Companies', value: 5, price_pkr: 1000, price_usd: 4 },
  { label: 'Unlimited', value: null, price_pkr: 2500, price_usd: 10 },
];

type PwStrength = { label: string; color: string; pct: number };

function pwStrength(p: string): PwStrength {
  if (!p) return { label: '', color: '#e2e8f0', pct: 0 };
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p)) s++;
  if (/[0-9]/.test(p)) s++;
  if (/[^a-zA-Z0-9]/.test(p)) s++;
  if (s <= 1) return { label: 'Weak', color: '#ef4444', pct: 25 };
  if (s === 2) return { label: 'Fair', color: '#f59e0b', pct: 50 };
  if (s === 3) return { label: 'Good', color: '#3b82f6', pct: 75 };
  return { label: 'Strong', color: '#22c55e', pct: 100 };
}

// Always includes at least one uppercase/lowercase/digit/symbol so it lands
// in the "Strong" bucket of pwStrength() above.
function generateStrongPassword(length = 14): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%^&*';
  const all = upper + lower + digits + symbols;
  const pick = (set: string) => set[Math.floor(Math.random() * set.length)];
  const required = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  const rest = Array.from({ length: Math.max(0, length - required.length) }, () => pick(all));
  return [...required, ...rest].sort(() => Math.random() - 0.5).join('');
}

const inputBase: CSSProperties = {
  width: '100%',
  height: 48,
  border: '1px solid var(--bg-blue-light1)',
  borderRadius: 8,
  paddingLeft: 40,
  paddingRight: 14,
  fontSize: 15,
  color: '#111827',
  outline: 'none',
  boxSizing: 'border-box',
  background: '#fff',
  transition: 'border-color 0.2s',
};

const labelBase: CSSProperties = {
  display: 'block',
  fontSize: 14,
  fontWeight: 500,
  color: '#374151',
  marginBottom: 8,
};

type InputFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  icon?: IconType;
  required?: boolean;
  error?: string;
  rightEl?: ReactNode;
};

function InputField({ label, icon: Icon, required, error, type = 'text', rightEl, ...rest }: InputFieldProps) {
  return (
    <div style={{ marginBottom: 18 }}>
      {label && (
        <label style={labelBase}>
          {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        {Icon && (
          <Icon size={16} style={{
            position: 'absolute', left: 14, top: '50%',
            transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none',
          }} />
        )}
        <input
          type={type}
          style={{
            ...inputBase,
            paddingLeft: Icon ? 40 : 14,
            paddingRight: rightEl ? 44 : 14,
            borderColor: error ? 'var(--error-lable, #ef4444)' : 'var(--bg-blue-light1)',
          }}
          onFocus={e => (e.target.style.borderColor = 'var(--brand-blue)')}
          onBlur={e => (e.target.style.borderColor = error ? 'var(--error-lable, #ef4444)' : 'var(--bg-blue-light1)')}
          {...rest}
        />
        {rightEl}
      </div>
      {error && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{error}</div>}
    </div>
  );
}

type PillOption = { label: string; value: number | null; price_pkr: number; price_usd: number };

type PillRowProps = {
  options: PillOption[];
  selectedIdx: number;
  onSelect: (idx: number) => void;
  label: string;
};

function PillRow({ options, selectedIdx, onSelect, label }: PillRowProps) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {options.map((opt, i) => {
          const active = selectedIdx === i;
          return (
            <button key={i} onClick={() => onSelect(i)} style={{
              padding: '6px 12px',
              borderRadius: 999,
              border: `1.5px solid ${active ? 'var(--brand-blue)' : 'var(--border, #e5e7eb)'}`,
              background: active ? 'var(--brand-gradient)' : '#fff',
              color: active ? '#fff' : '#374151',
              fontSize: 12,
              fontWeight: active ? 700 : 500,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}>
              {opt.label}
              {opt.price_usd > 0 && (
                <span style={{ marginLeft: 4, fontSize: 10, opacity: 0.85 }}>
                  +${opt.price_usd}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preSelectedPkg = searchParams.get('package');

  useEffect(() => {
    router.prefetch('/payment');
  }, [router]);

  const [step, setStep] = useState<number>(1);
  const [mode, setMode] = useState<Mode>('package');
  // Chosen up front on Step 1 (Create Account) instead of via two separate
  // submit buttons on Step 2 — one flow, one dropdown, same downstream
  // handleSubmit(startTypeChoice) call either way.
  const [startTypeChoice, setStartTypeChoice] = useState<'trial' | 'paid' | ''>('');
  const currency: Currency = 'USD';
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loadingPackages, setLoadingPackages] = useState<boolean>(true);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  // null = Monthly (base package). A number selects a Billing Term's id.
  const [billingTermId, setBillingTermId] = useState<number | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [liveModules, setLiveModules] = useState<PublicModule[] | null>(null);
  const [seatIdx, setSeatIdx] = useState<number>(0);
  const [companyIdx, setCompanyIdx] = useState<number>(0);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirm, setShowConfirm] = useState<boolean>(false);

  const seat = SEAT_OPTIONS[seatIdx];
  const company = COMPANY_OPTIONS[companyIdx];
  // Every package now carries the same value here (the Super Admin's global
  // Subscription Policy — see PublicController::packages()), so any package
  // in the list is a representative source. 14 is only a pre-load fallback.
  const effectiveTrialDays = packages[0]?.trial_days ?? 14;

  // Trials switched off by Super Admin after the dropdown already defaulted
  // to 'trial' (or before packages load) — force 'paid' so Step 2's button
  // label/behavior never contradicts a trial that isn't actually on offer.
  useEffect(() => {
    if (effectiveTrialDays === 0) setStartTypeChoice('paid');
  }, [effectiveTrialDays]);

  const visiblePackages = packages.filter(p => (p.billing_term?.id ?? null) === billingTermId);

  // Every distinct Billing Term currently on offer (Super Admin-managed, see
  // /super-admin/billing-terms) — sorted shortest-to-longest, deduped since
  // each term appears once per tier's companion package.
  const availableBillingTerms: BillingTermRef[] = [
    ...new Map(packages.filter(p => p.billing_term).map(p => [p.billing_term!.id, p.billing_term!])).values(),
  ].sort((a, b) => a.months - b.months);

  // Switching term keeps the same tier selected (Business monthly →
  // Business yearly) rather than dropping the selection — every companion
  // shares its monthly parent's tier (see YearlyPackageSync).
  const switchBillingTerm = (termId: number | null) => {
    setBillingTermId(termId);
    if (!selectedPackage) return;
    const match = packages.find(p => (p.billing_term?.id ?? null) === termId && p.tier === selectedPackage.tier);
    if (match) setSelectedPackage(match);
  };
  // Live category list — label/description/price come from the Modules
  // registry so a Super Admin price (or active/inactive) change takes effect
  // immediately here; icon/color/badge styling still comes from CATEGORIES.
  const liveCategories = liveModules ? liveModules.map(moduleToCategory) : null;
  const visibleCategories = liveCategories ?? CATEGORIES;
  const selectedCats = visibleCategories.filter(c => selectedCategories.includes(c.key));
  const customModules = [...new Set(selectedCats.flatMap(c => c.modules))];
  const customMonthlyBasePkr = selectedCats.reduce((s, c) => s + c.price_pkr, 0);
  const customMonthlyBaseUsd = selectedCats.reduce((s, c) => s + c.price_usd, 0);
  const packageDependencyErrors = moduleDependencyErrors(moduleKeysToCategoryKeys(selectedPackage?.modules ?? []));
  const customDependencyErrors = moduleDependencyErrors(selectedCategories);
  const activeDependencyErrors = mode === 'package' ? packageDependencyErrors : customDependencyErrors;
  const requiredDeps = requiredDependencyKeys(selectedCategories);

  // Every package row for the currently selected Billing Term carries the
  // same term-driven discount_percent/months (see YearlyPackageSync) —
  // reused here since a custom module bundle has no package row of its own
  // to read a discount off of. 0%/1 month for monthly (never discounted).
  const selectedTermPkg = billingTermId !== null ? packages.find(p => p.billing_term?.id === billingTermId) : null;
  const currentCycleDiscountPercent = Number(selectedTermPkg?.discount_percent ?? 0);
  const currentCycleMonths = selectedTermPkg?.billing_term?.months ?? 1;

  // A package's own price_usd is the pre-discount amount (monthly price ×
  // term months for a multi-year row — see YearlyPackageSync) —
  // discount_percent is applied here, same formula as the payment page's
  // planPrice().
  const packagePriceUsd = (pkg: Package): number => {
    const discount = Number(pkg.discount_percent) || 0;
    return Math.round(Number(pkg.price_usd) * (1 - discount / 100) * 100) / 100;
  };

  // Custom mode has no package row to read a multi-year price/discount off
  // of — same ×term-months then discount formula applied directly to the
  // monthly module total.
  const customBasePkr = billingTermId === null
    ? customMonthlyBasePkr
    : Math.round(customMonthlyBasePkr * currentCycleMonths * (1 - currentCycleDiscountPercent / 100) * 100) / 100;
  const customBaseUsd = billingTermId === null
    ? customMonthlyBaseUsd
    : Math.round(customMonthlyBaseUsd * currentCycleMonths * (1 - currentCycleDiscountPercent / 100) * 100) / 100;

  const addonPkr = seat.price_pkr + company.price_pkr;
  const addonUsd = seat.price_usd + company.price_usd;
  const totalPkr = mode === 'package' ? Number(selectedPackage?.price_pkr ?? 0) + addonPkr : customBasePkr + addonPkr;
  const totalUsd = mode === 'package' ? (selectedPackage ? packagePriceUsd(selectedPackage) : 0) + addonUsd : customBaseUsd + addonUsd;

  // How much the current term's discount is actually saving, in dollars —
  // shown as its own Order Summary line so the discount isn't just implicit
  // in a lower total.
  const discountAmountUsd = billingTermId === null ? 0
    : mode === 'package'
      ? (selectedPackage ? Number(selectedPackage.price_usd) - packagePriceUsd(selectedPackage) : 0)
      : (customMonthlyBaseUsd * currentCycleMonths) - customBaseUsd;


  // Resolves the cheapest real package (in the currently toggled billing
  // cycle) that already covers every custom-picked module — needed as the
  // package_id FK on submit, since a custom bundle has no package row of its
  // own. Matching the toggle here (not always monthly) matters for billing:
  // the admin's package_id is what later decides a monthly vs yearly renewal
  // period (see SubscriptionPaymentController::process()) — a yearly-priced
  // custom bundle linked to a monthly package_id would silently re-bill
  // monthly instead. Yearly rows mirror their monthly parent's modules
  // exactly (YearlyPackageSync), so the coverage check works identically.
  const autoPackage = (): Package | null => {
    const inCycle = packages.filter(p => (p.billing_term?.id ?? null) === billingTermId);
    if (!inCycle.length || !customModules.length) return null;
    const sorted = [...inCycle].sort((a, b) => Number(a.price_usd) - Number(b.price_usd));
    for (const pkg of sorted) {
      if (customModules.every(m => (pkg.modules ?? []).includes(m))) return pkg;
    }
    return sorted[sorted.length - 1] ?? null;
  };

  const [companyName, setCompanyName] = useState<string>('');
  const [companyNameOk, setCompanyNameOk] = useState<boolean | null>(null);
  const [companyNameChecking, setCompanyNameChecking] = useState<boolean>(false);
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [emailOk, setEmailOk] = useState<boolean | null>(null);
  const [emailChecking, setEmailChecking] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');
  const [confirm, setConfirm] = useState<string>('');
  const handleGeneratePassword = () => {
    const pw = generateStrongPassword();
    setPassword(pw);
    setConfirm(pw);
    setShowPassword(true);
    setShowConfirm(true);
  };
  const [phone, setPhone] = useState<string>('');
  const [countryCode, setCountryCode] = useState<Country>('US');
  const selectedCountry = ALL_COUNTRIES.find(c => c.code === countryCode) ?? ALL_COUNTRIES[0];

  // The account is already created by the time handleSubmit stashes this
  // (see below) — restoring it is purely so clicking Back on /payment
  // doesn't dump the admin back onto a blank Step 1, losing the company
  // info and module picks they already entered. Never includes
  // password/confirm — those aren't needed again and shouldn't sit in
  // localStorage past the moment they're submitted.
  useEffect(() => {
    try {
      const raw = localStorage.getItem('register_draft');
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft.companyName) setCompanyName(draft.companyName);
      if (draft.name) setName(draft.name);
      if (draft.email) setEmail(draft.email);
      if (draft.phone) setPhone(draft.phone);
      if (draft.countryCode) setCountryCode(draft.countryCode);
      if (draft.mode) setMode(draft.mode);
      if (Array.isArray(draft.selectedCategories)) setSelectedCategories(draft.selectedCategories);
      if (typeof draft.seatIdx === 'number') setSeatIdx(draft.seatIdx);
      if (typeof draft.companyIdx === 'number') setCompanyIdx(draft.companyIdx);
      if (draft.startTypeChoice) setStartTypeChoice(draft.startTypeChoice);
      // Account (Step 1) is already created — land back on plan/module picks.
      setStep(2);
    } catch { /* malformed/missing draft — nothing to restore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLoadingPackages(true);
    publicService.getPackages()
      .then((pkgs: Package[]) => {
        setPackages(pkgs);
        let draftPkgId: number | null = null;
        try {
          const raw = localStorage.getItem('register_draft');
          if (raw) draftPkgId = JSON.parse(raw).packageId ?? null;
        } catch { /* ignore */ }
        const wantedId = draftPkgId ?? (preSelectedPkg ? Number(preSelectedPkg) : null);
        if (wantedId) {
          const found = pkgs.find(p => p.id === wantedId);
          if (found) { setBillingTermId(found.billing_term?.id ?? null); setSelectedPackage(found); return; }
        }
        // Defaults to a monthly pick — pkgs includes every Billing Term (see
        // publicService.getPackages()), and the initial toggle state above
        // is null (Monthly).
        const monthly = pkgs.filter(p => p.billing_term === null);
        setSelectedPackage(monthly.find(p => p.is_popular) ?? monthly[0] ?? null);
      })
      // Previously swallowed silently, which left Step 2 with no package
      // ever selected and the submit button permanently (and silently)
      // disabled — no error, no toast, nothing in the console to explain it.
      .catch(() => toast.error('Failed to load pricing plans. Please refresh the page.'))
      .finally(() => setLoadingPackages(false));
  }, [preSelectedPkg]);

  // Live catalog — active/inactive AND current pricing must take effect here.
  useEffect(() => {
    publicService.getModules()
      .then(setLiveModules)
      .catch(() => { });
  }, []);


  // useEffect(() => {
  //   setLoadingCategories(true);
  //   publicService.getModules()
  //     .then(mods => {
  //       // agar API response { data: [...] } shape me wrapped hai to yahan handle ho jayega
  //       const list = Array.isArray(mods) ? mods : (mods as any)?.data ?? [];
  //       console.log('getModules raw response:', mods);
  //       if (!list.length) {
  //         console.warn('getModules returned an empty array — check backend is_active filter or DB seed');
  //       }
  //       setCategories(list.map(moduleToCategory));
  //     })
  //     .catch(err => {
  //       console.error('getModules failed:', err?.response?.data || err);
  //       setCategoriesError('Failed to load modules');
  //     })
  //     .finally(() => setLoadingCategories(false));
  // }, []);

  // useEffect(() => {
  //   publicService.getModules()
  //     .then(mods => setCategories(mods.map(moduleToCategory)))
  //     .catch(err => console.error('getModules failed:', err));
  // }, []);

  const checkEmail = useCallback(async (val: string) => {
    if (!val || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) { setEmailOk(null); return; }
    setEmailChecking(true);
    try { setEmailOk(await publicService.checkEmail(val)); }
    catch { setEmailOk(null); }
    finally { setEmailChecking(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => checkEmail(email), 700);
    return () => clearTimeout(t);
  }, [email, checkEmail]);

  const checkCompanyName = useCallback(async (val: string) => {
    if (!val.trim()) { setCompanyNameOk(null); return; }
    setCompanyNameChecking(true);
    try { setCompanyNameOk(await publicService.checkCompanyName(val.trim())); }
    catch { setCompanyNameOk(null); }
    finally { setCompanyNameChecking(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => checkCompanyName(companyName), 700);
    return () => clearTimeout(t);
  }, [companyName, checkCompanyName]);

  const toggleCategory = (key: string) =>
    setSelectedCategories(prev => {
      if (key === 'invoice' && prev.includes('invoice') && (prev.includes('sales') || prev.includes('finance'))) {
        toast.error(prev.includes('sales') ? DEPENDENCY_ERRORS.sales : DEPENDENCY_ERRORS.finance);
        return prev;
      }
      // Compliance needs Projects AND Invoice both present — block removing
      // either one while Compliance itself is still selected. Removing
      // Compliance is unaffected (that branch never touches this key), so
      // Projects/Invoice stay if they were picked manually or by anything
      // else that needs them.
      if ((key === 'invoice' || key === 'projects') && prev.includes(key) && prev.includes('compliance')) {
        toast.error(DEPENDENCY_ERRORS.compliance);
        return prev;
      }

      if (prev.includes(key)) return prev.filter(k => k !== key);

      const next = [...prev, key];
      if ((key === 'sales' || key === 'finance') && !next.includes('invoice')) {
        next.push('invoice');
      }
      if (key === 'compliance') {
        if (!next.includes('projects')) next.push('projects');
        if (!next.includes('invoice')) next.push('invoice');
      }
      return next;
    });

  const step1Valid = !!(companyName && companyNameOk && name && email && emailOk && password.length >= 8 && password === confirm && startTypeChoice !== '');

  // startType 'trial' (the primary CTA) still only actually grants a trial if
  // the Super Admin's Subscription Policy has trial_enabled — a policy-off
  // company always lands on pending_payment regardless. 'paid' (the "Skip
  // Trial, Pay Now" secondary action) always skips straight to pending_payment
  // by request, letting someone who doesn't want a trial go straight to
  // checkout instead of waiting out however many trial days are configured.
  const handleSubmit = async (startType: 'trial' | 'paid' | '' = startTypeChoice) => {
    if (submitting) return; // Guards a double-click re-submit before the disabled prop re-renders.
    if (!startType) { toast.error('Please select Start with option'); return; }
    const pkgToUse = mode === 'package' ? selectedPackage : autoPackage();
    const modulesToUse = mode === 'package' ? (selectedPackage?.modules ?? []) : customModules;
    if (mode === 'package' && !selectedPackage) { toast.error('Please select a package'); return; }
    if (mode === 'custom' && selectedCategories.length === 0) { toast.error('Please select at least one module'); return; }
    if (activeDependencyErrors.length > 0) {
      activeDependencyErrors.forEach(message => toast.error(message));
      return;
    }
    if (!pkgToUse) { toast.error('No matching package found'); return; }
    setSubmitting(true);
    try {
      const res = await publicService.register({
        company_name: companyName, name, email, password,
        password_confirmation: confirm,
        phone: phone || undefined,
        package_id: pkgToUse.id,
        selected_modules: modulesToUse,
        is_custom_selection: mode === 'custom',
        currency, start_type: startType, timezone: selectedCountry.timezone, country: countryCode,
        max_users: seat.value, max_companies: company.value,
      });
      if (res.success) {
        setAuthData(res.data.token, res.data.admin, 'admin');
        // Trial was actually granted (policy-dependent — see the comment
        // above) — nothing left to pay for yet, go straight in.
        if (res.data.admin.subscription_status === 'trial') {
          router.push('/admin/dashboard');
          return;
        }
        localStorage.setItem('pending_order', JSON.stringify({
          package_id: pkgToUse.id,
          package_name: pkgToUse.name,
          modules: mode === 'custom' ? selectedCats.map(c => c.key) : [],
          required_dependencies: mode === 'custom'
            ? requiredDeps.map(key => visibleCategories.find(c => c.key === key)?.label ?? key)
            : [],
          mode, seats: seat.label, companies: company.label,
          total_pkr: totalPkr, total_usd: totalUsd,
          currency, trial_days: pkgToUse.trial_days,
        }));
        // So Back from /payment can restore this instead of landing on a blank
        // Step 1 — never includes password/confirm (see the restore effect above).
        localStorage.setItem('register_draft', JSON.stringify({
          companyName, name, email, phone, countryCode, mode,
          packageId: pkgToUse.id, billingTermId,
          selectedCategories, seatIdx, companyIdx, startTypeChoice: startType,
        }));
        router.push('/payment');
      }
    } catch (err: any) {
      const e = err;
      const errs = e.response?.data?.errors;
      if (errs) Object.values(errs).flat().forEach((m: any) => toast.error(m));
      else toast.error(e.response?.data?.message ?? 'Registration failed');
    } finally { setSubmitting(false); }
  };

  const strength = pwStrength(password);
  const canSubmit = !submitting && (
    mode === 'package'
      ? !!selectedPackage && packageDependencyErrors.length === 0
      : selectedCategories.length > 0 && customDependencyErrors.length === 0
  );
  const fmt = (_pkr: number, usd: number) => `$${usd}`;

  return (
    <>
      <LoadingOverlay show={submitting} message="Creating Account…" />
      <LandingNavbar />
      <div className='AuthBackground'>
        <Container>
          <div style={{ maxWidth: step === 2 ? 1100 : 720, margin: '0 auto', }}>

            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 36 }}>
              {[1, 2].map(s => (
                <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: step >= s ? 'var(--brand-gradient)' : '#fff',
                      border: step >= s ? 'none' : '1.5px solid var(--border, #e5e7eb)',
                      color: step >= s ? '#fff' : '#9ca3af',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: 14,
                      boxShadow: step === s ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
                    }}>
                      {step > s ? <HiCheck size={16} /> : s}
                    </div>
                    <span style={{
                      fontSize: 12, fontWeight: step >= s ? 600 : 400,
                      color: step >= s ? 'var(--brand-blue)' : '#9ca3af',
                      whiteSpace: 'nowrap',
                    }}>
                      {s === 1 ? 'Company Info' : 'Select Plan'}
                    </span>
                  </div>
                  {s < 2 && (
                    <div style={{
                      width: 80, height: 2,
                      background: step > s ? 'var(--brand-blue)' : 'var(--border, #e5e7eb)',
                      margin: '0 10px', marginBottom: 22,
                    }} />
                  )}
                </div>
              ))}
            </div>

            {step === 1 && (
              <div style={{
                background: 'var(--bg-white)',
                borderRadius: 14,
                border: '1px solid var(--border, #e5e7eb)',
                padding: '48px',
              }} className="RegisterForm shadow-sm">
                <h2 style={{ fontSize: '2rem', fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>
                  Create Account
                </h2>
                <p style={{ color: '#6b7280', fontSize: 15, margin: '0 0 32px' }}>
                  Fill in your details to get started with a {effectiveTrialDays}-day free trial.
                </p>

                {effectiveTrialDays > 0 && (
                  <div style={{ marginBottom: 18 }}>
                    <label style={labelBase}>Start with</label>
                    <select
                      value={startTypeChoice}
                      onChange={e => setStartTypeChoice(e.target.value as 'trial' | 'paid' | '')}
                      style={{ ...inputBase, paddingLeft: 14, paddingRight: 14, appearance: 'none' }}
                      onFocus={e => (e.target.style.borderColor = 'var(--brand-blue)')}
                      onBlur={e => (e.target.style.borderColor = 'var(--bg-blue-light1)')}
                    >
                      <option value="" disabled>Select Type</option>
                      <option value="trial">Free Trial — {effectiveTrialDays} days, no payment now</option>
                      <option value="paid">Skip Trial — Pay Now</option>
                    </select>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <InputField
                    label="Company Name"
                    required
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    placeholder=""
                    error={companyNameOk === false ? 'This company name is already registered' : undefined}
                    rightEl={
                      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
                        {companyNameChecking
                          ? <HiClock size={16} color="#9ca3af" />
                          : companyNameOk === true
                            ? <HiCheckCircle size={16} color="#22c55e" />
                            : companyNameOk === false
                              ? <HiXCircle size={16} color="#ef4444" />
                              : null
                        }
                      </span>
                    }
                  />
                  <InputField
                    label="Your Full Name"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder=""
                  />
                </div>

                <div style={{ marginBottom: 18 }}>
                  <label style={labelBase}>
                    Email Address <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="email"
                      placeholder=""
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      style={{
                        ...inputBase,
                        paddingLeft: 14,
                        paddingRight: 14,
                        borderColor: emailOk === false ? 'var(--error-lable, #ef4444)' : emailOk === true ? '#22c55e' : 'var(--bg-blue-light1)',
                      }}
                      onFocus={e => (e.target.style.borderColor = 'var(--brand-blue)')}
                      onBlur={e => (e.target.style.borderColor = emailOk === false ? 'var(--error-lable, #ef4444)' : emailOk === true ? '#22c55e' : 'var(--bg-blue-light1)')}
                    />
                    <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
                      {emailChecking
                        ? <HiClock size={16} color="#9ca3af" />
                        : emailOk === true
                          ? <HiCheckCircle size={16} color="#22c55e" />
                          : emailOk === false
                            ? <HiXCircle size={16} color="#ef4444" />
                            : null
                      }
                    </span>
                  </div>
                  {emailOk === false && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>This email is already registered</div>}
                  {emailOk === true && <div style={{ fontSize: 12, color: '#22c55e', marginTop: 4 }}>Email is available</div>}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <label style={labelBase}>Password <span style={{ color: '#ef4444' }}>*</span></label>
                      <button type="button" onClick={handleGeneratePassword} style={{ fontSize: 11, fontWeight: 600, color: 'var(--brand-blue)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                        Suggest strong password
                      </button>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Min 8 characters"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        style={{ ...inputBase, paddingLeft: 14, paddingRight: 36 }}
                        onFocus={e => (e.target.style.borderColor = 'var(--brand-blue)')}
                        onBlur={e => (e.target.style.borderColor = 'var(--bg-blue-light1)')}
                      />
                      <button type="button" onClick={() => setShowPassword(v => !v)} tabIndex={-1} style={{
                        position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af',
                        display: 'flex', alignItems: 'center', padding: 2,
                      }}>
                        {showPassword ? <HiEyeSlash size={17} /> : <HiEye size={17} />}
                      </button>
                    </div>
                    {password && (
                      <div style={{ marginTop: 6 }}>
                        <div style={{ height: 3, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${strength.pct}%`, height: '100%', background: strength.color, borderRadius: 4, transition: 'all 0.3s' }} />
                        </div>
                        <span style={{ fontSize: 11, color: strength.color, fontWeight: 600 }}>{strength.label}</span>
                      </div>
                    )}
                  </div>

                  <div style={{ marginBottom: 18 }}>
                    <label style={labelBase}>Confirm Password <span style={{ color: '#ef4444' }}>*</span></label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        placeholder="Repeat password"
                        value={confirm}
                        onChange={e => setConfirm(e.target.value)}
                        style={{
                          ...inputBase, paddingLeft: 14, paddingRight: 36,
                          borderColor: confirm && password !== confirm ? 'var(--error-lable, #ef4444)' : 'var(--bg-blue-light1)',
                        }}
                        onFocus={e => (e.target.style.borderColor = 'var(--brand-blue)')}
                        onBlur={e => (e.target.style.borderColor = confirm && password !== confirm ? 'var(--error-lable, #ef4444)' : 'var(--bg-blue-light1)')}
                      />
                      <button type="button" onClick={() => setShowConfirm(v => !v)} tabIndex={-1} style={{
                        position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af',
                        display: 'flex', alignItems: 'center', padding: 2,
                      }}>
                        {showConfirm ? <HiEyeSlash size={17} /> : <HiEye size={17} />}
                      </button>
                    </div>
                    {confirm && password !== confirm && (
                      <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>Passwords do not match</div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
                  <div style={{ marginBottom: 18 }}>
                    <label style={labelBase}>Country</label>
                    <div style={{ position: 'relative' }}>
                      <select
                        value={countryCode}
                        onChange={e => setCountryCode(e.target.value as Country)}
                        style={{ ...inputBase, paddingLeft: 14, paddingRight: 14, appearance: 'none' }}
                        onFocus={e => (e.target.style.borderColor = 'var(--brand-blue)')}
                        onBlur={e => (e.target.style.borderColor = 'var(--bg-blue-light1)')}
                      >
                        {ALL_COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name} (+{c.callingCode})</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ marginBottom: 18 }}>
                    <label style={labelBase}>Phone (Optional)</label>
                    <PhoneInput
                      key={countryCode}
                      value={phone}
                      onChange={setPhone}
                      defaultCountry={countryCode}
                      onCountryChange={c => c && setCountryCode(c)}
                    />
                  </div>
                </div>

                {/* Trial needs no package/module choice — it already gets the
                    full catalog (see PublicController::register()), so Step 2
                    is skipped entirely and this submits right away with
                    whatever package auto-selected on load (any package works
                    identically for a trial; it only matters once they pay).
                    "Skip Trial, Pay Now" still needs Step 2 to actually pick
                    what they're paying for. */}
                {startTypeChoice === 'trial' ? (
                  <SubmitButton
                    type="button"
                    onClick={() => step1Valid && handleSubmit('trial')}
                    loading={submitting}
                    loadingText="Creating Account…"
                    disabled={!step1Valid || !selectedPackage}
                    style={{
                      width: '100%', height: 50,
                      borderRadius: 8, border: 'none',
                      background: (step1Valid && selectedPackage) ? 'var(--brand-gradient)' : 'var(--bg-blue-light1)',
                      color: '#fff', fontSize: 15, fontWeight: 600,
                      transition: 'background 0.2s',
                      marginBottom: 16,
                    }}
                  >
                    Start Free Trial <HiArrowRight size={16} />
                  </SubmitButton>
                ) : (
                  <button
                    onClick={() => step1Valid && setStep(2)}
                    disabled={!step1Valid}
                    style={{
                      width: '100%', height: 50,
                      borderRadius: 8, border: 'none',
                      cursor: step1Valid ? 'pointer' : 'not-allowed',
                      background: step1Valid ? 'var(--brand-gradient)' : 'var(--bg-blue-light1)',
                      color: '#fff', fontSize: 15, fontWeight: 600,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      transition: 'background 0.2s',
                      marginBottom: 16,
                    }}
                  >
                    Next: Select Plan <HiArrowRight size={16} />
                  </button>
                )}

                <div style={{ textAlign: 'center', fontSize: 13, color: '#9ca3af' }}>
                  Already have an account? <Link href="/login" style={{ color: 'var(--brand-blue)', paddingLeft: "5px", fontWeight: 600, textDecoration: 'none' }}>
                    Sign in
                  </Link>
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                {/* Header row */}
                <div className="defaultMargin" style={{ display: 'flex', gap: '5px', justifyContent: 'space-between', alignItems: 'center', }}>
                  <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Choose Your Plan</h2>
                    <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>Select a ready-made package or build your own</p>
                  </div>
                  {/* Currency toggle — login style */}
                </div>

                <div className='grid grid-cols-1 sm:grid-cols-2 items-center gap-2 sm:gap-4 defaultMargin '>
                  {[
                    { val: 'package' as Mode, Icon: HiCube, label: 'Choose a Package', sub: 'Pre-built plans with fixed pricing' },
                    { val: 'custom' as Mode, Icon: HiAdjustmentsHorizontal, label: 'Custom Modules', sub: 'Pick only what you need' },
                  ].map(opt => {
                    const active = mode === opt.val;
                    return (
                      <button key={opt.val} onClick={() => setMode(opt.val)} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 20px',
                        border: `1.5px solid var(--border, #e5e7eb)`,
                        borderRadius: 4, cursor: 'pointer',
                        background: active ? '#fff' : '#fff',
                        transition: 'all 0.15s', textAlign: 'left',
                        boxShadow: active ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                      }}>
                        <opt.Icon size={22} style={{ color: active ? 'var(--brand-blue)' : '#9ca3af', flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: active ? 'var(--brand-blue)' : '#111827' }}>{opt.label}</div>
                          <div style={{ fontSize: 12, color: '#9ca3af' }}>{opt.sub}</div>
                        </div>
                        {active && (
                          <div style={{
                            marginLeft: 'auto', width: 20, height: 20, borderRadius: '50%',
                            background: 'var(--brand-gradient)', color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 800, flexShrink: 0,
                          }}>
                            <HiCheck size={11} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className='w-full defaultMargin  grid grid-cols-12 items-start gap-2'>
                  <div className='w-full col-span-12 gap-6 items-start md:col-span-8'>
                    {/* Monthly/Yearly toggle lives in the Order Summary sidebar
                        only — no need to duplicate it here too. */}
                    {mode === 'package' && (
                      loadingPackages
                        ? (
                          <div style={{
                            padding: '100px 0',
                            textAlign: 'center',
                            color: '#64748b',
                            fontSize: 16
                          }}>
                            <div style={{
                              width: 48,
                              height: 48,
                              border: '4px solid #e2e8f0',
                              borderTopColor: '#2563eb',
                              borderRadius: '50%',
                              margin: '0 auto 20px',
                              animation: 'spin 1s linear infinite'
                            }} />
                            Loading plans...
                          </div>
                        )
                        : (
                          <div className='defaultMargin grid md:grid-cols-2 items-start gap-3 w-full'>
                            {visiblePackages.map(pkg => {
                              const active = selectedPackage?.id === pkg.id;
                              return (
                                <div
                                  key={pkg.id}
                                  onClick={() => setSelectedPackage(pkg)}
                                  style={{
                                    width: '100%',
                                    borderRadius: 24,
                                    border: active ? '2.5px solid #2563eb' : '1.5px solid #e2e8f0',
                                    background: '#ffffff',
                                    padding: '32px 28px',
                                    cursor: 'pointer',
                                    position: 'relative',
                                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                    boxShadow: active
                                      ? '0 25px 20px -12px rgba(37, 99, 235, 0.25)'
                                      : '0 10px 15px -3px rgba(0,0,0,0.06)',
                                  }}
                                  onMouseEnter={e => {
                                    if (!active) {
                                      e.currentTarget.style.transform = 'translateY(-6px)';
                                      e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0,0,0,0.1)';
                                      e.currentTarget.style.borderColor = '#bfdbfe';
                                    }
                                  }}
                                  onMouseLeave={e => {
                                    if (!active) {
                                      e.currentTarget.style.transform = 'translateY(0)';
                                      e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.06)';
                                      e.currentTarget.style.borderColor = '#e2e8f0';
                                    }
                                  }}
                                >
                                  {pkg.is_popular && (
                                    <div style={{
                                      position: 'absolute',
                                      top: -14,
                                      left: '50%',
                                      transform: 'translateX(-50%)',
                                      background: 'var(--brand-gradient)',
                                      color: '#fff',
                                      fontSize: 11,
                                      fontWeight: 700,
                                      padding: '6px 22px',
                                      borderRadius: 9999,
                                      letterSpacing: '0.08em',
                                      boxShadow: '0 6px 16px rgba(37,99,235,0.3)',
                                    }}>
                                      MOST POPULAR
                                    </div>
                                  )}

                                  {active && (
                                    <div style={{
                                      position: 'absolute',
                                      top: 20,
                                      right: 20,
                                      width: 28,
                                      height: 28,
                                      borderRadius: '50%',
                                      background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                                      color: '#fff',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: 16,
                                      fontWeight: 700,
                                    }}>
                                      <MdOutlineDone />
                                    </div>
                                  )}

                                  {/* Plan Name */}
                                  <div style={{
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: '#64748b',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.08em',
                                    marginBottom: 12,
                                  }}>
                                    {pkg.name}
                                  </div>

                                  {/* Price */}
                                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, }}>
                                    <span style={{
                                      fontSize: 18,
                                      fontWeight: 600,
                                      color: '#64748b'
                                    }}>
                                      $
                                    </span>
                                    <span style={{
                                      fontSize: '42px',
                                      fontWeight: 800,
                                      letterSpacing: '-0.04em',
                                      color: '#0f172a'
                                    }}>
                                      {packagePriceUsd(pkg)}
                                    </span>
                                    {Number(pkg.discount_percent) > 0 && (
                                      <span style={{ fontSize: 15, fontWeight: 600, color: '#94a3b8', textDecoration: 'line-through' }}>
                                        ${pkg.price_usd}
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: 14, color: '#94a3b8' }}>/{pkg.billing_term ? pkg.billing_term.name : 'month'}</div>

                                  {/* Trial */}
                                  <div style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    background: '#ecfdf5',
                                    color: '#10b981',
                                    fontSize: 13.5,
                                    fontWeight: 600,
                                    width: '100%',
                                    padding: '6px 18px',
                                    borderRadius: 9999,
                                    marginBottom: 28,
                                  }}>
                                    {pkg.trial_days}-day free trial
                                  </div>

                                  {/* Modules */}
                                  <div style={{ marginBottom: 24 }}>
                                    <div style={{
                                      fontSize: 12.5,
                                      fontWeight: 600,
                                      color: '#64748b',
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.06em',
                                      marginBottom: 12,
                                    }}>
                                      INCLUDED MODULES
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                      {(pkg.modules ?? []).map(m => (
                                        <span key={m} style={{
                                          padding: '6px 14px',
                                          background: '#f0f9ff',
                                          color: '#1e40af',
                                          fontSize: 13,
                                          borderRadius: 10,
                                          fontWeight: 500,
                                        }}>
                                          {m.replace(/_/g, ' ')}
                                        </span>
                                      ))}
                                    </div>
                                  </div>

                                  {/* CTA Button */}
                                  <button
                                    onClick={e => { e.stopPropagation(); setSelectedPackage(pkg); }}
                                    style={{
                                      width: '100%',
                                      padding: '14px 0',
                                      borderRadius: 14,
                                      border: active ? 'none' : '1.5px solid #dbeafe',
                                      background: active ? 'var(--brand-gradient)' : '#ffffff',
                                      color: active ? '#fff' : '#2563eb',
                                      fontSize: 15,
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      boxShadow: active ? '0 8px 25px rgba(37,99,235,0.35)' : 'none',
                                      transition: 'all 0.2s',
                                    }}
                                  >
                                    {active ? 'Selected' : 'Select This Plan'}
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        )
                    )}

                    {mode === 'custom' && (
                      <div>
                        <div className='grid max-[420px]:grid-cols-1 grid-cols-2 md:grid-cols-3 items-center gap-2 w-full mb-10'>
                          {visibleCategories.map(cat => {
                            const active = selectedCategories.includes(cat.key);
                            // requiredDeps only ever holds keys another selected
                            // category currently depends on (Invoice for
                            // Sales/Finance; Invoice + Projects for Compliance) —
                            // any of them being present means this tile is locked.
                            const locked = requiredDeps.includes(cat.key);
                            const CatIcon = cat.icon;
                            return (
                              <div key={cat.key} onClick={() => toggleCategory(cat.key)} style={{
                                padding: '16px 14px', borderRadius: 4, cursor: locked ? 'not-allowed' : 'pointer',
                                border: `1.5px solid ${active ? cat.color : 'var(--border, #e5e7eb)'}`,
                                background: active ? cat.bg : '#fff',
                                transition: 'all 0.15s', position: 'relative', userSelect: 'none',
                                boxShadow: active ? `0 2px 10px ${cat.color}22` : '0 1px 3px rgba(0,0,0,0.04)',
                              }}>
                                {active && (
                                  <div style={{
                                    position: 'absolute', top: 10, right: 10, width: 18, height: 18,
                                    borderRadius: '50%', background: cat.color, color: '#fff',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  }}>
                                    <HiCheck size={10} />
                                  </div>
                                )}
                                <CatIcon size={24} style={{ color: active ? cat.color : '#9ca3af', marginBottom: 8 }} />
                                <div style={{ fontSize: 13, fontWeight: 700, color: active ? cat.color : '#111827', marginBottom: 2 }}>{cat.label}</div>
                                <div style={{ fontSize: 11, color: active ? cat.color + 'aa' : '#9ca3af', marginBottom: 8, lineHeight: 1.3 }}>{cat.desc}</div>
                                <div style={{ fontSize: 10, color: active ? cat.color : '#6b7280', marginBottom: 8, lineHeight: 1.3, fontWeight: 600 }}>
                                  {locked ? 'Required dependency' : cat.badge}
                                </div>
                                <div style={{ fontWeight: 700, fontSize: 13, color: active ? cat.color : '#6b7280' }}>
                                  {fmt(cat.price_pkr, cat.price_usd)}
                                  <span style={{ fontSize: 10, fontWeight: 400, color: active ? cat.color + '99' : '#9ca3af' }}>/mo</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {selectedCategories.length > 0 && autoPackage() && (
                          <div style={{
                            padding: '10px 14px', background: '#f0fdf4',
                            border: '1px solid #a7f3d0', borderRadius: 4,
                            fontSize: 12, color: '#065f46', display: 'flex', gap: 8, alignItems: 'center',
                          }}>
                            <HiShieldCheck size={14} />
                            <span>Plan <strong>{autoPackage()?.name}</strong> will be applied for billing.</span>
                          </div>
                        )}
                        {customDependencyErrors.length > 0 && (
                          <div style={{
                            padding: '10px 14px', background: '#fef2f2',
                            border: '1px solid #fecaca', borderRadius: 4,
                            fontSize: 12, color: '#dc2626', display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8,
                          }}>
                            {customDependencyErrors.map(message => <span key={message}>{message}</span>)}
                          </div>
                        )}
                      </div>
                    )}
                    <div style={{
                      background: '#fff', borderRadius: 4,
                      border: '1px solid var(--border, #e5e7eb)', padding: '16px 18px',
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <HiUsers size={15} style={{ color: 'var(--brand-blue)' }} /> User Seats &amp; Companies
                      </div>
                      <PillRow label="Number of Users (Seats)" options={SEAT_OPTIONS} selectedIdx={seatIdx} onSelect={setSeatIdx} />
                      <PillRow label="Number of Companies" options={COMPANY_OPTIONS} selectedIdx={companyIdx} onSelect={setCompanyIdx} />
                    </div>
                  </div>

                  <div className='col-span-12 md:col-span-4' style={{ position: 'sticky', top: 88 }}>
                    <div style={{
                      background: '#fff', borderRadius: 4,
                      border: '1px solid var(--border, #e5e7eb)',
                      padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                    }}>
                      <h4 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 16px' }}>
                        Order Summary
                      </h4>

                      {availableBillingTerms.length > 0 && (
                        <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 3, gap: 3, marginBottom: 16, flexWrap: 'wrap' }}>
                          {[{ id: null as number | null, name: 'Monthly' }, ...availableBillingTerms].map(term => {
                            const active = billingTermId === term.id;
                            const termPkg = term.id !== null ? packages.find(p => p.billing_term?.id === term.id) : null;
                            return (
                              <button
                                key={term.id ?? 'monthly'}
                                type="button"
                                onClick={() => switchBillingTerm(term.id)}
                                style={{
                                  flex: 1, minWidth: 70, padding: '7px 0', borderRadius: 6, border: 'none',
                                  background: active ? '#fff' : 'transparent',
                                  color: active ? '#0f172a' : '#64748b',
                                  fontWeight: 700, fontSize: 12, cursor: 'pointer',
                                  boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                                  transition: 'all 0.15s',
                                }}
                              >
                                {term.name}
                                {termPkg && Number(termPkg.discount_percent) > 0 && (
                                  <span style={{ fontSize: 9, fontWeight: 800, color: active ? '#16a34a' : '#94a3b8' }}>
                                    -{Number(termPkg.discount_percent)}%
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {mode === 'package' && selectedPackage && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
                          <span style={{ color: '#6b7280', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <HiCube size={13} style={{ color: 'var(--brand-blue)' }} /> {selectedPackage.name}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                            {Number(selectedPackage.discount_percent) > 0 && (
                              <span style={{ color: '#9ca3af', textDecoration: 'line-through', fontSize: 12 }}>
                                {fmt(Number(selectedPackage.price_pkr), Number(selectedPackage.price_usd))}
                              </span>
                            )}
                            <span style={{ fontWeight: 600 }}>{fmt(Number(selectedPackage.price_pkr), packagePriceUsd(selectedPackage))}</span>
                          </span>
                        </div>
                      )}

                      {mode === 'package' && packageDependencyErrors.length > 0 && (
                        <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {packageDependencyErrors.map(message => <span key={message}>{message}</span>)}
                        </div>
                      )}

                      {mode === 'package' && !selectedPackage && !loadingPackages && (
                        <div style={{ color: '#dc2626', fontSize: 13, textAlign: 'center', padding: '8px 0 12px' }}>
                          Couldn&apos;t load pricing plans. Please refresh the page.
                        </div>
                      )}

                      {mode === 'package' && !selectedPackage && loadingPackages && (
                        <div style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '8px 0 12px' }}>
                          Loading plans…
                        </div>
                      )}

                      {mode === 'custom' && selectedCats.map(cat => (
                        <div key={cat.key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                          <span style={{ color: '#6b7280', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <cat.icon size={13} style={{ color: cat.color }} /> {cat.label}
                            {requiredDeps.includes(cat.key) && (
                              <span style={{ fontSize: 11, color: cat.color, fontWeight: 600 }}>(Required)</span>
                            )}
                          </span>
                          <span style={{ fontWeight: 600, color: cat.color }}>{fmt(cat.price_pkr, cat.price_usd)}</span>
                        </div>
                      ))}

                      {mode === 'custom' && selectedCats.length === 0 && (
                        <div style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '8px 0 12px' }}>
                          Select modules to see pricing
                        </div>
                      )}

                      {discountAmountUsd > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                          <span style={{ color: '#16a34a', fontWeight: 600 }}>{selectedTermPkg?.billing_term?.name ?? 'Term'} Discount ({currentCycleDiscountPercent}%)</span>
                          <span style={{ fontWeight: 600, color: '#16a34a' }}>-${discountAmountUsd.toFixed(2)}</span>
                        </div>
                      )}

                      {seat.price_usd > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                          <span style={{ color: '#6b7280', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <HiUsers size={13} style={{ color: '#7c3aed' }} /> {seat.label}
                          </span>
                          <span style={{ fontWeight: 600, color: '#7c3aed' }}>+{fmt(seat.price_pkr, seat.price_usd)}</span>
                        </div>
                      )}

                      {company.price_usd > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                          <span style={{ color: '#6b7280', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <HiBuildingOffice2 size={13} style={{ color: '#7c3aed' }} /> {company.label}
                          </span>
                          <span style={{ fontWeight: 600, color: '#7c3aed' }}>+{fmt(company.price_pkr, company.price_usd)}</span>
                        </div>
                      )}

                      {(mode === 'package' ? !!selectedPackage : selectedCats.length > 0) && (
                        <div style={{ borderTop: '1px dashed var(--border, #e5e7eb)', paddingTop: 12, marginTop: 8, marginBottom: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <span style={{ fontWeight: 700, color: '#111827', fontSize: 14 }}>Total</span>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--brand-blue)' }}>
                                {fmt(totalPkr, totalUsd)}
                                <span style={{ fontSize: 12, fontWeight: 400, color: '#9ca3af' }}>/{billingTermId === null ? 'mo' : `${currentCycleMonths}mo`}</span>
                              </div>
                              {effectiveTrialDays > 0 && startTypeChoice === 'trial' && (
                                <div style={{ fontSize: 11, color: '#22c55e', fontWeight: 600 }}>{effectiveTrialDays}-day free trial included</div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      <SubmitButton
                        type="button"
                        onClick={() => handleSubmit(startTypeChoice)}
                        loading={submitting}
                        loadingText="Creating Account…"
                        disabled={!canSubmit}
                        style={{
                          width: '100%', height: 46,
                          borderRadius: 6, border: 'none',
                          background: canSubmit ? 'var(--brand-gradient)' : 'var(--bg-blue-light1)',
                          color: '#fff', fontSize: 14, fontWeight: 700,
                          transition: 'background 0.2s',
                        }}
                      >
                        {startTypeChoice === 'trial'
                          ? <>Start Free Trial <HiArrowRight size={16} /></>
                          : <>Continue to Payment <HiArrowRight size={16} /></>}
                      </SubmitButton>

                      <div style={{ textAlign: 'center', marginTop: 10, fontSize: 11, color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        <HiShieldCheck size={12} /> Secure{effectiveTrialDays > 0 && startTypeChoice === 'trial' ? ` · ${effectiveTrialDays}-day free trial included` : ''}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <button
                    onClick={() => setStep(1)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 18px',
                      border: '1px solid var(--border, #e5e7eb)',
                      borderRadius: 4, background: '#fff',
                      color: '#6b7280', fontWeight: 600, fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    <HiChevronLeft size={15} /> Back
                  </button>
                </div>
              </div>
            )}

          </div>

        </Container>
      </div>
      <LandingFooter />
    </>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div style={{ color: '#6b7280', fontSize: 15 }}>Loading…</div>
      </div>
    }>
      <RegisterContent />
    </Suspense>
  );
}
