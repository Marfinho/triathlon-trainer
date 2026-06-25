/**
 * Withings REST-API-Client.
 *
 * Authentifizierung via OAuth2 Bearer Token (Access Token aus UserIntegration).
 * Basiert auf https://developer.withings.com/docs/
 */

export interface WithingsMeasurement {
  date: number; // Unix timestamp
  measures: Array<{
    value: number;
    type: number; // 1=weight(kg), 5=height(m), 6=fat_free_mass(kg), 8=fat_ratio(%), 9=fat_mass(kg), 11=heart_pulse(bpm), 12=temperature, 54=spo2(%), 71=body_temperature, 73=skin_temperature, 76=muscle_mass, 77=hydration, 88=hrv(ms)
    unit: number;
  }>;
}

export interface WithingsMeasurementResponse {
  status: number; // 0 = success
  body: {
    measuregrps: WithingsMeasurement[];
  };
}

export interface WithingsSleepSession {
  id: number;
  startdate: number; // Unix timestamp
  enddate: number;
  date: string; // YYYY-MM-DD
  data: {
    sleep_duration: number; // seconds
    wakeup_time: number; // seconds since sleep start
    deepsleepduration: number; // seconds
    remsleepduration?: number;
    lightsleepduration?: number;
    remsleepduration_confirmed?: number;
  };
}

export interface WithingsSleepResponse {
  status: number;
  body: {
    series: WithingsSleepSession[];
  };
}

export interface WithingsActivity {
  date: string; // YYYY-MM-DD
  starttime: number; // Unix timestamp
  endtime: number;
  duration: number; // seconds
  distance: number; // meters
  steps: number;
  calories: number;
  elevation: number; // meters
  hr_avg?: number;
  hr_min?: number;
  hr_max?: number;
  swim_lap_count?: number;
  pool_length?: number;
  activity_name?: string;
}

export interface WithingsActivityResponse {
  status: number;
  body: {
    activities: WithingsActivity[];
    more: boolean;
    offset: number;
  };
}

export interface WithingsClientConfig {
  accessToken: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export interface WithingsClient {
  getMeasurements(startDate: Date, endDate: Date): Promise<WithingsMeasurement[]>;
  getSleep(startDate: Date, endDate: Date): Promise<WithingsSleepSession[]>;
  getActivities(startDate: Date, endDate: Date): Promise<WithingsActivity[]>;
}

export class HttpWithingsClient implements WithingsClient {
  private readonly baseUrl: string;
  private readonly authHeader: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: WithingsClientConfig) {
    this.baseUrl = config.baseUrl ?? "https://wbsapi.withings.net";
    this.authHeader = `Bearer ${config.accessToken}`;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  private async request<T>(path: string, params: Record<string, string | number>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, String(value));
    });

    const res = await this.fetchImpl(url.toString(), {
      method: "GET",
      headers: {
        Authorization: this.authHeader,
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Withings API ${path} failed: ${res.status} ${text}`);
    }

    return (await res.json()) as T;
  }

  private unixTimestamp(date: Date): number {
    return Math.floor(date.getTime() / 1000);
  }

  async getMeasurements(startDate: Date, endDate: Date): Promise<WithingsMeasurement[]> {
    const response = await this.request<WithingsMeasurementResponse>("/measure/getmeas", {
      startdate: this.unixTimestamp(startDate),
      enddate: this.unixTimestamp(endDate),
      meastype: "1,11,88", // weight, heart_pulse, hrv
    });

    if (response.status !== 0) {
      throw new Error(`Withings getMeasurements failed with status ${response.status}`);
    }

    return response.body.measuregrps || [];
  }

  async getSleep(startDate: Date, endDate: Date): Promise<WithingsSleepSession[]> {
    const response = await this.request<WithingsSleepResponse>("/v2/sleep/get", {
      startdate: this.unixTimestamp(startDate),
      enddate: this.unixTimestamp(endDate),
    });

    if (response.status !== 0) {
      throw new Error(`Withings getSleep failed with status ${response.status}`);
    }

    return response.body.series || [];
  }

  async getActivities(startDate: Date, endDate: Date): Promise<WithingsActivity[]> {
    const allActivities: WithingsActivity[] = [];
    let offset = 0;
    const limit = 100;

    let hasMore = true;
    while (hasMore) {
      const response = await this.request<WithingsActivityResponse>("/v2/user/getactivity", {
        startdateymd: startDate.toISOString().split("T")[0],
        enddateymd: endDate.toISOString().split("T")[0],
        offset,
        limit,
      });

      if (response.status !== 0) {
        throw new Error(`Withings getActivities failed with status ${response.status}`);
      }

      allActivities.push(...(response.body.activities || []));
      hasMore = response.body.more ?? false;
      offset += limit;
    }

    return allActivities;
  }
}
