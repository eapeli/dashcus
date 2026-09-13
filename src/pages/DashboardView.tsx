import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Profile, Ticket } from '@/lib/types';
import KanbanBoard from '@/components/KanbanBoard';
import TicketOverview from '@/components/TicketOverview';
import {
  Clock,
  AlertCircle,
  CheckCircle2,
  Loader2,
  TrendingUp,
} from 'lucide-react';

interface DashboardViewProps {
  onSelectTicket: (ticket: Ticket) => void;
}

export default function DashboardView({ onSelectTicket }: DashboardViewProps) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayCount, setTodayCount] = useState(0);
  const [weekCount, setWeekCount] = useState(0);
  const [monthCount, setMonthCount] = useState(0);

  useEffect(() => {
    (async () => {
      const [ticketRes, profileRes] = await Promise.all([
        supabase.from('tickets').select('*').order('opened_at', { ascending: false }),
        supabase.from('profiles').select('*'),
      ]);
      setTickets(ticketRes.data || []);
      setProfiles(profileRes.data || []);
      setLoading(false);
    })();

    const sub = supabase
      .channel('tickets-dashboard')
      .on('postgres_changes' as const, { event: '*', schema: 'public', table: 'tickets' }, () => {
        supabase.from('tickets').select('*').order('opened_at', { ascending: false }).then(({ data }) => {
          if (data) setTickets(data);
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, []);

  useEffect(() => {
    if (tickets.length === 0) return;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    setTodayCount(tickets.filter(t => t.opened_at >= todayStart).length);
    setWeekCount(tickets.filter(t => t.opened_at >= weekAgo).length);
    setMonthCount(tickets.filter(t => t.opened_at >= monthAgo).length);
  }, [tickets]);

  const waiting = tickets.filter(t => t.status === 'waiting');
  const inProgress = tickets.filter(t => t.status === 'in_progress');
  const resolved = tickets.filter(t => t.status === 'resolved' || t.status === 'closed');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Clock}
          label="Aguardando Atendimento"
          value={waiting.length}
          color="amber"
          subtitle="Tickets na fila"
        />
        <StatCard
          icon={Loader2}
          label="Pendente de Resolução"
          value={inProgress.length}
          color="blue"
          subtitle="Em atendimento agora"
        />
        <StatCard
          icon={CheckCircle2}
          label="Resolvidos Hoje"
          value={resolved.length}
          color="emerald"
          subtitle="Concluídos"
        />
        <StatCard
          icon={AlertCircle}
          label="Total Abertos"
          value={tickets.length}
          color="slate"
          subtitle="Todos os tickets"
        />
      </div>

      {/* Volume stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <VolumeCard label="Atendidos Hoje" value={todayCount} icon={TrendingUp} />
        <VolumeCard label="Atendidos na Semana" value={weekCount} icon={TrendingUp} />
        <VolumeCard label="Atendidos no Mês" value={monthCount} icon={TrendingUp} />
      </div>

      {/* Kanban board */}
      <KanbanBoard tickets={tickets} onSelectTicket={onSelectTicket} />

      <TicketOverview tickets={tickets} profiles={profiles} />

    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, subtitle }: {
  icon: typeof Clock;
  label: string;
  value: number;
  color: 'amber' | 'blue' | 'emerald' | 'slate';
  subtitle: string;
}) {
  const colors = {
    amber: { bg: 'bg-amber-50', icon: 'text-amber-500', border: 'border-amber-100' },
    blue: { bg: 'bg-blue-50', icon: 'text-blue-500', border: 'border-blue-100' },
    emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-500', border: 'border-emerald-100' },
    slate: { bg: 'bg-slate-50', icon: 'text-slate-500', border: 'border-slate-100' },
  };
  const c = colors[color];
  return (
    <div className={`bg-white rounded-xl border ${c.border} shadow-sm p-4 hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1.5">{value}</p>
          <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
        </div>
        <div className={`w-10 h-10 rounded-lg ${c.bg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${c.icon}`} />
        </div>
      </div>
    </div>
  );
}

function VolumeCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof TrendingUp }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
        <Icon className="w-5 h-5 text-blue-600" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );
}
