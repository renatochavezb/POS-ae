import { useState } from 'react';
import { 
  ArrowLeft, 
  Mail, 
  Phone, 
  MapPin, 
  Gift, 
  AlertTriangle, 
  CheckCircle2, 
  FileText, 
  Plus, 
  Sparkles,
  Info,
  Calendar
} from 'lucide-react';
import { Client, Appointment } from '../types';
import AppointmentServiceList from '../serviceDisplay';
import { formatMXN, formatServicePrice } from '../data';

interface ClientProfileViewProps {
  client: Client;
  appointments: Appointment[];
  onBack: () => void;
  onOpenNewAppointment: (clientName?: string) => void;
}

export default function ClientProfileView({
  client,
  appointments,
  onBack,
  onOpenNewAppointment
}: ClientProfileViewProps) {
  
  // Filter appointments for this client
  const clientAppointments = appointments.filter(app => app.clientId === client.id || app.clientName === client.name);

  // Status simulation for Loading more history
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);

  const handleLoadHistory = () => {
    setLoadingHistory(true);
    setTimeout(() => {
      setLoadingHistory(false);
      setShowAllHistory(true);
    }, 800);
  };

  const portraitUrl = client.id === 'SA-2022' 
    ? 'https://lh3.googleusercontent.com/aida-public/AB6AXuCuHW-1-qfdtVzBxWvPpA-OqcaHbLR1_sK9e-e4oMb3OdUFEqW9YMQzFqDNl9t2rp0ekLfel-_kxYikI3SVkqrpBNthi7_u_DQhjCyO2kp2ocsT8TBdtEiFgNr6tpHULi0-sqdQtMu8hpU5Mp4IarqXCeiQjxWxDefBUb_aMlSQPpvEhQKnLA2sdECrsqUfvNUGZgDBMo04FYaWG9Q5hcUfPy9-J9OwrUo3qaW9Wx07Qae9thQ1EcOGIe76Lw2lddDnjFoxccVEgZE'
    : `https://api.dicebear.com/7.x/adventurer/svg?seed=${client.name}`;

  return (
    <div className="space-y-8 animate-fade-in p-1 md:p-6 max-w-7xl mx-auto">
      {/* Back navigation button */}
      <div>
        <button 
          onClick={onBack}
          className="group flex items-center gap-2 text-outline hover:text-primary text-xs font-bold uppercase tracking-widest transition-colors font-sans"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1 text-secondary" />
          <span>Volver al Directorio</span>
        </button>
      </div>

      {/* Main split profile canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 1 Column: Summary Card */}
        <div className="bg-surface-container-lowest rounded-2xl border border-primary/5 luxury-shadow overflow-hidden flex flex-col h-fit">
          {/* Header Image Cover banner */}
          <div className="h-28 bg-gradient-to-br from-primary to-primary-container relative">
            {client.isPlatinum && (
              <span className="absolute top-4 right-4 text-[9px] font-sans font-bold uppercase bg-secondary-container text-on-secondary-container px-2.5 py-1 rounded-full border border-secondary">
                Platinum VIP
              </span>
            )}
          </div>
          
          {/* Portrait and basic details */}
          <div className="px-6 pb-6 relative flex-grow flex flex-col items-center text-center -mt-14">
            <img 
              referrerPolicy="no-referrer"
              src={portraitUrl} 
              alt={client.name} 
              className="w-24 h-24 rounded-full object-cover border-4 border-surface shadow-md bg-white"
            />
            
            <h3 className="font-display text-2xl font-bold text-primary mt-3">{client.name}</h3>
            <p className="text-[10px] text-outline font-mono mt-0.5">MEMBER SINCE {client.memberSince}</p>
            
            <p className="text-xs text-on-surface-variant mt-4 leading-relaxed font-sans px-2">
              {client.bio}
            </p>

            {/* Contact attributes */}
            <div className="w-full mt-6 pt-6 border-t border-primary/5 space-y-3.5 text-left text-xs text-on-surface-variant font-medium">
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-outline" />
                <span className="truncate">{client.email}</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-outline" />
                <span>{client.phone}</span>
              </div>
              <div className="flex items-center gap-3">
                <Gift className="w-4 h-4 text-outline" />
                <span>{client.birthday}</span>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-outline" />
                <span>{client.address}</span>
              </div>
            </div>

            {/* Nueva Cita CTA */}
            <button 
              onClick={() => onOpenNewAppointment(client.name)}
              className="w-full mt-6 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-sans text-xs font-bold uppercase tracking-widest transition-all shadow-sm shadow-primary/10"
            >
              <Plus className="w-4 h-4 text-secondary" />
              <span>Nueva Reserva</span>
            </button>
          </div>
        </div>

        {/* Right 2 Columns: Client History, Preference Analysis & Medical Alerts */}
        <div className="lg:col-span-2 space-y-8">
          {/* Stats Summary Panel */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-surface-container-lowest p-5 rounded-2xl border border-primary/5 luxury-shadow">
              <span className="text-[9px] text-outline uppercase font-bold tracking-widest block mb-2">Inversión Acumulada</span>
              <p className="font-display text-2xl font-black text-primary">
                {formatMXN(client.totalSpent)}
              </p>
              <p className="text-[10px] text-on-surface-variant mt-1.5">Acumulado histórico</p>
            </div>

            <div className="bg-surface-container-lowest p-5 rounded-2xl border border-primary/5 luxury-shadow">
              <span className="text-[9px] text-outline uppercase font-bold tracking-widest block mb-2">Promedio por Cita</span>
              <p className="font-display text-2xl font-black text-primary">
                {formatMXN(client.averageTicket)}
              </p>
              <p className="text-[10px] text-on-surface-variant mt-1.5">Ticket medio de consumo</p>
            </div>

            <div className="bg-surface-container-lowest p-5 rounded-2xl border border-primary/5 luxury-shadow">
              <span className="text-[9px] text-outline uppercase font-bold tracking-widest block mb-2">Frecuencia Visitas</span>
              <p className="font-display text-2xl font-black text-primary">
                {client.visitsCount} citas
              </p>
              <p className="text-[10px] text-on-surface-variant mt-1.5">Cada 15 días promedio</p>
            </div>
          </div>

          {/* Style Preferences & Allergies */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Preferences Profile */}
            <div className="bg-surface-container-lowest p-6 rounded-2xl border border-primary/5 luxury-shadow flex flex-col justify-between">
              <div>
                <span className="text-[10px] text-outline uppercase font-bold tracking-widest block mb-3">Perfil de Estilo</span>
                <p className="text-xs text-on-surface-variant leading-relaxed font-sans font-medium">
                  {client.styleProfile.bio}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-primary/5">
                {client.styleProfile.tags.map((tag, idx) => (
                  <span 
                    key={idx} 
                    className="text-[9px] font-sans font-bold bg-primary/5 text-primary px-2.5 py-1 rounded-full uppercase flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3 text-secondary" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Medical Alerts (Crucial details for Elena Valenzuela) */}
            <div className="bg-amber-50/50 p-6 rounded-2xl border border-amber-200/50 flex flex-col justify-between">
              <div>
                <span className="text-[10px] text-amber-800 uppercase font-bold tracking-widest block mb-3 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 animate-pulse" />
                  Alertas Médicas / Cuidados
                </span>
                {client.alerts.length === 0 ? (
                  <p className="text-xs text-outline font-medium">No se registran contraindicaciones médicas.</p>
                ) : (
                  <ul className="space-y-2">
                    {client.alerts.map((alert, idx) => (
                      <li key={idx} className="text-xs text-amber-950 font-sans font-semibold flex items-start gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 shrink-0" />
                        <span>{alert}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="mt-4 pt-4 border-t border-amber-200/50 flex items-center gap-2 text-[10px] text-amber-800 font-bold">
                <Info className="w-3.5 h-3.5 shrink-0" />
                <span>Solo removedores sin acetona y cosmética orgánica</span>
              </div>
            </div>
          </div>

          {/* Appointment History */}
          <div className="bg-surface-container-lowest rounded-2xl border border-primary/5 luxury-shadow overflow-hidden">
            <div className="p-6 border-b border-primary/5 flex items-center justify-between">
              <div>
                <h4 className="font-display text-lg font-bold text-primary">Historial de Tratamientos</h4>
                <p className="text-xs text-outline">Listado cronológico de servicios y artistas asignados.</p>
              </div>
              <span className="text-xs font-mono font-bold text-primary bg-primary/5 px-3 py-1 rounded">
                {clientAppointments.length} Registradas
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low/50 text-[10px] text-outline font-bold uppercase tracking-widest border-b border-primary/5">
                    <th className="py-4 px-6">Fecha / Hora</th>
                    <th className="py-4 px-6">Servicio Realizado</th>
                    <th className="py-4 px-6">Especialista</th>
                    <th className="py-4 px-6 text-right">Inversión</th>
                    <th className="py-4 px-6 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary/5">
                  {clientAppointments.map((app) => (
                    <tr key={app.id} className="hover:bg-surface-container-low/30 transition-colors">
                      <td className="py-4 px-6">
                        <div className="font-sans font-bold text-xs text-primary flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-secondary" />
                          {app.date}
                        </div>
                        <p className="text-[9px] text-outline font-mono mt-0.5">{app.time}</p>
                      </td>
                      <td className="py-4 px-6 text-xs text-on-surface font-medium">
                        <AppointmentServiceList
                          serviceName={app.serviceName}
                          lineClassName="text-xs text-on-surface font-medium"
                        />
                      </td>
                      <td className="py-4 px-6">
                        <p className="text-xs font-bold text-primary">{app.staffName}</p>
                        <p className="text-[9px] text-outline uppercase">Initials: {app.staffInitials}</p>
                      </td>
                      <td className="py-4 px-6 text-right font-display font-black text-xs text-primary">
                        {formatServicePrice(app.cost)}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-800 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Listo
                        </span>
                      </td>
                    </tr>
                  ))}

                  {/* Simulated historical row items loaded on demand */}
                  {showAllHistory && (
                    <>
                      <tr className="hover:bg-surface-container-low/30 transition-colors animate-fade-in">
                        <td className="py-4 px-6">
                          <div className="font-sans font-bold text-xs text-primary flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-secondary" />
                            24 Jun, 2023
                          </div>
                          <p className="text-[9px] text-outline font-mono mt-0.5">14:00 PM</p>
                        </td>
                        <td className="py-4 px-6 text-xs text-on-surface font-medium">
                          Soft gel / Gel X
                        </td>
                        <td className="py-4 px-6">
                          <p className="text-xs font-bold text-primary">Carla</p>
                          <p className="text-[9px] text-outline">CA</p>
                        </td>
                        <td className="py-4 px-6 text-right font-display font-black text-xs text-outline">
                          Por definir
                        </td>
                        <td className="py-4 px-6 text-center">
                          <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-800 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Listo
                          </span>
                        </td>
                      </tr>
                      <tr className="hover:bg-surface-container-low/30 transition-colors animate-fade-in">
                        <td className="py-4 px-6">
                          <div className="font-sans font-bold text-xs text-primary flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-secondary" />
                            08 May, 2023
                          </div>
                          <p className="text-[9px] text-outline font-mono mt-0.5">11:00 AM</p>
                        </td>
                        <td className="py-4 px-6 text-xs text-on-surface font-medium">
                          Rubber
                        </td>
                        <td className="py-4 px-6">
                          <p className="text-xs font-bold text-primary">Danna</p>
                          <p className="text-[9px] text-outline">DA</p>
                        </td>
                        <td className="py-4 px-6 text-right font-display font-black text-xs text-outline">
                          Por definir
                        </td>
                        <td className="py-4 px-6 text-center">
                          <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-800 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Listo
                          </span>
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer triggers */}
            {!showAllHistory && (
              <div className="p-4 bg-surface-container-low/30 border-t border-primary/5 text-center">
                <button 
                  onClick={handleLoadHistory}
                  disabled={loadingHistory}
                  className="px-6 py-2.5 rounded-lg border border-primary/10 text-primary hover:bg-surface-container-low text-xs font-sans font-bold uppercase tracking-wider transition-all disabled:opacity-50"
                >
                  {loadingHistory ? 'Cargando tratamientos...' : 'Cargar Historial Completo'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
