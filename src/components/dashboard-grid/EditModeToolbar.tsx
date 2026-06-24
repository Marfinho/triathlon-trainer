"use client";

export function EditModeToolbar({
  editMode,
  dirty,
  saving,
  onToggleEdit,
  onSave,
  onCancel,
}: {
  editMode: boolean;
  dirty: boolean;
  saving: boolean;
  onToggleEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-neutral-200/80 bg-white px-4 py-2.5">
      <p className="text-xs text-neutral-500">
        {editMode
          ? "Bearbeitungsmodus: Größe anpassen oder Widgets entfernen."
          : "Dein Dashboard, individuell anpassbar."}
      </p>
      <div className="flex items-center gap-2">
        {editMode && (
          <button
            type="button"
            onClick={onCancel}
            className="flex h-11 items-center justify-center rounded-full border border-neutral-200 px-4 text-sm font-medium text-neutral-600 transition hover:border-neutral-300 hover:text-neutral-900"
          >
            Abbrechen
          </button>
        )}
        {editMode && (
          <button
            type="button"
            onClick={onSave}
            disabled={!dirty || saving}
            className="flex h-11 items-center justify-center rounded-full bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Speichern…" : "Speichern"}
          </button>
        )}
        <button
          type="button"
          onClick={onToggleEdit}
          className="flex h-11 items-center justify-center rounded-full border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-600 transition hover:border-neutral-300 hover:text-neutral-900"
        >
          {editMode ? "Fertig" : "Bearbeiten"}
        </button>
      </div>
    </div>
  );
}
