import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Search, Bell, Circle, Hand, Loader2, Moon, Sun, Palette, RotateCcw } from 'lucide-react';
import type { Ticket } from '@/lib/types';
import type { Theme } from '@/App';
import { DEFAULT_CUSTOMIZATION, type CustomizationPreferences } from '@/lib/customization';

interface HeadMessage {
  id: string;
  sender_name: string;
  sender_role: 'supervisor' | 'admin';
  content: string;
  message_type: 'message' | 'attention';
  created_at: string;
}

interface TopBarProps {
  title: string;
  subtitle: string;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  customization: CustomizationPreferences;
  onCustomizationChange: (customization: CustomizationPreferences) => void;
  onTicketPicked: (ticket: Ticket) => void;
  onSelectTicket: (ticket: Ticket) => void;
}

export default function TopBar({ title, subtitle, theme, onThemeChange, customization, onCustomizationChange, onTicketPicked, onSelectTicket }: TopBarProps) {
  const { profile, session } = useAuth();
  const [status, setStatus] = useState<'online' | 'offline' | 'away'>(profile?.status || 'offline');
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [pickingUp, setPickingUp] = useState(false);
  const [pickupMessage, setPickupMessage] = useState<string | null>(null);
  const [headMessages, setHeadMessages] = useState<HeadMessage[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Ticket[]>([]);
  const [searching, setSearching] = useState(false);
  const [showCustomization, setShowCustomization] = useState(false);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState('');

  useEffect(() => {
    setStatus(profile?.status || 'offline');
  }, [profile?.status]);

  useEffect(() => {
    if (!profile) return;

    const loadHeadMessages = async () => {
      const { data } = await supabase
        .from('team_messages')
        .select('id, sender_name, sender_role, content, message_type, created_at')
        .in('sender_role', ['admin', 'supervisor'])
        .order('created_at', { ascending: false })
        .limit(8);
      if (data) setHeadMessages(data as HeadMessage[]);
    };

    void loadHeadMessages();

    const sub = supabase
      .channel('head-notifications')
      .on('postgres_changes' as const, { event: 'INSERT', schema: 'public', table: 'team_messages' }, (payload: { new: HeadMessage }) => {
        if (payload.new.sender_role !== 'admin' && payload.new.sender_role !== 'supervisor') return;
        setHeadMessages((current) => [payload.new, ...current.filter((message) => message.id !== payload.new.id)].slice(0, 8));
        setUnreadNotifications((current) => current + 1);
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [profile]);

  useEffect(() => {
    const query = search.trim();
    if (!query) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    const timeout = window.setTimeout(async () => {
      const { data } = await supabase
        .from('tickets')
        .select('*')
        .ilike('subject', `%${query}%`)
        .order('opened_at', { ascending: false })
        .limit(8);
      if (!cancelled) {
        setSearchResults((data || []) as Ticket[]);
        setSearching(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [search]);

  const updateStatus = async (newStatus: 'online' | 'offline' | 'away') => {
    setStatus(newStatus);
    setShowStatusMenu(false);
    if (session?.user?.id) {
      await supabase.from('profiles').update({ status: newStatus }).eq('id', session.user.id);
    }
  };

  const handlePickup = async () => {
    if (!profile || pickingUp) return;
    setPickingUp(true);
    setPickupMessage(null);

    const { data: waitingTicket, error: fetchError } = await supabase
      .from('tickets')
      .select('*')
      .eq('status', 'waiting')
      .order('opened_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (fetchError || !waitingTicket) {
      setPickupMessage(fetchError ? 'Não foi possível pegar o atendimento.' : 'Nenhum ticket aguardando.');
      setPickingUp(false);
      return;
    }

    const { data: pickedTicket, error: pickupError } = await supabase
      .from('tickets')
      .update({
        status: 'in_progress',
        assigned_to: profile.id,
        picked_up_at: new Date().toISOString(),
      })
      .eq('id', waitingTicket.id)
      .eq('status', 'waiting')
      .select()
      .maybeSingle();

    if (pickupError || !pickedTicket) {
      setPickupMessage('Esse ticket acabou de ser pego por outro atendente.');
      setPickingUp(false);
      return;
    }

    await supabase.from('ticket_events').insert({
      ticket_id: pickedTicket.id,
      event_type: 'picked_up',
      actor_id: profile.id,
      actor_name: profile.full_name,
      details: { from_status: 'waiting', to_status: 'in_progress' },
    });

    setPickingUp(false);
    setPickupMessage(`Ticket #${pickedTicket.ticket_number} atribuído a você.`);
    onTicketPicked(pickedTicket as Ticket);
  };

  const statusColor = {
    online: 'text-emerald-400 fill-emerald-400',
    away: 'text-amber-400 fill-amber-400',
    offline: 'text-slate-500 fill-slate-500',
  };

  return (
    <header className="relative z-50 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <div>
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            onClick={() => setShowCustomization((current) => !current)}
            className="p-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
            title="Personalizar dashboard"
            aria-label="Personalizar dashboard"
          >
            <Palette className="w-5 h-5" />
          </button>
          {showCustomization && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowCustomization(false)} />
              <div className="absolute right-0 top-full mt-2 z-[100] w-72 bg-white border border-gray-200 rounded-xl shadow-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Personalizar dashboard</h3>
                    <p className="text-[11px] text-gray-500 mt-0.5">Preferências somente deste atendente</p>
                  </div>
                  <button
                    onClick={() => onCustomizationChange(DEFAULT_CUSTOMIZATION)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-gray-100 rounded-lg"
                    title="Restaurar padrão"
                    aria-label="Restaurar padrão"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <label className="text-xs text-gray-600">Cor do fundo<input type="color" value={customization.backgroundColor} onChange={(event) => onCustomizationChange({ ...customization, backgroundColor: event.target.value })} className="mt-1 block w-full h-8 rounded-lg border border-gray-200 cursor-pointer" /></label>
                  <label className="text-xs text-gray-600">Menu<input type="color" value={customization.sidebarColor} onChange={(event) => onCustomizationChange({ ...customization, sidebarColor: event.target.value })} className="mt-1 block w-full h-8 rounded-lg border border-gray-200 cursor-pointer" /></label>
                  <label className="text-xs text-gray-600">Botões<input type="color" value={customization.accentColor} onChange={(event) => onCustomizationChange({ ...customization, accentColor: event.target.value })} className="mt-1 block w-full h-8 rounded-lg border border-gray-200 cursor-pointer" /></label>
                </div>

                <label className="block text-xs text-gray-600">Papel de parede
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => onCustomizationChange({ ...customization, backgroundImage: String(reader.result) });
                      reader.readAsDataURL(file);
                    }}
                    className="mt-1 block w-full text-xs text-gray-500 file:mr-2 file:px-2 file:py-1 file:border-0 file:rounded-md file:bg-gray-100 file:text-gray-700"
                  />
                </label>
                <div className="space-y-2">
                  <label className="block text-xs text-gray-600">Ou cole o link da imagem
                    <input
                      type="url"
                      value={backgroundImageUrl}
                      onChange={(event) => setBackgroundImageUrl(event.target.value)}
                      placeholder="https://exemplo.com/imagem.jpg"
                      className="mt-1 w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:border-blue-400"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={!backgroundImageUrl.trim()}
                    onClick={() => {
                      try {
                        const url = new URL(backgroundImageUrl.trim());
                        if (url.protocol === 'http:' || url.protocol === 'https:') {
                          onCustomizationChange({ ...customization, backgroundImage: url.toString() });
                          setBackgroundImageUrl('');
                        }
                      } catch {
                        // Ignore malformed image URLs until the user enters a valid link.
                      }
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Aplicar imagem por link
                  </button>
                </div>
                {customization.backgroundImage && (
                  <>
                    <label className="block text-xs text-gray-600">Transparência do papel de parede
                      <input
                        type="range"
                        min="0"
                        max="0.8"
                        step="0.05"
                        value={customization.backgroundOpacity}
                        onChange={(event) => onCustomizationChange({ ...customization, backgroundOpacity: Number(event.target.value) })}
                        className="mt-2 w-full accent-blue-600"
                      />
                    </label>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => onCustomizationChange({
                    ...customization,
                    backgroundImage: DEFAULT_CUSTOMIZATION.backgroundImage,
                    backgroundOpacity: DEFAULT_CUSTOMIZATION.backgroundOpacity,
                    backgroundColor: DEFAULT_CUSTOMIZATION.backgroundColor,
                  })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                >
                  Usar fundo padrão
                </button>

                <label className="block text-xs text-gray-600">Tamanho da fonte
                  <select value={customization.fontSize} onChange={(event) => onCustomizationChange({ ...customization, fontSize: event.target.value as CustomizationPreferences['fontSize'] })} className="mt-1 w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700">
                    <option value="small">Pequena</option>
                    <option value="medium">Média</option>
                    <option value="large">Grande</option>
                  </select>
                </label>

                <label className="block text-xs text-gray-600">Estilo de letra
                  <select value={customization.fontFamily} onChange={(event) => onCustomizationChange({ ...customization, fontFamily: event.target.value as CustomizationPreferences['fontFamily'] })} className="mt-1 w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700">
                    <option value="inter">Inter</option>
                    <option value="poppins">Poppins</option>
                    <option value="montserrat">Montserrat</option>
                    <option value="nunito">Nunito</option>
                    <option value="source-sans">Source Sans 3</option>
                    <option value="merriweather">Merriweather</option>
                    <option value="system">Sistema</option>
                    <option value="serif">Serifada</option>
                    <option value="mono">Monoespaçada</option>
                  </select>
                </label>
              </div>
            </>
          )}
        </div>

        <button
          onClick={() => onThemeChange(theme === 'light' ? 'dark' : 'light')}
          className="p-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
          title={theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'}
          aria-label={theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'}
        >
          {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
        </button>

        <div className="relative">
          <button
            onClick={() => void handlePickup()}
            disabled={pickingUp}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold shadow-sm hover:bg-blue-700 disabled:cursor-wait disabled:opacity-70 transition-colors"
          >
            {pickingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Hand className="w-4 h-4" />}
            Pegar atendimento
          </button>
          {pickupMessage && (
            <span className="absolute right-0 top-full mt-2 z-30 whitespace-nowrap rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600 shadow-lg">
              {pickupMessage}
            </span>
          )}
        </div>

        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onFocus={() => { if (search.trim()) setSearchResults(searchResults); }}
            type="text"
            placeholder="Buscar tickets..."
            className="pl-10 pr-4 py-2 bg-gray-100 border border-transparent rounded-xl text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-gray-300 w-64 transition-all"
          />
          {search.trim() && (
            <div className="absolute right-0 top-full mt-2 z-[100] w-96 max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
              {searching ? (
                <p className="px-4 py-5 text-center text-xs text-gray-400">Buscando tickets...</p>
              ) : searchResults.length === 0 ? (
                <p className="px-4 py-5 text-center text-xs text-gray-400">Nenhum ticket encontrado para “{search}”.</p>
              ) : (
                <div className="max-h-80 overflow-y-auto">
                  {searchResults.map((ticket) => (
                    <button
                      key={ticket.id}
                      onClick={() => {
                        onSelectTicket(ticket);
                        setSearchResults([]);
                      }}
                      className="w-full px-4 py-3 text-left border-b border-gray-50 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-bold text-gray-400">#{ticket.ticket_number}</span>
                        <span className="text-[11px] text-gray-500">{ticket.status === 'waiting' ? 'Aguardando' : ticket.status === 'in_progress' ? 'Em atendimento' : ticket.status === 'closed' ? 'Fechado' : 'Resolvido'}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 mt-1">{ticket.subject}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{ticket.customer_name}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications((current) => !current);
              setUnreadNotifications(0);
            }}
            className="relative p-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
            title="Avisos da liderança"
            aria-label="Avisos da liderança"
          >
            <Bell className="w-5 h-5" />
            {unreadNotifications > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center">
                {unreadNotifications > 9 ? '9+' : unreadNotifications}
              </span>
            )}
          </button>

          {showNotifications && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowNotifications(false)} />
              <div className="absolute right-0 top-full mt-2 z-[100] w-80 max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Avisos da liderança</h3>
                    <p className="text-[11px] text-gray-500 mt-0.5">Mensagens recentes dos heads</p>
                  </div>
                  <Bell className="w-4 h-4 text-blue-600" />
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {headMessages.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-gray-400">Nenhum aviso recente.</p>
                  ) : headMessages.map((message) => (
                    <div key={message.id} className={`px-4 py-3 border-b border-gray-50 ${message.message_type === 'attention' ? 'bg-amber-50' : 'bg-white'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-gray-800">{message.sender_name}</span>
                        <span className="text-[10px] text-gray-400">
                          {new Date(message.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1 leading-relaxed">{message.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => setShowStatusMenu(!showStatusMenu)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <Circle className={`w-3 h-3 ${statusColor[status]}`} />
            <span className="text-sm font-medium text-gray-700 capitalize">
              {status === 'online' ? 'Disponível' : status === 'away' ? 'Ausente' : 'Offline'}
            </span>
          </button>

          {showStatusMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowStatusMenu(false)} />
              <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-20 w-48">
                <button
                  onClick={() => updateStatus('online')}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Circle className="w-3 h-3 text-emerald-400 fill-emerald-400" />
                  Disponível
                </button>
                <button
                  onClick={() => updateStatus('away')}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Circle className="w-3 h-3 text-amber-400 fill-amber-400" />
                  Ausente
                </button>
                <button
                  onClick={() => updateStatus('offline')}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Circle className="w-3 h-3 text-slate-400 fill-slate-400" />
                  Offline
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
