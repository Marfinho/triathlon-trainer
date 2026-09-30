"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { BarcodeScannerModal } from "@/components/dashboard/nutrition/BarcodeScannerModal";

interface FoodProductLite {
  id?: string;
  ean?: string | null;
  code?: string;
  name: string;
  brand: string | null;
  kcalPer100g: number;
  proteinGPer100g: number | null;
  carbsGPer100g: number | null;
  fatGPer100g: number | null;
  servingSizeG: number | null;
}

const EAN_PATTERN = /^\d{8,14}$/;

/**
 * Produktsuche per Barcode oder Name + Mengenangabe + Logging. Externe
 * Open-Food-Facts-Treffer haben noch keine lokale ID – beim Auswählen wird
 * das Produkt erst über die Barcode-Route in den lokalen Cache übernommen
 * (serverseitig, kein direkter Client-Zugriff auf Open Food Facts).
 */
export function FoodSearch({ onLogged }: { onLogged: () => void }) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [localResults, setLocalResults] = useState<FoodProductLite[]>([]);
  const [externalResults, setExternalResults] = useState<FoodProductLite[]>([]);
  const [selected, setSelected] = useState<FoodProductLite | null>(null);
  const [resolving, setResolving] = useState(false);
  const [quantityG, setQuantityG] = useState(100);
  const [logging, setLogging] = useState(false);

  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState({
    name: "",
    brand: "",
    ean: "",
    kcalPer100g: 0,
    proteinGPer100g: "" as number | "",
    carbsGPer100g: "" as number | "",
    fatGPer100g: "" as number | "",
    servingSizeG: "" as number | "",
  });
  const [savingManual, setSavingManual] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  /** Lädt ein Produkt per EAN – aus dem Such-Input oder direkt vom Scanner. */
  async function lookupByEan(ean: string) {
    setSearching(true);
    setSelected(null);
    try {
      const res = await fetch(`/api/nutrition/products/barcode/${ean}`);
      const data = await res.json();
      if (res.ok && data.ok) {
        setLocalResults([data.product]);
        setExternalResults([]);
      } else {
        setLocalResults([]);
        setExternalResults([]);
        toast(data.error ?? "Barcode nicht gefunden.", "error");
        setManual((m) => ({ ...m, ean }));
        setShowManual(true);
      }
    } catch {
      toast("Suche fehlgeschlagen.", "error");
    } finally {
      setSearching(false);
    }
  }

  async function search() {
    const q = query.trim();
    if (!q) return;
    if (EAN_PATTERN.test(q)) {
      await lookupByEan(q);
      return;
    }
    setSearching(true);
    setSelected(null);
    try {
      const res = await fetch(`/api/nutrition/products/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (res.ok && data.ok) {
        setLocalResults(data.local ?? []);
        setExternalResults(data.external ?? []);
      }
    } catch {
      toast("Suche fehlgeschlagen.", "error");
    } finally {
      setSearching(false);
    }
  }

  function onBarcodeDetected(ean: string) {
    setScannerOpen(false);
    setQuery(ean);
    void lookupByEan(ean);
  }

  async function select(product: FoodProductLite) {
    if (product.id) {
      setSelected(product);
      return;
    }
    // Externer Treffer ohne lokale ID: über Barcode-Route materialisieren.
    const ean = product.code ?? product.ean;
    if (!ean) return;
    setResolving(true);
    try {
      const res = await fetch(`/api/nutrition/products/barcode/${ean}`);
      const data = await res.json();
      if (res.ok && data.ok) {
        setSelected(data.product);
      } else {
        toast(data.error ?? "Produkt konnte nicht geladen werden.", "error");
      }
    } finally {
      setResolving(false);
    }
  }

  async function logSelected() {
    if (!selected?.id || quantityG <= 0) return;
    setLogging(true);
    try {
      const res = await fetch("/api/nutrition/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ foodProductId: selected.id, quantityG }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        toast(`${selected.name} eingetragen.`, "success");
        setSelected(null);
        setQuery("");
        setLocalResults([]);
        setExternalResults([]);
        setQuantityG(100);
        onLogged();
      } else {
        toast(data.error ?? "Eintragen fehlgeschlagen.", "error");
      }
    } catch {
      toast("Netzwerkfehler beim Eintragen.", "error");
    } finally {
      setLogging(false);
    }
  }

  async function saveManual() {
    if (!manual.name.trim() || manual.kcalPer100g < 0) return;
    setSavingManual(true);
    try {
      const res = await fetch("/api/nutrition/products/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: manual.name,
          brand: manual.brand || null,
          ean: manual.ean || null,
          kcalPer100g: manual.kcalPer100g,
          proteinGPer100g: manual.proteinGPer100g === "" ? null : manual.proteinGPer100g,
          carbsGPer100g: manual.carbsGPer100g === "" ? null : manual.carbsGPer100g,
          fatGPer100g: manual.fatGPer100g === "" ? null : manual.fatGPer100g,
          servingSizeG: manual.servingSizeG === "" ? null : manual.servingSizeG,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setSelected(data.product);
        setShowManual(false);
        setManual((m) => ({ ...m, ean: "" }));
        toast("Produkt angelegt – jetzt Menge eintragen.", "success");
      } else {
        toast(data.error ?? "Anlegen fehlgeschlagen.", "error");
      }
    } catch {
      toast("Netzwerkfehler beim Anlegen.", "error");
    } finally {
      setSavingManual(false);
    }
  }

  const results = [...localResults, ...externalResults];

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
      <div className="flex flex-wrap gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Barcode (EAN) oder Produktname…"
          className="min-w-[160px] flex-1 rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm"
        />
        <button
          onClick={search}
          disabled={searching || !query.trim()}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-40"
        >
          {searching ? "…" : "Suchen"}
        </button>
        <button
          onClick={() => setScannerOpen(true)}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
        >
          📷 Barcode scannen
        </button>
        <button
          onClick={() => setShowManual((s) => !s)}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
        >
          Manuell anlegen
        </button>
      </div>

      {scannerOpen ? (
        <BarcodeScannerModal onDetected={onBarcodeDetected} onClose={() => setScannerOpen(false)} />
      ) : null}

      {showManual ? (
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-neutral-200 bg-white p-3 sm:grid-cols-4">
          {manual.ean ? (
            <p className="col-span-2 text-xs text-neutral-400 sm:col-span-4">
              Barcode {manual.ean} ohne Treffer – wird mit angelegt.
            </p>
          ) : null}
          <input
            value={manual.name}
            onChange={(e) => setManual({ ...manual, name: e.target.value })}
            placeholder="Name"
            className="col-span-2 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm sm:col-span-4"
          />
          <input
            value={manual.brand}
            onChange={(e) => setManual({ ...manual, brand: e.target.value })}
            placeholder="Marke (optional)"
            className="col-span-2 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm sm:col-span-4"
          />
          <label className="text-xs text-neutral-500">
            kcal/100g
            <input
              type="number"
              min={0}
              value={manual.kcalPer100g}
              onChange={(e) => setManual({ ...manual, kcalPer100g: Number(e.target.value) || 0 })}
              className="mt-1 block w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs text-neutral-500">
            Protein/100g
            <input
              type="number"
              min={0}
              value={manual.proteinGPer100g}
              onChange={(e) =>
                setManual({ ...manual, proteinGPer100g: e.target.value === "" ? "" : Number(e.target.value) })
              }
              className="mt-1 block w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs text-neutral-500">
            Carbs/100g
            <input
              type="number"
              min={0}
              value={manual.carbsGPer100g}
              onChange={(e) =>
                setManual({ ...manual, carbsGPer100g: e.target.value === "" ? "" : Number(e.target.value) })
              }
              className="mt-1 block w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs text-neutral-500">
            Fett/100g
            <input
              type="number"
              min={0}
              value={manual.fatGPer100g}
              onChange={(e) =>
                setManual({ ...manual, fatGPer100g: e.target.value === "" ? "" : Number(e.target.value) })
              }
              className="mt-1 block w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
            />
          </label>
          <div className="col-span-2 sm:col-span-4">
            <button
              onClick={saveManual}
              disabled={savingManual || !manual.name.trim()}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
            >
              {savingManual ? "…" : "Produkt anlegen"}
            </button>
          </div>
        </div>
      ) : null}

      {results.length > 0 ? (
        <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto">
          {results.map((p, i) => (
            <li key={p.id ?? p.code ?? i}>
              <button
                onClick={() => select(p)}
                className={`flex w-full items-center justify-between rounded-lg border px-2 py-1.5 text-left text-sm hover:bg-white ${
                  selected && (selected.id === p.id || selected.ean === p.code)
                    ? "border-blue-400 bg-blue-50"
                    : "border-neutral-200 bg-white"
                }`}
              >
                <span>
                  {p.name}
                  {p.brand ? <span className="text-neutral-400"> · {p.brand}</span> : null}
                </span>
                <span className="text-xs text-neutral-400">{Math.round(p.kcalPer100g)} kcal/100g</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {resolving ? <p className="mt-2 text-xs text-neutral-400">Lade Produktdaten…</p> : null}

      {selected?.id ? (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <div className="text-sm text-neutral-700">
            <strong>{selected.name}</strong>
            <span className="ml-1 text-neutral-400">({Math.round(selected.kcalPer100g)} kcal/100g)</span>
          </div>
          <label className="text-xs text-neutral-500">
            Menge (g)
            <input
              type="number"
              min={1}
              value={quantityG}
              onChange={(e) => setQuantityG(Number(e.target.value) || 0)}
              className="mt-1 block w-24 rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm"
            />
          </label>
          <button
            onClick={logSelected}
            disabled={logging || quantityG <= 0}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
          >
            {logging ? "…" : "Eintragen"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
