import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Search, Bell, Circle } from 'lucide-react';
import type { Profile } from '@/lib/types';

interface TopBarProps {
  title: string;
  subtitle: string;
}

export default function TopBar({ title, subtitle }: TopBarProps) {
  const { profile, session } = useAuth();
  const [status, setStatus] = useState<'online' | 'offline' | 'away'>(profile?.status || 'offline');
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  useEffect(() => {
    setStatus(profile?.status || 'offline');
  }, [profile?.status]);

  const updateStatus = async (newStatus: 'online' | 'offline' | 'away') => {
    setStatus(newStatus);
    setShowStatusMenu(false);
    if (session?.user?.id) {
      await supabase.from('profiles').update({ status: newStatus }).eq('id', session.user.id);
    }
  };

  const statusColor = {
    online: 'text-emerald-400 fill-emerald-400',
    away: 'text-amber-400 fill-amber-400',
    offline: 'text-slate-500 fill-slate-500',
  };

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <div>
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar tickets..."
            className="pl-10 pr-4 py-2 bg-gray-100 border border-transparent rounded-xl text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-gray-300 w-64 transition-all"
          />
        </div>

        <button className="relative p-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>

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
