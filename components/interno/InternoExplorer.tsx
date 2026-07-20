"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Database,
  GitBranch,
  Loader2,
  Lock,
  LogOut,
  ChevronDown,
  ChevronRight,
  Shield,
  Workflow,
} from "lucide-react";

type FieldMeta = {
  name: string;
  type: string;
  key: string;
  example?: string;
  sensitive?: boolean;
};

type CollectionMeta = {
  model: string;
  collection: string;
  domain: string;
  purpose: string;
  fields: FieldMeta[];
  usedBy: string[];
};

type Relationship = {
  from: string;
  field: string;
  to: string;
  targetField: string;
  description: string;
};

type Flow = {
  title: string;
  steps: string[];
};

type DerivedFeature = {
  id: string;
  name: string;
  sourceCollections: string[];
  storage: string;
  segments: string[];
  updatesOnMongoChange: string;
};

type GlobalConvention = {
  id: string;
  title: string;
  summary: string;
  appliesTo: string;
  fields: FieldMeta[];
};

type OverviewData = {
  database: string;
  generatedAt: string;
  mongoOffline?: boolean;
  mongoError?: string;
  collections: CollectionMeta[];
  relationships: Relationship[];
  derivedFeatures?: DerivedFeature[];
  globalConventions?: GlobalConvention[];
  flows: Flow[];
  counts: Record<string, number>;
  samples: Record<string, Record<string, unknown>[]>;
  live: {
    openCashSession: Record<string, unknown> | null;
    appointmentsOnOpenShiftDate: number;
    latestWeeklySnapshot?: Record<string, unknown> | null;
  };
  catalogStats?: {
    documentedCollections: number;
    liveCountModels: number;
    missingFromCatalog: string[];
    missingFromRegistry: string[];
  };
};

