import type { ComponentType } from "react";
import type { WidgetSize } from "./types";
import { TodayWorkout } from "./widgets/TodayWorkout";
import { FormGauge } from "./widgets/FormGauge";
import { ReadinessCheckin } from "./widgets/ReadinessCheckin";

export const WIDGET_COMPONENTS: Record<string, ComponentType<{ size: WidgetSize }>> = {
  TodayWorkout,
  FormGauge,
  ReadinessCheckin,
};
