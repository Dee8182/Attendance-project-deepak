import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AppSession, Company } from '../types';

interface AppContextType {
  session: AppSession | null;
  setSession: (session: AppSession | null) => void;
  updateCompanyBranding: (updates: Partial<Pick<Company, 'name' | 'logo_url' | 'theme_primary' | 'theme_secondary' | 'pf_esi_enabled'>>) => void;
}

const AppContext = createContext<AppContextType | null>(null);

function applyTheme(primary: string, secondary: string) {
  document.documentElement.style.setProperty('--color-primary', primary);
  document.documentElement.style.setProperty('--color-secondary', secondary);
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSessionRaw] = useState<AppSession | null>(null);

  function setSession(s: AppSession | null) {
    setSessionRaw(s);
    if (s?.company) {
      applyTheme(s.company.theme_primary ?? '#f59e0b', s.company.theme_secondary ?? '#1e293b');
    } else {
      applyTheme('#f59e0b', '#1e293b');
    }
  }

  function updateCompanyBranding(updates: Partial<Pick<Company, 'name' | 'logo_url' | 'theme_primary' | 'theme_secondary' | 'pf_esi_enabled'>>) {
    if (!session?.company) return;
    const updatedCompany = { ...session.company, ...updates };
    setSessionRaw({ ...session, company: updatedCompany });
    if (updates.theme_primary || updates.theme_secondary) {
      applyTheme(
        updates.theme_primary ?? session.company?.theme_primary ?? '#f59e0b',
        updates.theme_secondary ?? session.company?.theme_secondary ?? '#1e293b'
      );
    }
  }

  useEffect(() => {
    applyTheme('#f59e0b', '#1e293b');
  }, []);

  return (
    <AppContext.Provider value={{ session, setSession, updateCompanyBranding }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
