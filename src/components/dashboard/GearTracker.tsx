"use client";

import { useState } from "react";
import { Card, sportLabel } from "./Card";
import type { WearStatus } from "@/domain/training/gear";

export interface Gear {
  id: string;
  name: string;
  type: string;
  sport: string | null;
  parentId: string | null;
  brand: string | null;
  model: string | null;
  purchaseDate: string | null;
  retired: boolean;
  autoTrack: boolean;
  manualKm: number;
  manualHours: number;
  alertKm: number | null;
  alertHours: number | null;
  notes: string | null;
  usage: {
    km: number;
    hours: number;
    kmPct: number | null;
    hoursPct: number | null;
    status: WearStatus;
  };
  components: Gear[];
}

const TYPE_LABEL: Record<string, string> = {
  shoe: "Schuh",
  bike: "Rad",
  component: "Komponente",
  wetsuit: "Neopren",
  other: "Sonstiges",
};

const STATUS: Record<WearStatus, { label: string; color: string; bg: string }> = {
  ok: { label: "OK", color: "#34c759", bg: "bg-emerald-50 text-emerald-700" },
  due: { label: "Wartung bald", color: "#ff9f0a", bg: "bg-amber-50 text-amber-700" },
  over: { label: "Austausch fällig", color: "#ff3b30", bg: "bg-rose-50 text-rose-700" },
};

const DEFAULT_SPORT: Record<string, string> = {
  shoe: "run",
  bike: "bike",
  component: "bike",
  wetsuit: "swim",
};

const emptyForm = {
  name: "",
  type: "shoe",
  sport: "run",
  brand: "",
  purchaseDate: "",
  alertKm: "",
};

