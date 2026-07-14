"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import posApi from "@/libs/posApi";
import MasterPinModal from "./MasterPinModal";

type PinPerson = {
  role: "staff" | "reception" | "accountant" | "master";
  id: string;
  name: string;
  subtitle: string;
  loginCode: string;
  isActive: boolean;
};

type DraftMap = Record<string, string>;

function personKey(person: Pick<PinPerson, "role" | "id">) {
  return `${person.role}:${person.id}`;
}

function PinGroup({
  title,
  people,
  drafts,
  showCodes,
  onDraftChange,
}: {
  title: string;
  people: PinPerson[];
  drafts: DraftMap;
  showCodes: boolean;
  onDraftChange: (key: string, value: string) => void;
}) {
  if (people.length === 0) return null;

  return (
    <div className="space-y-3">
      <h4 className="text-[10px] font-bold uppercase tracking-widest text-secondary">{title}</h4>
      <div className="space-y-2">
        {people.map((person) => {
          const key = personKey(person);
          const value = drafts[key] ?? person.loginCode;
          return (
            <div
              key={key}
              className="flex items-center gap-3 rounded-xl border border-primary/10 bg-surface px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-primary truncate">{person.name}</p>
                <p className="text-[10px] text-outline truncate">
                  {person.subtitle} · {person.id}
                </p>
              </div>
              <input
                type={showCodes ? "text" : "password"}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={value}
                onChange={(event) => {
                  const next = event.target.value.replace(/\D/g, "").slice(0, 4);
                  onDraftChange(key, next);
                }}
                className="w-[4.5rem] shrink-0 px-2 py-1.5 rounded-lg border border-primary/10 bg-surface-container-lowest text-center font-mono text-sm font-bold tracking-[0.2em] text-primary outline-none focus:border-secondary"
                aria-label={`PIN de ${person.name}`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PersonnelPinsPanel() {
  const [people, setPeople] = useState<PinPerson[]>([]);
  const [drafts, setDrafts] = useState<DraftMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCodes, setShowCodes] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const loadCodes = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await posApi.getLoginCodes();
      const rows: PinPerson[] = [
        data.master,
        ...data.receptionists,
        ...data.staff,
        ...data.accountants,
      ];
      setPeople(rows);
      const nextDrafts: DraftMap = {};
      rows.forEach((row) => {
        nextDrafts[personKey(row)] = row.loginCode;
      });
      setDrafts(nextDrafts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las claves");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCodes();
  }, []);

  const dirtyUpdates = useMemo(() => {
    return people
      .filter((person) => {
        const draft = drafts[personKey(person)] ?? "";
        return draft !== person.loginCode;
      })
      .map((person) => ({
        role: person.role,
        id: person.id,
        name: person.name,
        loginCode: drafts[personKey(person)] ?? "",
      }));
  }, [people, drafts]);

  const handleSaveClick = () => {
    setPinError(null);
    setError(null);

    if (dirtyUpdates.length === 0) {
      setError("No hay cambios para guardar.");
      return;
    }

    for (const update of dirtyUpdates) {
      if (!/^\d{4}$/.test(update.loginCode)) {
        setError(`La clave de ${update.name} debe ser de 4 dígitos.`);
        return;
      }
    }

    setIsPinModalOpen(true);
  };

  const handleConfirmMasterPin = async (adminPin: string) => {
    setIsSaving(true);
    setPinError(null);
    setError(null);

    try {
      await posApi.updateLoginCodes({
        adminPin,
        updates: dirtyUpdates,
      });
      setIsPinModalOpen(false);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
      await loadCodes();
    } catch (err) {
      setPinError(err instanceof Error ? err.message : "No se pudieron guardar las claves");
    } finally {
      setIsSaving(false);
    }
  };

  const receptionists = people.filter((p) => p.role === "reception");
  const staff = people.filter((p) => p.role === "staff");
  const accountants = people.filter((p) => p.role === "accountant");
  const master = people.filter((p) => p.role === "master");

  return (
    <>
      <div className="bg-surface-container-lowest p-6 rounded-2xl border border-primary/5 luxury-shadow space-y-5">
        <div className="flex items-start justify-between gap-3 border-b border-primary/5 pb-3">
          <div>
            <h3 className="font-display font-bold text-base text-primary flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-secondary" />
              Claves del personal
            </h3>
            <p className="text-xs text-outline mt-1">
              PINs de acceso conectados a MongoDB. Los cambios se guardan con tu clave de
              administrador.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCodes((prev) => !prev)}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-primary/10 text-[10px] font-bold uppercase tracking-wider text-primary hover:bg-surface-container-low transition-colors"
          >
            {showCodes ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showCodes ? "Ocultar" : "Mostrar"}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-outline">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            <PinGroup
              title="Administrador"
              people={master}
              drafts={drafts}
              showCodes={showCodes}
              onDraftChange={(key, value) =>
                setDrafts((prev) => ({ ...prev, [key]: value }))
              }
            />
            <PinGroup
              title="Recepción / Supervisión"
              people={receptionists}
              drafts={drafts}
              showCodes={showCodes}
              onDraftChange={(key, value) =>
                setDrafts((prev) => ({ ...prev, [key]: value }))
              }
            />
            <PinGroup
              title="Manicuristas"
              people={staff}
              drafts={drafts}
              showCodes={showCodes}
              onDraftChange={(key, value) =>
                setDrafts((prev) => ({ ...prev, [key]: value }))
              }
            />
            <PinGroup
              title="Contabilidad"
              people={accountants}
              drafts={drafts}
              showCodes={showCodes}
              onDraftChange={(key, value) =>
                setDrafts((prev) => ({ ...prev, [key]: value }))
              }
            />
          </div>
        )}

        {error ? (
          <p className="text-xs text-red-600 flex items-start gap-1.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            {error}
          </p>
        ) : null}

        {saved ? (
          <p className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Claves actualizadas en MongoDB
          </p>
        ) : null}

        <button
          type="button"
          onClick={handleSaveClick}
          disabled={loading || dirtyUpdates.length === 0 || isSaving}
          className="w-full px-4 py-2.5 rounded-lg bg-primary text-on-primary hover:bg-primary-container font-sans text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Guardar claves
        </button>
      </div>

      {isPinModalOpen ? (
        <MasterPinModal
          title="Confirmar cambio de claves"
          description="Ingresa tu clave de administrador para guardar los PINs en MongoDB."
          confirmLabel="Guardar claves"
          isSubmitting={isSaving}
          error={pinError}
          onConfirm={handleConfirmMasterPin}
          onClose={() => {
            if (isSaving) return;
            setIsPinModalOpen(false);
            setPinError(null);
          }}
        />
      ) : null}
    </>
  );
}
