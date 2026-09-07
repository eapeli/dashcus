import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Ticket, TicketStatus, Department } from '@/lib/types';
import { STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS, PRIORITY_DOT, CATEGORY_LABELS } from '@/lib/types';
import { Clock, Loader2, Filter, Inbox, UserCheck, CheckCircle2, FolderKanban } from 'lucide-react';

interface TicketListViewProps {
  onSelectTicket: (ticket: Ticket) => void;
}

type FilterTab = 'all' | 'waiting' | 'in_progress' | 'mine' | 'closed';

export default function TicketListView({ onSelectTicket }: TicketListViewProps) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('waiting');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: ticketData }, { data: deptData }, { data: userData }] = await Promise.all([
        supabase.from('tickets').select('*').order('opened_at', { ascending: false }),
        supabase.from('departments').select('*'),
        supabase.auth.getUser(),
      ]);
      setTickets(ticketData || []);
      setDepartments(deptData || []);
      setCurrentUserId(userData?.user?.id || null);
      setLoading(false);
    })();

    const sub = supabase
      .channel('tickets-list')
      .on('postgres_changes' as const, { event: '*', schema: 'public', table: 'tickets' }, () => {
        supabase.from('tickets').select('*').order('opened_at', { ascending: false }).then(({ data }) => {
          if (data) setTickets(data);
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, []);

  const getDeptName = (id: string | null) => departments.find(d => d.id === id)?.name || '—';
  const getDeptColor = (id: string | null) => departments.find(d => d.id === id)?.color || '#64748b';

  const formatWaitTime = (openedAt: string) => {
    const diff = Date.now() - new Date(openedAt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}min`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}min`;
  };

  const filtered = tickets.filter((t) => {
    if (activeTab === 'waiting' && t.status !== 'waiting') return false;
    if (activeTab === 'in_progress' && t.status !== 'in_progress') return false;
    if (activeTab === 'mine' && t.assigned_to !== currentUserId) return false;
    if (activeTab === 'closed' && t.status !== 'closed' && t.status !== 'resolved') return false;
    if (deptFilter !== 'all' && t.department_id !== deptFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        t.subject.toLowerCase().includes(q) ||
        t.customer_name.toLowerCase().includes(q) ||
        String(t.ticket_number).includes(q)
      );
    }
    return true;
  });

  const tabs: { id: FilterTab; label: string; icon: typeof Inbox; count: number }[] = [
    { id: 'waiting', label: 'Aguardando', icon: Inbox, count: tickets.filter(t => t.status === 'waiting').length },
    { id: 'in_progress', label: 'Em Atendimento', icon: UserCheck, count: tickets.filter(t => t.status === 'in_progress').length },
    { id: 'mine', label: 'Meus Tickets', icon: FolderKanban, count: tickets.filter(t => t.assigned_to === currentUserId).length },
    { id: 'closed', label: 'Resolvidos', icon: CheckCircle2, count: tickets.filter(t => t.status === 'closed' || t.status === 'resolved').length },
    { id: 'all', label: 'Todos', icon: Filter, count: tickets.length },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                active
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300 hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                active ? 'bg-white/20' : 'bg-gray-100 text-gray-500'
              }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:border-blue-400 transition-colors"
        >
          <option value="all">Todos os departamentos</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por assunto, cliente ou número..."
          className="flex-1 min-w-48 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-blue-400 transition-colors"
        />
      </div>

      {/* Ticket list */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-5 py-16 text-center text-gray-400">
            <Inbox className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>Nenhum ticket encontrado</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map((ticket) => (
              <button
                key={ticket.id}
                onClick={() => onSelectTicket(ticket)}
                className="w-full px-5 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors text-left group"
              >
                <div
                  className="w-1 h-14 rounded-full flex-shrink-0"
                  style={{ backgroundColor: getDeptColor(ticket.department_id) }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-gray-400">#{ticket.ticket_number}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[ticket.status]}`}>
                      {STATUS_LABELS[ticket.status]}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${PRIORITY_COLORS[ticket.priority]}`}>
                      <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${PRIORITY_DOT[ticket.priority]}`} />
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
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 justify-end">
                    <Clock className="w-3.5 h-3.5" />
                    {formatWaitTime(ticket.opened_at)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
