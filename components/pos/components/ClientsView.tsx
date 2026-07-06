import { useMemo, useState } from 'react';
import {
  Search,
  UserPlus,
  SlidersHorizontal,
  Mail,
  Phone,
  ChevronRight,
} from 'lucide-react';
import { Client } from '../types';
import { formatMXN } from '../data';
import {
  CLIENT_CRM_SEGMENTS,
  ClientCrmSegment,
  clientMatchesCrmSegment,
  countClientsBySegment,
  formatLastPaidVisitLabel,
  getClientSegmentTags,
  getSegmentSummary,
} from '../clientCrmUtils';

interface ClientsViewProps {
  clients: Client[];
  onOpenNewClient: () => void;
  onSelectClient: (id: string) => void;
}

export default function ClientsView({
  clients,
  onOpenNewClient,
  onSelectClient,
}: ClientsViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [segment, setSegment] = useState<ClientCrmSegment>('all');

  const handleResetFilters = () => {
    setSegment('all');
    setSearchTerm('');
  };

  const filteredClients = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return clients.filter((client) => {
      const matchesSearch =
        !normalizedSearch ||
        client.name.toLowerCase().includes(normalizedSearch) ||
        client.email.toLowerCase().includes(normalizedSearch) ||
        client.phone.includes(normalizedSearch);

      const matchesSegment = clientMatchesCrmSegment(client, segment);

      return matchesSearch && matchesSegment;
    });
  }, [clients, searchTerm, segment]);

  const segmentCounts = useMemo(
    () =>
      Object.fromEntries(
        CLIENT_CRM_SEGMENTS.map((item) => [
          item.id,
          countClientsBySegment(clients, item.id),
        ])
      ) as Record<ClientCrmSegment, number>,
    [clients]
  );

  const summary = getSegmentSummary(segment, filteredClients.length, clients.length);
  const activeSegment = CLIENT_CRM_SEGMENTS.find((item) => item.id === segment);

  return (
    <div className="space-y-8 animate-fade-in p-1 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-secondary font-sans text-xs font-bold tracking-widest uppercase">
            Clientes del salón
          </span>
          <h2 className="font-display text-3xl font-bold text-primary mt-1">
            Directorio de Clientes
          </h2>
          <p className="text-on-surface-variant text-sm mt-1">
            Segmentos operativos para recepción: reactivar, confirmar y dar seguimiento.
          </p>
        </div>
        <div>
          <button
            type="button"
            onClick={onOpenNewClient}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-on-primary font-sans text-xs font-bold uppercase tracking-wider hover:bg-primary-container transition-all shadow-sm"
          >
            <UserPlus className="w-4 h-4 text-secondary" />
            <span>Registrar Cliente</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-primary/5 luxury-shadow h-fit space-y-6">
          <div className="flex items-center justify-between border-b border-primary/5 pb-3">
            <span className="font-display font-bold text-sm text-primary flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-secondary" />
              Segmentos
            </span>
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-[10px] text-outline hover:text-primary font-bold uppercase tracking-widest"
            >
              Restaurar
            </button>
          </div>

          <div className="space-y-2 text-xs">
            {CLIENT_CRM_SEGMENTS.map((item) => {
              const count = segmentCounts[item.id] ?? 0;
              const active = segment === item.id;

              return (
                <label
                  key={item.id}
                  className={`flex items-start gap-2.5 cursor-pointer rounded-xl border px-3 py-2.5 transition-colors ${
                    active
                      ? 'border-secondary/40 bg-secondary/5 text-primary'
                      : 'border-transparent text-on-surface-variant hover:border-primary/10 hover:bg-surface-container-low/40'
                  }`}
                >
                  <input
                    type="radio"
                    name="client-segment"
                    checked={active}
                    onChange={() => setSegment(item.id)}
                    className="mt-0.5 text-primary focus:ring-primary w-4 h-4 accent-primary shrink-0"
                  />
                  <span className="min-w-0">
                    <span className="font-bold block">{item.label}</span>
                    <span className="text-[10px] text-outline leading-snug block mt-0.5">
                      {item.hint}
                    </span>
                    <span className="text-[10px] font-mono text-secondary mt-1 inline-block">
                      {count} clienta{count === 1 ? '' : 's'}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>

          <div className="p-4 bg-primary/5 rounded-xl border border-primary/5 space-y-2">
            <span className="text-[9px] text-outline uppercase font-bold tracking-widest">
              {activeSegment?.label ?? 'Resumen'}
            </span>
            <p className="text-xl font-display font-bold text-primary">{summary.title}</p>
            <p className="text-[10px] text-on-surface-variant leading-relaxed">
              {summary.subtitle}
            </p>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-6">
          <div className="bg-surface-container-lowest p-4 rounded-2xl border border-primary/5 luxury-shadow flex items-center gap-3">
            <Search className="w-5 h-5 text-outline" />
            <input
              type="text"
              placeholder="Buscar por nombre, correo electrónico, teléfono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-grow bg-transparent border-none outline-none text-sm text-primary placeholder-outline font-sans"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="text-xs text-outline hover:text-primary font-bold"
              >
                Limpiar
              </button>
            )}
          </div>

          <div className="bg-surface-container-lowest rounded-2xl border border-primary/5 luxury-shadow overflow-hidden">
            {filteredClients.length === 0 ? (
              <div className="py-16 text-center text-outline text-sm space-y-2">
                <p className="font-bold">No se encontraron clientes.</p>
                <p className="text-xs">
                  Prueba otro segmento o ajusta la búsqueda.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low/50 text-[10px] text-outline font-bold uppercase tracking-widest border-b border-primary/5">
                      <th className="py-4 px-6">Cliente</th>
                      <th className="py-4 px-6">Contacto</th>
                      <th className="py-4 px-6">Segmentos</th>
                      <th className="py-4 px-6">Última visita pagada</th>
                      <th className="py-4 px-6 text-right">Gasto total</th>
                      <th className="py-4 px-6 text-center">Visitas</th>
                      <th className="py-4 px-6 text-right">Perfil</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary/5">
                    {filteredClients.map((client) => {
                      const portraitUrl = `https://api.dicebear.com/7.x/adventurer/svg?seed=${client.name}`;
                      const tags = getClientSegmentTags(client);

                      return (
                        <tr
                          key={client.id}
                          onClick={() => onSelectClient(client.id)}
                          className="hover:bg-surface-container-low/30 transition-all group cursor-pointer"
                        >
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <img
                                referrerPolicy="no-referrer"
                                src={portraitUrl}
                                alt={client.name}
                                className="w-10 h-10 rounded-full object-cover border border-primary/10"
                              />
                              <div>
                                <p className="font-sans font-bold text-xs text-primary group-hover:underline">
                                  {client.name}
                                </p>
                                <p className="text-[10px] text-outline font-mono">
                                  {client.id}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div className="space-y-0.5 text-[10px] text-on-surface-variant font-medium">
                              <p className="flex items-center gap-1.5">
                                <Mail className="w-3 h-3 text-outline" /> {client.email}
                              </p>
                              <p className="flex items-center gap-1.5">
                                <Phone className="w-3 h-3 text-outline" /> {client.phone}
                              </p>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex flex-col gap-1 max-w-[240px]">
                              {tags.length === 0 ? (
                                <span className="text-[10px] text-outline">Sin señales activas</span>
                              ) : (
                                tags.map((tag) => (
                                  <div
                                    key={tag.key}
                                    className="rounded-lg border border-primary/10 bg-surface-container-low/40 px-2 py-1"
                                  >
                                    <p className="text-[9px] font-bold uppercase tracking-wider text-primary">
                                      {tag.label}
                                    </p>
                                    <p className="text-[10px] text-outline leading-snug mt-0.5">
                                      {tag.detail}
                                    </p>
                                  </div>
                                ))
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <p className="text-xs font-sans font-bold text-primary">
                              {formatLastPaidVisitLabel(client)}
                            </p>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <p className="text-xs font-display font-extrabold text-primary">
                              {formatMXN(client.totalSpent)}
                            </p>
                            <p className="text-[9px] text-outline font-sans">
                              Prom: {formatMXN(client.averageTicket)}
                            </p>
                          </td>
                          <td className="py-4 px-6 text-center">
                            <span className="text-xs font-mono font-bold text-primary">
                              {client.visitsCount}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <button
                              type="button"
                              className="text-outline group-hover:text-primary transition-colors p-1"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
