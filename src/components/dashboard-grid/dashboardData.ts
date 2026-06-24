import type { FormState, LoadSeries, WeeklyVolume } from "@/domain/training/trainingLoad";

export interface DashboardPlannedWorkout {
  id: string;
  userId: string;
  date: string;
  sport: string;
  title: string;
  plannedDurationMin: number;
  plannedDistanceM: number | null;
  rpe: number | null;
  description: string | null;
  segmentsJson: unknown;
  status: string;
  source: string;
  planImportId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardActualActivity {
  id: string;
  userId: string;
  externalId: string | null;
  source: string;
  date: string;
  sport: string;
  durationMin: number | null;
  distanceKm: number | null;
  distanceM: number | null;
  load: number | null;
  rpe: number | null;
  avgHr: number | null;
  avgPower: number | null;
  notes: string | null;
  rawJson: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardReadinessSnapshot {
  id: string;
  userId: string;
  date: string;
  status: string | null;
  sleepTrend: string | null;
  hrvTrend: string | null;
  restingHrTrend: string | null;
  subjectiveFatigue: number | null;
  notes: string | null;
  createdAt: string;
}

export interface DashboardBodyMetric {
  id: string;
  userId: string;
  date: string;
  weightKg: number | null;
  restingHr: number | null;
  hrv: number | null;
  notes: string | null;
  createdAt: string;
}

export interface DashboardTrainingGoal {
  id: string;
  userId: string;
  sport: string;
  weeklyTargetMin: number;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardData {
  today: {
    dateIso: string;
    planned: DashboardPlannedWorkout | null;
    actual: DashboardActualActivity | null;
  };
  training: {
    recentActivities: DashboardActualActivity[];
    loadSeries: LoadSeries;
    form: { state: FormState; label: string };
    weeklyVolume: WeeklyVolume[];
  };
  readiness: {
    latest: DashboardReadinessSnapshot | null;
    history: DashboardReadinessSnapshot[];
  };
  body: {
    latestMetric: DashboardBodyMetric | null;
  };
  goals: {
    active: DashboardTrainingGoal[];
  };
}
