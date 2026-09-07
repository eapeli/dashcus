import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Ticket, TicketStatus } from '@/lib/types';
import { STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS, PRIORITY_DOT, CATEGORY_LABELS } from '@/lib/types';
import type { Department } from '@/lib/types';
import {
  Clock,
  AlertCircle,
  CheckCircle2,
  Loader2,
  TrendingUp,
  Users,
  Ticket as TicketIcon,
  ArrowRight,
} from 'lucide-react';

interface DashboardViewProps {
  onNavigate: (view: 'tickets') => void;
  onSelectTicket: (ticket: Ticket) => void;
}

export default function DashboardView({ onNavigate, onSelectTicket }: DashboardViewProps) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayCount, setTodayCount] = useState(0);
  const [weekCount, setWeekCount] = useState(0);
  const [monthCount, setMonthCount] = useState(0);

  useEffect(() => {
    (async () => {
      const [ticketRes, deptRes] = await Promise.all([
        supabase.from('tickets').select('*').order('opened_at', { ascending: false }),
        supabase.from('departments').select('*'),
      ]);
      setTickets(ticketRes.data || []);
      setDepartments(deptRes.data || []);
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

  const getDeptName = (id: string | null) => departments.find(d => d.id === id)?.name || '—';
  const getDeptColor = (id: string | null) => departments.find(d => d.id === id)?.color || '#64748b';

  const formatWaitTime = (openedAt: string) => {
    const diff = Date.now() - new Date(openedAt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}min`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}min`;
  };

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

      {/* Waiting tickets */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TicketIcon className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-gray-900">Tickets Aguardando Atendimento</h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
              {waiting.length}
            </span>
          </div>
          <button
            onClick={() => onNavigate('tickets')}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Ver todos
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="divide-y divide-gray-50">
          {waiting.length === 0 ? (
            <div className="px-5 py-12 text-center text-gray-400">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>Nenhum ticket aguardando atendimento</p>
            </div>
          ) : (
            waiting.slice(0, 5).map((ticket) => (
              <button
                key={ticket.id}
                onClick={() => onSelectTicket(ticket)}
                className="w-full px-5 py-3.5 flex items-center gap-4 hover:bg-gray-50 transition-colors text-left group"
              >
                <div
                  className="w-1 h-12 rounded-full flex-shrink-0"
                  style={{ backgroundColor: getDeptColor(ticket.department_id) }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-gray-400">#{ticket.ticket_number}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${PRIORITY_COLORS[ticket.priority]}`}>
                      {PRIORITY_LABELS[ticket.priority]}
                    </span>
                    <span className="text-xs text-gray-400">{CATEGORY_LABELS[ticket.category]}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                    {ticket.subject}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {ticket.customer_name} — {getDeptName(ticket.department_id)}
                  </p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
                    <Clock className="w-3.5 h-3.5" />
                    {formatWaitTime(ticket.opened_at)}
                  </div>
                  <div className={`mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[ticket.status]}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[ticket.priority]}`} />
                    {STATUS_LABELS[ticket.status]}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Department breakdown */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-gray-700" />
          <h3 className="font-bold text-gray-900">Tickets por Departamento</h3>
        </div>
        <div className="space-y-3">
          {departments.map((dept) => {
            const deptTickets = tickets.filter(t => t.department_id === dept.id);
            const deptWaiting = deptTickets.filter(t => t.status === 'waiting').length;
            const total = deptTickets.length;
            const pct = tickets.length > 0 ? (total / tickets.length) * 100 : 0;
            return (
              <div key={dept.id} className="flex items-center gap-3">
                <div className="w-32 flex-shrink-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{dept.name}</p>
                </div>
                <div className="flex-1 h-8 bg-gray-100 rounded-lg overflow-hidden relative">
                  <div
                    className="h-full rounded-lg transition-all duration-500 flex items-center justify-end px-2"
                    style={{ width: `${Math.max(pct, 8)}%`, backgroundColor: dept.color }}
                  >
                    <span className="text-xs font-bold text-white">{total}</span>
                  </div>
                </div>
                <div className="w-20 text-right text-xs text-amber-600 font-medium">
                  {deptWaiting} aguardando
                </div>
              </div>
            );
          })}
        </div>
      </div>
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
    <div className={`bg-white rounded-2xl border ${c.border} shadow-sm p-5 hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl ${c.bg} flex items-center justify-center`}>
          <Icon className={`w-6 h-6 ${c.icon}`} />
        </div>
      </div>
    </div>
  );
}

function VolumeCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof TrendingUp }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
        <Icon className="w-6 h-6 text-blue-600" />
      </div>
      <div>
        <p className="text-3xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );
}
