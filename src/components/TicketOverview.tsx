import type { DragEvent } from 'react';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import type { Profile, Ticket } from '@/lib/types';
import { Archive, Clock3, GripVertical, Inbox, UserCheck } from 'lucide-react';

interface TicketOverviewProps {
  tickets: Ticket[];
  profiles: Profile[];
}

export default function TicketOverview({ tickets, profiles }: TicketOverviewProps) {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'open' | 'closed'>('open');
  const openTickets = tickets
    .filter((ticket) => ticket.assigned_to === profile?.id && ticket.status !== 'closed' && ticket.status !== 'resolved')
    .sort((a, b) => new Date(a.opened_at).getTime() - new Date(b.opened_at).getTime());
  const closedTickets = tickets
    .filter((ticket) => ticket.assigned_to === profile?.id && (ticket.status === 'closed' || ticket.status === 'resolved'))
    .sort((a, b) => new Date(b.closed_at || b.opened_at).getTime() - new Date(a.closed_at || a.opened_at).getTime())
    .slice(0, 8);

  const getProfileName = (profileId: string | null) => {
    if (!profileId) return 'Não atribuído';
    return profiles.find((profile) => profile.id === profileId)?.full_name || 'Atendente não identificado';
  };

  const handleDragStart = (event: DragEvent<HTMLDivElement>, ticketId: string) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', ticketId);
  };

  return (
    <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Acompanhamento</p>
          <h3 className="font-bold text-gray-900 mt-1">Visão geral dos tickets</h3>
          <p className="text-sm text-gray-500 mt-1">Acompanhe os tickets que você assumiu.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('open')}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${activeTab === 'open' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            <Inbox className="w-3.5 h-3.5" />
            Tickets abertos
            <span className="px-1.5 py-0.5 rounded-full bg-white/20">{openTickets.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('closed')}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${activeTab === 'closed' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            <Archive className="w-3.5 h-3.5" />
            Finalizados
            <span className="px-1.5 py-0.5 rounded-full bg-black/10">{closedTickets.length}</span>
          </button>
        </div>
      </div>

      <div className="p-5">
        {activeTab === 'open' ? (
          <div className="flex items-center gap-2 mb-3">
            <Inbox className="w-4 h-4 text-blue-600" />
            <h4 className="text-sm font-bold text-gray-900">Tickets abertos que você assumiu</h4>
          </div>
        ) : (
          <div className="flex items-center gap-2 mb-3">
            <Archive className="w-4 h-4 text-emerald-600" />
            <h4 className="text-sm font-bold text-gray-900">Tickets finalizados por você</h4>
          </div>
        )}

        {activeTab === 'open' ? (
          openTickets.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">Você ainda não assumiu tickets em aberto.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {openTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  draggable
                  onDragStart={(event) => handleDragStart(event, ticket.id)}
                  className="flex items-center gap-2 p-3 rounded-xl border border-gray-200 bg-gray-50 hover:border-blue-300 hover:bg-blue-50 cursor-grab active:cursor-grabbing transition-colors"
                  title="Arraste para uma categoria do quadro"
                >
                  <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-gray-400">#{ticket.ticket_number}</span>
                      <span className={`text-[10px] font-semibold ${ticket.status === 'in_progress' ? 'text-blue-600' : 'text-amber-600'}`}>
                        {ticket.status === 'in_progress' ? 'Em atendimento' : 'Aguardando'}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-gray-800 truncate mt-1">{ticket.subject}</p>
                    <p className="text-[11px] text-gray-500 truncate mt-0.5">{ticket.customer_name}</p>
                  </div>
                  <UserCheck className={`w-4 h-4 flex-shrink-0 ${ticket.assigned_to ? 'text-emerald-500' : 'text-gray-300'}`} />
                </div>
              ))}
            </div>
          )
        ) : (
          closedTickets.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">Você ainda não finalizou tickets.</p>
          ) : (
            <div className="space-y-2">
              {closedTickets.map((ticket) => (
                <div key={ticket.id} className="flex items-center gap-3 px-3 py-3 rounded-lg bg-gray-50 border border-gray-100">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-gray-800 truncate">#{ticket.ticket_number} {ticket.customer_name}</p>
                    <p className="text-xs text-gray-700 truncate mt-1" title={ticket.subject}>{ticket.subject}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-[11px] text-gray-500 truncate">Atendido por {getProfileName(ticket.assigned_to)}</p>
                      <span className={`text-[10px] font-semibold whitespace-nowrap ${ticket.feedback_success === true ? 'text-emerald-600' : ticket.feedback_success === false ? 'text-red-600' : 'text-gray-500'}`}>
                        {ticket.feedback_success === true ? 'Resolvido' : ticket.feedback_success === false ? 'Não resolvido' : 'Resultado não informado'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-gray-500 whitespace-nowrap">
                    <Clock3 className="w-3 h-3" />
                    {ticket.closed_at ? new Date(ticket.closed_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Sem horário'}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </section>
  );
}
