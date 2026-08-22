import { Component, ReactNode, ErrorInfo } from 'react';
import { AppProvider, useApp } from './store/AppContext';
import LoginPage from './pages/LoginPage';
import ManagerDashboard from './pages/manager/ManagerDashboard';
import EmployeeDashboard from './pages/employee/EmployeeDashboard';
import SuperAdminPage from './pages/SuperAdminPage';

class AppErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App crashed, falling back to login:', error, info);
  }

  render() {
    if (this.state.hasError) return <LoginPage />;
    return this.props.children;
  }
}

function AppRouter() {
  const { session } = useApp();

  if (!session) return <LoginPage />;

  if (session.role === 'superadmin') {
    return <SuperAdminPage />;
  } else if (session.role === 'manager') {
    return <ManagerDashboard />;
  } else {
    return <EmployeeDashboard />;
  }
}

export default function App() {
  return (
    <AppProvider>
      <AppErrorBoundary>
        <AppRouter />
      </AppErrorBoundary>
    </AppProvider>
  );
}
