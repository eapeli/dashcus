import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Department, Ticket } from '@/lib/types';
import { Inbox, Loader2, Users } from 'lucide-react';

export default function TicketListView() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadQueue = async () => {
      const [{ data: ticketData }, { data: departmentData }] = await Promise.all([
        supabase.from('tickets').select('*').eq('status', 'waiting'),
        supabase.from('departments').select('*'),
      ]);
      setTickets(ticketData || []);
      setDepartments(departmentData || []);
      setLoading(false);
    };

    void loadQueue();

    const sub = supabase
      .channel('waiting-ticket-counts')
      .on('postgres_changes' as const, { event: '*', schema: 'public', table: 'tickets' }, () => {
        void loadQueue();
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, []);

  const departmentCounts = useMemo(() => {
    const counts = departments.map((department) => ({
      ...department,
      count: tickets.filter((ticket) => ticket.department_id === department.id).length,
    }));
    const withoutDepartment = tickets.filter((ticket) => !ticket.department_id).length;

    if (withoutDepartment > 0) {
      counts.push({
        id: 'without-department',
        name: 'Sem departamento',
        description: '',
        color: '#64748b',
        discord_channel_id: null,
        created_at: '',
        count: withoutDepartment,
      });
    }

    return counts;
  }, [departments, tickets]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 flex items-start gap-3">
        <Inbox className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="font-bold text-gray-900">Fila de atendimento</h3>
          <p className="text-sm text-gray-600 mt-1">
            Consulte a quantidade de tickets aguardando por setor. Para iniciar um atendimento, use o botão <strong>Pegar atendimento</strong> no topo.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="font-bold text-gray-900">Tickets aguardando por setor</h3>
            <p className="text-xs text-gray-500 mt-0.5">Total na fila: {tickets.length}</p>
          </div>
        </div>

        {departmentCounts.length === 0 ? (
          <div className="px-5 py-16 text-center text-gray-400">
            <Inbox className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>Nenhum departamento cadastrado</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {departmentCounts.map((department) => (
              <div key={department.id} className="px-5 py-5 flex items-center gap-4">
                <span className="w-1.5 h-12 rounded-full flex-shrink-0" style={{ backgroundColor: department.color }} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{department.name}</p>
                  <p className="text-xs text-gray-500 mt-1">Tickets aguardando atendimento</p>
                </div>
                <span className="min-w-12 px-3 py-2 rounded-xl bg-amber-100 text-amber-700 text-center text-lg font-bold">
                  {department.count}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}