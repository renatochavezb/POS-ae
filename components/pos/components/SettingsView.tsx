"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Bell,
  CheckCircle2,
  Clock,
  Coins,
  ShieldCheck,
} from "lucide-react";
import { ScheduleConfig, WeeklyHoursConfig, WeeklyHoursSlot } from "../types";
import { DEFAULT_SCHEDULE_CONFIG } from "../scheduleUtils";
import posApi from "@/libs/posApi";
import MasterPinModal from "./MasterPinModal";
import PersonnelPinsPanel from "./PersonnelPinsPanel";

type SettingsViewProps = {
  scheduleConfig: ScheduleConfig;
  onScheduleConfigUpdated?: (config: ScheduleConfig) => void;
  isMasterSession?: boolean;
};

type WeeklyHoursKey = keyof WeeklyHoursConfig;

const SCHEDULE_ROWS: { key: WeeklyHoursKey; label: string }[] = [
  { key: "weekday", label: "Lunes a Viernes" },
  { key: "saturday", label: "Sábados" },
  { key: "sundayHoliday", label: "Domingos y Festivos" },
];

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => hour);

function cloneWeeklyHours(config?: ScheduleConfig): WeeklyHoursConfig {
  const source = config?.weeklyHours || DEFAULT_SCHEDULE_CONFIG.weeklyHours!;
  return {
    weekday: { ...source.weekday },
    saturday: { ...source.saturday },
    sundayHoliday: { ...source.sundayHoliday },
  };
}

