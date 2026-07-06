import { useState } from 'react';
import { 
  Search, 
  UserPlus, 
  Star, 
  Clock, 
  Award, 
  Check, 
  X,
  UserCheck,
  UserX,
  ChevronRight,
  TrendingUp,
  Mail,
  Phone,
  Trash2
} from 'lucide-react';
import { Staff, StaffStatus, Receptionist } from '../types';
import { formatServicePrice } from '../data';
import AccountantActivityPanel from './AccountantActivityPanel';

interface StaffViewProps {
  staffList: Staff[];
  receptionists: Receptionist[];
  onOpenNewStaff: () => void;
  onSelectStaff: (id: string) => void;
  onUpdateStaffStatus: (id: string, status: StaffStatus) => void;
  onDeleteStaff: (id: string) => void;
  readOnly?: boolean;
  accountantId?: string | null;
  accountantName?: string | null;
  activityRefreshKey?: number;
}

export default function StaffView({
  staffList,
  receptionists,
  onOpenNewStaff,
  onSelectStaff,
  onUpdateStaffStatus,
  onDeleteStaff,
  readOnly = false,
  accountantId = null,
  accountantName = null,
  activityRefreshKey = 0,
}: StaffViewProps) {
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredStaff = staffList.filter(staff => {
    if (staff.isActive === false) return false;

    const matchesSearch = 
      staff.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      staff.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      staff.specialty.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = 
      statusFilter === 'all' || 
      staff.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8 animate-fade-in p-1 md:p-6 max-w-7xl mx-auto">
      {/* Top Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-secondary font-sans text-xs font-bold tracking-widest uppercase">Gestión de Personal</span>
          <h2 className="font-display text-3xl font-bold text-primary mt-1">Equipo del Studio</h2>
          <p className="text-on-surface-variant text-sm mt-1">
            {readOnly
              ? 'Consulta perfiles, comisiones e historial para liquidar pagos.'
              : 'Administra el staff, sus comisiones y sus turnos estéticos en tiempo real.'}
          </p>
        </div>
        {!readOnly && (
        <div className="flex items-center gap-3">
          <button 
            onClick={onOpenNewStaff}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-on-primary font-sans text-xs font-bold uppercase tracking-wider hover:bg-primary-container transition-all shadow-sm"
          >
            <UserPlus className="w-4 h-4 text-secondary" />
            <span>Contratar Staff</span>
          </button>
        </div>
        )}
      </div>

      {!readOnly && (
      <div className="space-y-4">
        <div>
          <span className="text-[10px] text-outline font-bold uppercase tracking-widest">Recepción</span>
          <h3 className="font-display text-xl font-bold text-primary mt-1">Equipo de Recepción</h3>
          <p className="text-on-surface-variant text-xs mt-1">
            Citas agendadas hoy por cada recepcionista (sin importar la fecha del servicio).
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {receptionists.map((receptionist) => (
            <div
              key={receptionist.id}
              className="bg-surface-container-lowest rounded-2xl border border-primary/5 luxury-shadow p-5 flex items-center gap-4"
              style={{ borderTop: `3px solid ${receptionist.color}` }}
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border-2"
                style={{
                  borderColor: receptionist.color,
                  backgroundColor: receptionist.colorLight,
                  color: receptionist.color,
                }}
              >
                {receptionist.id}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-display font-extrabold text-sm text-primary">{receptionist.name}</h4>
                <p className="text-[10px] text-outline font-bold uppercase tracking-wider">{receptionist.role}</p>
                <p className="text-[10px] text-on-surface-variant mt-1">Código: {receptionist.loginCode}</p>
              </div>
              <div className="text-right shrink-0">
                <span className="font-display text-3xl font-black text-primary">{receptionist.bookingsToday}</span>
                <p className="text-[9px] text-outline font-bold uppercase tracking-wider">Hoy</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      )}

      {readOnly && accountantId ? (
        <AccountantActivityPanel
          accountantId={accountantId}
          accountantName={accountantName || undefined}
          refreshKey={activityRefreshKey}
        />
      ) : null}

      <div className="space-y-4">
        <div>
          <span className="text-[10px] text-outline font-bold uppercase tracking-widest">Manicuristas</span>
          <h3 className="font-display text-xl font-bold text-primary mt-1">Especialistas del Studio</h3>
        </div>
      </div>

      {/* Directory Controls */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-surface-container-lowest p-4 rounded-2xl border border-primary/5 luxury-shadow">
        <div className="flex-grow w-full md:max-w-md flex items-center gap-2.5 px-3 py-2 bg-surface-container-low rounded-xl border border-primary/5">
          <Search className="w-4 h-4 text-outline" />
          <input 
            type="text" 
            placeholder="Buscar especialista por nombre, rol o técnica..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent border-none outline-none text-xs text-primary placeholder-outline"
          />
        </div>
        
        <div className="flex items-center gap-2.5 w-full md:w-auto overflow-x-auto scrollbar-hide py-1">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'online', label: 'En Cita / Activos' },
            { id: 'break', label: 'En Descanso' },
            { id: 'offline', label: 'Inactivos' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg text-[10px] font-sans font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
                statusFilter === tab.id 
                  ? 'bg-primary text-on-primary' 
                  : 'bg-surface hover:bg-surface-container-low text-outline border border-primary/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Staff Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredStaff.map((staff) => (
          <div 
            key={staff.id}
            className="bg-surface-container-lowest rounded-2xl border border-primary/5 luxury-shadow overflow-hidden flex flex-col justify-between group transition-all duration-300 hover:-translate-y-1"
          >
            {/* Top Banner section */}
            <div className="p-6 flex items-start gap-4 border-b border-primary/5">
              <img 
                referrerPolicy="no-referrer"
                src={staff.image} 
                alt={staff.name} 
                className="w-16 h-16 rounded-full object-cover border-2 shrink-0 bg-surface-container-low"
                style={{ borderColor: staff.color }}
              />
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 
                    onClick={() => onSelectStaff(staff.id)}
                    className="font-display font-extrabold text-sm text-primary group-hover:underline cursor-pointer truncate"
                  >
                    {staff.name}
                  </h4>
                  <div className="flex items-center text-amber-500 shrink-0">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <span className="text-[10px] font-bold ml-0.5 text-primary">{staff.rating.toFixed(1)}</span>
                  </div>
                </div>
                <p className="text-[10px] text-outline font-bold uppercase tracking-wider truncate">{staff.role}</p>
                <p className="text-[11px] text-on-surface-variant font-medium truncate">{staff.specialty}</p>
              </div>
            </div>

            {/* Mid Stats section */}
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-outline font-medium flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-secondary" /> Turno
                </span>
                <span className="font-bold text-primary truncate text-right max-w-[150px]">{staff.shift}</span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-outline font-medium flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5 text-secondary" /> Ventas Semana
                </span>
                <span className="font-display font-black text-primary">
                  {staff.weeklyRevenue > 0
                    ? formatServicePrice(staff.weeklyRevenue)
                    : 'Por definir'}
                </span>
              </div>

              {/* Progress target indicator */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-[10px] font-bold text-outline">
                  <span>Meta de Turno de Hoy</span>
                  <span className="text-primary">{staff.completedToday}/{staff.totalToday} Citas</span>
                </div>
                <div className="w-full h-1.5 bg-surface-container-low rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary" 
                    style={{ width: `${staff.totalToday > 0 ? (staff.completedToday / staff.totalToday) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Footer Status actions */}
            <div className="px-6 py-4 bg-surface-container-low/30 border-t border-primary/5 flex items-center justify-between">
              {/* Status Indicator */}
              <div className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${
                  staff.status === 'online' 
                    ? 'bg-emerald-500' 
                    : staff.status === 'break' 
                    ? 'bg-secondary' 
                    : 'bg-outline'
                }`} />
                <span className="text-[10px] font-sans font-extrabold uppercase tracking-widest text-primary">
                  {staff.status === 'online' ? 'Disponible' : staff.status === 'break' ? 'En descanso' : 'Ausente'}
                </span>
              </div>

              {/* Status Switch Controls */}
              <div className="flex items-center gap-1">
                {!readOnly && (
                <>
                <button 
                  onClick={() => onUpdateStaffStatus(staff.id, 'online')}
                  title="Marcar Activo"
                  className={`p-1.5 rounded-md transition-colors ${
                    staff.status === 'online' 
                      ? 'bg-emerald-500/10 text-emerald-800' 
                      : 'hover:bg-surface-container-high text-outline'
                  }`}
                >
                  <UserCheck className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => onUpdateStaffStatus(staff.id, 'break')}
                  title="Marcar Descanso"
                  className={`p-1.5 rounded-md transition-colors ${
                    staff.status === 'break' 
                      ? 'bg-secondary/15 text-secondary' 
                      : 'hover:bg-surface-container-high text-outline'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => onUpdateStaffStatus(staff.id, 'offline')}
                  title="Marcar Ausente"
                  className={`p-1.5 rounded-md transition-colors ${
                    staff.status === 'offline' 
                      ? 'bg-red-500/10 text-red-800' 
                      : 'hover:bg-surface-container-high text-outline'
                  }`}
                >
                  <UserX className="w-4 h-4" />
                </button>
                <span className="w-px h-5 bg-primary/10 mx-1" />
                </>
                )}
                <button 
                  onClick={() => onSelectStaff(staff.id)}
                  title="Ver Analíticas"
                  className="p-1.5 rounded-md hover:bg-surface-container-high text-secondary transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                {!readOnly && (
                <button
                  onClick={() => onDeleteStaff(staff.id)}
                  title="Dar de baja"
                  className="p-1.5 rounded-md hover:bg-red-500/10 text-red-700 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
