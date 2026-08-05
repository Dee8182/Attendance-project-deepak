export interface Company {
  id: string;
  name: string;
  logo_url?: string;
  theme_primary: string;
  theme_secondary: string;
  pf_esi_enabled: boolean;
  status?: string;
  created_at: string;
}

export interface PayrollPayment {
  id: string;
  company_id: string;
  employee_id: string;
  month: string;
  base_salary: number;
  pf_deduction: number;
  esi_deduction: number;
  net_salary: number;
  status: 'pending' | 'paid';
  paid_at?: string;
  reference_id?: string;
  created_at: string;
}

export interface Manager {
  id: string;
  company_id: string;
  manager_id: string;
  pin: string;
  name: string;
  email?: string;
  created_at: string;
}

export interface Employee {
  id: string;
  company_id: string;
  employee_id: string;
  pin: string;
  name: string;
  role?: string;
  department?: string;
  phone?: string;
  email?: string;
  salary: number;
  avatar_url?: string;
  work_location_name?: string;
  work_lat?: number;
  work_lng?: number;
  work_radius: number;
  is_pf_enabled: boolean;
  is_esi_enabled: boolean;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface AttendanceRecord {
  id: string;
  company_id: string;
  employee_id: string;
  date: string;
  check_in_time?: string;
  check_out_time?: string;
  status: 'present' | 'absent' | 'on_leave' | 'late';
  notes?: string;
  created_at: string;
}

export interface LeaveRequest {
  id: string;
  company_id: string;
  employee_id: string;
  leave_type: 'sick' | 'casual' | 'annual';
  start_date: string;
  end_date: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface HelpDeskTicket {
  id: string;
  company_id: string;
  employee_id: string;
  subject: string;
  message?: string;
  status: 'pending' | 'resolved' | 'rejected';
  response?: string;
  responded_at?: string;
  created_at: string;
}

export interface SalaryAdvance {
  id: string;
  company_id: string;
  employee_id: string;
  amount: number;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface PlaylistSong {
  id: string;
  company_id: string;
  title: string;
  artist: string;
  file_name?: string;
  file_size?: number;
  duration: number;
  audio_data?: string;
  added_by?: string;
  created_at: string;
}

export interface WalletTransaction {
  id: string;
  company_id: string;
  amount: number;
  payment_method: string;
  reference_id: string;
  status: string;
  note?: string;
  created_at: string;
}

export interface CompanyWallet {
  id: string;
  company_id: string;
  balance: number;
  updated_at: string;
}

export interface SuperAdminLog {
  id: string;
  type: 'error' | 'info';
  message: string;
  details?: string;
  context?: string;
  created_at: string;
}

export type UserRole = 'manager' | 'employee' | 'superadmin';

export interface AppSession {
  role: UserRole;
  company?: Company;
  manager?: Manager;
  employee?: Employee;
}
