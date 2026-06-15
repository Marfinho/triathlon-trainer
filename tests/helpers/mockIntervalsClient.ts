import type {
  IntervalsClient,
  IntervalsEvent,
  IntervalsEventInput,
  IntervalsActivity,
} from "@/integrations/intervals/client";

/** In-Memory-Mock des Intervals.icu-Clients für Tests. */
export class MockIntervalsClient implements IntervalsClient {
  events = new Map<string, IntervalsEventInput>();
  calls = { create: 0, update: 0, delete: 0, find: 0 };
  /** Vorab gesetztes Event, das `findEvent` zurückgibt (Duplikat-Simulation). */
  preset: IntervalsEvent | null = null;
  private nextId = 1;

  async createEvent(input: IntervalsEventInput): Promise<IntervalsEvent> {
    this.calls.create++;
    const id = `evt-${this.nextId++}`;
    this.events.set(id, input);
    return { id, name: input.name, start_date_local: `${input.date}T00:00:00` };
  }

  async updateEvent(
    id: string,
    input: IntervalsEventInput,
  ): Promise<IntervalsEvent> {
    this.calls.update++;
    this.events.set(id, input);
    return { id, name: input.name };
  }

  async deleteEvent(id: string): Promise<void> {
    this.calls.delete++;
    this.events.delete(id);
  }

  async findEvent(): Promise<IntervalsEvent | null> {
    this.calls.find++;
    return this.preset;
  }

  async listEvents(): Promise<IntervalsEvent[]> {
    return [];
  }

  async listActivities(): Promise<IntervalsActivity[]> {
    return [];
  }
}
