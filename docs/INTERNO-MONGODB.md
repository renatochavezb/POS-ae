# Panel interno MongoDB (`/interno`)

Documentación completa del esquema MongoDB del POS Studio ae y ShipFast.

| | |
|---|---|
| **Base de datos** | `studio_ae` (MongoDB Atlas) |
| **Panel web** | `/interno` — requiere PIN master |
| **API en vivo** | `GET /api/interno/overview` |
| **Fuente de verdad en código** | `libs/mongoSchemaCatalog.js` |
| **UI** | `components/interno/InternoExplorer.tsx` |

> Al agregar o cambiar campos en Mongoose, actualiza `libs/mongoSchemaCatalog.js` y este archivo.

---

## Índice

1. [Convenciones globales](#convenciones-globales)
2. [Diagrama de relaciones](#diagrama-de-relaciones)
3. [Flujos de datos](#flujos-de-datos)
4. [Features derivadas (sin colección nueva)](#features-derivadas-sin-colección-nueva)
5. [Colecciones POS](#colecciones-pos)
6. [Colecciones ShipFast](#colecciones-shipfast)
7. [Tabla de relaciones (35 enlaces)](#tabla-de-relaciones-35-enlaces)
8. [Acceso y seguridad](#acceso-y-seguridad)

---

## Convenciones globales

### 1. Fechas automáticas (`createdAt` / `updatedAt`)

Todas las colecciones usan `{ timestamps: true }` en Mongoose. No hace falta enviarlas desde el frontend.

| Variable | Tipo | Descripción |
|----------|------|-------------|
| `createdAt` | Date | Cuándo se creó el documento |
| `updatedAt` | Date | Cuándo se modificó por última vez |

### 2. Claves de negocio (no ObjectId)

El `_id` de Mongo existe, pero la app enlaza tablas con **códigos legibles en String**:

- `staffCode` → `CA`
- `clientCode` → `SA-4092`
- `appointmentCode`, `paymentCode`, `sessionCode`, `settlementCode`, `activityCode`, etc.

Las FK son String con el código de negocio, **no** ObjectId de Mongo.

### 3. Campos sensibles

PINs y claves master se enmascaran (`••••`) en las muestras del panel `/interno`.

| Variable | Descripción |
|----------|-------------|
| `loginCode` | PIN de 4 dígitos — recepción, manicurista, contadora |
| `masterLoginCode` | PIN master de respaldo (`PosScheduleConfig`) |

### 4. Snapshots congelados (auditoría)

Al liquidar o descargar reporte se guarda una copia de los datos en ese momento. Si luego cambia una cita, el histórico **no** se altera.

| Variable | Descripción |
|----------|-------------|
| `appointmentSnapshots[]` | Cita congelada: `appointmentCode`, `date`, `time`, `clientName`, `serviceName`, `cost`, `commissionAmount`, `status` |
| `reportSnapshot[]` | Misma estructura — respaldo del reporte sin guardar PDF en Mongo |

---

## Diagrama de relaciones

```
── AGENDA Y CLIENTES ──
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
PosDailySnapshot ◄── date ──► PosAppointment
```

---

## Flujos de datos

### Login recepción o manicurista

1. `PosReceptionist.loginCode` o `PosStaff.loginCode` se valida en `/api/pos/login/verify`.
2. Si el PIN coincide con `PosScheduleConfig.masterLoginCode` → rol master (`isMaster` en `PosLoginAudit`).
3. Cada intento se registra en `PosLoginAudit` (éxito o fallo).
4. Al entrar recepción se abre `PosCashSession` si no hay turno abierto.

### Reserva y agenda

1. Se crea `PosAppointment` con `clientId` → `PosClient` y `staffId` → `PosStaff`.
2. `bookedByReceptionistId` y `bookedOnDate` enlazan a `PosReceptionist` (contador `bookingsToday`).
3. `PosBlockedSlot` evita solapamientos en la columna de la manicurista.
4. `PosDailySnapshot` se actualiza con contadores por `date`.

### Cobro y corte

1. `PosPayment` guarda `appointmentCode`, `clientId`, `staffId`, `cashSessionCode` y `processedByReceptionistId`.
2. `PosAppointment.status` pasa a `pagado`; totales se agregan en `PosCashSession`.
3. `PosClient.lastPaidVisitDate` y segmentos CRM se actualizan al cobrar.
4. Al cerrar turno: conteos, varianzas, `isPerfectCut` y `PosLoginAudit` con `actionDetails`.

### Contabilidad y liquidaciones

1. `PosAccountant` valida PIN; intento en `PosLoginAudit` y `PosAccountantActivity` (login) con `loginAuditId`.
2. Al liquidar: `PosStaffSettlement` con `appointmentSnapshots` y FKs a citas, pagos y caja.
3. `PosAccountantActivity` (liquidation) enlaza `settlementCode` + mismos FKs.
4. Reporte: `reportCode` + `reportSnapshot` en Mongo (PDF solo en navegador).
5. Logout: `manual` o `browser_close` → `PosAccountantActivity` (logout).
6. **Bitácora de movimientos**: solo visible con PIN master (administrador). `GET /api/pos/accountant-activities` requiere header `X-Pos-Master-Session: true`.

### CRM de clientes (Mongo)

1. `PosClient` almacena `crmSegmentFlags` (7 booleanos), `crmSegmentDetails` y `crmSegmentsSyncedAt`.
2. `libs/posClientCrmSegments.js` recalcula segmentos cruzando `PosClient` + `PosAppointment`.
3. Sincronización al cargar clientes, editar clienta, citas y cobros.
4. Segmentos: inactivas, cita próxima, sin confirmar, nuevas, cumpleaños, alertas, reagendar.

---

## Features derivadas (sin colección nueva)

### Borrador de corte de caja

- **Origen:** `PosCashSession`
- **Almacenamiento:** `sessionStorage` del navegador (no Mongo)
- **Campos:** `closingCountedCash`, `closingCountedCard`, `closingCountedTransfer`, `closingNotes`
- Solo aplica al turno abierto; no se guarda en base hasta confirmar cierre.

### PDF / impresión de reporte de manicurista

- **Origen:** `PosAppointment`, `PosStaff`, `PosAccountantActivity`
- **Almacenamiento:** HTML en navegador; respaldo en Mongo vía `reportSnapshot` + `reportCode`
- Al descargar reporte con sesión contadora, `POST /api/pos/accountant-activities` persiste snapshot y FKs.

### Resolución de citas y cobros al liquidar

- **Origen:** `PosAppointment`, `PosPayment`, `PosCashSession`, `PosStaffSettlement`
- **Código:** `libs/posSettlementSourceData.js` → `PosStaffSettlement` al crear liquidación
- `createStaffSettlement` recalcula desde citas pagadas; no se actualiza si luego cambian citas.

### Logout contadora al cerrar pestaña

- **Origen:** `PosAccountantActivity`
- **Almacenamiento:** `navigator.sendBeacon` → `POST /api/pos/accountant-activities`
- `logoutReason`: `manual` | `browser_close`

---

## Colecciones POS

### PosClient — `posclients`

**Propósito:** Clientas del estudio: perfil, gasto, visitas y segmentos CRM persistidos.

**Usado en:** Agenda, Perfil clienta, Reservas, Caja, CRM segmentos

| Variable | Tipo | Ejemplo | Descripción |
|----------|------|---------|-------------|
| `clientCode` | String | SA-4092 | PK lógica — código único de clienta |
| `name` | String | | Nombre completo |
| `email` | String | | Correo de contacto |
| `phone` | String | | Teléfono |
| `birthday` | String | | Cumpleaños — segmento CRM |
| `address` | String | | Dirección |
| `isPlatinum` | Boolean | | Legacy VIP |
| `memberSince` | String | | Texto «miembro desde» |
| `bio` | String | | Biografía corta |
| `styleProfile.bio` | String | | Bio en styleProfile |
| `styleProfile.tags` | [String] | | Etiquetas de estilo |
| `alerts` | [String] | | Alertas — segmento CRM |
| `totalSpent` | Number | | Gasto acumulado |
| `visitsCount` | Number | | Visitas pagadas |
| `averageTicket` | Number | | Ticket promedio |
| `registeredAt` | Date | | Registro real — segmento «nuevas» |
| `lastPaidVisitDate` | String | | Última cita pagada — «reagendar» |
| `phoneNormalized` | String | sensible | Índice único anti-duplicados |
| `emailNormalized` | String | sensible | Índice único anti-duplicados |
| `crmSegmentFlags.inactive` | Boolean | | Sin visita reciente |
| `crmSegmentFlags.upcoming` | Boolean | | Cita próxima |
| `crmSegmentFlags.unconfirmed` | Boolean | | Sin confirmar |
| `crmSegmentFlags.nuevas` | Boolean | | Clienta nueva ≤3 sem |
| `crmSegmentFlags.birthday` | Boolean | | Cumpleaños cercano |
| `crmSegmentFlags.alerts` | Boolean | | Alertas activas |
| `crmSegmentFlags.reschedule` | Boolean | | Conviene reagendar |
| `crmSegmentDetails` | Mixed | | Texto por segmento activo |
| `crmSegmentsSyncedAt` | Date | | Última sync CRM |
| `createdAt` | Date | | Auto Mongoose |
| `updatedAt` | Date | | Auto Mongoose |

---

### PosStaff — `posstaffs`

**Propósito:** Manicuristas: perfil, turno, comisión, colores de agenda y PIN.

**Usado en:** Agenda, Login manicurista, Bloqueos, Citas, Liquidaciones, Equipo

| Variable | Tipo | Ejemplo | Descripción |
|----------|------|---------|-------------|
| `staffCode` | String | CA | PK lógica |
| `name` | String | | Nombre en agenda |
| `email` | String | | Correo |
| `phone` | String | | Teléfono |
| `role` | String | | Puesto |
| `status` | enum | | online \| offline \| break |
| `rating` | Number | | Calificación perfil |
| `specialty` | String | | Especialidad |
| `shift` | String | | Turno |
| `completedToday` | Number | | Citas hoy (UI) |
| `totalToday` | Number | | Ingresos hoy (UI) |
| `weeklyRevenue` | Number | | Ingresos semana (UI) |
| `commissionPercent` | Number | | % comisión (default 40) |
| `bio` | String | | Biografía |
| `image` | String | | Foto `public/staff/` |
| `color` | String | | Color agenda |
| `colorLight` | String | | Variante clara |
| `allowedServiceIds` | [String] | | Servicios permitidos |
| `loginCode` | String | sensible | PIN 4 dígitos |
| `isActive` | Boolean | | false = baja |
| `deactivatedAt` | Date | | Fecha de baja |
| `deactivatedAgendaDate` | String | | Último día en agenda |
| `createdAt` / `updatedAt` | Date | | Auto Mongoose |

---

### PosReceptionist — `posreceptionists`

**Propósito:** Recepcionistas: PIN, reservas del día y apertura de caja.

| Variable | Tipo | Ejemplo | Descripción |
|----------|------|---------|-------------|
| `receptionistCode` | String | RC | PK lógica |
| `name` | String | | Nombre |
| `role` | String | | Rol mostrado |
| `loginCode` | String | sensible | PIN 4 dígitos |
| `bookingsToday` | Number | | Citas agendadas hoy |
| `bookingsTodayDate` | String | | Fecha del contador |
| `image` | String | | Avatar |
| `color` / `colorLight` | String | | Colores tarjeta |
| `createdAt` / `updatedAt` | Date | | Auto Mongoose |

---

### PosAppointment — `posappointments`

**Propósito:** Citas con servicio, horario, costo y vínculos.

| Variable | Tipo | Descripción |
|----------|------|-------------|
| `appointmentCode` | String | PK lógica |
| `date` | String | Fecha zona MX |
| `time` | String | Hora |
| `serviceName` | String | Servicio(s) |
| `serviceSubtitle` | String | Detalle |
| `serviceImage` | String | Imagen UI |
| `clientId` | String | FK → PosClient |
| `clientName` | String | Copia nombre |
| `staffId` | String | FK → PosStaff |
| `staffName` | String | Copia nombre |
| `staffInitials` | String | Iniciales |
| `cost` | Number | Precio MXN |
| `duration` | Number | Minutos |
| `status` | enum | agendado \| confirmado \| pagado \| cancelled \| pending \| completed |
| `bookedByReceptionistId` | String | FK → PosReceptionist |
| `bookedByReceptionistName` | String | Quién agendó |
| `bookedOnDate` | String | Día de creación — contador recepción |
| `createdAt` / `updatedAt` | Date | Auto Mongoose |

---

### PosBlockedSlot — `posblockedslots`

**Propósito:** Horarios bloqueados por manicurista.

| Variable | Tipo | Descripción |
|----------|------|-------------|
| `blockedSlotCode` | String | PK lógica |
| `date` | String | Fecha |
| `staffId` | String | FK → PosStaff |
| `time` | String | Hora inicio |
| `duration` | Number | Minutos |
| `reason` | String | Motivo |
| `createdAt` / `updatedAt` | Date | Auto Mongoose |

---

### PosPayment — `pospayments`

**Propósito:** Cobros en caja.

| Variable | Tipo | Descripción |
|----------|------|-------------|
| `paymentCode` | String | PK lógica |
| `appointmentCode` | String | FK → PosAppointment |
| `appointmentDate` | String | Filtro por día |
| `clientId` | String | FK → PosClient |
| `clientName` | String | Nombre clienta |
| `staffId` | String | FK → PosStaff |
| `staffName` | String | Manicurista |
| `serviceName` | String | Servicio |
| `amount` | Number | Sin propina |
| `tip` | Number | Propina |
| `total` | Number | amount + tip |
| `method` | enum | efectivo \| tarjeta \| transferencia \| mixto |
| `cashAmount` | Number | Parte efectivo |
| `cardAmount` | Number | Parte tarjeta |
| `transferAmount` | Number | Parte transferencia |
| `cashSessionCode` | String | FK → PosCashSession |
| `processedByReceptionistId` | String | FK → PosReceptionist |
| `processedByReceptionistName` | String | Quién cobró |
| `notes` | String | Notas |
| `createdAt` / `updatedAt` | Date | Auto Mongoose |

---

### PosCashSession — `poscashsessions`

**Propósito:** Turnos de caja: apertura, cobros y corte.

| Variable | Tipo | Descripción |
|----------|------|-------------|
| `sessionCode` | String | PK lógica |
| `status` | enum | open \| closed |
| `shiftDate` | String | Día operativo |
| `openedByReceptionistId` | String | FK quien abrió |
| `openedByReceptionistName` | String | Nombre |
| `closedByReceptionistId` | String | FK quien cerró |
| `closedByReceptionistName` | String | Nombre |
| `openingFloat` | Number | Fondo inicial |
| `expectedCash/Card/Transfer` | Number | Esperado al cierre |
| `closingCountedCash/Card/Transfer` | Number | Conteo físico |
| `variance` / `cardVariance` / `transferVariance` | Number | Diferencias |
| `isPerfectCut` | Boolean | Varianzas en cero |
| `paymentsCount` | Number | # cobros |
| `totalAmount` | Number | Total cobrado |
| `totalEfectivo/Tarjeta/Transferencia` | Number | Por método |
| `closingNotes` | String | Notas cierre |
| `closedAt` | Date | Momento cierre |
| `openedWithMasterPin` | Boolean | Abrió con master |
| `closedWithMasterPin` | Boolean | Cerró con master |
| `createdAt` / `updatedAt` | Date | Auto Mongoose |

---

### PosAccountant — `posaccountants`

**Propósito:** Perfiles de contabilidad.

| Variable | Tipo | Ejemplo | Descripción |
|----------|------|---------|-------------|
| `accountantCode` | String | CO | PK lógica |
| `name` | String | | Nombre |
| `role` | String | | Rol |
| `loginCode` | String | sensible | PIN 4 dígitos |
| `email` / `phone` | String | | Contacto |
| `isActive` | Boolean | | Perfil activo |
| `createdAt` / `updatedAt` | Date | | Auto Mongoose |

---

### PosAccountantActivity — `posaccountantactivities`

**Propósito:** Bitácora: login, logout, reportes, liquidaciones.

| Variable | Tipo | Descripción |
|----------|------|-------------|
| `activityCode` | String | PK lógica |
| `accountantId` | String | FK → PosAccountant |
| `accountantName` | String | Nombre al momento |
| `action` | enum | login \| logout \| report_download \| liquidation |
| `staffId` / `staffName` | String | Manicurista (si aplica) |
| `periodMode` | enum | day \| period |
| `periodStartLabel` / `periodEndLabel` | String | Periodo legible |
| `periodStartYmd` / `periodEndYmd` | String | YYYY-MM-DD |
| `settlementCode` | String | FK → PosStaffSettlement |
| `reportCode` | String | ID reporte |
| `reportSnapshot[]` | Array | Filas congeladas del reporte |
| `appointmentCodes` | [String] | FK → PosAppointment |
| `paymentCodes` | [String] | FK → PosPayment |
| `cashSessionCodes` | [String] | FK → PosCashSession |
| `loginAuditId` | String | FK → PosLoginAudit |
| `logoutReason` | String | manual \| browser_close |
| `isMasterSession` | Boolean | Login con PIN master |
| `appointmentCount` | Number | Citas del periodo |
| `grossAmount` / `paidAmount` | Number | Montos |
| `activityAt` | Date | Instante UTC |
| `activityDateLabel` / `activityTimeLabel` | String | Fecha/hora MX |
| `metadata` | Mixed | JSON extra |
| `createdAt` / `updatedAt` | Date | Auto Mongoose |

---

### PosStaffSettlement — `posstaffsettlements`

**Propósito:** Liquidaciones de comisión por periodo.

| Variable | Tipo | Descripción |
|----------|------|-------------|
| `settlementCode` | String | PK lógica |
| `staffId` / `staffName` | String | FK → PosStaff |
| `periodMode` | enum | day \| period |
| `periodStartLabel` / `periodEndLabel` | String | Periodo legible |
| `periodStartYmd` / `periodEndYmd` | String | Rango YMD (índice único) |
| `settledAt` / `settledDateLabel` | Date/String | Día liquidación |
| `grossAmount` | Number | Ventas brutas |
| `commissionAmount` | Number | Comisión |
| `paidAmount` | Number | Monto pagado |
| `commissionPercent` | Number | % usado |
| `appointmentCount` | Number | # citas |
| `accountantId` / `accountantName` | String | FK contadora |
| `notes` | String | Notas |
| `appointmentCodes` | [String] | FK citas |
| `appointmentSnapshots[]` | Array | Snapshot congelado |
| `paymentCodes` | [String] | FK cobros |
| `cashSessionCodes` | [String] | FK turnos caja |
| `loginAuditId` | String | FK auditoría |
| `createdAt` / `updatedAt` | Date | Auto Mongoose |

---

### PosLoginAudit — `posloginaudits`

**Propósito:** Auditoría de logins, liquidaciones y caja.

| Variable | Tipo | Descripción |
|----------|------|-------------|
| `role` | enum | reception \| manicurista \| accountant \| master |
| `userId` / `userName` | String | Usuario |
| `success` | Boolean | Éxito o fallo |
| `isMaster` | Boolean | Usó PIN master |
| `action` | String | login \| staff_settlement \| caja_open \| caja_close |
| `cashSessionCode` | String | FK → PosCashSession |
| `errorMessage` | String | Si falló |
| `actionDetails` | Mixed | JSON detalle |
| `createdAt` / `updatedAt` | Date | Auto Mongoose |

---

### PosDailySnapshot — `posdailysnapshots`

**Propósito:** Contadores diarios en barra de agenda.

| Variable | Tipo | Descripción |
|----------|------|-------------|
| `date` | String | PK lógica |
| `citas` | Number | Total |
| `sinConfirmar` | Number | Sin confirmar |
| `pagadas` | Number | Pagadas |
| `canceladas` | Number | Canceladas |
| `createdAt` / `updatedAt` | Date | Auto Mongoose |

---

### PosScheduleConfig — `posscheduleconfigs`

**Propósito:** Configuración global del salón (singleton).

| Variable | Tipo | Descripción |
|----------|------|-------------|
| `configCode` | String | default |
| `startHour` / `endHour` | Number | Horario agenda |
| `slotIntervalMinutes` | Number | Intervalo slots |
| `bookingDurationOptions` | [Number] | Duraciones cita |
| `closeDurationOptions` | [Number] | Duraciones bloqueo |
| `closeReasons` | [String] | Motivos bloqueo |
| `timeZone` | String | America/Mexico_City |
| `masterLoginCode` | String | sensible — PIN master |
| `createdAt` / `updatedAt` | Date | Auto Mongoose |

---

## Colecciones ShipFast

### User — `users`

Usuarios web NextAuth + Stripe.

| Variable | Tipo | Descripción |
|----------|------|-------------|
| `name` | String | Nombre |
| `email` | String | sensible |
| `image` | String | Avatar |
| `role` | enum | user \| admin \| editor \| moderator |
| `customerId` | String | Stripe cus_… |
| `priceId` | String | Stripe price_… |
| `hasAccess` | Boolean | Acceso producto |
| `createdAt` / `updatedAt` | Date | Auto Mongoose |

### Lead — `leads`

Waitlist landing.

| Variable | Tipo | Descripción |
|----------|------|-------------|
| `email` | String | sensible — PK lógica |
| `createdAt` / `updatedAt` | Date | Auto Mongoose |

---

## Tabla de relaciones (35 enlaces)

| Origen | Campo | Destino | Campo destino | Notas |
|--------|-------|---------|---------------|-------|
| PosClient | clientCode | PosAppointment | clientId | Cada cita → clienta |
| PosStaff | staffCode | PosAppointment | staffId | Manicurista asignada |
| PosStaff | staffCode | PosBlockedSlot | staffId | Bloqueos horario |
| PosReceptionist | receptionistCode | PosAppointment | bookedByReceptionistId | Quién agendó |
| PosAppointment | bookedByReceptionistId + bookedOnDate | PosReceptionist | bookingsToday | Contador diario |
| PosDailySnapshot | date | PosAppointment | date | Contadores día |
| PosAppointment | clientId + status | PosClient | crmSegmentFlags | Recalcula CRM |
| PosClient | birthday, alerts, etc. | PosClient | crmSegmentFlags | Segmentos perfil |
| PosAppointment | appointmentCode | PosPayment | appointmentCode | Cobro por cita |
| PosPayment | clientId | PosClient | clientCode | Clienta del pago |
| PosPayment | staffId | PosStaff | staffCode | Manicurista |
| PosPayment | processedByReceptionistId | PosReceptionist | receptionistCode | Quién cobró |
| PosPayment | appointmentCode | PosClient | lastPaidVisitDate | Actualiza CRM |
| PosCashSession | sessionCode | PosPayment | cashSessionCode | Turno de caja |
| PosReceptionist | receptionistCode | PosCashSession | openedBy/closedBy | Apertura/cierre |
| PosCashSession | sessionCode | PosLoginAudit | cashSessionCode | Auditoría caja |
| PosScheduleConfig | masterLoginCode | PosLoginAudit | isMaster | PIN master |
| PosReceptionist | loginCode | PosLoginAudit | userId | Login recepción |
| PosStaff | loginCode | PosLoginAudit | userId | Login manicurista |
| PosAccountant | loginCode | PosLoginAudit | userId | Login contadora |
| PosScheduleConfig | configCode | — | global | Singleton config |
| PosAccountant | accountantCode | PosStaffSettlement | accountantId | Autoriza liquidación |
| PosAccountant | accountantCode | PosAccountantActivity | accountantId | Bitácora |
| PosStaff | staffCode | PosStaffSettlement | staffId | Manicurista liquidada |
| PosStaffSettlement | appointmentCodes[] | PosAppointment | appointmentCode | Citas incluidas |
| PosStaffSettlement | appointmentSnapshots[] | PosAppointment | snapshot | Copia congelada |
| PosStaffSettlement | paymentCodes[] | PosPayment | paymentCode | Cobros |
| PosStaffSettlement | cashSessionCodes[] | PosCashSession | sessionCode | Turnos caja |
| PosStaffSettlement | loginAuditId | PosLoginAudit | _id | Auditoría |
| PosPayment | appointmentCode | PosStaffSettlement | appointmentCodes[] | Cita en liquidación |
| PosAccountantActivity | settlementCode | PosStaffSettlement | settlementCode | Movimiento → liquidación |
| PosAccountantActivity | appointmentCodes[] | PosAppointment | appointmentCode | Citas periodo |
| PosAccountantActivity | paymentCodes[] | PosPayment | paymentCode | Cobros periodo |
| PosAccountantActivity | cashSessionCodes[] | PosCashSession | sessionCode | Turnos periodo |
| PosAccountantActivity | reportSnapshot[] | — | snapshot | Reporte sin PDF |
| PosAccountantActivity | loginAuditId | PosLoginAudit | _id | Login/logout auditado |

---

## Acceso y seguridad

### Panel `/interno`

- Ruta: `/interno`
- Auth: `POST /api/interno/auth` con PIN master
- Cookie: `pos_interno_token`
- Muestra conteos en vivo, muestras enmascaradas y este catálogo en UI

### APIs relacionadas

| Endpoint | Quién puede |
|----------|-------------|
| `GET /api/interno/overview` | PIN master (`/interno`) |
| `GET /api/pos/accountant-activities` | Solo administrador (header `X-Pos-Master-Session: true`) |
| `POST /api/pos/accountant-activities` | Sesión POS activa (registra movimientos) |
| `POST /api/pos/staff-settlements` | Contadora o recepción con PIN contadora |

### Mantenimiento

1. Cambias un modelo en `models/Pos*.js`
2. Actualizas `libs/mongoSchemaCatalog.js`
3. Actualizas este archivo `docs/INTERNO-MONGODB.md`
4. Verificas en `/interno` → **Actualizar**

---

*Generado desde `libs/mongoSchemaCatalog.js` — POS Studio ae*
