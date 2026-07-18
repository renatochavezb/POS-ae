import { Appointment, Staff } from './types';
import { isAppointmentPaid } from './appointmentStatus';
import { compareSpanishShortDates } from '@/libs/spanishDateUtils';
import { formatSpanishShortDateInTimeZone } from './scheduleUtils';

export type StaffReportRow = {
  date: string;
  time: string;
  clientName: string;
  service: string;
  cost: number;
  commission: number;
};

export type StaffReportPeriod = {
  mode: 'day' | 'period';
  startLabel: string;
  endLabel: string;
};

const mxnFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
});

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatMoney(amount: number) {
  return mxnFormatter.format(amount);
}

export function buildStaffReportPeriodTitle(period: StaffReportPeriod) {
  if (period.mode === 'day' || period.startLabel === period.endLabel) {
    return period.startLabel;
  }
  return `${period.startLabel} – ${period.endLabel}`;
}

export function buildStaffReportRows(
  appointments: Appointment[],
  staff: Staff,
  period: StaffReportPeriod
): StaffReportRow[] {
  const base = appointments.filter(
    (app) => app.staffId === staff.id && isAppointmentPaid(app.status)
  );

  const filtered =
    period.mode === 'day' || period.startLabel === period.endLabel
      ? base.filter((app) => app.date === period.startLabel)
      : base.filter((app) => {
          const afterStart = compareSpanishShortDates(app.date, period.startLabel) >= 0;
          const beforeEnd = compareSpanishShortDates(app.date, period.endLabel) <= 0;
          return afterStart && beforeEnd;
        });

  return filtered
    .sort((a, b) => {
      const byDate = compareSpanishShortDates(a.date, b.date);
      if (byDate !== 0) return byDate;
      return a.time.localeCompare(b.time);
    })
    .map((app) => ({
      date: app.date,
      time: app.time,
      clientName: app.clientName,
      service: app.serviceName,
      cost: app.cost || 0,
      commission:
        app.cost > 0 ? app.cost * (staff.commissionPercent / 100) : 0,
    }));
}

function reportDensityClass(rowCount: number) {
  if (rowCount <= 18) return 'density-comfortable';
  if (rowCount <= 32) return 'density-compact';
  return 'density-dense';
}

