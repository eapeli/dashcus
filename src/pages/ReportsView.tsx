import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Ticket, Profile, Department } from '@/lib/types';
import { STATUS_LABELS, PRIORITY_LABELS, CATEGORY_LABELS } from '@/lib/types';
import { Loader2, TrendingUp, Calendar, Award, Clock, CheckCircle2, BarChart3, Users } from 'lucide-react';

export default function ReportsView() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [agents, setAgents] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('month');

  useEffect(() => {
    (async () => {
      const [ticketRes, agentRes, deptRes] = await Promise.all([
        supabase.from('tickets').select('*').order('opened_at', { ascending: false }),
        supabase.from('profiles').select('*'),
        supabase.from('departments').select('*'),
      ]);
      setTickets(ticketRes.data || []);
      setAgents(agentRes.data || []);
      setDepartments(deptRes.data || []);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const periodStart = period === 'today' ? todayStart : period === 'week' ? weekAgo : monthAgo;
  const periodTickets = tickets.filter(t => t.opened_at >= periodStart);
  const closedTickets = periodTickets.filter(t => t.status === 'closed' || t.status === 'resolved');

  const avgResolutionTime = closedTickets.length > 0
    ? closedTickets.reduce((sum, t) => {
        if (t.closed_at) {
          return sum + (new Date(t.closed_at).getTime() - new Date(t.opened_at).getTime());
        }
        return sum;
      }, 0) / closedTickets.length / 60000
    : 0;

  // Agent performance
  const agentStats = agents.map(agent => {
    const agentTickets = periodTickets.filter(t => t.assigned_to === agent.id);
    const agentClosed = agentTickets.filter(t => t.status === 'closed' || t.status === 'resolved');
    const avgTime = agentClosed.length > 0
      ? agentClosed.reduce((sum, t) => t.closed_at ? sum + (new Date(t.closed_at).getTime() - new Date(t.opened_at).getTime()) : sum, 0) / agentClosed.length / 60000
      : 0;
    return {
      agent,
      total: agentTickets.length,
      closed: agentClosed.length,
      avgTime,
      deptName: departments.find(d => d.id === agent.department_id)?.name || '—',
    };
  }).sort((a, b) => b.closed - a.closed);

  // Category breakdown
  const categoryStats = (Object.keys(CATEGORY_LABELS) as Array<keyof typeof CATEGORY_LABELS>).map(cat => ({
    label: CATEGORY_LABELS[cat],
    count: periodTickets.filter(t => t.category === cat).length,
  }));

  // Daily chart data (last 7 days)
  const dailyData = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(now.getTime() - (6 - i) * 24 * 60 * 60 * 1000);
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate()).toISOString();
    const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).toISOString();
    const count = tickets.filter(t => t.opened_at >= dayStart && t.opened_at < dayEnd).length;
    return {
      label: day.toLocaleDateString('pt-BR', { weekday: 'short' }),
      count,
    };
  });
  const maxDaily = Math.max(...dailyData.map(d => d.count), 1);

  const departmentStats = departments.map((department) => {
    const departmentTickets = periodTickets.filter((ticket) => ticket.department_id === department.id);
    return {
      ...department,
      total: departmentTickets.length,
      waiting: departmentTickets.filter((ticket) => ticket.status === 'waiting').length,
    };
  });
  const maxDepartmentTickets = Math.max(...departmentStats.map((department) => department.total), 1);

  const formatMinutes = (mins: number) => {
    if (mins < 60) return `${Math.round(mins)}min`;
    return `${Math.floor(mins / 60)}h ${Math.round(mins % 60)}min`;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Period selector */}
      <div className="flex items-center gap-2">
        {(['today', 'week', 'month'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              period === p
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
            }`}
          >
            <Calendar className="w-4 h-4" />
            {p === 'today' ? 'Hoje' : p === 'week' ? 'Semana' : 'Mês'}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard icon={TrendingUp} label="Total de Tickets" value={periodTickets.length} color="blue" />
        <SummaryCard icon={CheckCircle2} label="Resolvidos" value={closedTickets.length} color="emerald" />
        <SummaryCard icon={Clock} label="Aguardando" value={periodTickets.filter(t => t.status === 'waiting').length} color="amber" />
        <SummaryCard icon={Clock} label="Tempo Médio" value={formatMinutes(avgResolutionTime)} color="slate" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily chart */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-gray-900">Tickets por Dia (Últimos 7 dias)</h3>
          </div>
          <div className="flex items-end justify-between gap-2 h-48">
            {dailyData.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex-1 flex items-end">
                  <div
                    className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-lg transition-all duration-500 relative group"
                    style={{ height: `${(d.count / maxDaily) * 100}%`, minHeight: '4px' }}
                  >
                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity">
                      {d.count}
                    </span>
                  </div>
                </div>
                <span className="text-xs text-gray-500 capitalize">{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Category breakdown */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-gray-900">Tickets por Categoria</h3>
          </div>
          <div className="space-y-3">
            {categoryStats.map((cat) => {
              const pct = periodTickets.length > 0 ? (cat.count / periodTickets.length) * 100 : 0;
              return (
                <div key={cat.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-700">{cat.label}</span>
                    <span className="text-sm font-bold text-gray-900">{cat.count}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Department breakdown */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-gray-700" />
          <div>
            <h3 className="font-bold text-gray-900">Tickets por Departamento</h3>
            <p className="text-xs text-gray-500 mt-0.5">Distribuição no período selecionado</p>
          </div>
        </div>
        <div className="space-y-3">
          {departmentStats.map((department) => (
            <div key={department.id} className="flex items-center gap-3">
              <div className="w-32 flex-shrink-0">
                <p className="text-sm font-medium text-gray-700 truncate">{department.name}</p>
              </div>
              <div className="flex-1 h-8 bg-gray-100 rounded-lg overflow-hidden relative">
                <div
                  className="h-full rounded-lg transition-all duration-500 flex items-center justify-end px-2"
                  style={{ width: `${Math.max((department.total / maxDepartmentTickets) * 100, department.total > 0 ? 8 : 0)}%`, backgroundColor: department.color }}
                >
                  {department.total > 0 && <span className="text-xs font-bold text-white">{department.total}</span>}
                </div>
              </div>
              <div className="w-24 text-right text-xs text-amber-600 font-medium">
                {department.waiting} aguardando
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Agent performance table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-500" />
          <h3 className="font-bold text-gray-900">Desempenho dos Atendentes</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                <th className="px-5 py-3 text-left font-medium">Atendente</th>
                <th className="px-5 py-3 text-left font-medium">Departamento</th>
                <th className="px-5 py-3 text-center font-medium">Total</th>
                <th className="px-5 py-3 text-center font-medium">Resolvidos</th>
                <th className="px-5 py-3 text-center font-medium">Taxa Resolução</th>
                <th className="px-5 py-3 text-center font-medium">Tempo Médio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {agentStats.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-gray-400">
                    Nenhum atendente cadastrado
                  </td>
                </tr>
              ) : agentStats.map((stat, i) => {
                const rate = stat.total > 0 ? Math.round((stat.closed / stat.total) * 100) : 0;
                const initials = stat.agent.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
                return (
                  <tr key={stat.agent.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white font-bold text-xs">
                          {initials}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{stat.agent.full_name}</p>
                          {i === 0 && stat.closed > 0 && (
                            <span className="text-xs text-amber-600 font-medium">Destaque do período</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{stat.deptName}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-700 text-center font-medium">{stat.total}</td>
                    <td className="px-5 py-3.5 text-sm text-emerald-600 text-center font-bold">{stat.closed}</td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        rate >= 70 ? 'bg-emerald-100 text-emerald-700' :
                        rate >= 40 ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {rate}%
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600 text-center">{formatMinutes(stat.avgTime)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color }: {
  icon: typeof TrendingUp;
  label: string;
  value: string | number;
  color: 'blue' | 'emerald' | 'amber' | 'slate';
}) {
  const colors = {
    blue: { bg: 'bg-blue-50', icon: 'text-blue-600', border: 'border-blue-100' },
    emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', border: 'border-emerald-100' },
    amber: { bg: 'bg-amber-50', icon: 'text-amber-600', border: 'border-amber-100' },
    slate: { bg: 'bg-slate-50', icon: 'text-slate-600', border: 'border-slate-100' },
  };
  const c = colors[color];
  return (
    <div className={`bg-white rounded-2xl border ${c.border} shadow-sm p-5`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl ${c.bg} flex items-center justify-center`}>
          <Icon className={`w-6 h-6 ${c.icon}`} />
        </div>
      </div>
    </div>
  );
}
