import api from '@/lib/axios';

export type EmployeeStatus = 'active' | 'on_leave' | 'terminated';
export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'intern';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'half_day' | 'holiday' | 'leave' | 'off_day' | 'pending';
export type AttendanceDisplayStatus = AttendanceStatus | 'not_checked_in' | 'working';
export type AttendanceSource = 'system' | 'manual' | 'self' | 'import';
export type LeaveType = 'annual' | 'sick' | 'casual' | 'maternity' | 'unpaid';
export type LeaveStatus = 'pending' | 'approved' | 'rejected';
export type PayrollStatus = 'draft' | 'processed' | 'paid';
export type RecruitmentStatus = 'open' | 'closed' | 'on_hold';
export type ApplicantStatus = 'applied' | 'shortlisted' | 'interviewed' | 'hired' | 'rejected';

export interface Employee {
  id: number;
  company_id: number;
  user_id: number | null;
  employee_code: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  designation: string | null;
  employment_type: EmploymentType;
  // Expected daily schedule, "HH:MM" — a denormalized cache of shift.start_time/
  // end_time (kept in sync by the backend whenever shift_id changes), distinct
  // from an attendance row's own check_in/check_out (what actually happened).
  shift_start_time: string | null;
  shift_end_time: string | null;
  shift_id: number | null;
  salary: number | null;
  join_date: string | null;
  status: EmployeeStatus;
  created_at: string;
  attendances?: Attendance[];
  leave_requests?: LeaveRequestRecord[];
  payrolls?: Payroll[];
  notes?: EmployeeNote[];
  documents?: EmployeeDocument[];
  user?: { id: number; name: string; email: string } | null;
  company?: { id: number; name: string } | null;
  shift?: Shift | null;
  creator?: { id: number; name: string; type: 'user' | 'admin' } | null;
  today_attendance?: {
    id: number | null;
    date: string;
    display_status: AttendanceDisplayStatus;
    status: AttendanceStatus | null;
    check_in: string | null;
    check_out: string | null;
    worked_minutes: number | null;
    late_by_minutes: number | null;
    overtime_minutes: number | null;
  };
}

export interface Shift {
  id: number;
  company_id: number;
  name: string;
  start_time: string;
  end_time: string;
  grace_period_minutes: number;
  break_minutes: number;
  working_days: number[] | null;
}

export interface ShiftPayload {
  company_id?: number;
  name: string;
  start_time: string;
  end_time: string;
  grace_period_minutes?: number;
  break_minutes?: number;
  working_days?: number[] | null;
}

export interface Department {
  id: number;
  company_id: number;
  name: string;
  description: string | null;
  employee_count: number;
  company?: { id: number; name: string } | null;
}

export interface DepartmentPayload {
  company_id?: number;
  name: string;
  description?: string | null;
}

export interface EmployeePayload {
  company_id?: number;
  user_id?: number | null;
  employee_code?: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  department?: string | null;
  designation?: string | null;
  employment_type?: EmploymentType;
  shift_id?: number | null;
  shift_start_time?: string | null;
  shift_end_time?: string | null;
  salary?: number | null;
  join_date?: string | null;
  status?: EmployeeStatus;
}

export interface Attendance {
  id: number;
  employee_id: number;
  company_id: number | null;
  date: string;
  department: string | null;
  shift_id: number | null;
  shift_name: string | null;
  scheduled_check_in: string | null;
  scheduled_check_out: string | null;
  grace_period_minutes: number | null;
  break_minutes: number | null;
  check_in: string | null;
  check_out: string | null;
  late_by_minutes: number | null;
  early_leave_by_minutes: number | null;
  // Raw check-out minus check-in, before break is subtracted — distinct
  // from worked_minutes (net, after break).
  gross_minutes: number | null;
  worked_minutes: number | null;
  overtime_minutes: number | null;
  is_missing_checkout: boolean;
  source: AttendanceSource;
  is_manual_override: boolean;
  manual_time?: boolean;
  manual_entered_by?: string | null;
  manual_reason?: string | null;
  manual_created_at?: string | null;
  status: AttendanceStatus;
  notes: string | null;
  employee?: { id: number; name: string; employee_code: string | null; department?: string | null };
}

export interface AttendanceSummary {
  total_employees: number;
  present: number;
  late: number;
  absent: number;
  leave: number;
  half_day: number;
  holiday: number;
  off_day: number;
  not_checked_in: number;
  currently_working: number;
  checked_out: number;
  off_today: number;
}

export interface LiveAttendanceEntry {
  id: number;
  name: string;
  employee_code: string | null;
  department: string | null;
  check_in: string | null;
  check_out: string | null;
  status: AttendanceStatus | null;
}

