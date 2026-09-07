import { useState, useEffect } from 'react';
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
import { Loader2 } from 'lucide-react';

const VIEW_META: Record<View, { title: string; subtitle: string }> = {
  dashboard: { title: 'Painel Geral', subtitle: 'Visão geral do atendimento em tempo real' },
  tickets: { title: 'Fila de Tickets', subtitle: 'Gerencie tickets aguardando e em atendimento' },
  reports: { title: 'Relatórios de Desempenho', subtitle: 'Métricas diárias, semanais e mensais' },
  team: { title: 'Equipe de Atendimento', subtitle: 'Status e desempenho dos atendentes' },
};

function Dashboard() {
  const { session, loading } = useAuth();
  const [view, setView] = useState<View>('dashboard');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [waitingCount, setWaitingCount] = useState(0);
  const [inProgressCount, setInProgressCount] = useState(0);

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
    <div className="h-screen flex bg-gray-50 overflow-hidden">
      <Sidebar
        currentView={view}
        onNavigate={setView}
        waitingCount={waitingCount}
        inProgressCount={inProgressCount}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title={meta.title} subtitle={meta.subtitle} />
        <main className="flex-1 overflow-y-auto">
          {view === 'dashboard' && (
            <DashboardView
              onNavigate={(v) => setView(v)}
              onSelectTicket={(t) => setSelectedTicket(t)}
            />
          )}
          {view === 'tickets' && (
            <TicketListView onSelectTicket={(t) => setSelectedTicket(t)} />
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
