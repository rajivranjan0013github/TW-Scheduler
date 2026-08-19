import {
  ArrowLeft,
  Download,
  Layers3,
  Loader2,
  Redo2,
  Settings,
  Undo2,
} from 'lucide-react';

export const EditorToolbar = ({
  canUndo,
  canRedo,
  isExporting,
  isBulkProject,
  onUndo,
  onRedo,
  onOpenProjectSettings,
  onExport,
  onOpenBulkBuilder,
  onBack,
  backLabel,
}) => (
  <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 bg-black px-2.5 shadow-[0_1px_0_rgba(255,255,255,0.02)] sm:px-3">
    <div className="flex min-w-0 items-center gap-2">
      <button
        type="button"
        onClick={onBack}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white transition hover:bg-[#7831d6]/20 hover:text-white"
        aria-label={backLabel || (isBulkProject ? 'Back to Bulk Planning Board' : 'Back to Media Library')}
        title={backLabel || (isBulkProject ? 'Back to Bulk Planning Board' : 'Back to Media Library')}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
      </button>

      <div className="hidden h-5 w-px bg-white/10 sm:block" />
      <div className="min-w-0 flex items-center">
        <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#7831d6]">
          Timeline Editor
        </span>
      </div>

      {isBulkProject && (
        <>
          <div className="hidden h-5 w-px bg-white/10 sm:block" />
          <button
            type="button"
            onClick={onOpenBulkBuilder}
            className="flex h-7 items-center gap-1.5 rounded-lg border border-[#7831d6]/60 bg-[#7831d6]/10 px-2.5 text-[10px] font-bold text-[#c4b5fd] transition hover:border-[#7831d6] hover:bg-[#7831d6]/20 hover:text-white active:scale-[0.98]"
            aria-label="Open Bulk Video Builder"
            title="Open Bulk Video Builder"
          >
            <Layers3 className="h-3.5 w-3.5 text-[#a78bfa]" />
            <span className="hidden sm:inline">Bulk Video Builder</span>
            <span className="sm:hidden">Bulk</span>
          </button>
        </>
      )}
    </div>

    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="flex h-7 w-7 items-center justify-center rounded-md text-white transition hover:bg-[#7831d6]/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Undo"
          title="Undo (Ctrl/Cmd + Z)"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          className="flex h-7 w-7 items-center justify-center rounded-md text-white transition hover:bg-[#7831d6]/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Redo"
          title="Redo (Ctrl/Cmd + Shift + Z)"
        >
          <Redo2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="hidden h-5 w-px bg-white/10 sm:block" />

      <button
        type="button"
        onClick={onOpenProjectSettings}
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7831d6] text-white shadow-sm transition hover:bg-[#6825bc] active:scale-[0.98]"
        aria-label="Open project settings"
        title="Project settings"
      >
        <Settings className="h-4 w-4 text-white" />
      </button>

      <button
        type="button"
        onClick={onExport}
        disabled={isExporting}
        className="flex h-8 items-center gap-1.5 rounded-lg bg-[#7831d6] px-3 text-[10px] font-bold text-white shadow-sm transition hover:bg-[#6825bc] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55"
      >
        {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        {isExporting ? 'Exporting' : 'Export'}
      </button>
    </div>
  </header>
);
