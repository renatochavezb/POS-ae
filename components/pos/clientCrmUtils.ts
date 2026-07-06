import { Client, ClientCrmSegmentFlags } from './types';

export type ClientCrmSegment =
  | 'all'
  | 'inactive'
  | 'upcoming'
  | 'unconfirmed'
  | 'new'
  | 'birthday'
  | 'alerts'
  | 'reschedule';

export type ClientSegmentTag = {
  key: string;
  label: string;
  detail: string;
};

export const CRM_WEEKS_DAYS = 21;
export const INACTIVE_DAYS = 45;
export const UPCOMING_WINDOW_DAYS = 7;

export const CLIENT_CRM_SEGMENTS: {
  id: ClientCrmSegment;
  label: string;
  hint: string;
}[] = [
  { id: 'all', label: 'Todas', hint: 'Directorio completo' },
  {
    id: 'inactive',
    label: 'Inactivas',
    hint: 'Sin cita pendiente y sin visita pagada en 45+ días',
  },
  {
    id: 'upcoming',
    label: 'Con cita próxima',
    hint: 'Cita agendada o confirmada (sin pagar) en los próximos 7 días',
  },
  {
    id: 'unconfirmed',
    label: 'Sin confirmar',
    hint: 'Cita futura aún en estatus agendado',
  },
  {
    id: 'new',
    label: 'Nuevas',
    hint: 'Registradas en las últimas 3 semanas y sin historial largo',
  },
  {
    id: 'birthday',
    label: 'Cumpleaños del mes',
    hint: 'Celebran cumpleaños este mes (fecha en perfil)',
  },
  {
    id: 'alerts',
    label: 'Con alertas',
    hint: 'Contraindicaciones o notas médicas en el perfil',
  },
  {
    id: 'reschedule',
    label: 'Reagendar',
    hint: 'Sin cita pendiente y (canceló o pagó en las últimas 3 semanas)',
  },
];

const SEGMENT_FLAG_ORDER: (keyof ClientCrmSegmentFlags)[] = [
  'inactive',
  'upcoming',
  'unconfirmed',
  'nuevas',
  'birthday',
  'alerts',
  'reschedule',
];

const SEGMENT_TAG_LABELS: Record<keyof ClientCrmSegmentFlags, string> = {
  inactive: 'Inactiva',
  upcoming: 'Cita próxima',
  unconfirmed: 'Sin confirmar',
  nuevas: 'Nueva',
  birthday: 'Cumpleaños',
  alerts: 'Alerta',
  reschedule: 'Reagendar',
};

function segmentToFlagKey(
  segment: ClientCrmSegment
): keyof ClientCrmSegmentFlags | null {
  if (segment === 'all') return null;
  if (segment === 'new') return 'nuevas';
  return segment as keyof ClientCrmSegmentFlags;
}

export function clientMatchesCrmSegment(
  client: Client,
  segment: ClientCrmSegment
): boolean {
  if (segment === 'all') return true;

  const flagKey = segmentToFlagKey(segment);
  if (!flagKey) return true;

  return Boolean(client.crmSegmentFlags?.[flagKey]);
}

export function countClientsBySegment(
  clients: Client[],
  segment: ClientCrmSegment
): number {
  return clients.filter((client) => clientMatchesCrmSegment(client, segment))
    .length;
}

export function getSegmentSummary(
  segment: ClientCrmSegment,
  filteredCount: number,
  totalCount: number
): { title: string; subtitle: string } {
  const meta = CLIENT_CRM_SEGMENTS.find((item) => item.id === segment);

  if (segment === 'all') {
    return {
      title: `${filteredCount} clientas`,
      subtitle: 'Directorio completo del salón',
    };
  }

  return {
    title: `${filteredCount} clientas`,
    subtitle:
      filteredCount === 0
        ? `Ninguna clienta en «${meta?.label ?? segment}» de ${totalCount} registradas`
        : `${meta?.hint ?? ''} · ${filteredCount} de ${totalCount} registradas`,
  };
}

export function getClientSegmentTags(client: Client): ClientSegmentTag[] {
  const flags = client.crmSegmentFlags;
  const details = client.crmSegmentDetails || {};

  if (!flags) return [];

  return SEGMENT_FLAG_ORDER.filter((key) => flags[key]).map((key) => ({
    key: key === 'nuevas' ? 'new' : key,
    label: SEGMENT_TAG_LABELS[key],
    detail: details[key] || '',
  }));
}

export function formatLastPaidVisitLabel(client: Client): string {
  const label = client.lastPaidVisitDate?.trim();
  if (!label) return '—';
  return label;
}
