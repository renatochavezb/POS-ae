import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { 
  LayoutDashboard, 
  CalendarDays, 
  Users, 
  Sparkles, 
  Settings, 
  LogOut,
  TrendingUp,
  Award,
  Banknote
} from 'lucide-react';
import StudioLogo from './StudioLogo';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onSelectCarla: () => void;
  onSelectElenaValenzuela: () => void;
  activeSession?: {
    name: string;
    subtitle: string;
    initials: string;
  } | null;
  onLogout: () => void;
  isMasterSession?: boolean;
  onOpenMasterPanel?: () => void;
  allowedTabIds?: string[];
  hideQuickLinks?: boolean;
}

export default function Sidebar({ 
  currentTab, 
  setCurrentTab,
  onSelectCarla,
  onSelectElenaValenzuela,
  activeSession,
  onLogout,
  isMasterSession = false,
  onOpenMasterPanel,
  allowedTabIds,
  hideQuickLinks = false,
}: SidebarProps) {
  const { data: session } = useSession();
  const [logoClicks, setLogoClicks] = useState(0);

  useEffect(() => {
    if (!isMasterSession || logoClicks < 3) return;

    onOpenMasterPanel?.();
    setLogoClicks(0);
  }, [isMasterSession, logoClicks, onOpenMasterPanel]);

  useEffect(() => {
    if (logoClicks === 0) return;

    const timer = window.setTimeout(() => setLogoClicks(0), 900);
    return () => window.clearTimeout(timer);
  }, [logoClicks]);

  const userName = activeSession?.name || session?.user?.name || "Admin Jane";
  const userEmail = activeSession?.subtitle || session?.user?.email || "Gerente General";
  const userInitials = activeSession?.initials || (session?.user?.name
    ? session.user.name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : "JD");
  
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'agenda', label: 'Agenda', icon: CalendarDays },
    { id: 'caja', label: 'Caja', icon: Banknote },
    { id: 'clients', label: 'Clientes', icon: Users },
    { id: 'staff', label: 'Equipo', icon: Award },
    { id: 'services', label: 'Servicios', icon: Sparkles },
    { id: 'settings', label: 'Configuración', icon: Settings },
  ].filter((item) => !allowedTabIds || allowedTabIds.includes(item.id));

  return (
    <aside className="w-64 h-screen sticky top-0 bg-surface border-r border-primary/10 flex flex-col hidden md:flex shrink-0">
      {/* Brand Logo */}
      <div
        className="p-8 border-b border-primary/5 flex items-center gap-3 select-none"
        onClick={() => {
          if (isMasterSession) {
            setLogoClicks((prev) => prev + 1);
          }
        }}
        title={isMasterSession ? 'Acceso maestro' : undefined}
      >
        <StudioLogo size="sm" showWordmark />
      </div>

      {/* Navigation Links */}
      <nav className="flex-grow py-8 px-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setCurrentTab(item.id);
                // If switching to staff, we can default to list, but if specifically clicked we can navigate there
              }}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-lg font-sans text-xs tracking-widest font-bold uppercase transition-all duration-300 ${
                isActive 
                  ? 'bg-primary/5 text-primary border-l-2 border-secondary' 
                  : 'text-outline hover:bg-surface-container-low hover:text-primary'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-secondary' : 'text-outline group-hover:text-primary'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Accesos rápidos de revisión */}
      {!hideQuickLinks && (
      <div className="px-6 py-4 border-t border-primary/5 space-y-2">
        <p className="text-[10px] text-outline font-bold tracking-widest uppercase">Visuales Rápidas</p>
        <div className="flex flex-col gap-1.5 text-xs">
          <button 
            onClick={onSelectElenaValenzuela}
            className="text-left text-on-surface-variant hover:text-primary transition-colors hover:underline"
          >
            ● Perfil Elena Valenzuela
          </button>
          <button 
            onClick={onSelectCarla}
            className="text-left text-on-surface-variant hover:text-primary transition-colors hover:underline"
          >
            ● Analíticas Carla
          </button>
        </div>
      </div>
      )}

      {/* Administrator Footnote */}
      <div className="p-4 border-t border-primary/5 bg-surface-container-low/50">
        <div className="flex items-center gap-3 p-2 hover:bg-surface-container-low rounded-lg transition-colors cursor-pointer group">
          <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container font-bold text-sm">
            {userInitials}
          </div>
          <div className="flex-grow min-w-0">
            <p className="text-xs font-bold truncate text-primary uppercase">{userName}</p>
            <p className="text-[10px] text-outline truncate">{userEmail}</p>
          </div>
          <button 
            onClick={onLogout}
            title="Cerrar sesión"
            className="text-outline hover:text-error transition-colors p-1"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
