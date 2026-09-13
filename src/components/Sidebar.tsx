import { useAuth } from '@/lib/auth';
import {
  LayoutDashboard,
  Ticket,
  BarChart3,
  Users,
  LogOut,
  Circle,
} from 'lucide-react';

export type View = 'dashboard' | 'tickets' | 'reports' | 'team';

interface SidebarProps {
  currentView: View;
  onNavigate: (view: View) => void;
  waitingCount: number;
  inProgressCount: number;
}

const NAV_ITEMS: { id: View; label: string; icon: typeof Ticket }[] = [
  { id: 'dashboard', label: 'Painel', icon: LayoutDashboard },
  { id: 'tickets', label: 'Tickets', icon: Ticket },
  { id: 'reports', label: 'Relatórios', icon: BarChart3 },
  { id: 'team', label: 'Equipe', icon: Users },
];

export default function Sidebar({ currentView, onNavigate, waitingCount, inProgressCount }: SidebarProps) {
  const { profile, signOut } = useAuth();

  const initials = (profile?.full_name || '?')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col flex-shrink-0">
      <div className="px-5 py-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <img src="/logo-cus-nova-sem-fundo.png" alt="CUS" className="w-11 h-11 object-contain" />
          <div>
            <h1 className="text-white font-bold text-base leading-none">CUS Atendimento</h1>
            <p className="text-slate-500 text-xs mt-1">Central Discord</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.id === 'tickets' && waitingCount > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  active ? 'bg-white/20 text-white' : 'bg-amber-500/20 text-amber-400'
                }`}>
                  {waitingCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="px-3 py-3 border-t border-slate-800">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-800/50">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white font-bold text-sm">
              {initials}
            </div>
            <Circle className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-slate-800 ${
              profile?.status === 'online' ? 'text-emerald-400 fill-emerald-400' :
              profile?.status === 'away' ? 'text-amber-400 fill-amber-400' :
              'text-slate-500 fill-slate-500'
            }`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{profile?.full_name || 'Carregando...'}</p>
            <p className="text-slate-500 text-xs capitalize">{profile?.role || 'agent'}</p>
          </div>
          <button
            onClick={signOut}
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700/50 rounded-lg transition-colors"
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}


