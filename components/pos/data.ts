import { Client, Staff, Appointment, Service, ServiceCategory, StaffBlockedSlot, Receptionist, Accountant } from './types';
import { STAFF_COLOR_PALETTE, STAFF_CATALOG_TEMPLATE_BY_ROLE } from './staffColors';

const SERVICE_IMAGE =
  'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&q=80&w=600';

const STAFF_IMAGE =
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200';

const createService = (
  id: string,
  name: string,
  category: ServiceCategory,
  subtitle: string,
  staffIds: string[],
  description: string,
  duration = 60,
  exclusive = false
): Service => ({
  id,
  name,
  category,
  subtitle,
  price: 0,
  duration,
  image: SERVICE_IMAGE,
  description,
  staffIds,
  exclusive
});

export const INITIAL_SERVICES: Service[] = [
  // Uñas
  createService(
    'SRV-SGEL',
    'Soft gel / Gel X',
    'Uñas',
    'Extensión y retoque con soft gel',
    ['CA', 'KE', 'DE', 'DA', 'DI'],
    'Aplicación y mantenimiento con sistema soft gel / Gel X.'
  ),
  createService(
    'SRV-RUBBER',
    'Rubber',
    'Uñas',
    'Nivelación y estructura rubber',
    ['CA', 'KE', 'DE', 'DA', 'DI'],
    'Técnica rubber para nivelación, refuerzo y durabilidad.'
  ),
  createService(
    'SRV-ACR',
    'Acrílico / esculturales',
    'Uñas',
    'Estructuras esculturales en acrílico',
    ['CA', 'KE', 'DA', 'DI'],
    'Uñas esculturales y estructuras en acrílico.',
    90
  ),
  createService(
    'SRV-TIPS',
    'Uñas con tips',
    'Uñas',
    'Extensión con tips',
    ['CA', 'KE', 'DA'],
    'Colocación de tips para alargar y esculpir la uña.'
  ),
  createService(
    'SRV-RET',
    'Retiros de producto',
    'Uñas',
    'Retiro seguro de gel, acrílico o rubber',
    ['CA', 'DI', 'DA'],
    'Retiro profesional de cualquier producto previo en uñas.',
    45
  ),
  createService(
    'SRV-DIS',
    'Diseños / decoración',
    'Uñas',
    'Nail art y decoración',
    ['CA', 'DI', 'DA'],
    'Diseños, decoración y detalles artísticos sobre la uña.'
  ),
  createService(
    'SRV-POLY',
    'Polygel',
    'Uñas',
    'Construcción con polygel',
    ['KE', 'DE'],
    'Nivelación y construcción con sistema polygel.'
  ),
  createService(
    'SRV-GCON',
    'Gel de construcción',
    'Uñas',
    'Estructura con gel de construcción',
    ['KE', 'DE'],
    'Nivelación y refuerzo con gel de construcción.'
  ),
  createService(
    'SRV-ACRIG',
    'Acrigel',
    'Uñas',
    'Técnica acrigel',
    ['CA', 'DA'],
    'Combinación de acrílico y gel para estructuras resistentes.'
  ),
  createService(
    'SRV-TECH',
    'Tech gel',
    'Uñas',
    'Sistema tech gel',
    ['CA', 'DA'],
    'Aplicación y mantenimiento con técnica tech gel.'
  ),
  createService(
    'SRV-DUAL',
    'Dual system',
    'Uñas',
    'Sistema dual gel + acrílico',
    ['KE', 'DA'],
    'Construcción con sistema dual para máxima resistencia.'
  ),
  createService(
    'SRV-GMAN',
    'Gel en manos',
    'Uñas',
    'Esmaltado en gel liso o con diseño sencillo',
    ['CA', 'DI'],
    'Gel en manos: liso, efectos y diseños sencillos.',
    50
  ),
  createService(
    'SRV-HIBR',
    'Técnica híbrida',
    'Uñas',
    'Servicio exclusivo · técnica híbrida',
    ['DA'],
    'Técnica híbrida combinando sistemas para casos específicos.',
    75,
    true
  ),

  // Manos y pies
  createService(
    'SRV-MAN',
    'Manicure',
    'Manos y pies',
    'Cuidado integral de manos',
    ['CA', 'DI'],
    'Manicure clásica: limado, cutículas, hidratación y acabado.',
    45
  ),
  createService(
    'SRV-PED',
    'Pedicure',
    'Manos y pies',
    'Cuidado integral de pies',
    ['CA', 'DI'],
    'Pedicure: exfoliación, cutículas, limado e hidratación.',
    60
  ),
  createService(
    'SRV-ACPIE',
    'Acripie',
    'Manos y pies',
    'Pedicure con acrílico en uñas de los pies',
    ['CA', 'DA'],
    'Pedicure con aplicación de acrílico en pies.',
    75
  ),

  // Cejas y mirada
  createService(
    'SRV-LAMC',
    'Laminado de ceja',
    'Cejas y mirada',
    'Laminado y fijación de cejas',
    ['DE', 'VE', 'DA'],
    'Laminado de ceja para dar forma, volumen y fijación.',
    45
  ),
  createService(
    'SRV-DCEJ',
    'Diseño de ceja',
    'Cejas y mirada',
    'Perfilado y diseño de cejas',
    ['DE', 'VE', 'DA'],
    'Diseño y perfilado personalizado de cejas.',
    30
  ),
  createService(
    'SRV-HENN',
    'Henna en cejas',
    'Cejas y mirada',
    'Tinte natural con henna',
    ['DE', 'DA'],
    'Coloración de cejas con henna.',
    30
  ),
  createService(
    'SRV-HILO',
    'Depilación con hilo',
    'Cejas y mirada',
    'Depilación facial con hilo',
    ['DE', 'DA'],
    'Depilación precisa con hilo en zona facial.',
    20
  ),
  createService(
    'SRV-LASH',
    'Lash lifting',
    'Cejas y mirada',
    'Servicio exclusivo · lifting de pestañas',
    ['DE'],
    'Lifting de pestañas para curvar y definir la mirada.',
    60,
    true
  ),
  createService(
    'SRV-EXT',
    'Extensiones de pestañas',
    'Cejas y mirada',
    'Servicio exclusivo · clásica, volumen, híbridas',
    ['DE'],
    'Extensiones de pestañas: clásica, volumen, efectos e híbridas.',
    90,
    true
  ),
  createService(
    'SRV-RIZP',
    'Rizado permanente de pestañas',
    'Cejas y mirada',
    'Servicio exclusivo · rizado permanente',
    ['VE'],
    'Rizado permanente de pestañas.',
    60,
    true
  ),

  // Cabello, estética y cuerpo
  createService(
    'SRV-KERA',
    'Keratina / nanoplastia / botox',
    'Cabello, estética y cuerpo',
    'Servicio exclusivo · alaciado semipermanente',
    ['CA'],
    'Alaciado semipermanente: keratina, nanoplastia o botox capilar.',
    120,
    true
  ),
  createService(
    'SRV-CERA',
    'Depilación con cera (cuerpo)',
    'Cabello, estética y cuerpo',
    'Servicio exclusivo · cera española',
    ['CA'],
    'Depilación con cera española en cuerpo completo.',
    60,
    true
  ),
  createService(
    'SRV-STYL',
    'Alaciado / rizado (styling)',
    'Cabello, estética y cuerpo',
    'Servicio exclusivo · styling de cabello',
    ['DI'],
    'Alaciado y rizado de cabello para eventos o uso diario.',
    60,
    true
  ),
  createService(
    'SRV-EST',
    'Maquillaje · peinado · facial',
    'Cabello, estética y cuerpo',
    'Servicio exclusivo · estética integral',
    ['VE'],
    'Maquillaje, peinado y facial de limpieza profunda.',
    90,
    true
  )
];

