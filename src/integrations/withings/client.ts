/**
 * Withings Measure API – Abruf von Körperdaten (Gewicht, Ruhepuls).
 *
 * Withings ist der einzige direkt angebundene Provider mit eigenem Mehrwert
 * gegenüber Intervals.icu: Körpermetriken. Aktivitäten kommen weiterhin über
 * Intervals.icu.
 *
 * Antwortformat der Measure API ist in `{ status, body }` gewrappt (status 0 = ok).
 * Jeder Messwert kommt als `value * 10^unit` (z.B. value 70500, unit -3 = 70,5 kg).
 */
export interface WithingsMeasure {
  value: number;
  type: number;
  unit: number;
}

export interface WithingsMeasureGroup {
  grpid: number;
  date: number; // Unix-Sekunden
  category?: number;
  measures: WithingsMeasure[];
}

export interface WithingsClient {
  /** Liefert Mess-Gruppen ab `startUnix` (Unix-Sekunden). */
  listBodyMeasurements(startUnix?: number): Promise<WithingsMeasureGroup[]>;
}

/** Withings-Messtypen, die wir auswerten. */
export const WITHINGS_WEIGHT_TYPE = 1;
export const WITHINGS_HEART_PULSE_TYPE = 11;

const MEASURE_URL = "https://wbsapi.withings.net/measure";

export class HttpWithingsClient implements WithingsClient {
  constructor(private readonly accessToken: string) {}

  async listBodyMeasurements(startUnix?: number): Promise<WithingsMeasureGroup[]> {
    const params = new URLSearchParams({
      action: "getmeas",
      meastypes: `${WITHINGS_WEIGHT_TYPE},${WITHINGS_HEART_PULSE_TYPE}`,
      category: "1", // nur echte Messungen, keine Ziele
    });
    if (startUnix != null) params.set("startdate", String(Math.floor(startUnix)));

    const res = await fetch(MEASURE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
    if (!res.ok) {
      throw new Error(`Withings-Measure-Abruf fehlgeschlagen (${res.status}).`);
    }
    const data = await res.json();
    if (data.status !== 0) {
      throw new Error(`Withings-Measure-Abruf fehlgeschlagen (status ${data.status}).`);
    }
    const grps = data.body?.measuregrps;
    return Array.isArray(grps) ? (grps as WithingsMeasureGroup[]) : [];
  }
}
