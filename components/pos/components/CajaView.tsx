"use client";

import { ReactNode, useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  CreditCard,
  ArrowRightLeft,
  Wallet,
  Lock,
  Unlock,
  Receipt,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  History,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Appointment, CashRegisterState, CashSession, PaymentMethod, PosPayment, Receptionist } from '../types';
import { formatMXN } from '../data';
import { formatAppointmentTimeRange } from '../scheduleUtils';
import { isAppointmentPendingPayment, normalizeAppointmentStatus } from '../appointmentStatus';
import posApi from '@/libs/posApi';

interface CajaViewProps {
  appointments: Appointment[];
  todayLabel: string;
  receptionists: Receptionist[];
  loggedInReceptionist: Receptionist | null;
  onPaymentComplete: () => Promise<void> | void;
}

const EMPTY_SUMMARY = {
  count: 0,
  total: 0,
  efectivo: 0,
  tarjeta: 0,
  transferencia: 0,
  tips: 0,
  services: 0,
};

const METHOD_OPTIONS: { id: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { id: 'efectivo', label: 'Efectivo', icon: Banknote },
  { id: 'tarjeta', label: 'Tarjeta', icon: CreditCard },
  { id: 'transferencia', label: 'Transferencia', icon: ArrowRightLeft },
  { id: 'mixto', label: 'Mixto', icon: Wallet },
];

