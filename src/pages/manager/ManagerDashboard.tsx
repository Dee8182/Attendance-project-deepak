import { useState } from 'react';
import ManagerLayout from './ManagerLayout';
import ManagerHome from './ManagerHome';
import EmployeesPage from './EmployeesPage';
import AttendancePage from './AttendancePage';
import PayrollPage from './PayrollPage';
import AnalyticsPage from './AnalyticsPage';
import PlaylistPage from './PlaylistPage';
import HelpDeskPage from './HelpDeskPage';
import SettingsPage from './SettingsPage';

type ManagerPage = 'dashboard' | 'employees' | 'attendance' | 'payroll' | 'analytics' | 'playlist' | 'helpdesk' | 'settings';

export default function ManagerDashboard() {
  const [page, setPage] = useState<ManagerPage>('dashboard');

  function navigate(p: string) {
    setPage(p as ManagerPage);
  }

  return (
    <ManagerLayout currentPage={page} onNavigate={setPage}>
      {page === 'dashboard' && <ManagerHome onNavigate={navigate} />}
      {page === 'employees' && <EmployeesPage />}
      {page === 'attendance' && <AttendancePage />}
      {page === 'payroll' && <PayrollPage />}
      {page === 'analytics' && <AnalyticsPage />}
      {page === 'playlist' && <PlaylistPage />}
      {page === 'helpdesk' && <HelpDeskPage />}
      {page === 'settings' && <SettingsPage />}
    </ManagerLayout>
  );
}
