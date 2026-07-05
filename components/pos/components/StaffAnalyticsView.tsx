import { useState } from 'react';
import { 
  ArrowLeft, 
  Award, 
  Calendar, 
  DollarSign, 
  Download, 
  Percent, 
  Star, 
  TrendingUp, 
  CheckCircle2, 
  Coins, 
  Clock, 
  ChevronRight,
  ShieldAlert,
  Sliders
} from 'lucide-react';
import { Staff, Appointment } from '../types';
import { formatServicePrice, formatMXN } from '../data';
import { isAppointmentPaid } from '../appointmentStatus';

interface StaffAnalyticsViewProps {
  staff: Staff;
  appointments: Appointment[];
  onBack: () => void;
}

export default function StaffAnalyticsView({
  staff,
  appointments,
  onBack
}: StaffAnalyticsViewProps) {
  
  // Simulated chart data for weekly performance
  const weeklyPerformance = [
    { day: 'Lun', sales: 420 },
    { day: 'Mar', sales: 580 },
    { day: 'Mié', sales: 620 },
    { day: 'Jue', sales: 390 },
    { day: 'Vie', sales: 850 },
    { day: 'Sáb', sales: 980 },
    { day: 'Dom', sales: 120 }
  ];

  // Simulated state for payment request
  const [paymentRequested, setPaymentRequested] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState('Pendiente de liquidación (28 MAY 2024)');

  const handleRequestPayment = () => {
    setPaymentRequested(true);
    setPaymentStatus('Solicitud de Liquidación Enviada a Tesorería');
  };

  // Citas completadas del día para la especialista seleccionada
  const todayAppointments = appointments
    .filter((app) => app.staffId === staff.id && isAppointmentPaid(app.status))
    .map((app) => ({
      time: app.time,
      clientName: app.clientName,
      badge: 'Cliente',
      service: app.serviceName,
      cost: app.cost,
      commission: app.cost > 0 ? app.cost * (staff.commissionPercent / 100) : 0
    }));

  // Calculate sum of sales and commission
  const totalTodaySales = todayAppointments.reduce((sum, item) => sum + item.cost, 0);
  const totalTodayCommission = todayAppointments.reduce((sum, item) => sum + item.commission, 0);

  return (
    <div className="space-y-8 animate-fade-in p-1 md:p-6 max-w-7xl mx-auto">
      {/* Back button link */}
      <div>
        <button 
          onClick={onBack}
          className="group flex items-center gap-2 text-outline hover:text-primary text-xs font-bold uppercase tracking-widest transition-colors font-sans"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1 text-secondary" />
          <span>Volver al Listado</span>
        </button>
      </div>

      {/* Staff profile header */}
      <div className="bg-surface-container-lowest p-6 rounded-2xl border border-primary/5 luxury-shadow flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <img 
            referrerPolicy="no-referrer"
            src={staff.image} 
            alt={staff.name} 
            className="w-16 h-16 rounded-full object-cover border-2 border-primary/10 shadow-sm bg-surface-container-low"
          />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-2xl font-bold text-primary">{staff.name}</h2>
              <div className="flex items-center text-amber-500 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                <Star className="w-3.5 h-3.5 fill-current" />
                <span className="text-[10px] font-bold ml-0.5 text-amber-800">5.0 Star Artist</span>
              </div>
            </div>
            <p className="text-xs text-outline font-bold uppercase tracking-wider mt-0.5">{staff.role} | 8 años de experiencia</p>
            <p className="text-xs text-on-surface-variant font-medium mt-1">Especialidad: {staff.specialty}</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <button className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-primary/10 text-primary font-sans text-xs font-bold uppercase tracking-wider hover:bg-surface-container-low transition-colors">
            <Sliders className="w-4 h-4 text-secondary" />
            <span>Editar Perfil</span>
          </button>
          <button 
            onClick={() => window.print()}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-primary/10 text-primary font-sans text-xs font-bold uppercase tracking-wider hover:bg-surface-container-low transition-colors"
          >
            <Download className="w-4 h-4 text-secondary" />
            <span>Descargar Reporte Diario</span>
          </button>
        </div>
      </div>

      {/* Stats KPI overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Weekly Revenue */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-primary/5 luxury-shadow flex items-start justify-between">
          <div className="space-y-3">
            <span className="text-[10px] text-outline font-bold tracking-widest uppercase block">Total Generado (Semanal)</span>
            <div className="flex items-baseline gap-1">
              <span className="font-display text-3xl font-black text-primary">{formatMXN(staff.weeklyRevenue)}</span>
            </div>
            <p className="text-xs text-on-surface-variant">Ventas brutas de tratamientos de lunes a hoy.</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-primary/5 flex items-center justify-center text-primary">
            <TrendingUp className="w-6 h-6 text-secondary" />
          </div>
        </div>

        {/* Commission Rate */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-primary/5 luxury-shadow flex items-start justify-between">
          <div className="space-y-3">
            <span className="text-[10px] text-outline font-bold tracking-widest uppercase block">Comisión Acumulada</span>
            <div className="flex items-baseline gap-1">
              <span className="font-display text-3xl font-black text-secondary">
                {formatMXN(staff.weeklyRevenue * (staff.commissionPercent / 100))}
              </span>
              <span className="text-[10px] text-outline font-sans ml-1">({staff.commissionPercent}%)</span>
            </div>
            <p className="text-xs text-on-surface-variant">Monto líquido a transferir según contrato senior.</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary">
            <Coins className="w-6 h-6" />
          </div>
        </div>

        {/* Payment Liquidation status */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-primary/5 luxury-shadow flex flex-col justify-between">
          <div className="space-y-2">
            <span className="text-[10px] text-outline font-bold tracking-widest uppercase block">Estado Liquidación</span>
            <div className="text-xs font-bold text-primary flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${paymentRequested ? 'bg-amber-500 animate-pulse' : 'bg-primary'}`} />
              <span className="uppercase tracking-wide">{paymentRequested ? 'PENDIENTE VALIDACIÓN' : 'POR LIQUIDAR'}</span>
            </div>
            <p className="text-[11px] text-outline leading-tight">{paymentStatus}</p>
          </div>
          <button 
            onClick={handleRequestPayment}
            disabled={paymentRequested}
            className={`w-full mt-4 py-2 rounded-lg text-center text-[10px] font-sans font-bold uppercase tracking-widest transition-all ${
              paymentRequested 
                ? 'bg-amber-100 text-amber-800 cursor-not-allowed' 
                : 'bg-primary text-on-primary hover:bg-primary-container'
            }`}
          >
            {paymentRequested ? 'Solicitado Correctamente' : 'Solicitar Pago'}
          </button>
        </div>
      </div>

      {/* Graphs & Charts split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Columns: Breathtaking visual bar chart for weekly stats */}
        <div className="lg:col-span-2 bg-surface-container-lowest p-6 rounded-2xl border border-primary/5 luxury-shadow space-y-4">
          <div>
            <h3 className="font-display text-lg font-bold text-primary">Ventas Diarias de la Semana</h3>
            <p className="text-xs text-outline">Rendimiento volumétrico monetario de lunes a domingo.</p>
          </div>

          {/* SVG Custom Chart */}
          <div className="pt-6">
            <div className="h-64 w-full flex items-end justify-between gap-3 px-2 border-b border-primary/10">
              {weeklyPerformance.map((item, idx) => {
                const maxVal = 1000;
                const percentHeight = Math.min((item.sales / maxVal) * 100, 100);
                
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                    {/* Tooltip value */}
                    <span className="text-[9px] font-mono font-bold opacity-0 group-hover:opacity-100 transition-opacity bg-primary text-on-primary px-1.5 py-0.5 rounded -translate-y-1">
                      {formatMXN(item.sales)}
                    </span>
                    {/* Bar graphic */}
                    <div 
                      style={{ height: `${percentHeight}%` }} 
                      className={`w-full rounded-t-lg transition-all duration-500 relative group-hover:bg-secondary ${
                        item.day === 'Sáb' 
                          ? 'bg-secondary' 
                          : 'bg-primary/20'
                      }`}
                    >
                      <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 rounded-t-lg transition-opacity" />
                    </div>
                    {/* Label */}
                    <span className="text-[10px] text-outline font-bold mt-1">{item.day}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between text-[10px] text-outline font-mono mt-3 px-2">
              <span>Cero ventas</span>
              <span>Meta diaria: {formatMXN(500)}</span>
              <span>Max: {formatMXN(1000)}</span>
            </div>
          </div>
        </div>

        {/* Right 1 Column: Biography profile metadata & Specialty focus */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-primary/5 luxury-shadow flex flex-col justify-between">
          <div className="space-y-4">
            <span className="text-[10px] text-outline uppercase font-bold tracking-widest block border-b border-primary/5 pb-2">Biografía & Filosofía</span>
            <p className="text-xs text-on-surface-variant leading-relaxed font-sans font-medium">
              &ldquo;{staff.bio}&rdquo;
            </p>
            
            <div className="pt-4 space-y-3.5">
              <p className="text-[10px] text-outline uppercase font-bold tracking-widest">Atributos Clave</p>
              <div className="flex flex-col gap-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-outline">Puntualidad</span>
                  <span className="font-bold text-primary">100% Impecable</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-outline">Satisfacción de Cliente</span>
                  <span className="font-bold text-primary">5.0 / 5.0 Estrellas</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-outline">Porcentaje Retención</span>
                  <span className="font-bold text-primary">92% Recurrentes</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-emerald-500/[0.03] rounded-xl border border-emerald-500/10 text-xs text-emerald-900 font-medium flex items-start gap-2.5 mt-6">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p>Certificaciones al día para tratamientos de salud orgánica ungueal de alta gama.</p>
          </div>
        </div>
      </div>

      {/* Detalle de trabajos de hoy table */}
      <div className="bg-surface-container-lowest rounded-2xl border border-primary/5 luxury-shadow overflow-hidden">
        <div className="p-6 border-b border-primary/5">
          <h3 className="font-display text-lg font-bold text-primary">Detalle de Trabajos de Hoy</h3>
          <p className="text-xs text-outline">Liquidación detallada de servicios efectuados con comisión del 40% desglosada.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low/50 text-[10px] text-outline font-bold uppercase tracking-widest border-b border-primary/5">
                <th className="py-4 px-6">Hora</th>
                <th className="py-4 px-6">Cliente</th>
                <th className="py-4 px-6">Tratamiento / Servicio</th>
                <th className="py-4 px-6 text-right">Monto Bruto</th>
                <th className="py-4 px-6 text-right">Comisión Senior (40%)</th>
                <th className="py-4 px-6 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary/5">
              {todayAppointments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 px-6 text-center text-xs text-outline">
                    Sin trabajos completados registrados para {staff.name} hoy.
                  </td>
                </tr>
              ) : (
                todayAppointments.map((item, idx) => (
                <tr key={idx} className="hover:bg-surface-container-low/30 transition-colors">
                  <td className="py-4 px-6 font-mono font-bold text-xs text-primary">
                    {item.time}
                  </td>
                  <td className="py-4 px-6">
                    <p className="font-sans font-bold text-xs text-primary">{item.clientName}</p>
                    <span className="text-[9px] bg-primary/5 text-primary px-1.5 py-0.2 rounded font-semibold uppercase">{item.badge}</span>
                  </td>
                  <td className="py-4 px-6 text-xs text-on-surface-variant font-medium">
                    {item.service}
                  </td>
                  <td className="py-4 px-6 text-right font-display font-black text-xs text-primary">
                    {formatServicePrice(item.cost)}
                  </td>
                  <td className="py-4 px-6 text-right font-display font-black text-xs text-secondary">
                    {item.cost > 0 ? formatServicePrice(item.commission) : 'Por definir'}
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-800 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      COMPLETADO
                    </span>
                  </td>
                </tr>
              )))}
            </tbody>
            <tfoot>
              <tr className="bg-surface-container-low/30 font-bold border-t border-primary/10">
                <td colSpan={3} className="py-4 px-6 text-xs text-primary uppercase">Total Acumulado del Día</td>
                <td className="py-4 px-6 text-right font-display font-extrabold text-sm text-primary">
                  {totalTodaySales > 0 ? formatServicePrice(totalTodaySales) : 'Por definir'}
                </td>
                <td className="py-4 px-6 text-right font-display font-extrabold text-sm text-secondary">
                  {totalTodayCommission > 0 ? formatServicePrice(totalTodayCommission) : 'Por definir'}
                </td>
                <td className="py-4 px-6"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
