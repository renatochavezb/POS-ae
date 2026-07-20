"use client";



import { useEffect, useMemo, useState } from "react";

import { ChevronLeft, ChevronRight, TrendingUp } from "lucide-react";

import posApi from "@/libs/posApi";

import { Appointment, Staff } from "../types";

import { formatMXN } from "../data";

import { isAppointmentPaid } from "../appointmentStatus";

import {

  addDays,

  buildWeekDayEntries,

  formatWeekRangeLabel,

  getStudioWeekStart,

  isCurrentWeek,

} from "../scheduleUtils";



type WeeklySalesCardProps = {

  appointments: Appointment[];

  staffList: Staff[];

};



const DEFAULT_COMMISSION_PERCENT = 40;



export default function WeeklySalesCard({

  appointments,

  staffList,

}: WeeklySalesCardProps) {

  const [weekStart, setWeekStart] = useState<Date>(() => getStudioWeekStart(new Date()));

  const [showDetails, setShowDetails] = useState(false);

  const [weekTips, setWeekTips] = useState(0);



  const commissionByStaffId = useMemo(

    () =>

      new Map(

        staffList.map((member) => [member.id, member.commissionPercent ?? DEFAULT_COMMISSION_PERCENT])

      ),

    [staffList]

  );



  const staffNameById = useMemo(

    () => new Map(staffList.map((member) => [member.id, member.name])),

    [staffList]

  );



  const weekDays = useMemo(() => buildWeekDayEntries(weekStart), [weekStart]);

  const weekDateLabels = useMemo(

    () => new Set(weekDays.map((day) => day.dateLabel)),

    [weekDays]

  );



  useEffect(() => {

    let cancelled = false;



    const loadTips = async () => {

      try {

        const results = await Promise.all(

          weekDays.map((day) => posApi.getPayments({ date: day.dateLabel }))

        );

        if (cancelled) return;



        const tips = results

          .flatMap((result) => result.payments || [])

          .reduce((sum, payment) => sum + (payment.tip || 0), 0);

        setWeekTips(tips);

      } catch (error) {

        console.error(error);

        if (!cancelled) setWeekTips(0);

      }

    };



    void loadTips();



    return () => {

      cancelled = true;

    };

  }, [weekDays]);



  const weekPaidAppointments = useMemo(

    () =>

      appointments.filter(

        (appointment) =>

          isAppointmentPaid(appointment.status) && weekDateLabels.has(appointment.date)

      ),

    [appointments, weekDateLabels]

  );



  const appointmentCommission = (appointment: Appointment) => {

    const cost = appointment.cost || 0;

    if (cost <= 0) return 0;

    const percent = commissionByStaffId.get(appointment.staffId) ?? DEFAULT_COMMISSION_PERCENT;

    return cost * (percent / 100);

  };



  const byDay = useMemo(

    () =>

      weekDays.map((day) => {

        const dayAppointments = weekPaidAppointments.filter(

          (appointment) => appointment.date === day.dateLabel

        );

        const sales = dayAppointments.reduce((sum, appointment) => sum + (appointment.cost || 0), 0);

        const commission = dayAppointments.reduce(

          (sum, appointment) => sum + appointmentCommission(appointment),

          0

        );



        return {

          ...day,

          sales,

          commission,

        };

      }),

    [weekDays, weekPaidAppointments, commissionByStaffId]

  );



  const byStaff = useMemo(() => {

    const totals = new Map<string, { sales: number; commission: number }>();



    weekPaidAppointments.forEach((appointment) => {

      const current = totals.get(appointment.staffId) ?? { sales: 0, commission: 0 };

      const cost = appointment.cost || 0;

      totals.set(appointment.staffId, {

        sales: current.sales + cost,

        commission: current.commission + appointmentCommission(appointment),

      });

    });



    return [...totals.entries()]

      .map(([staffId, totalsForStaff]) => ({

        staffId,

        name:

          staffNameById.get(staffId) ||

          appointmentStaffName(weekPaidAppointments, staffId),

        sales: totalsForStaff.sales,

        commission: totalsForStaff.commission,

        commissionPercent: commissionByStaffId.get(staffId) ?? DEFAULT_COMMISSION_PERCENT,

      }))

      .sort((a, b) => b.sales - a.sales || a.name.localeCompare(b.name));

  }, [weekPaidAppointments, staffNameById, commissionByStaffId]);



  const weekTotalSales = weekPaidAppointments.reduce(

    (sum, appointment) => sum + (appointment.cost || 0),

    0

  );

  const weekTotalCommission = weekPaidAppointments.reduce(

    (sum, appointment) => sum + appointmentCommission(appointment),

    0

  );

  const weekSalonNet = weekTotalSales - weekTotalCommission - weekTips;



  const weekRangeLabel = formatWeekRangeLabel(weekStart);

  const viewingCurrentWeek = isCurrentWeek(weekStart);



  const previousWeekLabels = useMemo(() => {

    const prevStart = addDays(weekStart, -7);

    return new Set(buildWeekDayEntries(prevStart).map((day) => day.dateLabel));

  }, [weekStart]);



  const previousWeekSales = useMemo(

    () =>

      appointments

        .filter(

          (appointment) =>

            isAppointmentPaid(appointment.status) &&

            previousWeekLabels.has(appointment.date)

        )

        .reduce((sum, appointment) => sum + (appointment.cost || 0), 0),

    [appointments, previousWeekLabels]

  );



  const weekDeltaPercent =

    previousWeekSales > 0

      ? Math.round(((weekTotalSales - previousWeekSales) / previousWeekSales) * 100)

      : null;



  return (

    <div className="bg-surface-container-lowest p-6 rounded-2xl border border-primary/5 luxury-shadow h-full flex flex-col">

      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 flex-1">

        <div className="space-y-3 min-w-0 flex-1">

          <span className="text-[10px] text-outline font-bold tracking-widest uppercase block">

            Ventas Totales

          </span>



          <div className="flex items-center justify-between gap-2 max-w-md">

            <button

              type="button"

              onClick={() => setWeekStart((prev) => addDays(prev, -7))}

              className="p-1.5 rounded-lg border border-primary/10 text-outline hover:text-primary hover:bg-surface-container-low transition-colors shrink-0"

              title="Semana anterior"

            >

              <ChevronLeft className="w-4 h-4" />

            </button>

            <div className="min-w-0 text-center flex-1">

              <p className="text-[10px] text-secondary font-bold uppercase tracking-wider truncate">

                {viewingCurrentWeek ? "Semana en curso" : "Semana operativa"}

              </p>

              <p className="text-[11px] text-outline truncate">{weekRangeLabel}</p>

              <p className="text-[9px] text-outline/80 mt-0.5">Sábado a viernes</p>

            </div>

            <button

              type="button"

              onClick={() => setWeekStart((prev) => addDays(prev, 7))}

              className="p-1.5 rounded-lg border border-primary/10 text-outline hover:text-primary hover:bg-surface-container-low transition-colors shrink-0"

              title="Semana siguiente"

            >

              <ChevronRight className="w-4 h-4" />

            </button>

          </div>



          {!viewingCurrentWeek && (

            <button

              type="button"

              onClick={() => setWeekStart(getStudioWeekStart(new Date()))}

              className="text-[10px] font-sans font-bold uppercase tracking-wider text-secondary hover:text-primary transition-colors"

            >

              Volver a semana actual

            </button>

          )}



          <div className="flex flex-wrap items-start gap-x-8 gap-y-3">

            <div>

              <p className="text-[10px] text-outline font-bold uppercase tracking-wider mb-1">

                Ventas brutas

              </p>

              <div className="flex items-baseline gap-2">

                <span className="font-display text-4xl font-extrabold text-primary leading-none">

                  {formatMXN(weekTotalSales)}

                </span>

                {weekDeltaPercent !== null && (

                  <span

                    className={`text-xs font-bold font-sans ${

                      weekDeltaPercent >= 0 ? "text-emerald-700" : "text-red-700"

                    }`}

                  >

                    {weekDeltaPercent >= 0 ? "+" : ""}

                    {weekDeltaPercent}% vs sem. ant.

                  </span>

                )}

              </div>

            </div>

            <div>

              <p className="text-[10px] text-outline font-bold uppercase tracking-wider mb-1">

                Comisión estimada

              </p>

              <p className="font-display text-2xl font-extrabold text-secondary leading-none">

                {formatMXN(weekTotalCommission)}

              </p>

            </div>

            <div>

              <p className="text-[10px] text-outline font-bold uppercase tracking-wider mb-1">

                Neto para el salón

              </p>

              <p className="font-display text-4xl font-extrabold text-blue-600 leading-none">

                {formatMXN(weekSalonNet)}

              </p>

              {weekTips > 0 && (

                <p className="text-[9px] text-outline mt-1">

                  − propinas {formatMXN(weekTips)}

                </p>

              )}

            </div>

          </div>



          <p className="text-xs text-on-surface-variant">

            Citas terminadas · ventas − comisión − propinas.

          </p>



          <button

            type="button"

            onClick={() => setShowDetails((prev) => !prev)}

            className="text-[10px] font-sans font-bold uppercase tracking-wider text-secondary hover:text-primary transition-colors"

          >

            {showDetails ? "Ocultar detalle" : "Ver por día y manicurista"}

          </button>

        </div>



        <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary shrink-0">

          <TrendingUp className="w-6 h-6" />

        </div>

      </div>



      {showDetails && (

        <div className="mt-5 pt-5 border-t border-primary/5 space-y-5 w-full">

          <div className="w-full">

            <p className="text-[10px] text-outline font-bold uppercase tracking-wider mb-2">

              Por día

            </p>

            <div className="grid grid-cols-7 gap-2 w-full">

              {byDay.map((day) => (

                <div

                  key={day.dateLabel}

                  className="rounded-lg border border-primary/10 bg-surface-container-low/40 px-2 py-3 text-center min-w-0"

                >

                  <p className="text-[9px] text-outline font-bold uppercase">{day.dayLabel}</p>

                  <p className="text-sm font-mono font-bold text-primary mt-1.5 leading-tight">

                    {formatMXN(day.sales)}

                  </p>

                  <p className="text-[10px] text-secondary font-bold mt-1 leading-tight">

                    {formatMXN(day.commission)}

                  </p>

                </div>

              ))}

            </div>

          </div>



          <div className="w-full">

            <p className="text-[10px] text-outline font-bold uppercase tracking-wider mb-2">

              Por manicurista

            </p>

            {byStaff.length === 0 ? (

              <p className="text-xs text-outline">Sin ventas registradas en esta semana.</p>

            ) : (

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 w-full">

                {byStaff.map((member) => (

                  <div

                    key={member.staffId}

                    className="flex items-center justify-between gap-3 text-xs px-3 py-2.5 rounded-lg bg-surface-container-low/30"

                  >

                    <div className="min-w-0">

                      <p className="font-sans font-bold text-primary truncate">{member.name}</p>

                      <p className="text-[10px] text-outline">

                        Comisión {member.commissionPercent}%

                      </p>

                    </div>

                    <div className="text-right shrink-0">

                      <p className="font-mono font-bold text-primary">{formatMXN(member.sales)}</p>

                      <p className="text-[10px] font-mono font-bold text-secondary">

                        {formatMXN(member.commission)}

                      </p>

                    </div>

                  </div>

                ))}

              </div>

            )}

          </div>



          <div className="pt-2 border-t border-primary/5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs w-full">

            <div className="flex items-center justify-between sm:justify-start sm:gap-4 rounded-lg bg-surface-container-low/30 px-3 py-2">

              <span className="text-outline font-bold uppercase tracking-wider">Total ventas</span>

              <span className="font-display font-extrabold text-primary">

                {formatMXN(weekTotalSales)}

              </span>

            </div>

            <div className="flex items-center justify-between sm:justify-start sm:gap-4 rounded-lg bg-surface-container-low/30 px-3 py-2">

              <span className="text-outline font-bold uppercase tracking-wider">

                Total comisión

              </span>

              <span className="font-display font-extrabold text-secondary">

                {formatMXN(weekTotalCommission)}

              </span>

            </div>

            <div className="flex items-center justify-between sm:justify-start sm:gap-4 rounded-lg bg-surface-container-low/30 px-3 py-2">

              <span className="text-outline font-bold uppercase tracking-wider">Propinas</span>

              <span className="font-display font-extrabold text-outline">

                {formatMXN(weekTips)}

              </span>

            </div>

            <div className="flex items-center justify-between sm:justify-start sm:gap-4 rounded-lg bg-surface-container-low/30 px-3 py-2">

              <span className="text-outline font-bold uppercase tracking-wider">

                Neto salón

              </span>

              <span className="font-display font-extrabold text-primary">

                {formatMXN(weekSalonNet)}

              </span>

            </div>

          </div>

        </div>

      )}

    </div>

  );

}



function appointmentStaffName(appointments: Appointment[], staffId: string) {

  return (

    appointments.find((appointment) => appointment.staffId === staffId)?.staffName || staffId

  );

}

