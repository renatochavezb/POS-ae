"use client";

import { useEffect, useMemo, useState } from "react";
import posApi from "@/libs/posApi";
import { WeeklyStats } from "./types";
import {
  formatSpanishShortDate,
  formatWeekRangeLabel,
  isCurrentWeek,
} from "./scheduleUtils";

export function useWeeklySnapshot(weekStart: Date) {
  const [snapshot, setSnapshot] = useState<WeeklyStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const weekStartLabel = useMemo(
    () => formatSpanishShortDate(weekStart),
    [weekStart]
  );

  useEffect(() => {
    let cancelled = false;

    const loadSnapshot = async () => {
      setIsLoading(true);
      try {
        const result = await posApi.getWeeklyStats({ weekStart: weekStartLabel });
        if (!cancelled) {
          setSnapshot(result.snapshot);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setSnapshot(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadSnapshot();

    return () => {
      cancelled = true;
    };
  }, [weekStartLabel]);

  return {
    snapshot,
    isLoading,
    weekStartLabel,
    weekRangeLabel: snapshot?.weekRangeLabel || formatWeekRangeLabel(weekStart),
    viewingCurrentWeek: isCurrentWeek(weekStart),
  };
}