export function GearTracker({ initialGear }: { initialGear: Gear[] }) {
  const [gear, setGear] = useState<Gear[]>(initialGear);
  const [addingRoot, setAddingRoot] = useState(false);
  const [addingChildFor, setAddingChildFor] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  async function reload() {
    const res = await fetch("/api/gear");
    if (res.ok) setGear((await res.json()).gear);
  }

  async function createGear(parentId: string | null, type: string) {
    if (!form.name.trim()) return;
    await fetch("/api/gear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        type,
        sport: form.sport || DEFAULT_SPORT[type] || null,
        parentId,
        brand: form.brand || undefined,
        purchaseDate: form.purchaseDate || undefined,
        alertKm: form.alertKm ? Number(form.alertKm) : undefined,
      }),
    });
    setForm({ ...emptyForm });
    setAddingRoot(false);
    setAddingChildFor(null);
    await reload();
  }

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch(`/api/gear/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await reload();
  }

  async function remove(id: string) {
    await fetch(`/api/gear/${id}`, { method: "DELETE" });
    await reload();
  }

  async function addKm(id: string) {
    const v = window.prompt("Wie viele km hinzufügen?");
    const km = v ? Number(v) : NaN;
    if (!Number.isNaN(km) && km !== 0) await patch(id, { addKm: km });
  }

  async function setLimit(id: string, currentLimit: number | null) {
    const v = window.prompt(
      "Verschleißgrenze in km (leer = keine):",
      currentLimit ? String(currentLimit) : "",
    );
    if (v === null) return;
    await patch(id, { alertKm: v.trim() === "" ? null : Number(v) });
  }

  const active = gear.filter((g) => !g.retired);
  const retired = gear.filter((g) => g.retired);

  // Wartungsstatus über alle Geräte (inkl. Komponenten) zusammenfassen.
  const flat: Gear[] = [];
  const walk = (list: Gear[]) =>
    list.forEach((g) => {
      flat.push(g);
      walk(g.components);
    });
  walk(active);
  const due = flat.filter((g) => g.usage.status === "due").length;
  const over = flat.filter((g) => g.usage.status === "over").length;

  return (
    <Card
      title="Sportgeräte"
      subtitle="Schuhe, Räder & Komponenten – Verschleiß automatisch aus Aktivitäten"
      actions={
        <button
          onClick={() => {
            setAddingRoot((o) => !o);
            setForm({ ...emptyForm });
          }}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
        >
          {addingRoot ? "Schließen" : "Gerät hinzufügen"}
        </button>
      }
    >
      {over + due > 0 ? (
        <div
          className={`mb-4 rounded-xl px-3 py-2 text-xs font-medium ${
            over > 0 ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"
          }`}
        >
          {over > 0 ? `${over} Gerät(e) Austausch fällig` : null}
          {over > 0 && due > 0 ? " · " : null}
          {due > 0 ? `${due} Gerät(e) bald zu warten` : null}
        </div>
      ) : null}

      {addingRoot ? (
        <GearForm
          form={form}
          setForm={setForm}
          allowType
          onSubmit={() => createGear(null, form.type)}
        />
      ) : null}

      {active.length === 0 && !addingRoot ? (
        <p className="text-sm text-neutral-400">
          Noch keine Geräte erfasst. Lege z.B. deine Laufschuhe oder dein Rad an.
        </p>
      ) : null}

      <div className="space-y-3">
        {active.map((g) => (
          <GearRow
            key={g.id}
            gear={g}
            onAddKm={addKm}
            onSetLimit={setLimit}
            onRetire={(id) => patch(id, { retired: true })}
            onReset={(id) => patch(id, { resetUsage: true })}
            onDelete={remove}
            onAddComponent={
              g.type === "bike"
                ? () => {
                    setAddingChildFor(g.id);
                    setForm({ ...emptyForm, type: "component", sport: "bike" });
                  }
                : undefined
            }
          />
        ))}
      </div>

      {addingChildFor ? (
        <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
          <p className="mb-2 text-xs font-medium text-neutral-600">
            Komponente hinzufügen (z.B. Kette, Reifen, Kassette)
          </p>
          <GearForm
            form={form}
            setForm={setForm}
            onSubmit={() => createGear(addingChildFor, "component")}
            onCancel={() => setAddingChildFor(null)}
          />
        </div>
      ) : null}

      {retired.length > 0 ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs text-neutral-400">
            Ausgemusterte Geräte ({retired.length})
          </summary>
          <div className="mt-2 space-y-2">
            {retired.map((g) => (
              <div
                key={g.id}
                className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-500"
              >
                <span>
                  {g.name} · {Math.round(g.usage.km)} km
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => patch(g.id, { retired: false })}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Reaktivieren
                  </button>
                  <button
                    onClick={() => remove(g.id)}
                    className="text-xs text-neutral-300 hover:text-rose-500"
                  >
                    Löschen
                  </button>
                </div>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </Card>
  );
}

function GearRow({
  gear,
  onAddKm,
  onSetLimit,
  onRetire,
  onReset,
  onDelete,
  onAddComponent,
}: {
  gear: Gear;
  onAddKm: (id: string) => void;
  onSetLimit: (id: string, current: number | null) => void;
  onRetire: (id: string) => void;
  onReset: (id: string) => void;
  onDelete: (id: string) => void;
  onAddComponent?: () => void;
}) {
  const isComponent = gear.type === "component";
  return (
    <div
      className={`rounded-xl border border-neutral-200 ${
        isComponent ? "bg-neutral-50/60" : "bg-white"
      } p-3`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-900">
              {gear.name}
            </span>
            <span className="shrink-0 rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">
              {TYPE_LABEL[gear.type] ?? gear.type}
            </span>
            <span
              className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${STATUS[gear.usage.status].bg}`}
            >
              {STATUS[gear.usage.status].label}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-neutral-500">
            {[
              gear.brand,
              gear.sport ? sportLabel(gear.sport) : null,
              gear.purchaseDate ? `seit ${gear.purchaseDate.slice(0, 10)}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 gap-2 text-xs">
          <button onClick={() => onAddKm(gear.id)} className="text-neutral-500 hover:text-blue-600">
            + km
          </button>
          <button
            onClick={() => onSetLimit(gear.id, gear.alertKm)}
            className="text-neutral-500 hover:text-blue-600"
          >
            Grenze
          </button>
          {isComponent ? (
            <button onClick={() => onReset(gear.id)} className="text-neutral-500 hover:text-blue-600">
              gewechselt
            </button>
          ) : null}
          <button onClick={() => onRetire(gear.id)} className="text-neutral-500 hover:text-amber-600">
            ausmustern
          </button>
          <button
            onClick={() => onDelete(gear.id)}
            className="text-neutral-300 hover:text-rose-500"
            aria-label="Löschen"
          >
            ✕
          </button>
        </div>
      </div>

      <UsageBar gear={gear} />

      {onAddComponent ? (
        <button
          onClick={onAddComponent}
          className="mt-2 text-xs text-blue-600 hover:underline"
        >
          + Komponente
        </button>
      ) : null}

      {gear.components.length > 0 ? (
        <div className="mt-3 space-y-2 border-l-2 border-neutral-100 pl-3">
          {gear.components.map((c) => (
            <GearRow
              key={c.id}
              gear={c}
              onAddKm={onAddKm}
              onSetLimit={onSetLimit}
              onRetire={onRetire}
              onReset={onReset}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function UsageBar({ gear }: { gear: Gear }) {
  const pct = gear.usage.kmPct;
  const color = STATUS[gear.usage.status].color;
  return (
    <div className="mt-2">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium text-neutral-800">
          {Math.round(gear.usage.km)} km
          {gear.usage.hours ? ` · ${Math.round(gear.usage.hours)} h` : ""}
        </span>
        {gear.alertKm ? (
          <span className="text-neutral-400">
            {gear.usage.km < gear.alertKm
              ? `noch ${Math.round(gear.alertKm - gear.usage.km)} km`
              : `${Math.round(gear.usage.km - gear.alertKm)} km über Grenze`}
          </span>
        ) : null}
      </div>
      {pct != null ? (
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.min(100, pct * 100)}%`, backgroundColor: color }}
          />
        </div>
      ) : null}
      {gear.alertHours ? (
        <div className="mt-1.5">
          <div className="flex justify-between text-[11px] text-neutral-400">
            <span>{Math.round(gear.usage.hours)} h</span>
            <span>Ziel {gear.alertHours} h</span>
          </div>
          <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full bg-neutral-400"
              style={{
                width: `${Math.min(100, (gear.usage.hours / gear.alertHours) * 100)}%`,
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

type FormState = typeof emptyForm;

function GearForm({
  form,
  setForm,
  onSubmit,
  onCancel,
  allowType,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  allowType?: boolean;
}) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3 sm:grid-cols-3">
      <input
        placeholder="Name (z.B. Vaporfly 3)"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        className="col-span-2 rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm sm:col-span-1"
      />
      {allowType ? (
        <select
          value={form.type}
          onChange={(e) =>
            setForm({
              ...form,
              type: e.target.value,
              sport: DEFAULT_SPORT[e.target.value] ?? form.sport,
            })
          }
          className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm"
        >
          <option value="shoe">Schuh</option>
          <option value="bike">Rad</option>
          <option value="wetsuit">Neopren</option>
          <option value="other">Sonstiges</option>
        </select>
      ) : null}
      <select
        value={form.sport}
        onChange={(e) => setForm({ ...form, sport: e.target.value })}
        className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm"
      >
        <option value="run">Laufen</option>
        <option value="bike">Rad</option>
        <option value="swim">Schwimmen</option>
        <option value="">— ohne Auto-Tracking —</option>
      </select>
      <input
        placeholder="Marke"
        value={form.brand}
        onChange={(e) => setForm({ ...form, brand: e.target.value })}
        className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm"
      />
      <input
        type="date"
        value={form.purchaseDate}
        onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
        className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm"
      />
      <input
        type="number"
        placeholder="Verschleißgrenze km"
        value={form.alertKm}
        onChange={(e) => setForm({ ...form, alertKm: e.target.value })}
        className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm"
      />
      <div className="col-span-2 flex gap-2 sm:col-span-3">
        <button
          onClick={onSubmit}
          disabled={!form.name.trim()}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
        >
          Speichern
        </button>
        {onCancel ? (
          <button
            onClick={onCancel}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100"
          >
            Abbrechen
          </button>
        ) : null}
      </div>
    </div>
  );
}
