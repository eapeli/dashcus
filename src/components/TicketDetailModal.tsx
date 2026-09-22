import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { uploadToDiscord } from '@/lib/discordBridge';
import { useAuth } from '@/lib/auth';
import type { Ticket, Message, Department, Profile } from '@/lib/types';
import { STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS, PRIORITY_DOT, CATEGORY_LABELS } from '@/lib/types';
import {
  X,
  Send,
  Image as ImageIcon,
  Paperclip,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Mic,
  Video,
  User,
  MessageSquare,
} from 'lucide-react';

interface TicketDetailModalProps {
  ticket: Ticket;
  onClose: () => void;
  onUpdate: () => void;
}

export default function TicketDetailModal({ ticket, onClose, onUpdate }: TicketDetailModalProps) {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [agents, setAgents] = useState<Profile[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [action, setAction] = useState<'none' | 'transfer' | 'close'>('none');
  const [transferDept, setTransferDept] = useState<string>('');
  const [transferAgent, setTransferAgent] = useState<string>('');
  const [transferReason, setTransferReason] = useState('');
  const [closeReason, setCloseReason] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [feedbackSuccess, setFeedbackSuccess] = useState<'resolved' | 'unresolved' | ''>('');
  const [feedbackText, setFeedbackText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const [msgRes, deptRes, agentRes] = await Promise.all([
        supabase.from('messages').select('*').eq('ticket_id', ticket.id).order('created_at', { ascending: true }),
        supabase.from('departments').select('*'),
        supabase.from('profiles').select('*'),
      ]);
      setMessages(msgRes.data || []);
      setDepartments(deptRes.data || []);
      setAgents(agentRes.data || []);
      setLoading(false);
    })();

    const sub = supabase
      .channel(`messages-${ticket.id}`)
      .on('postgres_changes' as const, { event: 'INSERT', schema: 'public', table: 'messages', filter: `ticket_id=eq.${ticket.id}` }, (payload: { new: Message }) => {
        setMessages(prev => [...prev, payload.new]);
      })
      .on('postgres_changes' as const, { event: '*', schema: 'public', table: 'tickets', filter: `id=eq.${ticket.id}` }, () => {
        onUpdate();
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [ticket.id, onUpdate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getDeptName = (id: string | null) => departments.find(d => d.id === id)?.name || '—';
  const getDeptColor = (id: string | null) => departments.find(d => d.id === id)?.color || '#64748b';

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatWaitTime = (openedAt: string) => {
    const diff = Date.now() - new Date(openedAt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}min`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}min`;
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !profile) return;
    setSending(true);
    setError(null);
    const { error } = await supabase.from('messages').insert({
      ticket_id: ticket.id,
      sender_type: 'agent',
      sender_id: profile.id,
      sender_name: profile.full_name,
      content: newMessage.trim(),
      attachment_type: 'none',
    });
    if (error) {
      setError('Erro ao enviar mensagem');
    } else {
      setNewMessage('');
      await supabase.from('ticket_events').insert({
        ticket_id: ticket.id,
        event_type: 'message_sent',
        actor_id: profile.id,
        actor_name: profile.full_name,
        details: { message_type: 'text' },
      });
    }
    setSending(false);
  };

  const handleTransfer = async () => {
    if (!profile) return;
    if (!transferDept) {
      setError('Selecione um departamento');
      return;
    }
    setAction('transfer');
    setError(null);
    const update: Record<string, unknown> = {
      status: 'transferred',
      transfer_reason: transferReason || 'Transferido sem justificativa',
      transferred_to: transferAgent || null,
    };
    if (transferAgent) {
      update.assigned_to = transferAgent;
    }
    if (transferDept !== ticket.department_id) {
      update.department_id = transferDept;
    }
    const { error } = await supabase.from('tickets').update(update).eq('id', ticket.id);
    if (error) {
      setError('Erro ao transferir ticket');
    } else {
      const targetDept = departments.find(d => d.id === transferDept);
      const targetAgent = agents.find(a => a.id === transferAgent);
      await supabase.from('ticket_events').insert({
        ticket_id: ticket.id,
        event_type: 'transferred',
        actor_id: profile.id,
        actor_name: profile.full_name,
        details: {
          to_department: targetDept?.name,
          to_agent: targetAgent?.full_name,
          reason: transferReason,
        },
      });
      await supabase.from('messages').insert({
        ticket_id: ticket.id,
        sender_type: 'system',
        sender_name: 'Sistema',
        content: `Ticket transferido para ${targetDept?.name || 'outro departamento'}${targetAgent ? ` — Atendente: ${targetAgent.full_name}` : ''}. Motivo: ${transferReason || 'Não informado'}`,
        attachment_type: 'none',
      });
      setAction('none');
      setTransferDept('');
      setTransferAgent('');
      setTransferReason('');
      onUpdate();
    }
  };

  const handleClose = async () => {
    if (!profile) return;
    if (!feedbackSuccess) {
      setError('Informe se o caso foi resolvido ou não');
      return;
    }
    setAction('close');
    setError(null);
    const { error } = await supabase.from('tickets').update({
      status: 'closed',
      closed_at: new Date().toISOString(),
      close_reason: closeReason || (feedbackSuccess === 'resolved' ? 'Resolvido' : 'Não resolvido'),
      close_notes: closeNotes,
      feedback_success: feedbackSuccess === 'resolved',
      feedback_text: feedbackText.trim() || null,
    }).eq('id', ticket.id);

    if (error) {
      setError('Erro ao fechar ticket');
    } else {
      await supabase.from('ticket_events').insert({
        ticket_id: ticket.id,
        event_type: 'closed',
        actor_id: profile.id,
        actor_name: profile.full_name,
        details: { reason: closeReason, notes: closeNotes, storage: 'discord' },
      });
      await supabase.from('messages').insert({
        ticket_id: ticket.id,
        sender_type: 'system',
        sender_name: 'Sistema',
        content: `Ticket fechado por ${profile.full_name}. Feedback: ${feedbackSuccess === 'resolved' ? 'Caso resolvido com sucesso' : 'Caso não resolvido'}.${feedbackText.trim() ? ` Observação: ${feedbackText.trim()}` : ''} O transcript será gerado automaticamente no canal de transcripts do Discord.`,
        attachment_type: 'none',
      });
      setAction('none');
      setCloseReason('');
      setCloseNotes('');
      setFeedbackSuccess('');
      setFeedbackText('');
      onUpdate();
      onClose();
    }
  };

  const handleAttachment = (type: 'image' | 'audio' | 'video' | 'file') => {
    if (!profile) return;
    const input = document.createElement('input');
    input.type = 'file';
    if (type === 'image') input.accept = 'image/*';
    if (type === 'audio') input.accept = 'audio/*';
    if (type === 'video') input.accept = 'video/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setSending(true);
      try {
        const discordAttachment = await uploadToDiscord({
          ticket,
          file,
          attachmentType: type,
          senderId: profile.id,
          senderName: profile.full_name,
        });
        await supabase.from('messages').insert({
          ticket_id: ticket.id,
          sender_type: 'agent',
          sender_id: profile.id,
          sender_name: profile.full_name,
          content: `[Anexo enviado ao Discord: ${discordAttachment.name || file.name}]`,
          attachment_type: 'none',
        });
      } catch (uploadError) {
        console.error('Discord attachment upload error:', uploadError);
        setError('Não foi possível enviar o arquivo para o Discord.');
      }
      setSending(false);
    };
    input.click();
  };

  const isAssigned = ticket.assigned_to === profile?.id;
  const canAct = isAssigned || ticket.status === 'waiting';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-1 h-10 rounded-full"
              style={{ backgroundColor: getDeptColor(ticket.department_id) }}
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-400">#{ticket.ticket_number}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[ticket.status]}`}>
                  {STATUS_LABELS[ticket.status]}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${PRIORITY_COLORS[ticket.priority]}`}>
                  <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${PRIORITY_DOT[ticket.priority]}`} />
                  {PRIORITY_LABELS[ticket.priority]}
                </span>
              </div>
              <h3 className="font-bold text-gray-900 mt-0.5">{ticket.subject}</h3>
              <p className="text-xs text-gray-500">
                {ticket.customer_name} — {getDeptName(ticket.department_id)} — {CATEGORY_LABELS[ticket.category]}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body: chat + sidebar */}
        <div className="flex-1 flex overflow-hidden">
          {/* Chat area */}
          <div className="flex-1 flex flex-col">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto bg-gray-50 p-4 space-y-3">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <MessageSquare className="w-12 h-12 mb-2 text-gray-300" />
                  <p>Nenhuma mensagem ainda</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isAgent = msg.sender_type === 'agent';
                  const isSystem = msg.sender_type === 'system';
                  if (isSystem) {
                    return (
                      <div key={msg.id} className="flex justify-center">
                        <div className="px-4 py-2 bg-gray-200 rounded-full text-xs text-gray-600 max-w-md text-center">
                          {msg.content}
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={msg.id} className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-md ${isAgent ? 'order-2' : ''}`}>
                        <div className={`px-4 py-2.5 rounded-2xl ${
                          isAgent
                            ? 'bg-blue-600 text-white rounded-br-sm'
                            : 'bg-white text-gray-800 border border-gray-200 rounded-bl-sm'
                        }`}>
                          <p className="text-xs font-medium mb-1 opacity-70">{msg.sender_name}</p>
                          {msg.content && <p className="text-sm whitespace-pre-wrap">{msg.content}</p>}
                          {msg.attachment_type === 'image' && msg.attachment_url && (
                            <img src={msg.attachment_url} alt={msg.attachment_name || ''} className="mt-2 rounded-lg max-w-full" />
                          )}
                          {msg.attachment_type === 'audio' && msg.attachment_url && (
                            <audio controls src={msg.attachment_url} className="mt-2 w-full" />
                          )}
                          {msg.attachment_type === 'video' && msg.attachment_url && (
                            <video controls src={msg.attachment_url} className="mt-2 rounded-lg max-w-full" />
                          )}
                          {msg.attachment_type === 'file' && msg.attachment_url && (
                            <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-2 text-sm underline">
                              <Paperclip className="w-4 h-4" /> {msg.attachment_name || 'Arquivo'}
                            </a>
                          )}
                        </div>
                        <p className={`text-xs text-gray-400 mt-1 ${isAgent ? 'text-right' : ''}`}>
                          {formatTime(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Error */}
            {error && (
              <div className="px-4 py-2 bg-red-50 border-t border-red-100 text-sm text-red-600">
                {error}
              </div>
            )}

            {/* Input area */}
            <div className="border-t border-gray-100 p-3 bg-white">
              <div className="flex items-center gap-2">
                <div className="relative group">
                  <button className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <div className="absolute bottom-full left-0 mb-2 bg-white rounded-xl shadow-lg border border-gray-200 py-2 w-48 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                    <button onClick={() => handleAttachment('image')} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      <ImageIcon className="w-4 h-4 text-blue-500" /> Imagem
                    </button>
                    <button onClick={() => handleAttachment('audio')} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      <Mic className="w-4 h-4 text-emerald-500" /> Áudio
                    </button>
                    <button onClick={() => handleAttachment('video')} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      <Video className="w-4 h-4 text-purple-500" /> Vídeo
                    </button>
                    <button onClick={() => handleAttachment('file')} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      <FileText className="w-4 h-4 text-orange-500" /> Arquivo
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Digite sua mensagem..."
                  className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-blue-400 transition-colors"
                />

                <button
                  onClick={sendMessage}
                  disabled={sending || !newMessage.trim()}
                  className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Action sidebar */}
          <div className="w-72 border-l border-gray-100 bg-white p-4 overflow-y-auto flex-shrink-0">
            <h4 className="text-sm font-bold text-gray-700 mb-3">Ações do Ticket</h4>

            {/* Ticket info */}
            <div className="space-y-3 mb-4">
              <InfoRow icon={User} label="Cliente" value={ticket.customer_name} />
              <InfoRow icon={Clock} label="Tempo em aberto" value={formatWaitTime(ticket.opened_at)} />
              <InfoRow icon={FileText} label="Departamento" value={getDeptName(ticket.department_id)} />
              {ticket.picked_up_at && (
                <InfoRow icon={Clock} label="Pego em" value={new Date(ticket.picked_up_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} />
              )}
              {ticket.closed_at && (
                <InfoRow icon={CheckCircle2} label="Fechado em" value={new Date(ticket.closed_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} />
              )}
            </div>

            {/* Description */}
            {ticket.description && (
              <div className="mb-4 p-3 bg-gray-50 rounded-xl">
                <p className="text-xs font-medium text-gray-500 mb-1">Descrição</p>
                <p className="text-sm text-gray-700">{ticket.description}</p>
              </div>
            )}

            {/* Actions */}
            {canAct && ticket.status !== 'closed' && ticket.status !== 'resolved' && (
              <div className="space-y-2">
                {ticket.status === 'in_progress' && (
                  <>
                    <button
                      onClick={() => setAction(action === 'transfer' ? 'none' : 'transfer')}
                      className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                        action === 'transfer'
                          ? 'bg-purple-600 text-white'
                          : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                      }`}
                    >
                      <ArrowRightLeft className="w-4 h-4" />
                      Transferir
                    </button>

                    {action === 'transfer' && (
                      <div className="p-3 bg-purple-50 rounded-xl space-y-2">
                        <select
                          value={transferDept}
                          onChange={(e) => setTransferDept(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-purple-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:border-purple-400"
                        >
                          <option value="">Departamento...</option>
                          {departments.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                        <select
                          value={transferAgent}
                          onChange={(e) => setTransferAgent(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-purple-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:border-purple-400"
                        >
                          <option value="">Atendente (opcional)...</option>
                          {agents.filter(a => a.id !== profile?.id).map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.full_name}{a.discord_username ? ` @${a.discord_username}` : ''}
                            </option>
                          ))}
                        </select>
                        <textarea
                          value={transferReason}
                          onChange={(e) => setTransferReason(e.target.value)}
                          placeholder="Motivo da transferência..."
                          rows={2}
                          className="w-full px-3 py-2 bg-white border border-purple-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:border-purple-400 resize-none"
                        />
                        <button
                          onClick={handleTransfer}
                          className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-500 transition-colors"
                        >
                          Confirmar Transferência
                        </button>
                      </div>
                    )}

                    <button
                      onClick={() => setAction(action === 'close' ? 'none' : 'close')}
                      className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                        action === 'close'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Fechar Ticket
                    </button>

                    {action === 'close' && (
                      <div className="p-3 bg-emerald-50 rounded-xl space-y-3">
                        <div>
                          <p className="text-xs font-semibold text-emerald-700 mb-2">O caso foi resolvido com sucesso?</p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setFeedbackSuccess('resolved')}
                              className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium border-2 transition-all ${
                                feedbackSuccess === 'resolved'
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-white text-emerald-700 border-emerald-200 hover:border-emerald-400'
                              }`}
                            >
                              <CheckCircle2 className="w-4 h-4 inline mr-1.5" />
                              Sim, resolvido
                            </button>
                            <button
                              type="button"
                              onClick={() => setFeedbackSuccess('unresolved')}
                              className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium border-2 transition-all ${
                                feedbackSuccess === 'unresolved'
                                  ? 'bg-red-500 text-white border-red-500'
                                  : 'bg-white text-red-600 border-red-200 hover:border-red-400'
                              }`}
                            >
                              <X className="w-4 h-4 inline mr-1.5" />
                              Não, sem solução
                            </button>
                          </div>
                        </div>
                        <textarea
                          value={feedbackText}
                          onChange={(e) => setFeedbackText(e.target.value)}
                          placeholder="Breve feedback do atendimento (opcional)..."
                          rows={2}
                          className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:border-emerald-400 resize-none"
                        />
                        <input
                          value={closeReason}
                          onChange={(e) => setCloseReason(e.target.value)}
                          placeholder="Motivo do fechamento (opcional)"
                          className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:border-emerald-400"
                        />
                        <textarea
                          value={closeNotes}
                          onChange={(e) => setCloseNotes(e.target.value)}
                          placeholder="Notas internas de fechamento..."
                          rows={2}
                          className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:border-emerald-400 resize-none"
                        />
                        <p className="text-xs text-emerald-600">
                          O transcript completo será gerado automaticamente e enviado ao canal de transcripts do Discord.
                        </p>
                        <button
                          onClick={handleClose}
                          disabled={action === 'close' && !feedbackSuccess}
                          className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-500 transition-colors disabled:opacity-50"
                        >
                          Confirmar Fechamento
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {ticket.status === 'closed' && (
              <div className="p-3 bg-gray-50 rounded-xl">
                <p className="text-xs font-medium text-gray-500 mb-2">Transcript</p>
                <p className="text-sm text-gray-600">O transcript completo foi arquivado no canal de transcripts do Discord.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-gray-500" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm text-gray-700 font-medium truncate">{value}</p>
      </div>
    </div>
  );
}