export default function CajaView({
  appointments,
  todayLabel,
  receptionists,
  loggedInReceptionist,
  onPaymentComplete,
}: CajaViewProps) {
  const [registerState, setRegisterState] = useState<CashRegisterState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [tip, setTip] = useState('0');
  const [method, setMethod] = useState<PaymentMethod>('efectivo');
  const [cashAmount, setCashAmount] = useState('');
  const [cardAmount, setCardAmount] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [notes, setNotes] = useState('');

  const [showOpenModal, setShowOpenModal] = useState(false);
  const [openingFloat, setOpeningFloat] = useState('0');
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closingCountedCash, setClosingCountedCash] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [openReceptionistId, setOpenReceptionistId] = useState('');
  const [openPin, setOpenPin] = useState('');
  const [closeReceptionistId, setCloseReceptionistId] = useState('');
  const [closePin, setClosePin] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);

  const [historyScope, setHistoryScope] = useState<'today' | 'all'>('today');
  const [closedSessions, setClosedSessions] = useState<CashSession[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [expandedPayments, setExpandedPayments] = useState<PosPayment[]>([]);
  const [expandedPaymentsLoading, setExpandedPaymentsLoading] = useState(false);

  const pendingAppointments = useMemo(
    () =>
      appointments
        .filter(
          (appointment) =>
            appointment.date === todayLabel &&
            isAppointmentPendingPayment(appointment.status)
        )
        .sort((a, b) => a.time.localeCompare(b.time)),
    [appointments, todayLabel]
  );

  const selectedAppointment = pendingAppointments.find(
    (appointment) => appointment.id === selectedAppointmentId
  );

  const loadRegister = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const state = await posApi.getCashRegisterState();
      setRegisterState(state);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar la caja');
    } finally {
      setIsLoading(false);
    }
  };

  const loadHistory = async (scope: 'today' | 'all' = historyScope) => {
    setIsHistoryLoading(true);
    try {
      const result = await posApi.getCashSessionHistory({
        scope,
        date: todayLabel,
        limit: scope === 'today' ? 20 : 50,
      });
      setClosedSessions(result.sessions);
    } catch (historyError) {
      console.error(historyError);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const loadSessionPayments = async (sessionId: string) => {
    if (expandedSessionId === sessionId) {
      setExpandedSessionId(null);
      setExpandedPayments([]);
      return;
    }

    setExpandedSessionId(sessionId);
    setExpandedPaymentsLoading(true);
    try {
      const result = await posApi.getPayments({ sessionCode: sessionId });
      setExpandedPayments(result.payments);
    } catch (paymentsError) {
      console.error(paymentsError);
      setExpandedPayments([]);
    } finally {
      setExpandedPaymentsLoading(false);
    }
  };

  useEffect(() => {
    loadRegister();
  }, []);

  useEffect(() => {
    loadHistory(historyScope);
  }, [historyScope]);

  useEffect(() => {
    if (!selectedAppointment) return;
    setAmount(String(selectedAppointment.cost || 0));
    setTip('0');
    setMethod('efectivo');
    setCashAmount('');
    setCardAmount('');
    setTransferAmount('');
    setNotes('');
  }, [selectedAppointment?.id]);

  const serviceTotal = Number(amount) || 0;
  const tipValue = Number(tip) || 0;
  const paymentTotal = serviceTotal + tipValue;

  const expectedCash =
    (registerState?.session?.openingFloat ?? 0) + (registerState?.shiftSummary.efectivo ?? 0);

  const defaultReceptionistId =
    loggedInReceptionist?.id || receptionists[0]?.id || '';

  const resetOpenModal = () => {
    setOpeningFloat('0');
    setOpenReceptionistId(defaultReceptionistId);
    setOpenPin('');
    setModalError(null);
  };

  const resetCloseModal = () => {
    setClosingCountedCash(String(Math.round(expectedCash)));
    setCloseReceptionistId(defaultReceptionistId);
    setClosePin('');
    setClosingNotes('');
    setModalError(null);
  };

  const handleOpenSession = async () => {
    if (!openReceptionistId) {
      setModalError('Selecciona una recepcionista.');
      return;
    }
    if (openPin.length !== 4) {
      setModalError('Ingresa la clave de 4 dígitos.');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);
    setError(null);
    try {
      await posApi.openCashSession({
        openingFloat: Number(openingFloat) || 0,
        receptionistId: openReceptionistId,
        pin: openPin,
      });
      setShowOpenModal(false);
      resetOpenModal();
      await loadRegister();
    } catch (openError) {
      setModalError(openError instanceof Error ? openError.message : 'No se pudo abrir caja');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseSession = async () => {
    if (!registerState?.session) return;

    if (!closeReceptionistId) {
      setModalError('Selecciona una recepcionista.');
      return;
    }
    if (closePin.length !== 4) {
      setModalError('Ingresa la clave de 4 dígitos.');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);
    setError(null);
    try {
      await posApi.closeCashSession(registerState.session.id, {
        closingCountedCash: Number(closingCountedCash) || 0,
        closingNotes,
        receptionistId: closeReceptionistId,
        pin: closePin,
      });
      setShowCloseModal(false);
      resetCloseModal();
      await loadRegister();
      await loadHistory(historyScope);
    } catch (closeError) {
      setModalError(closeError instanceof Error ? closeError.message : 'No se pudo cerrar caja');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterPayment = async () => {
    if (!selectedAppointment || !registerState?.session) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        appointmentId: selectedAppointment.id,
        amount: serviceTotal,
        tip: tipValue,
        method,
        notes,
        processedByReceptionistId: loggedInReceptionist?.id,
        processedByReceptionistName: loggedInReceptionist?.name,
        ...(method === 'mixto'
          ? {
              cashAmount: Number(cashAmount) || 0,
              cardAmount: Number(cardAmount) || 0,
              transferAmount: Number(transferAmount) || 0,
            }
          : {}),
      };

      await posApi.registerPayment(payload);
      setSelectedAppointmentId(null);
      await loadRegister();
      await onPaymentComplete();
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : 'No se pudo registrar el pago');
    } finally {
      setIsSubmitting(false);
    }
  };

  const shiftSummary = registerState?.shiftSummary ?? EMPTY_SUMMARY;
  const daySummary = registerState?.daySummary ?? EMPTY_SUMMARY;
  const shiftPayments = registerState?.shiftPayments ?? [];
  const session = registerState?.session;

  if (isLoading && !registerState) {
    return (
      <div className="flex items-center justify-center min-h-[420px]">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in p-1 md:p-2 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <span className="text-secondary font-sans text-xs font-bold tracking-widest uppercase">Punto de venta</span>
          <h2 className="font-display text-3xl font-bold text-primary mt-1">Caja del Salón</h2>
          <p className="text-on-surface-variant text-sm mt-1">
            Cobros del día {todayLabel} · turno {session ? 'abierto' : 'cerrado'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {session ? (
            <>
              <div className="px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                <Unlock className="w-4 h-4" />
                Turno abierto
                {session.openedByReceptionistName ? ` · ${session.openedByReceptionistName}` : ''}
              </div>
              <button
                type="button"
                onClick={() => {
                  resetCloseModal();
                  setShowCloseModal(true);
                }}
                className="px-4 py-2.5 rounded-lg bg-primary text-on-primary font-sans text-xs font-bold uppercase tracking-wider hover:bg-primary-container transition-colors flex items-center gap-2"
              >
                <Lock className="w-4 h-4" />
                Corte de caja
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                resetOpenModal();
                setShowOpenModal(true);
              }}
              className="px-4 py-2.5 rounded-lg bg-primary text-on-primary font-sans text-xs font-bold uppercase tracking-wider hover:bg-primary-container transition-colors flex items-center gap-2"
            >
              <Unlock className="w-4 h-4" />
              Abrir turno
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <SummaryCard title="Turno actual" summary={shiftSummary} accent="secondary" />
        <SummaryCard title="Total del día" summary={daySummary} accent="primary" />
        <MetricCard
          label="Fondo de caja"
          value={formatMXN(session?.openingFloat ?? 0)}
          hint="Al abrir turno"
        />
        <MetricCard
          label="Efectivo esperado"
          value={formatMXN(expectedCash)}
          hint="Fondo + cobros en efectivo"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="xl:col-span-1 bg-surface border border-primary/10 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-primary/5 bg-surface-container-low/40">
            <h3 className="font-display text-lg font-bold text-primary">Por cobrar hoy</h3>
            <p className="text-xs text-outline mt-1">{pendingAppointments.length} citas pendientes de pago</p>
          </div>
          <div className="max-h-[520px] overflow-y-auto divide-y divide-primary/5">
            {pendingAppointments.length === 0 ? (
              <p className="p-6 text-sm text-outline text-center">No hay citas pendientes de cobro.</p>
            ) : (
              pendingAppointments.map((appointment) => {
                const isSelected = appointment.id === selectedAppointmentId;
                const status = normalizeAppointmentStatus(appointment.status);

                return (
                  <button
                    key={appointment.id}
                    type="button"
                    onClick={() => setSelectedAppointmentId(appointment.id)}
                    className={`w-full text-left p-4 transition-colors ${
                      isSelected ? 'bg-primary/5 border-l-2 border-secondary' : 'hover:bg-surface-container-low'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-sans text-sm font-bold text-primary">{appointment.clientName}</p>
                        <p className="text-xs text-outline mt-0.5">{appointment.serviceName}</p>
                        <p className="text-[10px] text-outline mt-1">
                          {appointment.time} · {appointment.staffName}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-display text-sm font-bold text-primary">
                          {formatMXN(appointment.cost || 0)}
                        </p>
                        <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900">
                          {status}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section className="xl:col-span-1 bg-surface border border-primary/10 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-primary/5 bg-surface-container-low/40">
            <h3 className="font-display text-lg font-bold text-primary">Registrar cobro</h3>
            <p className="text-xs text-outline mt-1">Efectivo, tarjeta, transferencia o mixto</p>
          </div>

          {!session ? (
            <div className="p-6 text-center space-y-3">
              <Lock className="w-10 h-10 text-outline mx-auto" />
              <p className="text-sm text-outline">Abre un turno de caja para empezar a cobrar.</p>
            </div>
          ) : !selectedAppointment ? (
            <div className="p-6 text-center space-y-3">
              <Receipt className="w-10 h-10 text-outline mx-auto" />
              <p className="text-sm text-outline">Selecciona una cita de la cola para cobrar.</p>
            </div>
          ) : (
            <div className="p-5 space-y-4">
              <div className="rounded-xl bg-surface-container-low p-4 border border-primary/5">
                <p className="text-xs font-bold uppercase tracking-wider text-outline">Cliente</p>
                <p className="font-sans text-sm font-bold text-primary mt-1">{selectedAppointment.clientName}</p>
                <p className="text-xs text-outline mt-2">{selectedAppointment.serviceName}</p>
                <p className="text-[10px] text-outline mt-1">
                  {formatAppointmentTimeRange(selectedAppointment.time, selectedAppointment.duration)} · {selectedAppointment.staffName}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Importe servicio">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className={fieldClassName}
                  />
                </Field>
                <Field label="Propina">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={tip}
                    onChange={(e) => setTip(e.target.value)}
                    className={fieldClassName}
                  />
                </Field>
              </div>

              <div>
                <p className="text-[10px] text-outline font-bold uppercase tracking-wider mb-2">Método de pago</p>
                <div className="grid grid-cols-2 gap-2">
                  {METHOD_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const active = method === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setMethod(option.id)}
                        className={`px-3 py-2.5 rounded-lg border text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors ${
                          active
                            ? 'bg-primary text-on-primary border-primary'
                            : 'bg-surface border-primary/10 text-outline hover:border-secondary'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {method === 'mixto' && (
                <div className="grid grid-cols-3 gap-2">
                  <Field label="Efectivo">
                    <input type="number" min="0" step="0.01" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} className={fieldClassName} />
                  </Field>
                  <Field label="Tarjeta">
                    <input type="number" min="0" step="0.01" value={cardAmount} onChange={(e) => setCardAmount(e.target.value)} className={fieldClassName} />
                  </Field>
                  <Field label="Transf.">
                    <input type="number" min="0" step="0.01" value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} className={fieldClassName} />
                  </Field>
                </div>
              )}

              <Field label="Notas">
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Opcional"
                  className={fieldClassName}
                />
              </Field>

              <div className="rounded-xl bg-primary/5 border border-primary/10 p-4 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-outline">Total a cobrar</span>
                <span className="font-display text-2xl font-bold text-primary">{formatMXN(paymentTotal)}</span>
              </div>

              <button
                type="button"
                disabled={isSubmitting || paymentTotal <= 0}
                onClick={handleRegisterPayment}
                className="w-full py-3 rounded-xl bg-primary text-on-primary font-sans text-xs font-bold uppercase tracking-wider hover:bg-primary-container transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Registrar pago
              </button>
            </div>
          )}
        </section>

        <section className="xl:col-span-1 bg-surface border border-primary/10 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-primary/5 bg-surface-container-low/40">
            <h3 className="font-display text-lg font-bold text-primary">Movimientos del turno</h3>
            <p className="text-xs text-outline mt-1">{shiftPayments.length} pagos registrados</p>
          </div>
          <div className="max-h-[520px] overflow-y-auto divide-y divide-primary/5">
            {shiftPayments.length === 0 ? (
              <p className="p-6 text-sm text-outline text-center">Aún no hay cobros en este turno.</p>
            ) : (
              shiftPayments.map((payment) => (
                <PaymentRow key={payment.id} payment={payment} />
              ))
            )}
          </div>
        </section>
      </div>

      <section className="bg-surface border border-primary/10 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-primary/5 bg-surface-container-low/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold text-primary flex items-center gap-2">
              <History className="w-5 h-5 text-secondary" />
              Historial de cortes
            </h3>
            <p className="text-xs text-outline mt-1">
              Turnos cerrados guardados en MongoDB
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setHistoryScope('today')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-colors ${
                historyScope === 'today'
                  ? 'bg-primary text-on-primary border-primary'
                  : 'border-primary/10 text-outline hover:text-primary'
              }`}
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => setHistoryScope('all')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-colors ${
                historyScope === 'all'
                  ? 'bg-primary text-on-primary border-primary'
                  : 'border-primary/10 text-outline hover:text-primary'
              }`}
            >
              Recientes
            </button>
          </div>
        </div>

        <div className="divide-y divide-primary/5">
          {isHistoryLoading ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-secondary" />
            </div>
          ) : closedSessions.length === 0 ? (
            <p className="p-6 text-sm text-outline text-center">
              {historyScope === 'today'
                ? 'No hay cortes registrados hoy.'
                : 'Aún no hay cortes de caja en el historial.'}
            </p>
          ) : (
            closedSessions.map((closedSession) => (
              <CloseHistoryRow
                key={closedSession.id}
                session={closedSession}
                isExpanded={expandedSessionId === closedSession.id}
                isLoadingPayments={expandedPaymentsLoading && expandedSessionId === closedSession.id}
                payments={expandedSessionId === closedSession.id ? expandedPayments : []}
                onToggle={() => loadSessionPayments(closedSession.id)}
              />
            ))
          )}
        </div>
      </section>

      {showOpenModal && (
        <Modal title="Abrir turno de caja" onClose={() => setShowOpenModal(false)}>
          <div className="space-y-4">
            <ReceptionistPinFields
              receptionists={receptionists}
              receptionistId={openReceptionistId}
              pin={openPin}
              onReceptionistChange={setOpenReceptionistId}
              onPinChange={setOpenPin}
            />
            <Field label="Fondo inicial en efectivo">
              <input
                type="number"
                min="0"
                step="0.01"
                value={openingFloat}
                onChange={(e) => setOpeningFloat(e.target.value)}
                className={fieldClassName}
              />
            </Field>
            <p className="text-xs text-outline">
              La apertura queda registrada en Mongo con la recepcionista que autoriza.
            </p>
            {modalError && <ModalError message={modalError} />}
            <button
              type="button"
              disabled={isSubmitting || openPin.length !== 4 || !openReceptionistId}
              onClick={handleOpenSession}
              className="w-full py-3 rounded-xl bg-primary text-on-primary font-sans text-xs font-bold uppercase tracking-wider disabled:opacity-40"
            >
              {isSubmitting ? 'Validando...' : 'Confirmar apertura'}
            </button>
          </div>
        </Modal>
      )}

      {showCloseModal && session && (
        <Modal title="Corte de caja" onClose={() => setShowCloseModal(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-surface-container-low p-3 border border-primary/5">
                <p className="text-[10px] uppercase tracking-wider text-outline font-bold">Servicios turno</p>
                <p className="font-bold text-primary mt-1">{shiftSummary.count}</p>
              </div>
              <div className="rounded-xl bg-surface-container-low p-3 border border-primary/5">
                <p className="text-[10px] uppercase tracking-wider text-outline font-bold">Total turno</p>
                <p className="font-bold text-primary mt-1">{formatMXN(shiftSummary.total)}</p>
              </div>
              <div className="rounded-xl bg-surface-container-low p-3 border border-primary/5">
                <p className="text-[10px] uppercase tracking-wider text-outline font-bold">Efectivo esperado</p>
                <p className="font-bold text-primary mt-1">{formatMXN(expectedCash)}</p>
              </div>
              <div className="rounded-xl bg-surface-container-low p-3 border border-primary/5">
                <p className="text-[10px] uppercase tracking-wider text-outline font-bold">Tarjeta + transf.</p>
                <p className="font-bold text-primary mt-1">
                  {formatMXN(shiftSummary.tarjeta + shiftSummary.transferencia)}
                </p>
              </div>
            </div>

            <Field label="Efectivo contado en caja">
              <input
                type="number"
                min="0"
                step="0.01"
                value={closingCountedCash}
                onChange={(e) => setClosingCountedCash(e.target.value)}
                className={fieldClassName}
              />
            </Field>

            <Field label="Notas del corte">
              <textarea
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                rows={3}
                className={`${fieldClassName} resize-none`}
              />
            </Field>

            {closingCountedCash !== '' && (
              <div className={`rounded-xl p-3 text-sm border ${
                Math.abs(Number(closingCountedCash) - expectedCash) < 0.01
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}>
                Diferencia: {formatMXN(Number(closingCountedCash) - expectedCash)}
              </div>
            )}

            <ReceptionistPinFields
              receptionists={receptionists}
              receptionistId={closeReceptionistId}
              pin={closePin}
              onReceptionistChange={setCloseReceptionistId}
              onPinChange={setClosePin}
            />

            {modalError && <ModalError message={modalError} />}

            <button
              type="button"
              disabled={isSubmitting || closePin.length !== 4 || !closeReceptionistId}
              onClick={handleCloseSession}
              className="w-full py-3 rounded-xl bg-primary text-on-primary font-sans text-xs font-bold uppercase tracking-wider disabled:opacity-40"
            >
              {isSubmitting ? 'Validando...' : 'Cerrar turno'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

const fieldClassName =
  'w-full px-3 py-2.5 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary';

function SummaryCard({
  title,
  summary,
  accent,
}: {
  title: string;
  summary: CashRegisterState['shiftSummary'];
  accent: 'primary' | 'secondary';
}) {
  return (
    <div className="bg-surface border border-primary/10 rounded-2xl p-5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-outline">{title}</p>
      <p className={`font-display text-2xl font-bold mt-2 ${accent === 'secondary' ? 'text-secondary' : 'text-primary'}`}>
        {formatMXN(summary.total)}
      </p>
      <div className="grid grid-cols-3 gap-2 mt-4 text-[10px]">
        <div>
          <p className="text-outline font-bold uppercase">Efectivo</p>
          <p className="font-bold text-primary mt-1">{formatMXN(summary.efectivo)}</p>
        </div>
        <div>
          <p className="text-outline font-bold uppercase">Tarjeta</p>
          <p className="font-bold text-primary mt-1">{formatMXN(summary.tarjeta)}</p>
        </div>
        <div>
          <p className="text-outline font-bold uppercase">Transf.</p>
          <p className="font-bold text-primary mt-1">{formatMXN(summary.transferencia)}</p>
        </div>
      </div>
      <p className="text-[10px] text-outline mt-3">{summary.count} servicios · propinas {formatMXN(summary.tips)}</p>
    </div>
  );
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="bg-surface border border-primary/10 rounded-2xl p-5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-outline">{label}</p>
      <p className="font-display text-2xl font-bold text-primary mt-2">{value}</p>
      <p className="text-[10px] text-outline mt-2">{hint}</p>
    </div>
  );
}

function CloseHistoryRow({
  session,
  isExpanded,
  isLoadingPayments,
  payments,
  onToggle,
}: {
  session: CashSession;
  isExpanded: boolean;
  isLoadingPayments: boolean;
  payments: PosPayment[];
  onToggle: () => void;
}) {
  const closedTime = session.closedAt
    ? new Date(session.closedAt).toLocaleString('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
        day: 'numeric',
        month: 'short',
      })
    : '—';

  const varianceOk = Math.abs(session.variance) < 0.01;

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left p-4 hover:bg-surface-container-low transition-colors"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-sans text-sm font-bold text-primary">
              Corte · {session.shiftDate}
            </p>
            <p className="text-[10px] text-outline mt-1">
              Cerrado {closedTime}
              {session.closedByReceptionistName
                ? ` · ${session.closedByReceptionistName}`
                : session.closedByReceptionistId
                ? ` · ${session.closedByReceptionistId}`
                : ''}
              {session.closedWithMasterPin ? ' · Master' : ''}
            </p>
            <div className="flex flex-wrap gap-2 mt-2 text-[10px]">
              <span className="px-2 py-0.5 rounded-full bg-surface-container-low border border-primary/10 text-outline font-bold">
                {session.paymentsCount} cobros
              </span>
              <span className="px-2 py-0.5 rounded-full bg-surface-container-low border border-primary/10 text-outline font-bold">
                Fondo {formatMXN(session.openingFloat)}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full font-bold border ${
                  varianceOk
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                Dif. {formatMXN(session.variance)}
              </span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="font-display text-lg font-bold text-primary">
              {formatMXN(session.totalAmount)}
            </p>
            <p className="text-[10px] text-outline mt-1">
              Efe. {formatMXN(session.totalEfectivo)} · Tarj. {formatMXN(session.totalTarjeta)}
            </p>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-outline ml-auto mt-2" />
            ) : (
              <ChevronDown className="w-4 h-4 text-outline ml-auto mt-2" />
            )}
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 bg-surface-container-low/30 border-t border-primary/5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-3 text-[10px]">
            <div>
              <p className="text-outline font-bold uppercase">Esperado</p>
              <p className="font-bold text-primary mt-1">{formatMXN(session.expectedCash)}</p>
            </div>
            <div>
              <p className="text-outline font-bold uppercase">Contado</p>
              <p className="font-bold text-primary mt-1">{formatMXN(session.closingCountedCash)}</p>
            </div>
            <div>
              <p className="text-outline font-bold uppercase">Transferencia</p>
              <p className="font-bold text-primary mt-1">{formatMXN(session.totalTransferencia)}</p>
            </div>
            <div>
              <p className="text-outline font-bold uppercase">Apertura</p>
              <p className="font-bold text-primary mt-1">
                {session.openedByReceptionistName || session.openedByReceptionistId || '—'}
                {session.openedWithMasterPin ? ' (Master)' : ''}
              </p>
            </div>
          </div>

          {session.closingNotes && (
            <p className="text-xs text-outline mb-3 px-1">
              <span className="font-bold uppercase text-[10px]">Notas: </span>
              {session.closingNotes}
            </p>
          )}

          <p className="text-[10px] font-bold uppercase tracking-wider text-outline mb-2">
            Cobros del turno
          </p>

          {isLoadingPayments ? (
            <div className="py-4 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-secondary" />
            </div>
          ) : payments.length === 0 ? (
            <p className="text-xs text-outline py-2">Sin pagos en este turno.</p>
          ) : (
            <div className="rounded-xl border border-primary/10 overflow-hidden divide-y divide-primary/5 bg-surface">
              {payments.map((payment) => (
                <PaymentRow key={payment.id} payment={payment} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PaymentRow({ payment }: { payment: PosPayment }) {
  const methodLabel =
    payment.method === 'mixto'
      ? 'Mixto'
      : payment.method.charAt(0).toUpperCase() + payment.method.slice(1);

  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-sans text-sm font-bold text-primary">{payment.clientName}</p>
          <p className="text-xs text-outline mt-0.5">{payment.serviceName}</p>
          <p className="text-[10px] text-outline mt-1 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {payment.createdAt
              ? new Date(payment.createdAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
              : '—'}
            · {methodLabel}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-sm font-bold text-primary">{formatMXN(payment.total)}</p>
          {payment.tip > 0 && (
            <p className="text-[10px] text-outline">+ propina {formatMXN(payment.tip)}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ReceptionistPinFields({
  receptionists,
  receptionistId,
  pin,
  onReceptionistChange,
  onPinChange,
}: {
  receptionists: Receptionist[];
  receptionistId: string;
  pin: string;
  onReceptionistChange: (value: string) => void;
  onPinChange: (value: string) => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-primary/10 bg-surface-container-low/40 p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-outline">
        Autorización de recepción
      </p>
      <Field label="Recepcionista">
        <select
          value={receptionistId}
          onChange={(e) => onReceptionistChange(e.target.value)}
          className={fieldClassName}
        >
          <option value="">Seleccionar...</option>
          {receptionists.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name} ({member.id})
            </option>
          ))}
        </select>
      </Field>
      <Field label="Clave de 4 dígitos">
        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={(e) => onPinChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
          className={`${fieldClassName} tracking-[0.45em] text-center`}
          placeholder="••••"
        />
      </Field>
    </div>
  );
}

function ModalError({ message }: { message: string }) {
  return (
    <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
      <AlertCircle className="w-4 h-4 shrink-0" />
      {message}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] text-outline font-bold uppercase tracking-wider">{label}</span>
      {children}
    </label>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-surface max-w-md w-full rounded-2xl border border-primary/10 luxury-shadow overflow-hidden">
        <div className="px-5 py-4 border-b border-primary/5 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-primary">{title}</h3>
          <button type="button" onClick={onClose} className="text-outline hover:text-primary text-sm font-bold">
            Cerrar
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
