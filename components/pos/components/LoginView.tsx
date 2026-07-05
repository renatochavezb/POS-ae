"use client";

import React, { useEffect, useState } from 'react';
import {
  Users,
  ShieldCheck,
  ArrowLeft,
  Check,
  AlertCircle
} from 'lucide-react';
import { Staff, Receptionist } from '../types';
import { INITIAL_RECEPTIONISTS, INITIAL_STAFF } from '../data';
import posApi from '@/libs/posApi';

interface LoginViewProps {
  onLogin: (
    role: 'reception' | 'manicurista',
    staffId?: string,
    receptionistId?: string,
    isMaster?: boolean
  ) => void;
}

export default function LoginView({ onLogin }: LoginViewProps) {
  const [viewState, setViewState] = useState<
    'select' | 'reception_select' | 'reception_pin' | 'staff_select' | 'staff_pin'
  >('select');
  const [receptionists, setReceptionists] = useState<Receptionist[]>(INITIAL_RECEPTIONISTS);
  const [staffList, setStaffList] = useState<Staff[]>(INITIAL_STAFF);
  const [selectedReceptionist, setSelectedReceptionist] = useState<Receptionist | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  useEffect(() => {
    posApi
      .getLoginBootstrap()
      .then(({ receptionists: nextReceptionists, staff }) => {
        if (nextReceptionists.length > 0) setReceptionists(nextReceptionists);
        if (staff.length > 0) setStaffList(staff);
        setBootstrapError(null);
      })
      .catch((bootstrapErr) => {
        console.error(bootstrapErr);
        setBootstrapError('No se pudo conectar con la base de datos. Usando datos locales.');
      });
  }, []);

  const handleReceptionClick = () => {
    setSelectedReceptionist(null);
    setPin('');
    setError(null);
    setViewState('reception_select');
  };

  const handleStaffClick = () => {
    setSelectedStaff(null);
    setPin('');
    setError(null);
    setViewState('staff_select');
  };

  const handleReceptionistSelect = (receptionist: Receptionist) => {
    setSelectedReceptionist(receptionist);
    setPin('');
    setError(null);
    setViewState('reception_pin');
  };

  const handleStaffMemberSelect = (staff: Staff) => {
    setSelectedStaff(staff);
    setPin('');
    setError(null);
    setViewState('staff_pin');
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (viewState === 'reception_pin' && selectedReceptionist) {
      setIsVerifying(true);
      try {
        const result = await posApi.verifyLogin({
          role: 'reception',
          userId: selectedReceptionist.id,
          pin,
        });

        setSuccess(true);
        setTimeout(
          () =>
            onLogin(
              'reception',
              undefined,
              result.userId,
              result.isMaster
            ),
          800
        );
      } catch (verifyError) {
        setError(
          verifyError instanceof Error
            ? verifyError.message
            : 'PIN incorrecto. Intenta de nuevo.'
        );
        setPin('');
      } finally {
        setIsVerifying(false);
      }
    } else if (viewState === 'staff_pin' && selectedStaff) {
      setIsVerifying(true);
      try {
        const result = await posApi.verifyLogin({
          role: 'manicurista',
          userId: selectedStaff.id,
          pin,
        });

        setSuccess(true);
        setTimeout(
          () => onLogin('manicurista', result.userId, undefined, result.isMaster),
          800
        );
      } catch (verifyError) {
        setError(
          verifyError instanceof Error
            ? verifyError.message
            : 'PIN incorrecto. Intenta de nuevo.'
        );
        setPin('');
      } finally {
        setIsVerifying(false);
      }
    }
  };

  const handleKeypadPress = (num: string) => {
    if (pin.length < 4) {
      setPin((prev) => prev + num);
      setError(null);
    }
  };

  return (
    <div className="pos-theme fixed inset-0 bg-[#00261b] z-[9999] flex flex-col items-center justify-center overflow-y-auto p-4 md:p-8 font-sans">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(254,214,91,0.06),transparent_60%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(254,214,91,0.04),transparent_60%)] pointer-events-none" />

      <div className="w-full max-w-md bg-[#001f16] border border-[#e5c158]/20 rounded-3xl p-6 md:p-8 luxury-shadow flex flex-col items-center relative overflow-hidden transition-all duration-500 hover:border-[#e5c158]/35">
        <div className="mb-8 relative shrink-0">
          <div className="w-44 h-44 bg-[#00261b] border border-[#e5c158] flex flex-col items-center justify-center p-6 relative shadow-2xl">
            <div className="relative text-center select-none leading-none">
              <span className="font-display font-medium text-7xl text-transparent bg-clip-text bg-gradient-to-b from-[#fff1be] via-[#e5c158] to-[#997c23] tracking-tighter filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]">
                aé
              </span>
            </div>
            <div className="mt-4 font-sans text-xs tracking-[0.45em] font-medium text-transparent bg-clip-text bg-gradient-to-r from-[#fff1be] via-[#e5c158] to-[#bfa13c] mr-[-0.45em] select-none">
              STUDIO
            </div>
          </div>
        </div>

        {success && (
          <div className="absolute inset-0 bg-[#00261b]/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 z-50 text-center">
            <div className="w-16 h-16 rounded-full bg-[#e5c158]/10 border border-[#e5c158]/40 flex items-center justify-center mb-4">
              <Check className="w-8 h-8 text-[#e5c158]" />
            </div>
            <h3 className="font-display text-2xl font-bold text-[#e5c158] mb-1">Acceso Concedido</h3>
            <p className="text-[#e5c158]/60 text-xs tracking-wider uppercase">Cargando terminal...</p>
          </div>
        )}

        {viewState === 'select' && (
          <div className="w-full space-y-6">
            <div className="text-center space-y-1">
              <h2 className="font-display text-xl text-[#e5c158] font-bold tracking-wide">Terminal del Salón</h2>
              <p className="text-white/60 text-xs uppercase tracking-widest font-semibold">Iniciar Sesión de Trabajo</p>
              {bootstrapError && (
                <p className="text-amber-200/70 text-[10px] mt-2">{bootstrapError}</p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4">
              <button onClick={handleReceptionClick} className="w-full p-4 rounded-2xl bg-[#00261b] border border-[#e5c158]/10 hover:border-[#e5c158]/40 transition-all text-left flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#e5c158]/5 border border-[#e5c158]/20 flex items-center justify-center text-[#e5c158]">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-sans text-sm font-extrabold text-[#e5c158] uppercase tracking-wider">Recepción / Admin</h4>
                    <p className="text-white/40 text-[11px]">Gestión total de agenda y caja</p>
                  </div>
                </div>
                <div className="text-[#e5c158]">→</div>
              </button>

              <button onClick={handleStaffClick} className="w-full p-4 rounded-2xl bg-[#00261b] border border-[#e5c158]/10 hover:border-[#e5c158]/40 transition-all text-left flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#e5c158]/5 border border-[#e5c158]/20 flex items-center justify-center text-[#e5c158]">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-sans text-sm font-extrabold text-[#e5c158] uppercase tracking-wider">Equipo / Manicuristas</h4>
                    <p className="text-white/40 text-[11px]">Fichajes y comisiones personales</p>
                  </div>
                </div>
                <div className="text-[#e5c158]">→</div>
              </button>
            </div>
          </div>
        )}

        {viewState === 'reception_select' && (
          <div className="w-full space-y-6">
            <div className="flex items-center gap-2">
              <button onClick={() => setViewState('select')} className="p-1.5 rounded-full text-[#e5c158] border border-[#e5c158]/10"><ArrowLeft className="w-4 h-4" /></button>
              <h3 className="font-display text-lg text-[#e5c158] font-bold">Selecciona Recepcionista</h3>
            </div>
            <div className="space-y-2">
              {receptionists.map((receptionist) => (
                <button
                  key={receptionist.id}
                  onClick={() => handleReceptionistSelect(receptionist)}
                  className="w-full p-3 rounded-xl bg-[#00261b] border border-[#e5c158]/5 hover:border-[#e5c158]/20 flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-[10px] font-bold border border-[#e5c158]/20 text-[#e5c158]"
                      style={{ backgroundColor: `${receptionist.color}22` }}
                    >
                      {receptionist.id}
                    </div>
                    <div>
                      <h4 className="font-sans text-xs font-bold text-[#e5c158]">{receptionist.name}</h4>
                      <p className="text-white/40 text-[10px] uppercase font-semibold">{receptionist.role}</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-[#e5c158]/5 text-[#e5c158] text-[9px] font-bold">INGRESAR</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {viewState === 'reception_pin' && selectedReceptionist && (
          <div className="w-full space-y-6">
            <div className="flex items-center gap-2">
              <button onClick={() => setViewState('reception_select')} className="p-1.5 rounded-full text-[#e5c158] border border-[#e5c158]/10"><ArrowLeft className="w-4 h-4" /></button>
              <h3 className="font-display text-sm text-[#e5c158] font-bold">{selectedReceptionist.name}</h3>
            </div>
            <form onSubmit={handlePinSubmit} className="space-y-6">
              <PinDots pin={pin} />
              {error && <ErrorMessage error={error} />}
              <Keypad onPress={handleKeypadPress} onClear={() => setPin('')} onBackspace={() => setPin((prev) => prev.slice(0, -1))} />
              <button type="submit" disabled={pin.length < 4 || isVerifying} className={`w-full py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest ${pin.length === 4 && !isVerifying ? 'bg-gradient-to-r from-[#fff1be] via-[#e5c158] to-[#bfa13c] text-[#00261b]' : 'bg-[#00261b]/50 text-white/20 border border-[#e5c158]/5'}`}>{isVerifying ? 'Validando...' : 'Validar Credencial'}</button>
            </form>
          </div>
        )}

        {viewState === 'staff_select' && (
          <div className="w-full space-y-6">
            <div className="flex items-center gap-2">
              <button onClick={() => setViewState('select')} className="p-1.5 rounded-full text-[#e5c158] border border-[#e5c158]/10"><ArrowLeft className="w-4 h-4" /></button>
              <h3 className="font-display text-lg text-[#e5c158] font-bold">Selecciona tu Artista</h3>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {staffList.map((staff) => (
                <button key={staff.id} onClick={() => handleStaffMemberSelect(staff)} className="w-full p-3 rounded-xl bg-[#00261b] border border-[#e5c158]/5 hover:border-[#e5c158]/20 flex items-center justify-between text-left">
                  <div className="flex items-center gap-3">
                    <img referrerPolicy="no-referrer" src={staff.image} alt={staff.name} className="w-10 h-10 rounded-full object-cover border border-[#e5c158]/10" />
                    <div>
                      <h4 className="font-sans text-xs font-bold text-[#e5c158]">{staff.name}</h4>
                      <p className="text-white/40 text-[10px] uppercase font-semibold">{staff.role}</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-[#e5c158]/5 text-[#e5c158] text-[9px] font-bold">FICHAR</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {viewState === 'staff_pin' && selectedStaff && (
          <div className="w-full space-y-6">
            <div className="flex items-center gap-2">
              <button onClick={() => setViewState('staff_select')} className="p-1.5 rounded-full text-[#e5c158] border border-[#e5c158]/10"><ArrowLeft className="w-4 h-4" /></button>
              <h3 className="font-display text-sm text-[#e5c158] font-bold">{selectedStaff.name}</h3>
            </div>
            <form onSubmit={handlePinSubmit} className="space-y-6">
              <PinDots pin={pin} />
              {error && <ErrorMessage error={error} />}
              <Keypad onPress={handleKeypadPress} onClear={() => setPin('')} onBackspace={() => setPin((prev) => prev.slice(0, -1))} />
              <button type="submit" disabled={pin.length < 4 || isVerifying} className={`w-full py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest ${pin.length === 4 && !isVerifying ? 'bg-gradient-to-r from-[#fff1be] via-[#e5c158] to-[#bfa13c] text-[#00261b]' : 'bg-[#00261b]/50 text-white/20 border border-[#e5c158]/5'}`}>{isVerifying ? 'Verificando...' : 'Verificar PIN'}</button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

function PinDots({ pin }: { pin: string }) {
  return (
    <div className="flex flex-col items-center justify-center space-y-2">
      <div className="flex gap-4 py-2">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className={`w-4.5 h-4.5 rounded-full border-2 transition-all ${pin.length > index ? 'bg-[#e5c158] border-[#e5c158]' : 'bg-transparent border-[#e5c158]/20'}`} />
        ))}
      </div>
    </div>
  );
}

function ErrorMessage({ error }: { error: string }) {
  return (
    <div className="p-3 bg-red-950/40 border border-red-500/20 rounded-xl text-center text-red-200 text-xs flex items-center justify-center gap-1.5">
      <AlertCircle className="w-4 h-4 shrink-0" />
      {error}
    </div>
  );
}

function Keypad({
  onPress,
  onClear,
  onBackspace
}: {
  onPress: (num: string) => void;
  onClear: () => void;
  onBackspace: () => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
        <button key={num} type="button" onClick={() => onPress(num)} className="w-16 h-16 rounded-full bg-[#00261b] hover:bg-[#003425] border border-[#e5c158]/10 text-[#e5c158] font-sans font-bold text-lg flex items-center justify-center">{num}</button>
      ))}
      <button type="button" onClick={onClear} className="w-16 h-16 text-white/40 text-xs">Borrar</button>
      <button key="0" type="button" onClick={() => onPress('0')} className="w-16 h-16 rounded-full bg-[#00261b] hover:bg-[#003425] border border-[#e5c158]/10 text-[#e5c158] font-sans font-bold text-lg flex items-center justify-center">0</button>
      <button type="button" onClick={onBackspace} className="w-16 h-16 text-white/40 text-xs">←</button>
    </div>
  );
}