export interface LiveAttendance {
  checked_in: LiveAttendanceEntry[];
  not_checked_in: LiveAttendanceEntry[];
  currently_working: LiveAttendanceEntry[];
  checked_out: LiveAttendanceEntry[];
  late: LiveAttendanceEntry[];
}

export interface AttendanceHistoryEntry {
  id: number;
  user_id: number | null;
  old_values: Record<string, unknown>;
  new_values: Record<string, unknown>;
  created_at: string;
}

export interface AttendanceCalendarDay {
  date: string;
  status: AttendanceStatus | null;
  check_in: string | null;
  check_out: string | null;
  worked_minutes: number | null;
  late_by_minutes: number | null;
  overtime_minutes: number | null;
}

export interface AttendanceCalendar {
  days: AttendanceCalendarDay[];
  stats: Record<string, number>;
  total_worked_minutes: number;
  total_overtime_minutes: number;
  total_late_minutes: number;
  attendance_percentage: number;
}

export interface AttendancePolicy {
  id: number;
  company_id: number;
  half_day_threshold_minutes: number;
  full_day_threshold_minutes: number;
  overtime_enabled: boolean;
  overtime_threshold_minutes: number | null;
  default_grace_period_minutes: number;
  default_working_days: number[] | null;
  // Salary deduction: % of one day's pay deducted per occurrence beyond
  // the matching free_*_allowed count, applied when Payroll is generated.
  late_deduction_percent: string;
  half_day_deduction_percent: string;
  absent_deduction_percent: string;
  off_day_deduction_percent: string;
  free_late_allowed: number;
  free_half_day_allowed: number;
  free_absent_allowed: number;
  free_off_day_allowed: number;
}

// Write shape differs from the read shape only for the decimal percent
// fields — the backend casts those to strings on the way out (Laravel
// decimal cast), but validates+accepts plain numbers on the way in.
export type AttendancePolicyPayload = Partial<Omit<AttendancePolicy,
  'id' | 'company_id' | 'late_deduction_percent' | 'half_day_deduction_percent' | 'absent_deduction_percent' | 'off_day_deduction_percent'
> & {
  late_deduction_percent: number;
  half_day_deduction_percent: number;
  absent_deduction_percent: number;
  off_day_deduction_percent: number;
}>;

export interface AttendanceDeductionBreakdownEntry {
  count: number;
  free_allowed: number;
  billable_count: number;
  percent: number;
  amount: number;
}

export interface AttendanceDeductionPreview {
  daily_rate: number;
  working_days_in_month: number;
  breakdown: {
    late: AttendanceDeductionBreakdownEntry;
    half_day: AttendanceDeductionBreakdownEntry;
    absent: AttendanceDeductionBreakdownEntry;
    off_day: AttendanceDeductionBreakdownEntry;
  };
  total: number;
}

export interface LeaveRequestRecord {
  id: number;
  employee_id: number;
  leave_type: LeaveType;
  from_date: string;
  to_date: string;
  total_days: number | null;
  reason: string | null;
  status: LeaveStatus;
  employee?: { id: number; name: string; employee_code?: string | null; department?: string | null };
}

export interface Payroll {
  id: number;
  employee_id: number;
  month_year: string;
  basic_salary: number;
  allowances: number;
  deductions: number;
  // Auto-calculated from that month's Attendance (Late/Half Day/Absent
  // beyond the company's free allowance) — separate from `deductions`
  // (manual: loans, penalties, etc.).
  attendance_deduction: number;
  attendance_deduction_breakdown: AttendanceDeductionPreview['breakdown'] | null;
  net_pay: number;
  status: PayrollStatus;
  paid_at: string | null;
  employee?: { id: number; name: string; employee_code?: string | null; department?: string | null; company?: { id: number; name: string } };
}

export interface Recruitment {
  id: number;
  company_id: number;
  position: string;
  department: string | null;
  openings: number;
  description: string | null;
  status: RecruitmentStatus;
  applicants_count?: number;
  applicants?: JobApplicant[];
}

export interface JobApplicant {
  id: number;
  recruitment_id: number;
  name: string;
  email: string | null;
  phone: string | null;
  resume_path: string | null;
  status: ApplicantStatus;
  notes: string | null;
}

export interface EmployeeNote {
  id: number;
  employee_id: number;
  body: string;
  created_at: string;
  author_admin?: { id: number; name: string } | null;
}

export interface EmployeeDocument {
  id: number;
  title: string;
  file_name: string | null;
  file_size_bytes: number | null;
  created_at: string;
}

export interface HrActivityEntry {
  id: number;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  created_at: string;
}

export interface HrDashboardStats {
  total_employees: number;
  active_employees: number;
  on_leave_employees: number;
  terminated_employees: number;
  pending_leave_requests: number;
  attendance_today: { present: number; absent: number; late: number };
  open_recruitment_postings: number;
  payroll_pending: number;
  recent_activity: HrActivityEntry[];
}

