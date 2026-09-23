import api from '@/lib/axios';
import type {
  Employee, EmployeePayload, Attendance, AttendanceStatus, LeaveRequestRecord, LeaveType,
  Payroll, Recruitment, JobApplicant, ApplicantStatus, EmployeeNote, EmployeeDocument,
  HrDashboardStats, Shift, ShiftPayload, AttendanceSummary, LiveAttendance,
  AttendanceHistoryEntry, AttendanceCalendar, AttendancePolicy, AttendancePolicyPayload,
  AttendanceDeductionPreview, Department, DepartmentPayload,
} from './adminHrService';

// Staff-side counterpart to adminHrService.ts — same shapes, hits
// /user/... instead of /admin/..., and omits the few actions this role
// doesn't have (payroll draft creation/mark-paid, attendance bulk-mark)
// since no Api\User route exists for them; the corresponding UI simply
// never renders those buttons.
export const hrService = {
  dashboard: async (): Promise<HrDashboardStats> => (await api.get('/user/hr/dashboard')).data.data,

  employees: {
    list: async (params?: Record<string, string>): Promise<Employee[]> => (await api.get('/user/employees', { params })).data.data,
    getOne: async (id: number): Promise<Employee> => (await api.get(`/user/employees/${id}`)).data.data,
    create: async (payload: EmployeePayload): Promise<Employee> => (await api.post('/user/employees', payload)).data.data,
    update: async (id: number, payload: Partial<EmployeePayload>): Promise<Employee> => (await api.put(`/user/employees/${id}`, payload)).data.data,
    deactivate: async (id: number): Promise<Employee> => (await api.patch(`/user/employees/${id}/deactivate`)).data.data,
    reactivate: async (id: number): Promise<Employee> => (await api.patch(`/user/employees/${id}/reactivate`)).data.data,
    remove: async (id: number): Promise<void> => { await api.delete(`/user/employees/${id}`); },

    documents: {
      list: async (employeeId: number): Promise<EmployeeDocument[]> => (await api.get(`/user/employees/${employeeId}/documents`)).data.data,
      upload: async (employeeId: number, file: File, title: string): Promise<EmployeeDocument> => {
        const form = new FormData();
        form.append('file', file);
        form.append('title', title);
        return (await api.post(`/user/employees/${employeeId}/documents`, form, { headers: { 'Content-Type': 'multipart/form-data' } })).data.data;
      },
      remove: async (employeeId: number, documentId: number): Promise<void> => {
        await api.delete(`/user/employees/${employeeId}/documents/${documentId}`);
      },
    },

    notes: {
      list: async (employeeId: number): Promise<EmployeeNote[]> => (await api.get(`/user/employees/${employeeId}/notes`)).data.data,
      add: async (employeeId: number, body: string): Promise<EmployeeNote> => (await api.post(`/user/employees/${employeeId}/notes`, { body })).data.data,
    },
  },

  departments: {
    list: async (params?: Record<string, string>): Promise<Department[]> => (await api.get('/user/departments', { params })).data.data,
    create: async (payload: DepartmentPayload): Promise<Department> => (await api.post('/user/departments', payload)).data.data,
    update: async (id: number, payload: Partial<DepartmentPayload>): Promise<Department> => (await api.put(`/user/departments/${id}`, payload)).data.data,
    remove: async (id: number): Promise<void> => { await api.delete(`/user/departments/${id}`); },
  },

  shifts: {
    list: async (): Promise<Shift[]> => (await api.get('/user/shifts')).data.data,
    create: async (payload: ShiftPayload): Promise<Shift> => (await api.post('/user/shifts', payload)).data.data,
    update: async (id: number, payload: Partial<ShiftPayload>): Promise<Shift> => (await api.put(`/user/shifts/${id}`, payload)).data.data,
    remove: async (id: number): Promise<void> => { await api.delete(`/user/shifts/${id}`); },
  },

  attendance: {
    list: async (params?: Record<string, string>): Promise<Attendance[]> => (await api.get('/user/attendance', { params })).data.data,
    mark: async (payload: { employee_id: number; date: string; status?: AttendanceStatus; check_in?: string | null; check_out?: string | null; notes?: string }): Promise<Attendance> =>
      (await api.post('/user/attendance/mark', payload)).data.data,
    checkInEmployee: async (employeeId: number, payload: { time_mode?: 'current' | 'manual'; time?: string; date?: string; reason?: string; note?: string }): Promise<Attendance> =>
      (await api.post(`/user/attendance/employees/${employeeId}/check-in`, payload)).data.data,
    checkOutEmployee: async (employeeId: number, payload: { time_mode?: 'current' | 'manual'; time?: string; reason?: string; note?: string }): Promise<Attendance> =>
      (await api.post(`/user/attendance/employees/${employeeId}/check-out`, payload)).data.data,
    correct: async (id: number, payload: { status?: AttendanceStatus; check_in?: string | null; check_out?: string | null; notes?: string | null; reason: string }): Promise<Attendance> =>
      (await api.post(`/user/attendance/${id}/correct`, payload)).data.data,
    history: async (id: number): Promise<AttendanceHistoryEntry[]> => (await api.get(`/user/attendance/${id}/history`)).data.data,
    summary: async (date?: string): Promise<AttendanceSummary> => (await api.get('/user/attendance/summary', { params: date ? { date } : undefined })).data.data,
    live: async (): Promise<LiveAttendance> => (await api.get('/user/attendance/live')).data.data,
    syncNow: async (date?: string): Promise<void> => { await api.post('/user/attendance/sync-now', date ? { date } : {}); },
    calendar: async (employeeId: number, month: number, year: number): Promise<AttendanceCalendar> =>
      (await api.get('/user/attendance/calendar', { params: { employee_id: employeeId, month, year } })).data.data,
    checkIn: async (): Promise<Attendance> => (await api.post('/user/attendance/check-in')).data.data,
    checkOut: async (): Promise<Attendance> => (await api.post('/user/attendance/check-out')).data.data,
    policy: {
      get: async (): Promise<AttendancePolicy> => (await api.get('/user/attendance/policy')).data.data,
      update: async (payload: AttendancePolicyPayload): Promise<AttendancePolicy> => (await api.put('/user/attendance/policy', payload)).data.data,
    },
  },

  leaves: {
    list: async (params?: Record<string, string>): Promise<LeaveRequestRecord[]> => (await api.get('/user/leaves', { params })).data.data,
    create: async (payload: { employee_id: number; leave_type: LeaveType; from_date: string; to_date: string; reason?: string }): Promise<LeaveRequestRecord> =>
      (await api.post('/user/leaves', payload)).data.data,
    updateStatus: async (id: number, status: 'approved' | 'rejected'): Promise<LeaveRequestRecord> =>
      (await api.patch(`/user/leaves/${id}/status`, { status })).data.data,
  },

  payroll: {
    list: async (params?: Record<string, string>): Promise<Payroll[]> => (await api.get('/user/payroll', { params })).data.data,
    update: async (id: number, payload: Partial<{ basic_salary: number; allowances: number; deductions: number; attendance_deduction: number; attendance_deduction_breakdown: AttendanceDeductionPreview['breakdown'] | null }>): Promise<Payroll> =>
      (await api.put(`/user/payroll/${id}`, payload)).data.data,
    process: async (id: number): Promise<Payroll> => (await api.patch(`/user/payroll/${id}/process`)).data.data,
    payslip: async (id: number): Promise<Payroll> => (await api.get(`/user/payroll/${id}/payslip`)).data.data,
    deductionPreview: async (employeeId: number, monthYear: string, basicSalary: number): Promise<AttendanceDeductionPreview> =>
      (await api.get('/user/payroll/deduction-preview', { params: { employee_id: employeeId, month_year: monthYear, basic_salary: basicSalary } })).data.data,
  },

  recruitment: {
    list: async (params?: Record<string, string>): Promise<Recruitment[]> => (await api.get('/user/recruitment', { params })).data.data,
    create: async (payload: { position: string; department?: string; openings?: number; description?: string }): Promise<Recruitment> =>
      (await api.post('/user/recruitment', payload)).data.data,
    getOne: async (id: number): Promise<Recruitment> => (await api.get(`/user/recruitment/${id}`)).data.data,
    update: async (id: number, payload: Partial<{ position: string; department: string; openings: number; description: string; status: Recruitment['status'] }>): Promise<Recruitment> =>
      (await api.put(`/user/recruitment/${id}`, payload)).data.data,
    remove: async (id: number): Promise<void> => { await api.delete(`/user/recruitment/${id}`); },

    addApplicant: async (recruitmentId: number, payload: { name: string; email?: string; phone?: string; notes?: string }): Promise<JobApplicant> =>
      (await api.post(`/user/recruitment/${recruitmentId}/applicants`, payload)).data.data,
    updateApplicantStatus: async (recruitmentId: number, applicantId: number, status: ApplicantStatus): Promise<JobApplicant> =>
      (await api.patch(`/user/recruitment/${recruitmentId}/applicants/${applicantId}/status`, { status })).data.data,
  },
};
