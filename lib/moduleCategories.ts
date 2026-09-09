import {
  HiCube, HiUsers, HiDocumentText, HiShieldCheck, HiBanknotes,
  HiClipboardDocumentList,
} from 'react-icons/hi2';
import { IconType } from 'react-icons';
import { PublicModule } from './services/publicService';

export type Category = {
  key: string;
  label: string;
  icon: IconType;
  desc: string;
  color: string;
  bg: string;
  border: string;
  price_pkr: number;
  price_usd: number;
  modules: string[];
  badge: string;
};

// Presentational styling per module key — pricing/description/availability come from the
// Modules registry (GET /public/modules) so super admin's active/inactive toggle takes effect here.
// Shared by the registration "Build Your Own Plan" flow and the payment/reactivation page's
// custom-module picker, so both stay in lockstep with the same catalog and dependency rules.
export const CATEGORIES: Category[] = [
  // 'clients' deliberately excluded from this category's modules — Sales
  // buyers get only the limited "Basic Clients" permission bundle, not the
  // real Client module (see database/seeders/ModuleSeeder.php's comment).
  { key: 'sales', label: 'Sales', icon: HiDocumentText, desc: 'Leads, clients & pipeline', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', price_pkr: 1500, price_usd: 6, modules: ['leads', 'projects_handoff', 'lead_transfer', 'reports_seller'], badge: 'Requires Invoice' },
  { key: 'client_portal', label: 'Client', icon: HiUsers, desc: 'Client login, documents & support', color: '#10b981', bg: '#ecfdf5', border: '#6ee7b7', price_pkr: 1200, price_usd: 5, modules: ['client_portal'], badge: 'Requires Invoice or Project' },
  { key: 'projects', label: 'Project', icon: HiClipboardDocumentList, desc: 'Tasks, timesheets & deliverables', color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc', price_pkr: 1800, price_usd: 7, modules: ['projects', 'tasks', 'timesheets', 'production', 'revisions', 'deliverables', 'team_resources', 'file_storage'], badge: 'Can be used alone' },
  { key: 'compliance', label: 'Compliance', icon: HiShieldCheck, desc: 'Policies, audits & risk', color: '#dc2626', bg: '#fef2f2', border: '#fecaca', price_pkr: 1500, price_usd: 6, modules: ['compliance', 'policies', 'audit_trails', 'compliance_reports', 'risk_assessments', 'alerts', 'document_compliance'], badge: 'Requires Projects + Invoice' },
  { key: 'hr', label: 'HR Management', icon: HiUsers, desc: 'Employees, attendance & payroll', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', price_pkr: 1800, price_usd: 7, modules: ['employees', 'recruitment', 'attendance', 'leaves', 'payroll'], badge: 'Can be used alone' },
  { key: 'finance', label: 'Finance', icon: HiBanknotes, desc: 'Dashboard, revenue & reports', color: '#d97706', bg: '#fffbeb', border: '#fde68a', price_pkr: 1200, price_usd: 5, modules: ['finance_dashboard', 'finance_reports', 'revenue_reports', 'payments_report'], badge: 'Requires Invoice' },
  { key: 'invoice', label: 'Invoice', icon: HiDocumentText, desc: 'Billing, payments & reminders', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', price_pkr: 1200, price_usd: 5, modules: ['invoices', 'payments', 'payment_details', 'invoice_reminders'], badge: 'Can be used alone' },
];
export const DEFAULT_CATEGORY_STYLE = { icon: HiCube, color: '#475569', bg: '#f8fafc', border: '#e2e8f0', badge: 'Can be used alone' };

export function moduleToCategory(m: PublicModule): Category {
  const style = CATEGORIES.find(c => c.key === m.key) ?? DEFAULT_CATEGORY_STYLE;
  return {
    key: m.key,
    label: m.label,
    icon: style.icon,
    desc: m.description ?? '',
    color: style.color,
    bg: style.bg,
    border: style.border,
    price_pkr: m.price_pkr,
    price_usd: m.price_usd,
    modules: m.sub_modules,
    badge: style.badge,
  };
}

export const DEPENDENCY_ERRORS: Record<string, string> = {
  sales: 'Invoice module is required because Sales includes invoice features.',
  client_portal: 'Client module requires Invoice or Project.',
  finance: 'Invoice module is required because Finance depends on invoice and payment data.',
  compliance: 'Compliance requires both the Project and Invoice modules.',
};

export function requiredDependencyKeys(selected: string[]): string[] {
  const deps: string[] = [];
  if ((selected.includes('sales') || selected.includes('finance')) && selected.includes('invoice')) {
    deps.push('invoice');
  }
  if (selected.includes('compliance')) {
    if (selected.includes('projects') && !deps.includes('projects')) deps.push('projects');
    if (selected.includes('invoice') && !deps.includes('invoice')) deps.push('invoice');
  }
  return deps;
}

export function moduleDependencyErrors(selected: string[]): string[] {
  const errors: string[] = [];
  if (selected.includes('sales') && !selected.includes('invoice')) errors.push(DEPENDENCY_ERRORS.sales);
  if (selected.includes('finance') && !selected.includes('invoice')) errors.push(DEPENDENCY_ERRORS.finance);
  if (selected.includes('client_portal') && !selected.includes('invoice') && !selected.includes('projects')) {
    errors.push(DEPENDENCY_ERRORS.client_portal);
  }
  if (selected.includes('compliance') && (!selected.includes('projects') || !selected.includes('invoice'))) {
    errors.push(DEPENDENCY_ERRORS.compliance);
  }
  return errors;
}

export function moduleKeysToCategoryKeys(moduleKeys: string[]): string[] {
  return CATEGORIES
    .filter(category =>
      moduleKeys.includes(category.key) || category.modules.some(moduleKey => moduleKeys.includes(moduleKey))
    )
    .map(category => category.key);
}
