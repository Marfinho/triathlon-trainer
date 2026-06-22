/**
 * Intervals.icu REST-Client.
 *
 * Authentifizierung via HTTP Basic Auth: Benutzername `API_KEY`, Passwort = der
 * persönliche API-Key (siehe https://intervals.icu/settings).
 *
 * Der Client ist hinter dem Interface `IntervalsClient` gekapselt, damit Sync
 * und Queue mit einer Mock-Implementierung getestet werden können.
 */

export interface IntervalsEventInput {
  /** Lokales Datum YYYY-MM-DD. */
  date: string;
  /** Intervals.icu Aktivitätstyp, z.B. "Run" | "Ride" | "Swim". */
  type: string;
  name: string;
  description?: string | null;
  durationMin?: number | null;
  distanceM?: number | null;
  /** Externe Referenz zur Wiedererkennung (Idempotenz). */
  externalId?: string | null;
}

export interface IntervalsEvent {
  id: string;
  start_date_local?: string;
  name?: string;
  type?: string;
  external_id?: string | null;
}

export interface IntervalsActivity {
  id: string;
  start_date_local?: string;
  type?: string;
  name?: string;
  moving_time?: number;
  distance?: number;
  icu_training_load?: number;
  average_heartrate?: number;
  average_watts?: number;
}

export interface IntervalsClient {
  createEvent(input: IntervalsEventInput): Promise<IntervalsEvent>;
  updateEvent(id: string, input: IntervalsEventInput): Promise<IntervalsEvent>;
  deleteEvent(id: string): Promise<void>;
  /** Sucht ein bereits vorhandenes Event (zur Duplikat-Vermeidung). */
  findEvent(input: IntervalsEventInput): Promise<IntervalsEvent | null>;
  listEvents(oldest: string, newest: string): Promise<IntervalsEvent[]>;
  listActivities(oldest: string, newest: string): Promise<IntervalsActivity[]>;
}

/** Mapping LocalHub-Sport -> Intervals.icu-Typ. */
export const SPORT_TO_INTERVALS_TYPE: Record<string, string> = {
  run: "Run",
  bike: "Ride",
  swim: "Swim",
  strength: "Weight Training",
  brick: "Ride",
  mobility: "Yoga",
  walk: "Walk",
  cross_training: "Workout",
  other: "Workout",
};

export interface IntervalsClientConfig {
  athleteId: string;
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export class HttpIntervalsClient implements IntervalsClient {
  private readonly athleteId: string;
  private readonly baseUrl: string;
  private readonly authHeader: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: IntervalsClientConfig) {
    this.athleteId = encodeURIComponent(config.athleteId);
    this.baseUrl = config.baseUrl ?? "https://intervals.icu/api/v1";
    this.authHeader =
      "Basic " +
      Buffer.from(`API_KEY:${config.apiKey}`).toString("base64");
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Intervals.icu ${method} ${path} fehlgeschlagen: ${res.status} ${text}`,
      );
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  private toEventBody(input: IntervalsEventInput) {
    return {
      start_date_local: `${input.date}T00:00:00`,
      category: "WORKOUT",
      type: input.type,
      name: input.name,
      description: input.description ?? undefined,
      moving_time:
        typeof input.durationMin === "number"
          ? input.durationMin * 60
          : undefined,
      distance: input.distanceM ?? undefined,
      external_id: input.externalId ?? undefined,
    };
  }

  async createEvent(input: IntervalsEventInput): Promise<IntervalsEvent> {
    return this.request<IntervalsEvent>(
      "POST",
      `/athlete/${this.athleteId}/events`,
      this.toEventBody(input),
    );
  }

  async updateEvent(
    id: string,
    input: IntervalsEventInput,
  ): Promise<IntervalsEvent> {
    return this.request<IntervalsEvent>(
      "PUT",
      `/athlete/${this.athleteId}/events/${id}`,
      this.toEventBody(input),
    );
  }

  async deleteEvent(id: string): Promise<void> {
    await this.request<void>(
      "DELETE",
      `/athlete/${this.athleteId}/events/${id}`,
    );
  }

  async listEvents(oldest: string, newest: string): Promise<IntervalsEvent[]> {
    return this.request<IntervalsEvent[]>(
      "GET",
      `/athlete/${this.athleteId}/events?oldest=${oldest}&newest=${newest}&category=WORKOUT`,
    );
  }

  async listActivities(
    oldest: string,
    newest: string,
  ): Promise<IntervalsActivity[]> {
    return this.request<IntervalsActivity[]>(
      "GET",
      `/athlete/${this.athleteId}/activities?oldest=${oldest}&newest=${newest}`,
    );
  }

  async findEvent(input: IntervalsEventInput): Promise<IntervalsEvent | null> {
    const events = await this.listEvents(input.date, input.date);
    // Priorität: externalId-Treffer, sonst Datum + Name.
    const byExternal = input.externalId
      ? events.find((e) => e.external_id === input.externalId)
      : undefined;
    if (byExternal) return byExternal;
    const byNatural = events.find(
      (e) =>
        (e.start_date_local ?? "").slice(0, 10) === input.date &&
        e.name === input.name,
    );
    return byNatural ?? null;
  }
}

/** Erstellt einen Client aus Umgebungsvariablen (oder null, wenn nicht gesetzt). */
export function createIntervalsClientFromEnv(): HttpIntervalsClient | null {
  const athleteId = process.env.INTERVALS_ATHLETE_ID;
  const apiKey = process.env.INTERVALS_API_KEY;
  if (!athleteId || !apiKey) return null;
  return new HttpIntervalsClient({
    athleteId,
    apiKey,
    baseUrl: process.env.INTERVALS_API_BASE_URL,
  });
}