function formatHourLabel(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function formatSlotLabel(slot: WeeklyHoursSlot) {
  if (slot.closed) return "Cerrado";
  return `${formatHourLabel(slot.startHour)} - ${formatHourLabel(slot.endHour)}`;
}

export default function SettingsView({
  scheduleConfig,
  onScheduleConfigUpdated,
  isMasterSession = false,
}: SettingsViewProps) {
  const [studioName, setStudioName] = useState("aé Studio");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("info@ae.studioo");
  const [address, setAddress] = useState("Chihuahua, México");

  const [smsNotifications, setSmsNotifications] = useState(true);
  const [whatsappAlerts, setWhatsappAlerts] = useState(true);
  const [autoConfirm, setAutoConfirm] = useState(true);
  const [saved, setSaved] = useState(false);

  const [weeklyHours, setWeeklyHours] = useState<WeeklyHoursConfig>(() =>
    cloneWeeklyHours(scheduleConfig)
  );
  const [hoursSaved, setHoursSaved] = useState(false);
  const [hoursError, setHoursError] = useState<string | null>(null);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isSavingHours, setIsSavingHours] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  useEffect(() => {
    setWeeklyHours(cloneWeeklyHours(scheduleConfig));
  }, [scheduleConfig]);

  const hasHourChanges = useMemo(() => {
    const baseline = cloneWeeklyHours(scheduleConfig);
    return JSON.stringify(baseline) !== JSON.stringify(weeklyHours);
  }, [scheduleConfig, weeklyHours]);

  const handleSave = (event: FormEvent) => {
    event.preventDefault();
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  const updateSlot = (
    key: WeeklyHoursKey,
    patch: Partial<WeeklyHoursSlot>
  ) => {
    setWeeklyHours((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }));
    setHoursSaved(false);
    setHoursError(null);
  };

  const handleSaveHoursClick = () => {
    setHoursError(null);
    setPinError(null);

    for (const row of SCHEDULE_ROWS) {
      const slot = weeklyHours[row.key];
      if (slot.closed) continue;
      if (slot.startHour >= slot.endHour) {
        setHoursError(
          `${row.label}: la hora de cierre debe ser posterior a la de apertura.`
        );
        return;
      }
    }

    setIsPinModalOpen(true);
  };

  const handleConfirmMasterPin = async (pin: string) => {
    setIsSavingHours(true);
    setPinError(null);
    setHoursError(null);

    try {
      const updated = await posApi.updateScheduleConfig({
        pin,
        weeklyHours,
      });
      onScheduleConfigUpdated?.(updated);
      setWeeklyHours(cloneWeeklyHours(updated));
      setIsPinModalOpen(false);
      setHoursSaved(true);
      window.setTimeout(() => setHoursSaved(false), 2500);
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error
          ? error.message
          : "No se pudieron guardar los horarios";
      setPinError(message);
    } finally {
      setIsSavingHours(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in p-1 md:p-6 max-w-4xl mx-auto">
      <div>
        <span className="text-secondary font-sans text-xs font-bold tracking-widest uppercase">
          Preferencias del Sistema
        </span>
        <h2 className="font-display text-3xl font-bold text-primary mt-1">
          Configuración del Studio
        </h2>
        <p className="text-on-surface-variant text-sm mt-1">
          Ajusta la información pública de tu sucursal, alertas de clientes y horarios de
          operación.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 bg-surface-container-lowest p-6 rounded-2xl border border-primary/5 luxury-shadow">
          <form onSubmit={handleSave} className="space-y-6">
            <h3 className="font-display font-bold text-base text-primary border-b border-primary/5 pb-2">
              Información del Salón
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">
                  Nombre del Salón
                </label>
                <input
                  type="text"
                  value={studioName}
                  onChange={(event) => setStudioName(event.target.value)}
                  className="w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">
                  Teléfono Principal
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">
                Correo Electrónico Comercial
              </label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">
                Dirección Física
              </label>
              <input
                type="text"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                className="w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary"
              />
            </div>

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
                    <span className="text-xs font-bold text-primary block">
                      Recordatorios por SMS automáticos
                    </span>
                    <span className="text-[10px] text-outline block">
                      Envía un SMS recordatorio 24 horas antes de la reserva.
                    </span>
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
                    <span className="text-xs font-bold text-primary block">
                      Alertas de confirmación vía WhatsApp Business
                    </span>
                    <span className="text-[10px] text-outline block">
                      Notificación instantánea de nueva cita con enlace para reprogramar.
                    </span>
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
                    <span className="text-xs font-bold text-primary block">
                      Auto-confirmar citas web
                    </span>
                    <span className="text-[10px] text-outline block">
                      Las citas entrantes se aprueban automáticamente si hay disponibilidad de
                      cabina.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <div className="pt-4 flex justify-end items-center gap-3">
              {saved ? (
                <span className="text-xs font-sans font-bold text-emerald-800 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 animate-pulse" /> Preferencias
                  Guardadas
                </span>
              ) : null}
              <button
                type="submit"
                className="px-6 py-2.5 rounded-lg bg-primary text-on-primary hover:bg-primary-container font-sans text-xs font-bold uppercase tracking-wider transition-colors"
              >
                Guardar Cambios
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-6">
          <div className="bg-surface-container-lowest p-6 rounded-2xl border border-primary/5 luxury-shadow space-y-4">
            <div className="border-b border-primary/5 pb-2">
              <h3 className="font-display font-bold text-sm text-primary flex items-center gap-2">
                <Clock className="w-4 h-4 text-secondary" /> Horas de Apertura
              </h3>
              <p className="text-[10px] text-outline mt-1">
                Guardado en MongoDB · requiere clave de administrador
              </p>
            </div>

            <div className="space-y-4 text-xs">
              {SCHEDULE_ROWS.map((row) => {
                const slot = weeklyHours[row.key];

                return (
                  <div key={row.key} className="space-y-2 pb-3 border-b border-primary/5 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-outline font-medium">{row.label}</span>
                      <span className="font-bold text-primary text-[11px]">
                        {formatSlotLabel(slot)}
                      </span>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={slot.closed}
                        onChange={(event) =>
                          updateSlot(row.key, { closed: event.target.checked })
                        }
                        className="rounded border-outline text-primary focus:ring-primary w-4 h-4 accent-primary"
                      />
                      <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
                        Cerrado
                      </span>
                    </label>

                    {!slot.closed ? (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[9px] text-outline font-bold uppercase tracking-wider block">
                            Apertura
                          </label>
                          <select
                            value={slot.startHour}
                            onChange={(event) =>
                              updateSlot(row.key, {
                                startHour: Number(event.target.value),
                              })
                            }
                            className="w-full px-2 py-2 border border-primary/10 rounded-lg text-xs font-bold text-primary bg-surface outline-none focus:border-secondary"
                          >
                            {HOUR_OPTIONS.map((hour) => (
                              <option key={`${row.key}-start-${hour}`} value={hour}>
                                {formatHourLabel(hour)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-outline font-bold uppercase tracking-wider block">
                            Cierre
                          </label>
                          <select
                            value={slot.endHour}
                            onChange={(event) =>
                              updateSlot(row.key, {
                                endHour: Number(event.target.value),
                              })
                            }
                            className="w-full px-2 py-2 border border-primary/10 rounded-lg text-xs font-bold text-primary bg-surface outline-none focus:border-secondary"
                          >
                            {HOUR_OPTIONS.filter((hour) => hour > 0).map((hour) => (
                              <option key={`${row.key}-end-${hour}`} value={hour}>
                                {formatHourLabel(hour)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {hoursError ? (
              <p className="text-[11px] text-red-600 font-medium">{hoursError}</p>
            ) : null}

            <div className="pt-1 flex flex-col gap-2">
              {hoursSaved ? (
                <span className="text-xs font-sans font-bold text-emerald-800 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Horarios guardados en
                  MongoDB
                </span>
              ) : null}
              <button
                type="button"
                onClick={handleSaveHoursClick}
                disabled={!hasHourChanges || isSavingHours}
                className="w-full px-4 py-2.5 rounded-lg bg-primary text-on-primary hover:bg-primary-container font-sans text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Guardar horarios
              </button>
            </div>
          </div>

          {isMasterSession ? <PersonnelPinsPanel /> : null}

          <div className="bg-surface-container-lowest p-6 rounded-2xl border border-primary/5 luxury-shadow space-y-4">
            <h3 className="font-display font-bold text-sm text-primary flex items-center gap-2 border-b border-primary/5 pb-2">
              <ShieldCheck className="w-4 h-4 text-secondary" /> Seguridad & Backup
            </h3>
            <p className="text-xs text-on-surface-variant font-medium leading-relaxed">
              Las copias de seguridad de la base de datos de clientes se realizan diariamente de
              forma cifrada en la nube de studio aé.
            </p>
            <div className="p-3 bg-secondary/5 rounded-xl border border-secondary/15 text-[10px] text-secondary font-bold flex items-center gap-2">
              <Coins className="w-4 h-4 shrink-0" />
              <span>Conexión cifrada SSL Activa (256-bit)</span>
            </div>
          </div>
        </div>
      </div>

      {isPinModalOpen ? (
        <MasterPinModal
          title="Confirmar cambio de horarios"
          description="Ingresa la clave de administrador para guardar los horarios en MongoDB."
          confirmLabel="Guardar horarios"
          isSubmitting={isSavingHours}
          error={pinError}
          onConfirm={handleConfirmMasterPin}
          onClose={() => {
            if (isSavingHours) return;
            setIsPinModalOpen(false);
            setPinError(null);
          }}
        />
      ) : null}
    </div>
  );
}
