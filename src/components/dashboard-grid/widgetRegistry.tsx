import type { ComponentType } from "react";
import type { WidgetSize } from "./types";
import { TodayWorkout } from "./widgets/TodayWorkout";
import { FormGauge } from "./widgets/FormGauge";
import { ReadinessCheckin } from "./widgets/ReadinessCheckin";
import { WeekCalendar } from "./widgets/WeekCalendar";
import { Compliance } from "./widgets/Compliance";
import { VolumeByDiscipline } from "./widgets/VolumeByDiscipline";
import { NextRace } from "./widgets/NextRace";
import { TaperForecast } from "./widgets/TaperForecast";
import { RacePrediction } from "./widgets/RacePrediction";
import { RaceWeather } from "./widgets/RaceWeather";

export const WIDGET_COMPONENTS: Record<string, ComponentType<{ size: WidgetSize }>> = {
  TodayWorkout,
  FormGauge,
  ReadinessCheckin,
  WeekCalendar,
  Compliance,
  VolumeByDiscipline,
  NextRace,
  TaperForecast,
  RacePrediction,
  RaceWeather,
};