export function openStaffWorkReportPrint(options: {
  staff: Staff;
  rows: StaffReportRow[];
  period: StaffReportPeriod;
}) {
  const { staff, rows, period } = options;
  const periodTitle = buildStaffReportPeriodTitle(period);
  const isSingleDay = period.mode === 'day' || period.startLabel === period.endLabel;
  const totalSales = rows.reduce((sum, row) => sum + row.cost, 0);
  const totalCommission = rows.reduce((sum, row) => sum + row.commission, 0);
  const generatedAt = formatSpanishShortDateInTimeZone(new Date());
  const generatedTime = new Date().toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const density = reportDensityClass(rows.length);

  const tableRows =
    rows.length === 0
      ? `<tr><td colspan="${isSingleDay ? 5 : 6}" class="empty">Sin trabajos terminados en el periodo seleccionado.</td></tr>`
      : rows
          .map((row) => {
            const dateCell = isSingleDay
              ? ''
              : `<td>${escapeHtml(row.date)}</td>`;
            const gross = row.cost > 0 ? formatMoney(row.cost) : 'Por definir';
            const commission =
              row.cost > 0 ? formatMoney(row.commission) : 'Por definir';

            return `<tr>
              ${dateCell}
              <td class="mono">${escapeHtml(row.time)}</td>
              <td>${escapeHtml(row.clientName)}</td>
              <td>${escapeHtml(row.service)}</td>
              <td class="num">${gross}</td>
              <td class="num commission">${commission}</td>
            </tr>`;
          })
          .join('');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Reporte ${escapeHtml(staff.name)} · ${escapeHtml(periodTitle)}</title>
  <style>
    @page { size: letter portrait; margin: 10mm 12mm; }
    * { box-sizing: border-box; }
    body {
      font-family: "Segoe UI", Arial, sans-serif;
      color: #1a1a1a;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet {
      width: 100%;
      max-width: 780px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      border-bottom: 2px solid #1a1a1a;
      padding-bottom: 10px;
      margin-bottom: 12px;
    }
    .brand {
      font-size: 11px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #666;
      margin-bottom: 4px;
    }
    h1 {
      font-size: 22px;
      margin: 0 0 4px;
      line-height: 1.1;
    }
    .meta {
      font-size: 11px;
      color: #444;
      line-height: 1.5;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-bottom: 12px;
    }
    .summary-card {
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 8px 10px;
      background: #fafafa;
    }
    .summary-card span {
      display: block;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #666;
      margin-bottom: 4px;
    }
    .summary-card strong {
      font-size: 14px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    thead {
      display: table-header-group;
    }
    th, td {
      border-bottom: 1px solid #e5e5e5;
      text-align: left;
      vertical-align: top;
      word-wrap: break-word;
    }
    th {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #555;
      background: #f3f3f3;
    }
    td.empty {
      text-align: center;
      color: #666;
      padding: 24px 8px;
    }
    td.num { text-align: right; white-space: nowrap; }
    td.mono { font-family: Consolas, monospace; }
    td.commission { color: #7a5c00; }
    tfoot td {
      font-weight: 700;
      border-top: 2px solid #1a1a1a;
      border-bottom: none;
      background: #f7f7f7;
    }
    .footer {
      margin-top: 10px;
      font-size: 9px;
      color: #666;
      display: flex;
      justify-content: space-between;
      gap: 12px;
    }
    .density-comfortable th, .density-comfortable td { font-size: 10px; padding: 5px 6px; }
    .density-compact th, .density-compact td { font-size: 9px; padding: 3px 5px; }
    .density-dense th, .density-dense td { font-size: 8px; padding: 2px 4px; line-height: 1.25; }
    .density-dense tbody tr { page-break-inside: avoid; }
    .col-date { width: 12%; }
    .col-time { width: 8%; }
    .col-client { width: 18%; }
    .col-service { width: 34%; }
    .col-money { width: 14%; }
  </style>
</head>
<body>
  <div class="sheet ${density}">
    <div class="header">
      <div>
        <div class="brand">aé Studio · Reporte de trabajos</div>
        <h1>${escapeHtml(staff.name)}</h1>
        <div class="meta">
          ${escapeHtml(staff.role)}<br />
          Especialidad: ${escapeHtml(staff.specialty || '—')}<br />
          Periodo: <strong>${escapeHtml(periodTitle)}</strong>
        </div>
      </div>
      <div class="meta" style="text-align:right;">
        Código: ${escapeHtml(staff.id)}<br />
        Comisión: ${staff.commissionPercent}%<br />
        Citas: ${rows.length}
      </div>
    </div>

    <div class="summary">
      <div class="summary-card">
        <span>Total bruto</span>
        <strong>${totalSales > 0 ? formatMoney(totalSales) : 'Por definir'}</strong>
      </div>
      <div class="summary-card">
        <span>Comisión (${staff.commissionPercent}%)</span>
        <strong>${totalCommission > 0 ? formatMoney(totalCommission) : 'Por definir'}</strong>
      </div>
      <div class="summary-card">
        <span>Servicios completados</span>
        <strong>${rows.length}</strong>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          ${isSingleDay ? '' : '<th class="col-date">Fecha</th>'}
          <th class="col-time">Hora</th>
          <th class="col-client">Cliente</th>
          <th class="col-service">Tratamiento / Servicio</th>
          <th class="col-money">Monto bruto</th>
          <th class="col-money">Comisión</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
      <tfoot>
        <tr>
          <td colspan="${isSingleDay ? 3 : 4}">Total del periodo</td>
          <td class="num">${totalSales > 0 ? formatMoney(totalSales) : 'Por definir'}</td>
          <td class="num commission">${totalCommission > 0 ? formatMoney(totalCommission) : 'Por definir'}</td>
        </tr>
      </tfoot>
    </table>

    <div class="footer">
      <span>Generado el ${escapeHtml(generatedAt)} a las ${escapeHtml(generatedTime)}</span>
      <span>Solo citas con estatus terminado</span>
    </div>
  </div>
</body>
</html>`;

  printHtmlDocument(html);
}

function printHtmlDocument(html: string) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);
  const printWindow = window.open(blobUrl, '_blank');

  if (printWindow) {
    const triggerPrint = () => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch (error) {
        console.error('No se pudo abrir el diálogo de impresión', error);
      }
    };

    printWindow.addEventListener('load', () => {
      triggerPrint();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
    });

    window.setTimeout(triggerPrint, 900);
    return;
  }

  URL.revokeObjectURL(blobUrl);
  printWithHiddenIframe(html);
}

function printWithHiddenIframe(html: string) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', 'Reporte de trabajos');
  iframe.style.cssText =
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDocument = frameWindow?.document;

  if (!frameWindow || !frameDocument) {
    iframe.remove();
    window.alert('No se pudo generar el reporte. Intenta de nuevo.');
    return;
  }

  frameDocument.open();
  frameDocument.write(html);
  frameDocument.close();

  window.setTimeout(() => {
    frameWindow.focus();
    frameWindow.print();
    window.setTimeout(() => iframe.remove(), 1000);
  }, 300);
}
