import React, { useState } from 'react';
import { 
  Settings, 
  MapPin, 
  Phone, 
  Mail, 
  Clock, 
  Bell, 
  CheckCircle2, 
  ShieldCheck, 
  Coins, 
  Sparkles,
  Info
} from 'lucide-react';

export default function SettingsView() {
  
  const [studioName, setStudioName] = useState('aé Studio');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('info@ae.studioo');
  const [address, setAddress] = useState('Chihuahua, México');
  
  const [smsNotifications, setSmsNotifications] = useState(true);
  const [whatsappAlerts, setWhatsappAlerts] = useState(true);
  const [autoConfirm, setAutoConfirm] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-8 animate-fade-in p-1 md:p-6 max-w-4xl mx-auto">
      {/* Top Header section */}
      <div>
        <span className="text-secondary font-sans text-xs font-bold tracking-widest uppercase">Preferencias del Sistema</span>
        <h2 className="font-display text-3xl font-bold text-primary mt-1">Configuración del Studio</h2>
        <p className="text-on-surface-variant text-sm mt-1">Ajusta la información pública de tu sucursal, alertas de clientes y pasarela de pago.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Form: Studio Info */}
        <div className="md:col-span-2 bg-surface-container-lowest p-6 rounded-2xl border border-primary/5 luxury-shadow">
          <form onSubmit={handleSave} className="space-y-6">
            <h3 className="font-display font-bold text-base text-primary border-b border-primary/5 pb-2">Información del Salón</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">Nombre del Salón</label>
                <input 
                  type="text" 
                  value={studioName}
                  onChange={(e) => setStudioName(e.target.value)}
                  className="w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">Teléfono Principal</label>
                <input 
                  type="text" 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">Correo Electrónico Comercial</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">Dirección Física</label>
              <input 
                type="text" 
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary"
              />
            </div>

            {/* Notifications switches */}
            <div className="space-y-4 pt-4 border-t border-primary/5">
              <h4 className="font-display font-bold text-sm text-primary flex items-center gap-2">
                <Bell className="w-4 h-4 text-secondary" />
                Comunicaciones con Clientes
              </h4>

              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input 
                    type="checkbox"
                    checked={smsNotifications}
                    onChange={() => setSmsNotifications(!smsNotifications)}
                    className="rounded border-outline text-primary focus:ring-primary w-4 h-4 accent-primary"
                  />
                  <div>
                    <span className="text-xs font-bold text-primary block">Recordatorios por SMS automáticos</span>
                    <span className="text-[10px] text-outline block">Envía un SMS recordatorio 24 horas antes de la reserva.</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input 
                    type="checkbox"
                    checked={whatsappAlerts}
                    onChange={() => setWhatsappAlerts(!whatsappAlerts)}
                    className="rounded border-outline text-primary focus:ring-primary w-4 h-4 accent-primary"
                  />
                  <div>
                    <span className="text-xs font-bold text-primary block">Alertas de confirmación vía WhatsApp Business</span>
                    <span className="text-[10px] text-outline block">Notificación instantánea de nueva cita con enlace para reprogramar.</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input 
                    type="checkbox"
                    checked={autoConfirm}
                    onChange={() => setAutoConfirm(!autoConfirm)}
                    className="rounded border-outline text-primary focus:ring-primary w-4 h-4 accent-primary"
                  />
                  <div>
                    <span className="text-xs font-bold text-primary block">Auto-confirmar citas web</span>
                    <span className="text-[10px] text-outline block">Las citas entrantes se aprueban automáticamente si hay disponibilidad de cabina.</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Action Save button */}
            <div className="pt-4 flex justify-end items-center gap-3">
              {saved && (
                <span className="text-xs font-sans font-bold text-emerald-800 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 animate-pulse" /> Preferencias Guardadas
                </span>
              )}
              <button 
                type="submit"
                className="px-6 py-2.5 rounded-lg bg-primary text-on-primary hover:bg-primary-container font-sans text-xs font-bold uppercase tracking-wider transition-colors"
              >
                Guardar Cambios
              </button>
            </div>
          </form>
        </div>

        {/* Right Info: Credentials & Support */}
        <div className="space-y-6">
          {/* Working hours card */}
          <div className="bg-surface-container-lowest p-6 rounded-2xl border border-primary/5 luxury-shadow space-y-4">
            <h3 className="font-display font-bold text-sm text-primary flex items-center gap-2 border-b border-primary/5 pb-2">
              <Clock className="w-4 h-4 text-secondary" /> Horas de Apertura
            </h3>
            
            <div className="space-y-2 text-xs">
              {[
                { days: 'Lunes a Viernes', hours: '09:00 - 21:00' },
                { days: 'Sábados', hours: '09:00 - 18:00' },
                { days: 'Domingos y Festivos', hours: 'Cerrado' }
              ].map((item, idx) => (
                <div key={idx} className="flex justify-between items-center py-1">
                  <span className="text-outline font-medium">{item.days}</span>
                  <span className="font-bold text-primary">{item.hours}</span>
                </div>
              ))}
            </div>
          </div>

          {/* System Security */}
          <div className="bg-surface-container-lowest p-6 rounded-2xl border border-primary/5 luxury-shadow space-y-4">
            <h3 className="font-display font-bold text-sm text-primary flex items-center gap-2 border-b border-primary/5 pb-2">
              <ShieldCheck className="w-4 h-4 text-secondary" /> Seguridad & Backup
            </h3>
            <p className="text-xs text-on-surface-variant font-medium leading-relaxed">
              Las copias de seguridad de la base de datos de clientes se realizan diariamente de forma cifrada en la nube de studio aé.
            </p>
            <div className="p-3 bg-secondary/5 rounded-xl border border-secondary/15 text-[10px] text-secondary font-bold flex items-center gap-2">
              <Coins className="w-4 h-4 shrink-0" />
              <span>Conexión cifrada SSL Activa (256-bit)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
