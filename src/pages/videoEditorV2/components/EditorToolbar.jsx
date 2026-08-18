import {
  ArrowLeft,
  Download,
  Layers3,
  Loader2,
  Play,
  Redo2,
  Save,
  Settings,
  Undo2,
} from 'lucide-react';

export const EditorToolbar = ({
  projectName,
  output,
  canUndo,
  canRedo,
  isExporting,
  isBulkProject,
  onProjectNameChange,
  onUndo,
  onRedo,
  onOpenProjectSettings,
  onPreview,
  onExport,
  onSaveProject,
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
      <div className="min-w-0">
        <p className="text-[8px] font-extrabold uppercase tracking-[0.14em] text-[#7831d6]">
          Timeline Editor
        </p>
        <input
          value={projectName}
          onChange={(event) => onProjectNameChange(event.target.value)}
          aria-label="Project name"
          className="w-36 truncate border-0 bg-transparent p-0 text-[11px] font-bold leading-tight text-white outline-none placeholder:text-white/40 sm:w-52"
        />
      </div>

      <div className="ml-1 flex items-center gap-1">
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
    </div>

    <div className="flex items-center gap-1.5">
      {isBulkProject && (
        <button
          type="button"
          onClick={onOpenBulkBuilder}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-[#7831d6] px-2.5 text-[10px] font-bold text-white shadow-sm transition hover:bg-[#6825bc] active:scale-[0.98]"
          aria-label="Open Bulk Video Builder"
          title="Open Bulk Video Builder"
        >
          <Layers3 className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Bulk Video Builder</span>
          <span className="lg:hidden">Bulk Builder</span>
        </button>
      )}

      <button
        type="button"
        onClick={onOpenProjectSettings}
        className="flex h-8 items-center gap-1.5 rounded-lg bg-[#7831d6] px-2 text-[9px] font-bold text-white shadow-sm transition hover:bg-[#6825bc] active:scale-[0.98] md:px-2.5"
        aria-label="Open project settings"
        title="Project settings"
      >
        <Settings className="h-3.5 w-3.5 text-white" />
        <span className="hidden md:inline">{output.width} × {output.height}</span>
        <span className="hidden text-white/80 xl:inline">· {output.fps} fps</span>
      </button>

      <button
        type="button"
        onClick={onSaveProject}
        className="hidden h-8 items-center gap-1.5 rounded-lg bg-[#7831d6] px-2.5 text-[10px] font-bold text-white shadow-sm transition hover:bg-[#6825bc] active:scale-[0.98] sm:flex"
      >
        <Save className="h-3.5 w-3.5" />
        {isBulkProject ? 'Save to row' : 'Save draft'}
      </button>

      <button
        type="button"
        onClick={onPreview}
        className="hidden h-8 items-center gap-1.5 rounded-lg bg-[#7831d6] px-2.5 text-[10px] font-bold text-white shadow-sm transition hover:bg-[#6825bc] active:scale-[0.98] md:flex"
      >
        <Play className="h-3.5 w-3.5 fill-current" />
        Preview
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
