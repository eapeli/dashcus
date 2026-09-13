import { useState, useEffect, type CSSProperties } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { Ticket } from '@/lib/types';
import Login from '@/pages/Login';
import Sidebar, { type View } from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import DashboardView from '@/pages/DashboardView';
import TicketListView from '@/pages/TicketListView';
import ReportsView from '@/pages/ReportsView';
import TeamView from '@/pages/TeamView';
import TicketDetailModal from '@/components/TicketDetailModal';
import TeamChat from '@/components/TeamChat';
import { Loader2 } from 'lucide-react';
import {
  DEFAULT_CUSTOMIZATION,
  FONT_FAMILY_VALUES,
  FONT_SIZE_VALUES,
  type CustomizationPreferences,
} from '@/lib/customization';

export type Theme = 'light' | 'dark';

const VIEW_META: Record<View, { title: string; subtitle: string }> = {
  dashboard: { title: 'Painel Geral', subtitle: 'Visão geral do atendimento em tempo real' },
  tickets: { title: 'Fila de Tickets', subtitle: 'Gerencie tickets aguardando e em atendimento' },
  reports: { title: 'Relatórios de Desempenho', subtitle: 'Métricas diárias, semanais e mensais' },
  team: { title: 'Equipe de Atendimento', subtitle: 'Status e desempenho dos atendentes' },
};

function Dashboard() {
  const { session, profile, loading } = useAuth();
  const [view, setView] = useState<View>('dashboard');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('cus-theme') as Theme) || 'light';
  });
  const [customization, setCustomization] = useState<CustomizationPreferences>(DEFAULT_CUSTOMIZATION);
  const [customizationReady, setCustomizationReady] = useState(false);
  const [waitingCount, setWaitingCount] = useState(0);
  const [inProgressCount, setInProgressCount] = useState(0);

  useEffect(() => {
    localStorage.setItem('cus-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!profile) return;
    const saved = localStorage.getItem(`cus-customization-${profile.id}`);
    if (saved) {
      try {
        setCustomization({ ...DEFAULT_CUSTOMIZATION, ...JSON.parse(saved) });
      } catch {
        setCustomization(DEFAULT_CUSTOMIZATION);
      }
    }
    setCustomizationReady(true);
  }, [profile]);

  useEffect(() => {
    if (customizationReady && profile) {
      localStorage.setItem(`cus-customization-${profile.id}`, JSON.stringify(customization));
    }
  }, [customization, customizationReady, profile]);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const { count } = await supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'waiting');
      setWaitingCount(count || 0);
      const { count: ipCount } = await supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'in_progress');
      setInProgressCount(ipCount || 0);
    })();

    const sub = supabase
      .channel('ticket-counts')
      .on('postgres_changes' as const, { event: '*', schema: 'public', table: 'tickets' }, async () => {
        const { count } = await supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'waiting');
        setWaitingCount(count || 0);
        const { count: ipCount } = await supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'in_progress');
        setInProgressCount(ipCount || 0);
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [session]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  const meta = VIEW_META[view];

  return (
    <div
      className={`${theme === 'dark' ? 'dark ' : ''}customized ${customization.backgroundImage ? 'has-wallpaper' : ''} h-screen flex bg-gray-50 overflow-hidden`}
      style={{
        '--app-background': theme === 'dark' && customization.backgroundColor === DEFAULT_CUSTOMIZATION.backgroundColor
          ? '#0f172a'
          : customization.backgroundColor,
        '--sidebar-color': customization.sidebarColor,
        '--accent-color': customization.accentColor,
        '--app-font-size': FONT_SIZE_VALUES[customization.fontSize],
        '--app-font-family': FONT_FAMILY_VALUES[customization.fontFamily],
        backgroundImage: customization.backgroundImage
          ? `linear-gradient(${theme === 'dark' ? 'rgba(15, 23, 42' : 'rgba(255, 255, 255'}, ${1 - customization.backgroundOpacity}), ${theme === 'dark' ? 'rgba(15, 23, 42' : 'rgba(255, 255, 255'}, ${1 - customization.backgroundOpacity})), url("${customization.backgroundImage}")`
          : undefined,
        backgroundSize: customization.backgroundImage ? 'cover' : undefined,
        backgroundPosition: customization.backgroundImage ? 'center' : undefined,
        backgroundAttachment: customization.backgroundImage ? 'fixed' : undefined,
      } as CSSProperties}
    >
      <Sidebar
        currentView={view}
        onNavigate={setView}
        waitingCount={waitingCount}
        inProgressCount={inProgressCount}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar
          title={meta.title}
          subtitle={meta.subtitle}
          theme={theme}
          onThemeChange={setTheme}
          customization={customization}
          onCustomizationChange={setCustomization}
          onTicketPicked={(ticket) => setSelectedTicket(ticket)}
          onSelectTicket={(ticket) => setSelectedTicket(ticket)}
        />
        <main className="flex-1 overflow-y-auto">
          {view === 'dashboard' && (
            <DashboardView
              onSelectTicket={(t) => setSelectedTicket(t)}
            />
          )}
          {view === 'tickets' && (
            <TicketListView />
          )}
          {view === 'reports' && <ReportsView />}
          {view === 'team' && <TeamView />}
        </main>
      </div>

      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onUpdate={async () => {
            const { data } = await supabase.from('tickets').select('*').eq('id', selectedTicket.id).maybeSingle();
            if (data) setSelectedTicket(data);
          }}
        />
      )}

      <TeamChat />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Dashboard />
    </AuthProvider>
  );
}
