/**
 * TCX-Export (rein/testbar) für aufgezeichnete Aktivitäten (1-Hz-Samples),
 * z.B. von der Radrolle. Garmin TrainingCenterDatabase v2 – wird von
 * Strava, Intervals.icu, Garmin Connect & Co. importiert.
 */

export interface TcxSample {
  tSec: number;
  powerW?: number | null;
  cadenceRpm?: number | null;
  hrBpm?: number | null;
  speedKmh?: number | null;
}

export interface TcxActivityInput {
  sport: string;
  startTime: Date;
  samples: TcxSample[];
}

const SPORT_TO_TCX: Record<string, "Biking" | "Running" | "Other"> = {
  bike: "Biking",
  brick: "Biking",
  run: "Running",
};

function trackpoint(time: string, distanceM: number, s: TcxSample): string {
  const cadence =
    typeof s.cadenceRpm === "number" && s.cadenceRpm > 0
      ? `<Cadence>${Math.round(s.cadenceRpm)}</Cadence>`
      : "";
  const hr =
    typeof s.hrBpm === "number" && s.hrBpm > 0
      ? `<HeartRateBpm><Value>${Math.round(s.hrBpm)}</Value></HeartRateBpm>`
      : "";
  const extensions =
    typeof s.powerW === "number" && s.powerW >= 0
      ? `<Extensions><TPX xmlns="http://www.garmin.com/xmlschemas/ActivityExtension/v2"><Watts>${Math.round(s.powerW)}</Watts></TPX></Extensions>`
      : "";
  return `<Trackpoint><Time>${time}</Time><DistanceMeters>${distanceM.toFixed(1)}</DistanceMeters>${hr}${cadence}${extensions}</Trackpoint>`;
}

/** Baut ein TCX-Dokument aus 1-Hz-Samples (jedes Sample = 1 Sekunde). */
export function buildTcx(input: TcxActivityInput): string {
  const tcxSport = SPORT_TO_TCX[input.sport] ?? "Other";
  const startIso = input.startTime.toISOString();

  let distanceM = 0;
  const points = input.samples
    .map((s) => {
      const speedMs = ((s.speedKmh ?? 0) * 1000) / 3600;
      distanceM += speedMs; // 1 Sample ≈ 1 Sekunde
      const time = new Date(input.startTime.getTime() + s.tSec * 1000).toISOString();
      return trackpoint(time, distanceM, s);
    })
    .join("");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">',
    "<Activities>",
    `<Activity Sport="${tcxSport}">`,
    `<Id>${startIso}</Id>`,
    `<Lap StartTime="${startIso}">`,
    `<TotalTimeSeconds>${input.samples.length}</TotalTimeSeconds>`,
    `<DistanceMeters>${distanceM.toFixed(1)}</DistanceMeters>`,
    "<Intensity>Active</Intensity>",
    "<TriggerMethod>Manual</TriggerMethod>",
    `<Track>${points}</Track>`,
    "</Lap>",
    "</Activity>",
    "</Activities>",
    "</TrainingCenterDatabase>",
  ].join("");
}