export const INITIAL_STAFF: Staff[] = [
  {
    id: 'CA',
    name: 'Carla',
    email: 'carla@ae.studioo',
    phone: '',
    role: 'Perfil más completo',
    status: 'online',
    rating: 5.0,
    specialty: 'Uñas, manos, pies, keratina y depilación',
    shift: 'Completo',
    completedToday: 0,
    totalToday: 0,
    weeklyRevenue: 0,
    commissionPercent: 40,
    bio: 'El perfil más completo del equipo: acrílicas, gel, rubber, soft gel, manicure, pedicure, keratina y depilación con cera.',
    image: STAFF_IMAGE,
    ...STAFF_COLOR_PALETTE[0]
  },
  {
    id: 'DI',
    name: 'Diana',
    email: 'diana@ae.studioo',
    phone: '',
    role: 'Generalista en crecimiento',
    status: 'online',
    rating: 4.8,
    specialty: 'Gel en manos, manicure, pedicure y styling',
    shift: 'Completo',
    completedToday: 0,
    totalToday: 0,
    weeklyRevenue: 0,
    commissionPercent: 40,
    bio: 'Generalista en crecimiento: gel en manos, manicure, pedicure, alaciado y rizado. En práctica con rubber y acrílico.',
    image: STAFF_IMAGE,
    ...STAFF_COLOR_PALETTE[1]
  },
  {
    id: 'KE',
    name: 'Kenia',
    email: 'kenia@ae.studioo',
    phone: '',
    role: 'Especialista 100% uñas',
    status: 'online',
    rating: 4.9,
    specialty: 'Polygel, acrílico, rubber y dual system',
    shift: 'Completo',
    completedToday: 0,
    totalToday: 0,
    weeklyRevenue: 0,
    commissionPercent: 40,
    bio: '100% uñas: polygel, acrílico, rubber, gel de construcción, soft gel, dual system, tips y esculturales.',
    image: STAFF_IMAGE,
    ...STAFF_COLOR_PALETTE[2]
  },
  {
    id: 'DE',
    name: 'Denisse',
    email: 'denisse@ae.studioo',
    phone: '',
    role: 'Uñas + mirada y cejas',
    status: 'online',
    rating: 5.0,
    specialty: 'Rubber, soft gel y extensiones de pestañas',
    shift: 'Completo',
    completedToday: 0,
    totalToday: 0,
    weeklyRevenue: 0,
    commissionPercent: 40,
    bio: 'Uñas con rubber, gel de construcción, polygel y soft gel. Mirada y cejas: lash lifting, laminado, diseño, henna y extensiones.',
    image: STAFF_IMAGE,
    ...STAFF_COLOR_PALETTE[3]
  },
  {
    id: 'VE',
    name: 'Veikin',
    email: 'veikin@ae.studioo',
    phone: '',
    role: 'Estética',
    status: 'break',
    rating: 4.9,
    specialty: 'Maquillaje, peinado, cejas y facial',
    shift: 'Completo',
    completedToday: 0,
    totalToday: 0,
    weeklyRevenue: 0,
    commissionPercent: 40,
    bio: 'Estética: maquillaje, peinado, laminado y diseño de cejas, rizado permanente de pestañas y facial de limpieza profunda.',
    image: '/staff/veikin.jpg',
    ...STAFF_COLOR_PALETTE[4]
  },
  {
    id: 'DA',
    name: 'Danna',
    email: 'danna@ae.studioo',
    phone: '',
    role: 'Comodín de uñas',
    status: 'online',
    rating: 5.0,
    specialty: 'Soft gel, acrílico, rubber y técnica híbrida',
    shift: 'Completo',
    completedToday: 0,
    totalToday: 0,
    weeklyRevenue: 0,
    commissionPercent: 40,
    bio: 'Comodín de uñas: soft gel, acrílico, rubber, acrigel, tech gel, dual system, tips, esculturales, retiros, diseños, acripie y técnica híbrida.',
    image: '/staff/danna.jpg',
    ...STAFF_COLOR_PALETTE[5]
  },
  {
    id: 'VN',
    name: 'Vanny',
    email: 'vanny@ae.studioo',
    phone: '',
    role: 'Perfil más completo',
    status: 'online',
    rating: 5.0,
    specialty: 'Uñas, manos, pies, keratina y depilación',
    shift: 'Completo',
    completedToday: 0,
    totalToday: 0,
    weeklyRevenue: 0,
    commissionPercent: 40,
    bio: 'Perfil completo de uñas y estética: soft gel, rubber, acrílico, manicure, pedicure, keratina y depilación.',
    image: STAFF_IMAGE,
    ...STAFF_COLOR_PALETTE[6]
  }
];

