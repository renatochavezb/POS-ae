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
import {
  clearCashCloseDraft,
  readCashCloseDraft,
  writeCashCloseDraft,
} from '@/libs/cashCloseDraft';
import AppointmentServiceList from '../serviceDisplay';

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

const amountsMatch = (left: number, right: number) => Math.abs(left - right) < 0.01;

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
  const [closingCountedCard, setClosingCountedCard] = useState('');
  const [closingCountedTransfer, setClosingCountedTransfer] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [closeTitleClicks, setCloseTitleClicks] = useState(0);
  const [showCloseAdminDetails, setShowCloseAdminDetails] = useState(false);
  const [showAdminPinPrompt, setShowAdminPinPrompt] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [adminPinError, setAdminPinError] = useState<string | null>(null);
  const [openReceptionistId, setOpenReceptionistId] = useState('');
  const [openPin, setOpenPin] = useState('');
  const [closeReceptionistId, setCloseReceptionistId] = useState('');
  const [closePin, setClosePin] = useState('');
  const [closeDraftActive, setCloseDraftActive] = useState(false);
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
    if (closeTitleClicks === 0) return;
    const timer = window.setTimeout(() => setCloseTitleClicks(0), 900);
    return () => window.clearTimeout(timer);
  }, [closeTitleClicks]);

  useEffect(() => {
    if (closeTitleClicks < 3) return;
    setCloseTitleClicks(0);
    setShowAdminPinPrompt(true);
    setAdminPinError(null);
  }, [closeTitleClicks]);

  useEffect(() => {
    if (!showCloseModal || !registerState?.session?.id) return;

    const timer = window.setTimeout(() => {
      writeCashCloseDraft(registerState.session!.id, {
        closingCountedCash,
        closingCountedCard,
        closingCountedTransfer,
        closingNotes,
      });
      setCloseDraftActive(true);
    }, 400);

    return () => window.clearTimeout(timer);
  }, [
    showCloseModal,
    registerState?.session?.id,
    closingCountedCash,
    closingCountedCard,
    closingCountedTransfer,
    closingNotes,
  ]);

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
  const expectedCard = registerState?.shiftSummary.tarjeta ?? 0;
  const expectedTransfer = registerState?.shiftSummary.transferencia ?? 0;

  const closeCountsReady =
    closingCountedCash !== '' &&
    closingCountedCard !== '' &&
    closingCountedTransfer !== '';

  const cashVariance = closeCountsReady ? Number(closingCountedCash) - expectedCash : 0;
  const cardVariance = closeCountsReady ? Number(closingCountedCard) - expectedCard : 0;
  const transferVariance = closeCountsReady
    ? Number(closingCountedTransfer) - expectedTransfer
    : 0;

  const isPerfectCut =
    closeCountsReady &&
    amountsMatch(Number(closingCountedCash), expectedCash) &&
    amountsMatch(Number(closingCountedCard), expectedCard) &&
    amountsMatch(Number(closingCountedTransfer), expectedTransfer);

  const defaultReceptionistId =
    loggedInReceptionist?.id || receptionists[0]?.id || '';

  const resetOpenModal = () => {
    setOpeningFloat('0');
    setOpenReceptionistId(defaultReceptionistId);
    setOpenPin('');
    setModalError(null);
  };

  const resetCloseModalUI = () => {
    setCloseReceptionistId(defaultReceptionistId);
    setClosePin('');
    setModalError(null);
    setShowCloseAdminDetails(false);
    setShowAdminPinPrompt(false);
    setAdminPin('');
    setAdminPinError(null);
    setCloseTitleClicks(0);
  };

  const clearCloseForm = () => {
    setClosingCountedCash('');
    setClosingCountedCard('');
    setClosingCountedTransfer('');
    setClosingNotes('');
    setCloseDraftActive(false);
  };

  const openCloseModal = () => {
    const sessionId = registerState?.session?.id;
    resetCloseModalUI();

    if (sessionId) {
      const draft = readCashCloseDraft(sessionId);
      if (draft) {
        setClosingCountedCash(draft.closingCountedCash);
        setClosingCountedCard(draft.closingCountedCard);
        setClosingCountedTransfer(draft.closingCountedTransfer);
        setClosingNotes(draft.closingNotes);
        setCloseDraftActive(true);
      } else {
        clearCloseForm();
      }
    } else {
      clearCloseForm();
    }

    setShowCloseModal(true);
  };

  const handleVerifyAdminPin = async () => {
    if (adminPin.length !== 4) {
      setAdminPinError('Ingresa la clave de admin de 4 dígitos.');
      return;
    }

    setAdminPinError(null);
    try {
      await posApi.verifyMasterPin(adminPin);
      setShowCloseAdminDetails(true);
      setShowAdminPinPrompt(false);
      setAdminPin('');
    } catch (verifyError) {
      setAdminPinError(
        verifyError instanceof Error ? verifyError.message : 'Clave de admin incorrecta'
      );
      setAdminPin('');
    }
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
        closingCountedCard: Number(closingCountedCard) || 0,
        closingCountedTransfer: Number(closingCountedTransfer) || 0,
        closingNotes,
        receptionistId: closeReceptionistId,
        pin: closePin,
      });
      clearCashCloseDraft(registerState.session.id);
      setShowCloseModal(false);
      clearCloseForm();
      resetCloseModalUI();
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
                onClick={openCloseModal}
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
                        <AppointmentServiceList
                          serviceName={appointment.serviceName}
                          lineClassName="text-xs text-outline"
                          className="mt-0.5"
                        />
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
                <AppointmentServiceList
                  serviceName={selectedAppointment.serviceName}
                  lineClassName="text-xs text-outline"
                  className="mt-2"
                />
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
        <Modal
          title="Corte de caja"
          onClose={() => {
            setShowCloseModal(false);
            resetCloseModalUI();
          }}
          onTitleClick={() => setCloseTitleClicks((prev) => prev + 1)}
        >
          <div className="space-y-4">
            {closeDraftActive && (
              <p className="text-[10px] font-bold uppercase tracking-wider text-secondary">
                Borrador guardado — puedes cerrar y retomar después
              </p>
            )}

            {showCloseAdminDetails && (
              <CloseCutVariancePanel
                expectedCash={expectedCash}
                closingCountedCash={Number(closingCountedCash) || 0}
                variance={cashVariance}
                expectedCard={expectedCard}
                closingCountedCard={Number(closingCountedCard) || 0}
                cardVariance={cardVariance}
                expectedTransfer={expectedTransfer}
                closingCountedTransfer={Number(closingCountedTransfer) || 0}
                transferVariance={transferVariance}
              />
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Efectivo contado">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={closingCountedCash}
                  onChange={(e) => setClosingCountedCash(e.target.value)}
                  className={fieldClassName}
                />
              </Field>
              <Field label="Tarjeta contada">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={closingCountedCard}
                  onChange={(e) => setClosingCountedCard(e.target.value)}
                  className={fieldClassName}
                />
              </Field>
              <Field label="Transferencia contada">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={closingCountedTransfer}
                  onChange={(e) => setClosingCountedTransfer(e.target.value)}
                  className={fieldClassName}
                />
              </Field>
            </div>

            {closeCountsReady && (
              <div
                className={`rounded-xl p-4 text-sm border flex items-start gap-3 ${
                  isPerfectCut
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                {isPerfectCut ? (
                  <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-bold">
                    {isPerfectCut ? 'Corte perfecto' : 'Hay diferencias en el corte'}
                  </p>
                  <p className="text-xs mt-1 opacity-90">
                    {isPerfectCut
                      ? 'Los tres rubros coinciden con lo registrado en el sistema.'
                      : 'Los montos contados no coinciden con el sistema. Revisa con admin si necesitas el detalle.'}
                  </p>
                </div>
              </div>
            )}

            <Field label="Notas del corte">
              <textarea
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                rows={3}
                className={`${fieldClassName} resize-none`}
              />
            </Field>

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
              disabled={
                isSubmitting ||
                closePin.length !== 4 ||
                !closeReceptionistId ||
                !closeCountsReady
              }
              onClick={handleCloseSession}
              className="w-full py-3 rounded-xl bg-primary text-on-primary font-sans text-xs font-bold uppercase tracking-wider disabled:opacity-40"
            >
              {isSubmitting ? 'Validando...' : 'Cerrar turno'}
            </button>
          </div>

          {showAdminPinPrompt && (
            <AdminPinOverlay
              adminPin={adminPin}
              adminPinError={adminPinError}
              onPinChange={(value) => {
                setAdminPin(value);
                if (adminPinError) setAdminPinError(null);
              }}
              onCancel={() => {
                setShowAdminPinPrompt(false);
                setAdminPin('');
                setAdminPinError(null);
              }}
              onConfirm={handleVerifyAdminPin}
            />
          )}
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
  const [titleClicks, setTitleClicks] = useState(0);
  const [showAdminPinPrompt, setShowAdminPinPrompt] = useState(false);
  const [showAdminDetails, setShowAdminDetails] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [adminPinError, setAdminPinError] = useState<string | null>(null);

  useEffect(() => {
    if (titleClicks === 0) return;
    const timer = window.setTimeout(() => setTitleClicks(0), 900);
    return () => window.clearTimeout(timer);
  }, [titleClicks]);

  useEffect(() => {
    if (titleClicks < 3) return;
    setTitleClicks(0);
    setShowAdminPinPrompt(true);
    setAdminPinError(null);
  }, [titleClicks]);

  const handleVerifyAdminPin = async () => {
    if (adminPin.length !== 4) {
      setAdminPinError('Ingresa la clave de admin de 4 dígitos.');
      return;
    }

    setAdminPinError(null);
    try {
      await posApi.verifyMasterPin(adminPin);
      setShowAdminDetails(true);
      setShowAdminPinPrompt(false);
      setAdminPin('');
      if (!isExpanded) {
        onToggle();
      }
    } catch (verifyError) {
      setAdminPinError(
        verifyError instanceof Error ? verifyError.message : 'Clave de admin incorrecta'
      );
      setAdminPin('');
    }
  };

  const closedTime = session.closedAt
    ? new Date(session.closedAt).toLocaleString('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
        day: 'numeric',
        month: 'short',
      })
    : '—';

  const varianceOk =
    typeof session.isPerfectCut === 'boolean'
      ? session.isPerfectCut
      : Math.abs(session.variance) < 0.01;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left p-4 hover:bg-surface-container-low transition-colors"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p
              className="font-sans text-sm font-bold text-primary select-none"
              onClick={(event) => {
                event.stopPropagation();
                setTitleClicks((prev) => prev + 1);
              }}
            >
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
                {varianceOk ? 'Corte perfecto' : 'Con diferencias'}
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
          <div className="grid grid-cols-2 gap-3 py-3 text-[10px]">
            <div>
              <p className="text-outline font-bold uppercase">Apertura</p>
              <p className="font-bold text-primary mt-1">
                {session.openedByReceptionistName || session.openedByReceptionistId || '—'}
                {session.openedWithMasterPin ? ' (Master)' : ''}
              </p>
            </div>
            <div>
              <p className="text-outline font-bold uppercase">Cierre</p>
              <p className="font-bold text-primary mt-1">
                {session.closedByReceptionistName || session.closedByReceptionistId || '—'}
                {session.closedWithMasterPin ? ' (Master)' : ''}
              </p>
            </div>
          </div>

          {showAdminDetails && (
            <div className="mb-3">
              <CloseCutVariancePanel
                expectedCash={session.expectedCash ?? 0}
                closingCountedCash={session.closingCountedCash ?? 0}
                variance={session.variance ?? 0}
                expectedCard={session.expectedCard ?? 0}
                closingCountedCard={session.closingCountedCard ?? 0}
                cardVariance={session.cardVariance ?? 0}
                expectedTransfer={session.expectedTransfer ?? 0}
                closingCountedTransfer={session.closingCountedTransfer ?? 0}
                transferVariance={session.transferVariance ?? 0}
              />
            </div>
          )}

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

      {showAdminPinPrompt && (
        <AdminPinOverlay
          adminPin={adminPin}
          adminPinError={adminPinError}
          onPinChange={(value) => {
            setAdminPin(value);
            if (adminPinError) setAdminPinError(null);
          }}
          onCancel={() => {
            setShowAdminPinPrompt(false);
            setAdminPin('');
            setAdminPinError(null);
          }}
          onConfirm={handleVerifyAdminPin}
        />
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
          <AppointmentServiceList
            serviceName={payment.serviceName}
            lineClassName="text-xs text-outline"
            className="mt-0.5"
          />
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

function CloseCutVariancePanel({
  expectedCash,
  closingCountedCash,
  variance,
  expectedCard,
  closingCountedCard,
  cardVariance,
  expectedTransfer,
  closingCountedTransfer,
  transferVariance,
}: {
  expectedCash: number;
  closingCountedCash: number;
  variance: number;
  expectedCard: number;
  closingCountedCard: number;
  cardVariance: number;
  expectedTransfer: number;
  closingCountedTransfer: number;
  transferVariance: number;
}) {
  return (
    <div className="rounded-xl border border-primary/10 bg-surface-container-low/50 p-3 space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-outline">
        Detalle admin · restas del corte
      </p>
      <div className="grid grid-cols-4 gap-2 text-[9px] uppercase tracking-wider text-outline font-bold pb-1 border-b border-primary/5">
        <span>Rubro</span>
        <span>Sistema</span>
        <span>Contado</span>
        <span>Diferencia</span>
      </div>
      <CloseVarianceRow
        label="Efectivo"
        expected={expectedCash}
        counted={closingCountedCash}
        variance={variance}
      />
      <CloseVarianceRow
        label="Tarjeta"
        expected={expectedCard}
        counted={closingCountedCard}
        variance={cardVariance}
      />
      <CloseVarianceRow
        label="Transferencia"
        expected={expectedTransfer}
        counted={closingCountedTransfer}
        variance={transferVariance}
      />
    </div>
  );
}

function CloseVarianceRow({
  label,
  expected,
  counted,
  variance,
}: {
  label: string;
  expected: number;
  counted: number;
  variance: number;
}) {
  const ok = amountsMatch(counted, expected);

  return (
    <div className="grid grid-cols-4 gap-2 text-[10px] items-center">
      <span className="font-bold uppercase text-outline">{label}</span>
      <span className="text-primary font-bold">{formatMXN(expected)}</span>
      <span className="text-primary font-bold">{formatMXN(counted)}</span>
      <span className={`font-bold ${ok ? 'text-emerald-700' : 'text-amber-800'}`}>
        {variance >= 0 ? '+' : ''}
        {formatMXN(variance)}
      </span>
    </div>
  );
}

function AdminPinOverlay({
  adminPin,
  adminPinError,
  onPinChange,
  onCancel,
  onConfirm,
}: {
  adminPin: string;
  adminPinError: string | null;
  onPinChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px] flex items-center justify-center p-4 z-10">
      <div className="bg-surface w-full max-w-xs rounded-2xl border border-primary/10 p-5 space-y-4 shadow-xl">
        <div>
          <h4 className="font-display text-base font-bold text-primary">Clave de admin</h4>
          <p className="text-xs text-outline mt-1">
            Ingresa la clave para ver las restas del corte.
          </p>
        </div>
        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={adminPin}
          onChange={(e) => onPinChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
          className={`${fieldClassName} tracking-[0.45em] text-center`}
          placeholder="••••"
          autoFocus
        />
        {adminPinError && <ModalError message={adminPinError} />}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-primary/10 text-xs font-bold uppercase tracking-wider text-outline"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={adminPin.length !== 4}
            className="flex-1 py-2.5 rounded-xl bg-primary text-on-primary text-xs font-bold uppercase tracking-wider disabled:opacity-40"
          >
            Ver detalle
          </button>
        </div>
      </div>
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
  onTitleClick,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  onTitleClick?: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-surface max-w-lg w-full rounded-2xl border border-primary/10 luxury-shadow overflow-hidden relative">
        <div className="px-5 py-4 border-b border-primary/5 flex items-center justify-between">
          <h3
            className={`font-display text-lg font-bold text-primary ${
              onTitleClick ? 'select-none cursor-default' : ''
            }`}
            onClick={onTitleClick}
          >
            {title}
          </h3>
          <button type="button" onClick={onClose} className="text-outline hover:text-primary text-sm font-bold">
            Cerrar
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
