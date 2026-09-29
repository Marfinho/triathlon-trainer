"use client";

export function EditModeToolbar({
  editMode,
  dirty,
  saving,
  onToggleEdit,
  onSave,
  onCancel,
  onAddWidget,
}: {
  editMode: boolean;
  dirty: boolean;
  saving: boolean;
  onToggleEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onAddWidget: () => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-2.5">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        {editMode
          ? "Bearbeitungsmodus: Größe anpassen oder Widgets entfernen."
          : "Dein Dashboard, individuell anpassbar."}
      </p>
      <div className="flex items-center gap-2">
        {editMode && (
          <button
            type="button"
            onClick={onAddWidget}
            className="flex h-11 items-center justify-center rounded-full border border-neutral-200 dark:border-neutral-800 px-4 text-sm font-medium text-neutral-600 dark:text-neutral-400 transition hover:border-neutral-300 dark:hover:border-neutral-700 hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            Widget hinzufügen
          </button>
        )}
        {editMode && (
          <button
            type="button"
            onClick={onCancel}
            className="flex h-11 items-center justify-center rounded-full border border-neutral-200 dark:border-neutral-800 px-4 text-sm font-medium text-neutral-600 dark:text-neutral-400 transition hover:border-neutral-300 dark:hover:border-neutral-700 hover:text-neutral-900 dark:hover:text-neutral-100"
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
          className="flex h-11 items-center justify-center rounded-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 text-sm font-medium text-neutral-600 dark:text-neutral-400 transition hover:border-neutral-300 dark:hover:border-neutral-700 hover:text-neutral-900 dark:hover:text-neutral-100"
        >
          {editMode ? "Fertig" : "Bearbeiten"}
        </button>
      </div>
    </div>
  );
}