export const adminHrService = {
  dashboard: async (): Promise<HrDashboardStats> => (await api.get('/admin/hr/dashboard')).data.data,

  reports: {
    headcount: async (): Promise<Record<string, number>> => (await api.get('/admin/hr/reports/headcount')).data.data,
    attendanceSummary: async (params?: Record<string, string>): Promise<Record<string, number>> =>
      (await api.get('/admin/hr/reports/attendance-summary', { params })).data.data,
    leaveSummary: async (): Promise<{ by_status: Record<string, number>; by_type: Record<string, number> }> =>
      (await api.get('/admin/hr/reports/leave-summary')).data.data,
  },

  employees: {
    list: async (params?: Record<string, string>): Promise<Employee[]> => (await api.get('/admin/employees', { params })).data.data,
    getOne: async (id: number): Promise<Employee> => (await api.get(`/admin/employees/${id}`)).data.data,
    create: async (payload: EmployeePayload): Promise<Employee> => (await api.post('/admin/employees', payload)).data.data,
    update: async (id: number, payload: Partial<EmployeePayload>): Promise<Employee> => (await api.put(`/admin/employees/${id}`, payload)).data.data,
    // Status change only — employee stays visible everywhere (Terminated
    // badge). Separate from remove() (below), which soft-deletes and
    // removes them from every default list.
    deactivate: async (id: number): Promise<Employee> => (await api.patch(`/admin/employees/${id}/deactivate`)).data.data,
    reactivate: async (id: number): Promise<Employee> => (await api.patch(`/admin/employees/${id}/reactivate`)).data.data,
    remove: async (id: number): Promise<void> => { await api.delete(`/admin/employees/${id}`); },

    documents: {
      list: async (employeeId: number): Promise<EmployeeDocument[]> => (await api.get(`/admin/employees/${employeeId}/documents`)).data.data,
      upload: async (employeeId: number, file: File, title: string): Promise<EmployeeDocument> => {
        const form = new FormData();
        form.append('file', file);
        form.append('title', title);
        return (await api.post(`/admin/employees/${employeeId}/documents`, form, { headers: { 'Content-Type': 'multipart/form-data' } })).data.data;
      },
      remove: async (employeeId: number, documentId: number): Promise<void> => {
        await api.delete(`/admin/employees/${employeeId}/documents/${documentId}`);
      },
    },

    notes: {
      list: async (employeeId: number): Promise<EmployeeNote[]> => (await api.get(`/admin/employees/${employeeId}/notes`)).data.data,
      add: async (employeeId: number, body: string): Promise<EmployeeNote> => (await api.post(`/admin/employees/${employeeId}/notes`, { body })).data.data,
    },
  },

  departments: {
    list: async (params?: Record<string, string>): Promise<Department[]> => (await api.get('/admin/departments', { params })).data.data,
    create: async (payload: DepartmentPayload): Promise<Department> => (await api.post('/admin/departments', payload)).data.data,
    update: async (id: number, payload: Partial<DepartmentPayload>): Promise<Department> => (await api.put(`/admin/departments/${id}`, payload)).data.data,
    remove: async (id: number): Promise<void> => { await api.delete(`/admin/departments/${id}`); },
  },

  shifts: {
    list: async (): Promise<Shift[]> => (await api.get('/admin/shifts')).data.data,
    create: async (payload: ShiftPayload): Promise<Shift> => (await api.post('/admin/shifts', payload)).data.data,
    update: async (id: number, payload: Partial<ShiftPayload>): Promise<Shift> => (await api.put(`/admin/shifts/${id}`, payload)).data.data,
    remove: async (id: number): Promise<void> => { await api.delete(`/admin/shifts/${id}`); },
  },

  attendance: {
    list: async (params?: Record<string, string>): Promise<Attendance[]> => (await api.get('/admin/attendance', { params })).data.data,
    mark: async (payload: { employee_id: number; date: string; status?: AttendanceStatus; check_in?: string | null; check_out?: string | null; notes?: string }): Promise<Attendance> =>
      (await api.post('/admin/attendance/mark', payload)).data.data,
    checkInEmployee: async (employeeId: number, payload: { time_mode?: 'current' | 'manual'; time?: string; date?: string; reason?: string; note?: string }): Promise<Attendance> =>
      (await api.post(`/admin/attendance/employees/${employeeId}/check-in`, payload)).data.data,
    checkOutEmployee: async (employeeId: number, payload: { time_mode?: 'current' | 'manual'; time?: string; reason?: string; note?: string }): Promise<Attendance> =>
      (await api.post(`/admin/attendance/employees/${employeeId}/check-out`, payload)).data.data,
    correct: async (id: number, payload: { status?: AttendanceStatus; check_in?: string | null; check_out?: string | null; notes?: string | null; reason: string }): Promise<Attendance> =>
      (await api.post(`/admin/attendance/${id}/correct`, payload)).data.data,
    history: async (id: number): Promise<AttendanceHistoryEntry[]> => (await api.get(`/admin/attendance/${id}/history`)).data.data,
    bulkMark: async (date: string, entries: { employee_id: number; status: AttendanceStatus }[]): Promise<Attendance[]> =>
      (await api.post('/admin/attendance/bulk-mark', { date, entries })).data.data,
    summary: async (date?: string): Promise<AttendanceSummary> => (await api.get('/admin/attendance/summary', { params: date ? { date } : undefined })).data.data,
    live: async (): Promise<LiveAttendance> => (await api.get('/admin/attendance/live')).data.data,
    syncNow: async (date?: string): Promise<void> => { await api.post('/admin/attendance/sync-now', date ? { date } : {}); },
    calendar: async (employeeId: number, month: number, year: number): Promise<AttendanceCalendar> =>
      (await api.get('/admin/attendance/calendar', { params: { employee_id: employeeId, month, year } })).data.data,
    policy: {
      get: async (): Promise<AttendancePolicy> => (await api.get('/admin/attendance/policy')).data.data,
      update: async (payload: AttendancePolicyPayload): Promise<AttendancePolicy> => (await api.put('/admin/attendance/policy', payload)).data.data,
    },
  },

  leaves: {
    list: async (params?: Record<string, string>): Promise<LeaveRequestRecord[]> => (await api.get('/admin/leaves', { params })).data.data,
    create: async (payload: { employee_id: number; leave_type: LeaveType; from_date: string; to_date: string; reason?: string }): Promise<LeaveRequestRecord> =>
      (await api.post('/admin/leaves', payload)).data.data,
    updateStatus: async (id: number, status: 'approved' | 'rejected'): Promise<LeaveRequestRecord> =>
      (await api.patch(`/admin/leaves/${id}/status`, { status })).data.data,
  },

  payroll: {
    list: async (params?: Record<string, string>): Promise<Payroll[]> => (await api.get('/admin/payroll', { params })).data.data,
    create: async (payload: { employee_id: number; month_year: string; basic_salary: number; allowances?: number; deductions?: number; attendance_deduction?: number; attendance_deduction_breakdown?: AttendanceDeductionPreview['breakdown'] | null }): Promise<Payroll> =>
      (await api.post('/admin/payroll', payload)).data.data,
    // Draft records only — the backend rejects this once a record is
    // processed/paid (a payroll statement stops being an editable form the
    // moment it's been acted on).
    update: async (id: number, payload: Partial<{ basic_salary: number; allowances: number; deductions: number; attendance_deduction: number; attendance_deduction_breakdown: AttendanceDeductionPreview['breakdown'] | null }>): Promise<Payroll> =>
      (await api.put(`/admin/payroll/${id}`, payload)).data.data,
    process: async (id: number): Promise<Payroll> => (await api.patch(`/admin/payroll/${id}/process`)).data.data,
    markPaid: async (id: number): Promise<Payroll> => (await api.patch(`/admin/payroll/${id}/mark-paid`)).data.data,
    payslip: async (id: number): Promise<Payroll> => (await api.get(`/admin/payroll/${id}/payslip`)).data.data,
    deductionPreview: async (employeeId: number, monthYear: string, basicSalary: number): Promise<AttendanceDeductionPreview> =>
      (await api.get('/admin/payroll/deduction-preview', { params: { employee_id: employeeId, month_year: monthYear, basic_salary: basicSalary } })).data.data,
  },

  recruitment: {
    list: async (params?: Record<string, string>): Promise<Recruitment[]> => (await api.get('/admin/recruitment', { params })).data.data,
    create: async (payload: { company_id: number; position: string; department?: string; openings?: number; description?: string }): Promise<Recruitment> =>
      (await api.post('/admin/recruitment', payload)).data.data,
    getOne: async (id: number): Promise<Recruitment> => (await api.get(`/admin/recruitment/${id}`)).data.data,
    update: async (id: number, payload: Partial<{ position: string; department: string; openings: number; description: string; status: RecruitmentStatus }>): Promise<Recruitment> =>
      (await api.put(`/admin/recruitment/${id}`, payload)).data.data,
    remove: async (id: number): Promise<void> => { await api.delete(`/admin/recruitment/${id}`); },

    addApplicant: async (recruitmentId: number, payload: { name: string; email?: string; phone?: string; notes?: string }): Promise<JobApplicant> =>
      (await api.post(`/admin/recruitment/${recruitmentId}/applicants`, payload)).data.data,
    updateApplicantStatus: async (recruitmentId: number, applicantId: number, status: ApplicantStatus): Promise<JobApplicant> =>
      (await api.patch(`/admin/recruitment/${recruitmentId}/applicants/${applicantId}/status`, { status })).data.data,
  },
};