export default function InternoExplorer() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [pin, setPin] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [isLoadingOverview, setIsLoadingOverview] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [expandedModel, setExpandedModel] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    setIsLoadingOverview(true);
    setOverviewError(null);
    try {
      const res = await fetch("/api/interno/overview", { cache: "no-store" });
      if (res.status === 401) {
        setAuthenticated(false);
        setOverview(null);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "No se pudo cargar MongoDB");
      }
      const data = (await res.json()) as OverviewData;
      setOverview(data);
      setAuthenticated(true);
    } catch (error) {
      setOverviewError(
        error instanceof Error ? error.message : "Error al cargar datos"
      );
    } finally {
      setIsLoadingOverview(false);
    }
  }, []);

  const checkSession = useCallback(async () => {
    setCheckingSession(true);
    try {
      const res = await fetch("/api/interno/auth", { cache: "no-store" });
      if (!res.ok) {
        setAuthenticated(false);
        return;
      }
      const data = await res.json();
      if (data.authenticated) {
        await loadOverview();
      } else {
        setAuthenticated(false);
      }
    } catch {
      setAuthenticated(false);
    } finally {
      setCheckingSession(false);
    }
  }, [loadOverview]);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const handleLogin = async () => {
    if (pin.length !== 4) {
      setLoginError("Ingresa la clave de administrador de 4 dígitos.");
      return;
    }

    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const res = await fetch("/api/interno/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Clave incorrecta");
      }
      setPin("");
      await loadOverview();
    } catch (error) {
      setLoginError(
        error instanceof Error ? error.message : "No se pudo iniciar sesión"
      );
      setPin("");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/interno/auth", { method: "DELETE" });
    setAuthenticated(false);
    setOverview(null);
    setExpandedModel(null);
    setCheckingSession(false);
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#0f1419] text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl border border-slate-700/80 bg-slate-900/90 p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30">
              <Shield className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">/interno</h1>
              <p className="text-xs text-slate-400">Solo administrador</p>
            </div>
          </div>

          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            Acceso restringido con la clave master del POS. No acepta PIN de
            recepcionistas ni manicuristas.
          </p>

          {checkingSession && (
            <p className="text-xs text-slate-500 mb-4 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Verificando sesión…
            </p>
          )}

          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
            Clave de administrador
          </label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, "").slice(0, 4));
              if (loginError) setLoginError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && pin.length === 4) handleLogin();
            }}
            className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 text-center text-lg tracking-[0.5em] font-mono outline-none focus:border-amber-500/60 mb-4"
            placeholder="••••"
            autoFocus
            disabled={checkingSession || isLoggingIn}
          />

          {loginError && (
            <p className="text-xs text-red-400 mb-4 flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 shrink-0" />
              {loginError}
            </p>
          )}

          <button
            type="button"
            onClick={handleLogin}
            disabled={checkingSession || isLoggingIn || pin.length !== 4}
            className="w-full py-3 rounded-xl bg-amber-500 text-slate-900 text-xs font-bold uppercase tracking-wider hover:bg-amber-400 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
          >
            {isLoggingIn ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Lock className="w-4 h-4" />
            )}
            Entrar
          </button>
        </div>
      </div>
    );
  }

  const posCollections = overview?.collections.filter((c) => c.domain.includes("POS")) ?? [];
  const saasCollections = overview?.collections.filter((c) => !c.domain.includes("POS")) ?? [];
  const totalDocs = overview
    ? Object.values(overview.counts).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <div className="min-h-screen bg-[#0f1419] text-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-[#0f1419]/95 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Database className="w-6 h-6 text-amber-400" />
            <div>
              <h1 className="text-lg font-bold">Panel interno MongoDB</h1>
              <p className="text-xs text-slate-400">
                Base <span className="text-amber-400/90 font-mono">{overview?.database}</span>
                {" · "}
                {totalDocs} documentos
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadOverview}
              disabled={isLoadingOverview}
              className="px-3 py-2 rounded-lg border border-slate-700 text-xs font-bold uppercase tracking-wider text-slate-300 hover:border-slate-500 disabled:opacity-40"
            >
              {isLoadingOverview ? "Actualizando…" : "Actualizar"}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="px-3 py-2 rounded-lg border border-slate-700 text-xs font-bold uppercase tracking-wider text-slate-300 hover:border-red-500/50 hover:text-red-300 flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-10">
        {overviewError && (
          <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm">
            {overviewError}
          </div>
        )}

        {overview?.mongoOffline && (
          <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-100 text-sm leading-relaxed">
            <p className="font-bold mb-1">MongoDB no disponible</p>
            <p>{overview.mongoError}</p>
            <p className="mt-2 text-amber-200/80 text-xs">
              Mostrando esquemas y relaciones en modo offline. Conteos y muestras
              aparecerán cuando la base de datos responda.
            </p>
          </div>
        )}

            {overview.catalogStats &&
              (overview.catalogStats.missingFromCatalog.length > 0 ||
                overview.catalogStats.missingFromRegistry.length > 0) && (
                <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-100 text-sm">
                  <p className="font-bold mb-1">Catálogo desincronizado</p>
                  {overview.catalogStats.missingFromCatalog.length > 0 && (
                    <p className="text-xs">
                      En Mongo sin documentar:{" "}
                      {overview.catalogStats.missingFromCatalog.join(", ")}
                    </p>
                  )}
                  {overview.catalogStats.missingFromRegistry.length > 0 && (
                    <p className="text-xs mt-1">
                      Documentadas sin conteo en vivo:{" "}
                      {overview.catalogStats.missingFromRegistry.join(", ")}
                    </p>
                  )}
                </div>
              )}

            {isLoadingOverview && !overview ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
          </div>
        ) : overview ? (
          <>
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Colecciones" value={String(overview.collections.length)} />
              <StatCard
                label="Relaciones"
                value={String(overview.relationships.length)}
                hint="Enlaces FK entre tablas"
              />
              <StatCard
                label="Turno caja"
                value={overview.live.openCashSession ? "Abierto" : "Cerrado"}
                hint={
                  overview.live.openCashSession
                    ? String(overview.live.openCashSession.sessionCode ?? "")
                    : undefined
                }
              />
              <StatCard
                label="Documentos"
                value={String(totalDocs)}
                hint={new Date(overview.generatedAt).toLocaleTimeString("es-MX", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              />
            </section>

            {overview.globalConventions && overview.globalConventions.length > 0 && (
              <section>
                <SectionTitle icon={Shield} title="Convenciones globales de MongoDB" />
                <p className="text-xs text-slate-500 mt-2 mb-4 leading-relaxed">
                  Reglas que aplican a todas o varias colecciones. Cada tabla lista sus variables
                  abajo; al final verás <span className="text-slate-400">createdAt</span> y{" "}
                  <span className="text-slate-400">updatedAt</span> en todas.
                </p>
                <div className="grid md:grid-cols-2 gap-4 mt-2">
                  {overview.globalConventions.map((convention) => (
                    <div
                      key={convention.id}
                      className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3"
                    >
                      <div>
                        <h3 className="text-sm font-bold text-amber-400/90">{convention.title}</h3>
                        <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                          {convention.summary}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-2">
                          Aplica a: {convention.appliesTo}
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-800 overflow-hidden">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-900 text-slate-500 text-[10px] uppercase">
                              <th className="text-left p-2 font-bold">Variable</th>
                              <th className="text-left p-2 font-bold">Tipo</th>
                              <th className="text-left p-2 font-bold">Descripción</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800">
                            {convention.fields.map((field) => (
                              <tr key={field.name}>
                                <td className="p-2 font-mono text-slate-300">{field.name}</td>
                                <td className="p-2 text-slate-500">{field.type}</td>
                                <td className="p-2 text-slate-500">{field.key}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section>
              <SectionTitle icon={Workflow} title="Cómo interactúan los datos" />
              <div className="grid md:grid-cols-3 gap-4 mt-4">
                {overview.flows.map((flow) => (
                  <div
                    key={flow.title}
                    className="rounded-xl border border-slate-800 bg-slate-900/50 p-4"
                  >
                    <h3 className="text-sm font-bold text-amber-400/90 mb-3">{flow.title}</h3>
                    <ol className="space-y-2 text-xs text-slate-400 leading-relaxed list-decimal list-inside">
                      {flow.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </section>

            {overview.derivedFeatures && overview.derivedFeatures.length > 0 && (
              <section>
                <SectionTitle icon={Database} title="Features derivadas (sin colección nueva)" />
                <p className="text-xs text-slate-500 mt-2 mb-4">
                  Lógica en la app que depende de Mongo pero no crea tablas. Al cambiar
                  modelos o campos, actualizar <code className="text-amber-400/90">libs/mongoSchemaCatalog.js</code>.
                </p>
                <div className="grid md:grid-cols-2 gap-4 mt-2">
                  {overview.derivedFeatures.map((feature) => (
                    <div
                      key={feature.id}
                      className="rounded-xl border border-slate-800 bg-slate-900/50 p-4"
                    >
                      <h3 className="text-sm font-bold text-amber-400/90">{feature.name}</h3>
                      <p className="text-[10px] text-slate-500 mt-2">
                        Origen: {feature.sourceCollections.join(" + ")}
                      </p>
                      <p className="text-[10px] text-slate-500">{feature.storage}</p>
                      <ul className="mt-3 space-y-1 text-xs text-slate-400 list-disc list-inside">
                        {feature.segments.map((segment) => (
                          <li key={segment}>{segment}</li>
                        ))}
                      </ul>
                      <p className="text-[10px] text-slate-500 mt-3 leading-relaxed border-t border-slate-800 pt-3">
                        {feature.updatesOnMongoChange}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section>
              <SectionTitle icon={GitBranch} title="Relaciones entre tablas" />
              <p className="text-xs text-slate-500 mt-2 mb-4">
                {overview.relationships.length} enlaces documentados. Las FK son códigos en String
                (no ObjectId de Mongo).
              </p>
              <div className="mt-4 rounded-xl border border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-900/80 text-slate-500 uppercase tracking-wider text-[10px]">
                        <th className="text-left p-3 font-bold">Origen</th>
                        <th className="text-left p-3 font-bold">Campo</th>
                        <th className="text-left p-3 font-bold">→ Destino</th>
                        <th className="text-left p-3 font-bold">Campo destino</th>
                        <th className="text-left p-3 font-bold hidden lg:table-cell">Notas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {overview.relationships.map((rel) => (
                        <tr key={`${rel.from}-${rel.field}-${rel.to}`} className="hover:bg-slate-900/40">
                          <td className="p-3 font-mono text-amber-400/80">{rel.from}</td>
                          <td className="p-3 font-mono text-slate-300">{rel.field}</td>
                          <td className="p-3 font-mono text-emerald-400/80">{rel.to}</td>
                          <td className="p-3 font-mono text-slate-300">{rel.targetField}</td>
                          <td className="p-3 text-slate-500 hidden lg:table-cell">{rel.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-6 p-4 rounded-xl border border-dashed border-slate-700 bg-slate-900/30 font-mono text-[10px] text-slate-500 leading-relaxed overflow-x-auto whitespace-pre">
{`── AGENDA Y CLIENTES ──
PosClient ──clientCode──► PosAppointment ◄──staffCode── PosStaff
                                │
PosReceptionist ──bookedBy──►   │     PosBlockedSlot ◄──staffId── PosStaff
         ▲                      │
         └── bookingsToday ◄── bookedOnDate + bookedByReceptionistId

── CAJA ──
PosAppointment ──appointmentCode──► PosPayment ──cashSessionCode──► PosCashSession
                         │                    ▲
              clientId / staffId               └── openedBy / closedBy ──► PosReceptionist
              processedByReceptionistId

── LOGIN Y AUDITORÍA ──
PosReceptionist / PosStaff / PosAccountant ──login──► PosLoginAudit
PosScheduleConfig.masterLoginCode ──► isMaster en auditoría
PosCashSession ──cashSessionCode──► PosLoginAudit

── CONTABILIDAD ──
PosAccountant ──► PosStaffSettlement ──► appointmentCodes / paymentCodes / cashSessionCodes
              └──► PosAccountantActivity (login | logout | report | liquidation)
PosStaffSettlement.appointmentSnapshots[] = copia congelada de citas al liquidar

── CRM ──
PosAppointment + PosPayment ──► PosClient.crmSegmentFlags
PosDailySnapshot ◄── date ──► PosAppointment`}
              </div>
            </section>

            <CollectionSection
              title="Colecciones POS (salón)"
              collections={posCollections}
              counts={overview.counts}
              samples={overview.samples}
              expandedModel={expandedModel}
              onToggle={(model) =>
                setExpandedModel((prev) => (prev === model ? null : model))
              }
            />

            <CollectionSection
              title="Colecciones ShipFast (web)"
              collections={saasCollections}
              counts={overview.counts}
              samples={overview.samples}
              expandedModel={expandedModel}
              onToggle={(model) =>
                setExpandedModel((prev) => (prev === model ? null : model))
              }
            />
          </>
        ) : null}
      </main>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
}: {
  icon: typeof Database;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-5 h-5 text-amber-400" />
      <h2 className="text-base font-bold">{title}</h2>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{label}</p>
      <p className="text-xl font-bold mt-1 text-slate-100">{value}</p>
      {hint && <p className="text-[10px] text-slate-500 mt-1 font-mono truncate">{hint}</p>}
    </div>
  );
}

function CollectionSection({
  title,
  collections,
  counts,
  samples,
  expandedModel,
  onToggle,
}: {
  title: string;
  collections: CollectionMeta[];
  counts: Record<string, number>;
  samples: Record<string, Record<string, unknown>[]>;
  expandedModel: string | null;
  onToggle: (model: string) => void;
}) {
  return (
    <section>
      <SectionTitle icon={Database} title={title} />
      <div className="mt-4 space-y-2">
        {collections.map((col) => {
          const isOpen = expandedModel === col.model;
          const count = counts[col.model] ?? 0;
          const sampleDocs = samples[col.model] ?? [];

          return (
            <div
              key={col.model}
              className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => onToggle(col.model)}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-800/40 transition-colors"
              >
                {isOpen ? (
                  <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold text-amber-400/90">
                      {col.model}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                      {col.collection}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold">
                      {count} docs
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{col.purpose}</p>
                </div>
              </button>

              {isOpen && (
                <div className="px-4 pb-4 border-t border-slate-800/80">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mt-4 mb-2">
                    Variables ({col.fields.length} campos documentados)
                  </p>
                  <div className="overflow-x-auto rounded-lg border border-slate-800">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-900 text-slate-500 text-[10px] uppercase">
                          <th className="text-left p-2 font-bold">Variable</th>
                          <th className="text-left p-2 font-bold">Tipo</th>
                          <th className="text-left p-2 font-bold hidden md:table-cell">Ejemplo</th>
                          <th className="text-left p-2 font-bold">Descripción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {col.fields.map((field) => (
                          <tr key={field.name}>
                            <td className="p-2 font-mono text-slate-300 align-top">
                              {field.name}
                              {field.sensitive && (
                                <span className="ml-1.5 text-[9px] text-red-400/80 block md:inline">
                                  sensible
                                </span>
                              )}
                            </td>
                            <td className="p-2 text-slate-500 align-top whitespace-nowrap">
                              {field.type}
                            </td>
                            <td className="p-2 text-slate-600 font-mono text-[10px] align-top hidden md:table-cell">
                              {field.example ?? "—"}
                            </td>
                            <td className="p-2 text-slate-400 align-top leading-relaxed">
                              {field.key}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mt-4 mb-2">
                    Usado en
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {col.usedBy.map((use) => (
                      <span
                        key={use}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-400"
                      >
                        {use}
                      </span>
                    ))}
                  </div>

                  {sampleDocs.length > 0 && (
                    <>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mt-4 mb-2">
                        Muestra reciente (PINs enmascarados)
                      </p>
                      <pre className="text-[10px] font-mono text-slate-400 bg-slate-950 rounded-lg p-3 overflow-x-auto border border-slate-800">
                        {JSON.stringify(sampleDocs, null, 2)}
                      </pre>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