export const INITIAL_ACCOUNTANTS: Accountant[] = [
  {
    id: 'CO',
    name: 'Contadora',
    role: 'Contabilidad',
    loginCode: '4001',
    email: 'contabilidad@ae.studioo',
    phone: '',
  },
];

export const INITIAL_RECEPTIONISTS: Receptionist[] = [
  {
    id: 'AL',
    name: 'Alondra',
    role: 'Recepción',
    loginCode: '1011',
    bookingsToday: 0,
    bookingsTodayDate: '',
    image: STAFF_IMAGE,
    color: '#7A6142',
    colorLight: '#f5efe6'
  },
  {
    id: 'AB',
    name: 'Abril',
    role: 'Recepción',
    loginCode: '1202',
    bookingsToday: 0,
    bookingsTodayDate: '',
    image: STAFF_IMAGE,
    color: '#5C6B7A',
    colorLight: '#eef1f4'
  },
  {
    id: 'DR',
    name: 'Diana',
    role: 'Recepción',
    loginCode: '1033',
    bookingsToday: 0,
    bookingsTodayDate: '',
    image: STAFF_IMAGE,
    color: '#6B5C8E',
    colorLight: '#f0ecf5'
  }
];

export const INITIAL_CLIENTS: Client[] = [];

export const INITIAL_APPOINTMENTS: Appointment[] = [];

