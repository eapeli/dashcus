import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Profile, Department, Ticket } from '@/lib/types';
import { Loader2, Circle, Users, Award, TrendingUp } from 'lucide-react';

export default function TeamView() {
  const [agents, setAgents] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [agentRes, deptRes, ticketRes] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('departments').select('*'),
        supabase.from('tickets').select('*'),
      ]);
      setAgents(agentRes.data || []);
      setDepartments(deptRes.data || []);
      setTickets(ticketRes.data || []);
      setLoading(false);
    })();

    const sub = supabase
      .channel('profiles-team')
      .on('postgres_changes' as const, { event: '*', schema: 'public', table: 'profiles' }, () => {
        supabase.from('profiles').select('*').then(({ data }) => {
          if (data) setAgents(data);
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  const onlineAgents = agents.filter(a => a.status === 'online');
  const awayAgents = agents.filter(a => a.status === 'away');
  const offlineAgents = agents.filter(a => a.status === 'offline');

  const getDeptName = (id: string | null) => departments.find(d => d.id === id)?.name || 'Sem departamento';
  const getDeptColor = (id: string | null) => departments.find(d => d.id === id)?.color || '#64748b';

  const getAgentStats = (agentId: string) => {
    const agentTickets = tickets.filter(t => t.assigned_to === agentId);
    const closed = agentTickets.filter(t => t.status === 'closed' || t.status === 'resolved');
    const inProgress = agentTickets.filter(t => t.status === 'in_progress');
    return { total: agentTickets.length, closed: closed.length, inProgress: inProgress.length };
  };

  const statusColor = {
    online: 'text-emerald-400 fill-emerald-400',
    away: 'text-amber-400 fill-amber-400',
    offline: 'text-slate-400 fill-slate-400',
  };

  const statusLabel = {
    online: 'Disponível',
    away: 'Ausente',
    offline: 'Offline',
  };

  const AgentCard = ({ agent }: { agent: Profile }) => {
    const initials = agent.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
    const stats = getAgentStats(agent.id);
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white font-bold">
              {initials}
            </div>
            <Circle className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white ${statusColor[agent.status]}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 truncate">{agent.full_name}</p>
            <p className="text-xs text-gray-500">{statusLabel[agent.status]}</p>
          </div>
          <span className="text-xs font-medium text-gray-400 capitalize px-2 py-1 bg-gray-100 rounded-full">
            {agent.role === 'admin' ? 'Admin' : agent.role === 'supervisor' ? 'Supervisor' : 'Atendente'}
          </span>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: getDeptColor(agent.department_id) }}
          />
          <p className="text-sm text-gray-600 truncate">{getDeptName(agent.department_id)}</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-2.5 bg-gray-50 rounded-xl">
            <p className="text-xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-xs text-gray-500">Total</p>
          </div>
          <div className="text-center p-2.5 bg-blue-50 rounded-xl">
            <p className="text-xl font-bold text-blue-600">{stats.inProgress}</p>
            <p className="text-xs text-gray-500">Ativos</p>
          </div>
          <div className="text-center p-2.5 bg-emerald-50 rounded-xl">
            <p className="text-xl font-bold text-emerald-600">{stats.closed}</p>
            <p className="text-xs text-gray-500">Resolvidos</p>
          </div>
        </div>

        {agent.discord_username && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-500">
            <span className="font-medium">Discord:</span>
            <span>{agent.discord_username}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900">{agents.length}</p>
              <p className="text-sm text-gray-500">Total da Equipe</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Circle className="w-6 h-6 text-emerald-500 fill-emerald-500" />
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900">{onlineAgents.length}</p>
              <p className="text-sm text-gray-500">Disponíveis</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
              <Circle className="w-6 h-6 text-amber-500 fill-amber-500" />
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900">{awayAgents.length}</p>
              <p className="text-sm text-gray-500">Ausentes</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center">
              <Circle className="w-6 h-6 text-gray-400 fill-gray-400" />
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900">{offlineAgents.length}</p>
              <p className="text-sm text-gray-500">Offline</p>
            </div>
          </div>
        </div>
      </div>

      {/* Online agents */}
      {onlineAgents.length > 0 && (
        <div>
          <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Circle className="w-3 h-3 text-emerald-500 fill-emerald-500" />
            Disponíveis Agora
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {onlineAgents.map(agent => <AgentCard key={agent.id} agent={agent} />)}
          </div>
        </div>
      )}

      {/* Away agents */}
      {awayAgents.length > 0 && (
        <div>
          <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Circle className="w-3 h-3 text-amber-500 fill-amber-500" />
            Ausentes
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {awayAgents.map(agent => <AgentCard key={agent.id} agent={agent} />)}
          </div>
        </div>
      )}

      {/* Offline agents */}
      {offlineAgents.length > 0 && (
        <div>
          <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Circle className="w-3 h-3 text-gray-400 fill-gray-400" />
            Offline
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {offlineAgents.map(agent => <AgentCard key={agent.id} agent={agent} />)}
          </div>
        </div>
      )}

      {agents.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Users className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p>Nenhum atendente cadastrado ainda</p>
        </div>
      )}
    </div>
  );
}
