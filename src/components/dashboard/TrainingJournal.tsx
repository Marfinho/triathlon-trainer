"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "./Card";

export interface JournalItem {
  id: string;
  date: string;
  mood: number | null;
  text: string;
}

const MOODS = ["😞", "😕", "😐", "🙂", "😄"];

function moodEmoji(m: number | null): string {
  if (m == null || m < 1 || m > 5) return "·";
  return MOODS[m - 1];
}

function fmtDate(iso: string): string {
  const [, mo, d] = iso.slice(0, 10).split("-");
  return `${d}.${mo}.`;
}

export function TrainingJournal({ initial }: { initial: JournalItem[] }) {
  const router = useRouter();
  const [entries, setEntries] = useState<JournalItem[]>(initial);
  const [open, setOpen] = useState(false);
  const [mood, setMood] = useState(4);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mood, text }),
      });
      const data = await res.json();
      if (data.ok) {
        setEntries((e) => [
          { id: data.entry.id, date: data.entry.date, mood, text },
          ...e,
        ]);
        setText("");
        setOpen(false);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setEntries((e) => e.filter((x) => x.id !== id));
    await fetch(`/api/journal?id=${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <Card
      title="Trainingstagebuch"
      subtitle="Notizen zu Gefühl, Technik und Besonderheiten"
      actions={
        <button
          onClick={() => setOpen((o) => !o)}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
        >
          {open ? "Schließen" : "Notiz"}
        </button>
      }
    >
      {open ? (
        <div className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
          <div className="mb-2 flex gap-1.5">
            {MOODS.map((m, i) => (
              <button
                key={i}
                onClick={() => setMood(i + 1)}
                className={`h-8 w-8 rounded-lg text-lg transition-transform ${
                  mood === i + 1 ? "scale-110 bg-white shadow-sm" : "opacity-50"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Wie war die Einheit? Was ist aufgefallen?"
            className="h-20 w-full rounded-lg border border-neutral-300 bg-white p-2 text-sm"
          />
          <div className="mt-2">
            <button
              onClick={save}
              disabled={saving || !text.trim()}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
            >
              {saving ? "…" : "Speichern"}
            </button>
          </div>
        </div>
      ) : null}

      {entries.length === 0 ? (
        <p className="text-sm text-neutral-400">Noch keine Notizen.</p>
      ) : (
        <ul className="space-y-2">
          {entries.slice(0, 8).map((e) => (
            <li key={e.id} className="flex gap-3 border-b border-neutral-100 pb-2 last:border-0">
              <span className="text-lg leading-6">{moodEmoji(e.mood)}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-neutral-800">{e.text}</p>
                <p className="text-[11px] text-neutral-400">{fmtDate(e.date)}</p>
              </div>
              <button
                onClick={() => remove(e.id)}
                className="text-neutral-300 hover:text-rose-500"
                aria-label="Notiz löschen"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
