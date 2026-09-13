import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { BellRing, MessageCircle, Send, Volume2, X } from 'lucide-react';

interface TeamMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_role: 'agent' | 'supervisor' | 'admin';
  content: string;
  message_type: 'message' | 'attention';
  created_at: string;
}

function playAttentionSound() {
  const AudioContextClass = window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;

  const audioContext = new AudioContextClass();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(740, audioContext.currentTime);
  oscillator.frequency.setValueAtTime(980, audioContext.currentTime + 0.12);
  gain.gain.setValueAtTime(0.001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.22, audioContext.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.42);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.45);
  oscillator.addEventListener('ended', () => { void audioContext.close(); });
}

export default function TeamChat() {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [unread, setUnread] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isHead = profile?.role === 'admin' || profile?.role === 'supervisor';

  useEffect(() => {
    if (!profile) return;

    const loadMessages = async () => {
      const { data } = await supabase
        .from('team_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(80);
      if (data) setMessages(data.reverse() as TeamMessage[]);
    };

    void loadMessages();

    const sub = supabase
      .channel('team-chat')
      .on('postgres_changes' as const, { event: 'INSERT', schema: 'public', table: 'team_messages' }, (payload: { new: TeamMessage }) => {
        const message = payload.new;
        setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
        if (message.message_type === 'attention') {
          setShaking(true);
          setUnread((current) => current + 1);
          playAttentionSound();
          window.setTimeout(() => setShaking(false), 1600);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [profile]);

  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setUnread(0);
    }
  }, [messages, open]);

  const sendMessage = async (messageType: TeamMessage['message_type'] = 'message') => {
    const content = draft.trim();
    if (!content || !profile) return;

    const { data } = await supabase.from('team_messages').insert({
      sender_id: profile.id,
      sender_name: profile.full_name,
      sender_role: profile.role,
      content,
      message_type: messageType,
    }).select().maybeSingle();

    if (data) {
      setMessages((current) => current.some((item) => item.id === data.id) ? current : [...current, data as TeamMessage]);
      setDraft('');
    }
  };

  const callAttention = async () => {
    if (!isHead || !profile) return;
    const { data } = await supabase.from('team_messages').insert({
      sender_id: profile.id,
      sender_name: profile.full_name,
      sender_role: profile.role,
      content: 'Atenção da liderança: a equipe precisa verificar o chat.',
      message_type: 'attention',
    }).select().maybeSingle();
    if (data) {
      setMessages((current) => current.some((item) => item.id === data.id) ? current : [...current, data as TeamMessage]);
      setOpen(true);
    }
  };

  return (
    <div className={`fixed right-6 bottom-6 z-40 ${shaking ? 'team-chat-shake' : ''}`}>
      {open && (
        <section className="mb-3 w-[min(360px,calc(100vw-2rem))] h-[min(500px,calc(100vh-7rem))] bg-white border border-gray-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          <header className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-blue-300" />
              <div>
                <h2 className="text-sm font-bold">Chat da equipe</h2>
                <p className="text-[11px] text-slate-400">Comunicação interna</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800" title="Fechar chat">
              <X className="w-4 h-4" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 px-6">
                <MessageCircle className="w-8 h-8 mb-2 text-gray-300" />
                <p className="text-sm">Nenhuma mensagem ainda.</p>
              </div>
            ) : messages.map((message) => (
              <div key={message.id} className={`rounded-xl px-3 py-2 ${message.message_type === 'attention' ? 'bg-amber-100 border border-amber-300 text-amber-900' : 'bg-white border border-gray-200'}`}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-bold">{message.sender_name}</span>
                  <span className="text-[10px] opacity-60">{new Date(message.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p className="text-xs leading-relaxed">{message.content}</p>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 border-t border-gray-200 bg-white space-y-2">
            {isHead && (
              <button onClick={() => void callAttention()} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition-colors">
                <BellRing className="w-3.5 h-3.5" />
                Chamar atenção da equipe
              </button>
            )}
            <form onSubmit={(event) => { event.preventDefault(); void sendMessage(); }} className="flex items-center gap-2">
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Escreva para a equipe..."
                className="flex-1 min-w-0 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700 focus:outline-none focus:border-blue-400"
              />
              <button type="submit" disabled={!draft.trim()} className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40" title="Enviar mensagem">
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </section>
      )}

      <button
        onClick={() => { setOpen((current) => !current); setUnread(0); }}
        className={`relative flex items-center gap-2 px-4 py-3 rounded-full bg-slate-900 text-white shadow-xl hover:bg-slate-800 transition-colors ${shaking ? 'ring-4 ring-amber-300' : ''}`}
        title="Abrir chat da equipe"
      >
        {shaking ? <Volume2 className="w-5 h-5 text-amber-300" /> : <MessageCircle className="w-5 h-5 text-blue-300" />}
        <span className="text-sm font-semibold">Chat da equipe</span>
        {unread > 0 && <span className="absolute -right-1 -top-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{unread}</span>}
      </button>
    </div>
  );
}
