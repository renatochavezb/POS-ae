import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Sparkles,
  Settings,
  LogOut,
  Award,
  Banknote,
  ChevronDown,
  Package,
} from 'lucide-react';
import StudioLogo from './StudioLogo';
import {
  ADMIN_SECTION_ICON,
  ADMIN_SECTION_LABEL,
  AdminNavItem,
  isAdminTab,
} from '../admin/adminNav';
import {
  DASHBOARD_NAV_ITEMS,
  DashboardSectionId,
} from '../dashboardNav';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  activeSession?: {
    name: string;
    subtitle: string;
    initials: string;
  } | null;
  onLogout: () => void;
  isMasterSession?: boolean;
  onOpenMasterPanel?: () => void;
  allowedTabIds?: string[];
  adminNavItems?: AdminNavItem[];
  hideDashboardSubmenu?: boolean;
  /** Si se define, limita el submenú del Dashboard a esas secciones. */
  allowedDashboardSections?: DashboardSectionId[];
  activeDashboardSection?: DashboardSectionId | null;
  onDashboardSection?: (sectionId: DashboardSectionId) => void;
}

export default function Sidebar({
  currentTab,
  setCurrentTab,
  activeSession,
  onLogout,
  isMasterSession = false,
  onOpenMasterPanel,
  allowedTabIds,
  adminNavItems = [],
  hideDashboardSubmenu = false,
  allowedDashboardSections,
  activeDashboardSection = null,
  onDashboardSection,
}: SidebarProps) {
  const { data: session } = useSession();
  const [logoClicks, setLogoClicks] = useState(0);
  const [adminExpanded, setAdminExpanded] = useState(isAdminTab(currentTab));
  const [dashboardExpanded, setDashboardExpanded] = useState(currentTab === 'dashboard');

  useEffect(() => {
    if (isAdminTab(currentTab)) {
      setAdminExpanded(true);
    }
  }, [currentTab]);

  useEffect(() => {
    if (currentTab === 'dashboard') {
      setDashboardExpanded(true);
    }
  }, [currentTab]);

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

  const userName = activeSession?.name || session?.user?.name || 'Admin Jane';
  const userEmail = activeSession?.subtitle || session?.user?.email || 'Gerente General';
  const userInitials = activeSession?.initials ||
    (session?.user?.name
      ? session.user.name
          .split(' ')
          .map((n: string) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)
      : 'JD');

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'agenda', label: 'Agenda', icon: CalendarDays },
    { id: 'caja', label: 'Caja', icon: Banknote },
    { id: 'clients', label: 'Clientes', icon: Users },
    { id: 'staff', label: 'Equipo', icon: Award },
    { id: 'services', label: 'Servicios', icon: Sparkles },
    { id: 'inventario', label: 'Inventario', icon: Package },
    { id: 'settings', label: 'Configuración', icon: Settings },
  ].filter((item) => !allowedTabIds || allowedTabIds.includes(item.id));

  const showDashboardSubmenu =
    !hideDashboardSubmenu &&
    (!allowedTabIds || allowedTabIds.includes('dashboard'));

  const dashboardNavItems = allowedDashboardSections
    ? DASHBOARD_NAV_ITEMS.filter((section) =>
        allowedDashboardSections.includes(section.id)
      )
    : DASHBOARD_NAV_ITEMS;

  const AdminSectionIcon = ADMIN_SECTION_ICON;
  const adminSectionActive = isAdminTab(currentTab);
  const dashboardActive = currentTab === 'dashboard';

  return (
    <aside className="w-[4.25rem] lg:w-64 h-full min-h-0 bg-surface border-r border-primary/10 flex flex-col shrink-0 transition-[width] duration-200">
      <div
        className="p-3 lg:p-5 border-b border-primary/5 flex items-center justify-center lg:justify-start gap-3 select-none shrink-0"
        onClick={() => {
          if (isMasterSession) {
            setLogoClicks((prev) => prev + 1);
          }
        }}
        title={isMasterSession ? 'Acceso maestro' : 'studio aé'}
      >
        <StudioLogo size="sm" showWordmark={false} className="lg:hidden" />
        <div className="hidden lg:block">
          <StudioLogo size="sm" showWordmark />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
        <nav className="py-3 px-2 lg:py-4 lg:px-4 space-y-1.5 lg:space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            if (item.id === 'dashboard' && showDashboardSubmenu) {
              return (
                <div key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (dashboardActive) {
                        setDashboardExpanded((prev) => !prev);
                      } else {
                        setCurrentTab('dashboard');
                        setDashboardExpanded(true);
                      }
                    }}
                    title={item.label}
                    className={`w-full flex items-center justify-center lg:justify-between gap-0 lg:gap-3 px-0 lg:px-4 py-3 rounded-lg font-sans text-xs tracking-widest font-bold uppercase transition-all duration-300 ${
                      dashboardActive
                        ? 'bg-primary/5 text-primary lg:border-l-2 border-secondary'
                        : 'text-outline hover:bg-surface-container-low hover:text-primary'
                    }`}
                  >
                    <span className="flex items-center justify-center lg:justify-start gap-0 lg:gap-4">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${dashboardActive ? 'text-secondary' : 'text-outline'}`}
                      />
                      <span className="hidden lg:inline">{item.label}</span>
                    </span>
                    <ChevronDown
                      className={`hidden lg:block w-4 h-4 transition-transform ${
                        dashboardExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {dashboardExpanded ? (
                    <div className="mt-1 space-y-1 lg:ml-3 lg:pl-3 lg:border-l lg:border-primary/10">
                      {dashboardNavItems.map((section) => {
                        const SectionIcon = section.icon;
                        const sectionActive =
                          dashboardActive && activeDashboardSection === section.id;
                        return (
                          <button
                            key={section.id}
                            type="button"
                            onClick={() => onDashboardSection?.(section.id)}
                            title={section.label}
                            className={`w-full flex items-center justify-center lg:justify-start gap-0 lg:gap-3 px-0 lg:px-3 py-2.5 rounded-lg font-sans text-[10px] tracking-wider font-bold uppercase transition-all ${
                              sectionActive
                                ? 'bg-secondary/10 text-primary'
                                : 'text-outline hover:bg-surface-container-low hover:text-primary'
                            }`}
                          >
                            <SectionIcon
                              className={`w-3.5 h-3.5 shrink-0 ${
                                sectionActive ? 'text-secondary' : 'text-outline'
                              }`}
                            />
                            <span className="hidden lg:inline text-left leading-tight">
                              {section.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            }

            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentTab(item.id);
                }}
                title={item.label}
                className={`w-full flex items-center justify-center lg:justify-start gap-0 lg:gap-4 px-0 lg:px-4 py-3 rounded-lg font-sans text-xs tracking-widest font-bold uppercase transition-all duration-300 ${
                  isActive
                    ? 'bg-primary/5 text-primary lg:border-l-2 border-secondary'
                    : 'text-outline hover:bg-surface-container-low hover:text-primary'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${isActive ? 'text-secondary' : 'text-outline'}`}
                />
                <span className="hidden lg:inline">{item.label}</span>
              </button>
            );
          })}

          {adminNavItems.length > 0 ? (
            <div className="pt-1 lg:pt-2">
              <button
                type="button"
                onClick={() => setAdminExpanded((prev) => !prev)}
                title={ADMIN_SECTION_LABEL}
                className={`w-full flex items-center justify-center lg:justify-between gap-0 lg:gap-3 px-0 lg:px-4 py-3 rounded-lg font-sans text-xs tracking-widest font-bold uppercase transition-all duration-300 ${
                  adminSectionActive
                    ? 'bg-primary/5 text-primary lg:border-l-2 border-secondary'
                    : 'text-outline hover:bg-surface-container-low hover:text-primary'
                }`}
              >
                <span className="flex items-center justify-center lg:justify-start gap-0 lg:gap-4">
                  <AdminSectionIcon
                    className={`w-4 h-4 shrink-0 ${adminSectionActive ? 'text-secondary' : 'text-outline'}`}
                  />
                  <span className="hidden lg:inline">{ADMIN_SECTION_LABEL}</span>
                </span>
                <ChevronDown
                  className={`hidden lg:block w-4 h-4 transition-transform ${adminExpanded ? 'rotate-180' : ''}`}
                />
              </button>

              {adminExpanded ? (
                <div className="mt-1 space-y-1 lg:ml-3 lg:pl-3 lg:border-l lg:border-primary/10">
                  {adminNavItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setCurrentTab(item.id)}
                        title={item.label}
                        className={`w-full flex items-center justify-center lg:justify-start gap-0 lg:gap-3 px-0 lg:px-3 py-2.5 rounded-lg font-sans text-[10px] tracking-wider font-bold uppercase transition-all ${
                          isActive
                            ? 'bg-secondary/10 text-primary'
                            : 'text-outline hover:bg-surface-container-low hover:text-primary'
                        }`}
                      >
                        <Icon
                          className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-secondary' : 'text-outline'}`}
                        />
                        <span className="hidden lg:inline">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}
        </nav>

        <div className="p-2 lg:p-4 border-t border-primary/5 bg-surface-container-low/50 shrink-0 mt-auto">
          <div className="flex items-center justify-center lg:justify-start gap-0 lg:gap-3 p-1.5 lg:p-2 hover:bg-surface-container-low rounded-lg transition-colors">
            <div
              className="w-9 h-9 lg:w-10 lg:h-10 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container font-bold text-sm shrink-0"
              title={`${userName} · ${userEmail}`}
            >
              {userInitials}
            </div>
            <div className="hidden lg:block flex-grow min-w-0">
              <p className="text-xs font-bold truncate text-primary uppercase">{userName}</p>
              <p className="text-[10px] text-outline truncate">{userEmail}</p>
            </div>
            <button
              onClick={onLogout}
              title="Cerrar sesión"
              className="hidden lg:inline-flex text-outline hover:text-error transition-colors p-1 shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={onLogout}
            title="Cerrar sesión"
            className="lg:hidden mt-1 w-full flex items-center justify-center py-2 text-outline hover:text-error transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
