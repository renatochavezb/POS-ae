import { useMemo, useState } from 'react';
import { 
  Plus, 
  UserPlus, 
  ShieldAlert, 
  ArrowRight,
  ChevronRight,
  UserCheck
} from 'lucide-react';
import { Staff, Client, Appointment } from '../types';
import { formatMXN } from '../data';
import { getBookableStaff } from '@/libs/posStaffAgenda';
import WeeklyCompletedAppointmentsCard from './WeeklyCompletedAppointmentsCard';
import WeeklySalesCard from './WeeklySalesCard';
import WeeklyCutsCard from './WeeklyCutsCard';
import CabinOccupancyCard from './CabinOccupancyCard';

interface DashboardViewProps {
  staffList: Staff[];
  clients: Client[];
  appointments: Appointment[];
  onOpenNewAppointment: () => void;
  onOpenNewClient: () => void;
  onSelectClient: (id: string) => void;
  onSelectStaff: (id: string) => void;
}

export default function DashboardView({
  staffList,
  clients,
  appointments,
  onOpenNewAppointment,
  onOpenNewClient,
  onSelectClient,
  onSelectStaff
}: DashboardViewProps) {
  
  const [waitingQueue, setWaitingQueue] = useState([
    { id: 'wq-1', name: 'María González', service: 'Soft gel / Gel X', time: '13:00', status: 'En espera' },
    { id: 'wq-2', name: 'Ana Lucía Ruiz', service: 'Laminado de ceja', time: '13:30', status: 'En camino' }
  ]);

  const operationalStaff = useMemo(() => getBookableStaff(staffList), [staffList]);
  const activeStaff = operationalStaff.filter(
    (member) => member.status === 'online' || member.status === 'break'
  );

  const handleAttendInQueue = (id: string) => {
    setWaitingQueue(waitingQueue.filter(item => item.id !== id));
  };

  return (
    <div className="space-y-8 animate-fade-in p-1 md:p-6 max-w-7xl mx-auto">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-secondary font-sans text-xs font-bold tracking-widest uppercase">Panel Ejecutivo</span>
          <h2 className="font-display text-3xl font-bold text-primary mt-1">Gestión Operativa</h2>
          <p className="text-on-surface-variant text-sm mt-1">Control diario en tiempo real de studio aé premium manicure & spa.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={onOpenNewClient}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-primary/10 text-primary font-sans text-xs font-bold uppercase tracking-wider hover:bg-surface-container-low transition-colors"
          >
            <UserPlus className="w-4 h-4 text-secondary" />
            <span>Registrar Cliente</span>
          </button>
          <button 
            onClick={onOpenNewAppointment}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-on-primary font-sans text-xs font-bold uppercase tracking-wider hover:bg-primary-container transition-all shadow-sm shadow-primary/10"
          >
            <Plus className="w-4 h-4 text-secondary" />
            <span>Nueva Cita</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 md:grid-rows-2 gap-6 items-stretch">
        <div className="h-full min-h-0">
          <WeeklyCompletedAppointmentsCard
            appointments={appointments}
            staffList={staffList}
          />
        </div>

        <div className="md:col-span-2 h-full min-h-0">
          <WeeklySalesCard appointments={appointments} staffList={staffList} />
        </div>

        <div className="h-full min-h-0">
          <CabinOccupancyCard staffList={staffList} />
        </div>

        <div className="md:col-span-2 h-full min-h-0">
          <WeeklyCutsCard />
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Columns: Staff Status & Alerts */}
        <div className="lg:col-span-2 space-y-8">
          {/* Active Staff List */}
          <div className="bg-surface-container-lowest rounded-2xl border border-primary/5 luxury-shadow overflow-hidden">
            <div className="p-6 border-b border-primary/5 flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-bold text-primary">Personal de Turno Hoy</h3>
                <p className="text-xs text-outline">Listado activo de artistas de uñas, técnicos y recepcionistas en cabina.</p>
              </div>
              <span className="text-[10px] bg-primary-fixed text-primary-fixed-dim px-2.5 py-1 rounded-full font-sans font-bold uppercase tracking-wider">
                {activeStaff.length} Activos
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low/50 text-[10px] text-outline font-bold uppercase tracking-widest border-b border-primary/5">
                    <th className="py-4 px-6">Staff Artist</th>
                    <th className="py-4 px-6">Estado</th>
                    <th className="py-4 px-6">Especialidad</th>
                    <th className="py-4 px-6 text-center">Progreso</th>
                    <th className="py-4 px-6 text-right">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary/5">
                  {operationalStaff.map((staff) => (
                    <tr 
                      key={staff.id} 
                      className="hover:bg-surface-container-low/30 transition-colors group cursor-pointer"
                      onClick={() => onSelectStaff(staff.id)}
                    >
                      <td className="py-4 px-6 flex items-center gap-3">
                        <img 
                          referrerPolicy="no-referrer"
                          src={staff.image} 
                          alt={staff.name} 
                          className="w-10 h-10 rounded-full object-cover border border-primary/10"
                        />
                        <div>
                          <p className="font-sans font-bold text-xs text-primary group-hover:underline">{staff.name}</p>
                          <p className="text-[10px] text-outline">{staff.role}</p>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                          staff.status === 'online' 
                            ? 'bg-emerald-500/10 text-emerald-800' 
                            : staff.status === 'break'
                            ? 'bg-secondary-container/30 text-secondary'
                            : 'bg-surface-container-highest text-outline'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            staff.status === 'online' 
                              ? 'bg-emerald-500' 
                              : staff.status === 'break'
                              ? 'bg-secondary'
                              : 'bg-outline'
                          }`} />
                          {staff.status === 'online' ? 'En Cita' : staff.status === 'break' ? 'Descanso' : 'Ausente'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-xs text-on-surface-variant font-medium">
                        {staff.specialty}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <div className="flex flex-col items-center justify-center gap-1">
                          <span className="text-[10px] font-mono text-primary font-bold">
                            {staff.completedToday}/{staff.totalToday} citas
                          </span>
                          <div className="w-20 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary" 
                              style={{ width: `${staff.totalToday > 0 ? (staff.completedToday / staff.totalToday) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button className="text-outline hover:text-primary transition-colors">
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right 1 Column: Queue status & System Alert Alerts */}
        <div className="space-y-8">
          {/* Waiting Queue section */}
          <div className="bg-surface-container-lowest p-6 rounded-2xl border border-primary/5 luxury-shadow">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-primary/5">
              <div>
                <h4 className="font-display font-bold text-sm text-primary">Clientes en Espera</h4>
                <p className="text-[10px] text-outline">Fila presencial para atención prioritaria</p>
              </div>
              <span className="text-[10px] font-bold text-secondary font-mono bg-secondary/10 px-2 py-0.5 rounded">
                Live Queue
              </span>
            </div>

            {waitingQueue.length === 0 ? (
              <div className="py-8 text-center text-outline text-xs">
                No hay clientes en espera actualmente.
              </div>
            ) : (
              <div className="space-y-4">
                {waitingQueue.map((item) => (
                  <div key={item.id} className="p-3 bg-surface-container-low rounded-xl border border-primary/5 flex items-center justify-between">
                    <div>
                      <p className="font-sans font-bold text-xs text-primary">{item.name}</p>
                      <p className="text-[10px] text-outline">{item.service} (Cita {item.time})</p>
                      <span className={`inline-block text-[9px] font-bold px-1.5 py-0.2 rounded mt-1.5 ${
                        item.status === 'En espera' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                    {item.status === 'En espera' && (
                      <button 
                        onClick={() => handleAttendInQueue(item.id)}
                        className="flex items-center gap-1 bg-primary text-on-primary hover:bg-primary-container px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors shadow-sm"
                      >
                        <UserCheck className="w-3 h-3 text-secondary" />
                        <span>Atender</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick VIP Lookup section */}
          <div className="bg-gradient-to-br from-primary to-primary-container text-on-primary p-6 rounded-2xl border border-primary-container luxury-shadow">
            <span className="text-[10px] text-on-primary-container font-mono uppercase tracking-widest font-bold">Cliente Destacado</span>
            <div className="flex items-center gap-3 mt-4">
              <img 
                referrerPolicy="no-referrer"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCuHW-1-qfdtVzBxWvPpA-OqcaHbLR1_sK9e-e4oMb3OdUFEqW9YMQzFqDNl9t2rp0ekLfel-_kxYikI3SVkqrpBNthi7_u_DQhjCyO2kp2ocsT8TBdtEiFgNr6tpHULi0-sqdQtMu8hpU5Mp4IarqXCeiQjxWxDefBUb_aMlSQPpvEhQKnLA2sdECrsqUfvNUGZgDBMo04FYaWG9Q5hcUfPy9-J9OwrUo3qaW9Wx07Qae9thQ1EcOGIe76Lw2lddDnjFoxccVEgZE" 
                alt="Elena Valenzuela"
                className="w-12 h-12 rounded-full object-cover border-2 border-secondary"
              />
              <div>
                <h4 className="font-display font-bold text-sm text-white">Elena Valenzuela</h4>
                <p className="text-[10px] text-on-primary-container font-sans tracking-wide">Platinum Member (since 2022)</p>
              </div>
            </div>
            <p className="text-xs text-on-primary-container/90 mt-4 leading-relaxed line-clamp-2">
              Cliente recurrente con especial enfoque en tratamientos de alta gama y diseños minimalistas...
            </p>
            <div className="mt-5 pt-4 border-t border-on-primary-container/10 flex justify-between items-center">
              <span className="text-[10px] text-secondary font-mono font-bold">{formatMXN(3450)} acumulados</span>
              <button 
                onClick={() => onSelectClient('SA-2022')}
                className="text-white hover:text-secondary text-xs font-bold uppercase tracking-widest flex items-center gap-1 transition-colors"
              >
                <span>Ver Perfil</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Critical medical warning list */}
          <div className="bg-amber-50 p-6 rounded-2xl border border-amber-200/50">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider mb-3">
              <ShieldAlert className="w-4 h-4 text-amber-700" />
              <span>Alertas Médicas de Hoy</span>
            </div>
            <div className="space-y-3">
              <div className="text-xs">
                <p className="font-bold text-amber-950">Elena Valenzuela</p>
                <p className="text-amber-800">Sensibilidad extrema a acetona pura. Usar removedor alternativo.</p>
              </div>
              <div className="text-xs pt-2.5 border-t border-amber-200">
                <p className="font-bold text-amber-950">Sophia Wright</p>
                <p className="text-amber-800">Uñas quebradizas; evitar limados agresivos en matriz ungueal.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