export const INITIAL_BLOCKED_SLOTS: StaffBlockedSlot[] = [];

const mxnFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formatea precio en pesos mexicanos; 0 significa pendiente de definir. */
export const formatServicePrice = (price: number): string =>
  price > 0 ? mxnFormatter.format(price) : 'Por definir';

/** Formatea montos en pesos mexicanos (incluye $0.00). */
export const formatMXN = (amount: number): string => mxnFormatter.format(amount);

/** Especialistas que pueden realizar un servicio. */
export const getStaffForService = (
  serviceId: string,
  staffList: Staff[]
): Staff[] => {
  const service = INITIAL_SERVICES.find((item) => item.id === serviceId);
  if (!service) return staffList;
  return staffList.filter((member) => service.staffIds.includes(member.id));
};

/** Servicios del catálogo que puede realizar una especialista. */
export const getServicesForStaff = (
  staffId: string,
  services: Service[] = INITIAL_SERVICES,
  staffList: Staff[] = INITIAL_STAFF
): Service[] => {
  const staff = staffList.find((member) => member.id === staffId);

  if (staff?.allowedServiceIds?.length) {
    const allowed = new Set(staff.allowedServiceIds);
    return services.filter((service) => allowed.has(service.id));
  }

  const direct = services.filter((service) => service.staffIds.includes(staffId));
  if (direct.length > 0) return direct;

  if (!staff) return services;

  const templateId =
    STAFF_CATALOG_TEMPLATE_BY_ROLE[staff.role] ||
    (staff.name.toLowerCase() === 'vanny' ? 'CA' : undefined);

  if (templateId) {
    return services.filter((service) => service.staffIds.includes(templateId));
  }

  return services;
};
