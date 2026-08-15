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
  <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 bg-[#111318] px-2.5 shadow-[0_1px_0_rgba(255,255,255,0.02)] sm:px-3">
    <div className="flex min-w-0 items-center gap-2">
      <button
        type="button"
        onClick={onBack}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#9298a3] transition hover:bg-white/10 hover:text-white"
        aria-label={backLabel || (isBulkProject ? 'Back to Bulk Planning Board' : 'Back to Media Library')}
        title={backLabel || (isBulkProject ? 'Back to Bulk Planning Board' : 'Back to Media Library')}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
      </button>

      <div className="hidden h-5 w-px bg-white/10 sm:block" />
      <div className="min-w-0">
        <p className="text-[8px] font-extrabold uppercase tracking-[0.14em] text-[#ff5500]">
          Timeline Editor
        </p>
        <input
          value={projectName}
          onChange={(event) => onProjectNameChange(event.target.value)}
          aria-label="Project name"
          className="w-36 truncate border-0 bg-transparent p-0 text-[11px] font-bold leading-tight text-[#f5f7fa] outline-none placeholder:text-[#666d78] sm:w-52"
        />
      </div>

      <div className="ml-1 flex items-center gap-1">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="flex h-7 w-7 items-center justify-center rounded-md text-[#9298a3] transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Undo"
          title="Undo (Ctrl/Cmd + Z)"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          className="flex h-7 w-7 items-center justify-center rounded-md text-[#9298a3] transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Redo"
          title="Redo (Ctrl/Cmd + Shift + Z)"
        >
          <Redo2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>

    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={onOpenBulkBuilder}
        className="flex h-8 items-center gap-1.5 rounded-lg border border-[#ff5500]/35 bg-[#ff5500]/10 px-2.5 text-[10px] font-bold text-orange-300 transition hover:border-[#ff5500]/60 hover:bg-[#ff5500]/20 hover:text-orange-200"
        aria-label="Open Bulk Video Builder"
        title="Open Bulk Video Builder"
      >
        <Layers3 className="h-3.5 w-3.5" />
        <span className="hidden lg:inline">Bulk Video Builder</span>
        <span className="lg:hidden">Bulk Builder</span>
      </button>

      <button
        type="button"
        onClick={onOpenProjectSettings}
        className="flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-[#1a1d24] px-2 text-[9px] font-bold text-[#d7dbe2] transition hover:border-white/20 hover:bg-[#20242c] md:px-2.5"
        aria-label="Open project settings"
        title="Project settings"
      >
        <Settings className="h-3.5 w-3.5 text-[#ff5500]" />
        <span className="hidden md:inline">{output.width} × {output.height}</span>
        <span className="hidden text-[#7f8691] xl:inline">· {output.fps} fps</span>
      </button>

      <button
        type="button"
        onClick={onSaveProject}
        className="hidden h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-[#171a20] px-2.5 text-[10px] font-bold text-[#d7dbe2] transition hover:bg-[#20242c] hover:text-white sm:flex"
      >
        <Save className="h-3.5 w-3.5" />
        {isBulkProject ? 'Save to row' : 'Save draft'}
      </button>

      <button
        type="button"
        onClick={onPreview}
        className="hidden h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-[#171a20] px-2.5 text-[10px] font-bold text-[#d7dbe2] transition hover:bg-[#20242c] hover:text-white md:flex"
      >
        <Play className="h-3.5 w-3.5 fill-current" />
        Preview
      </button>

      <button
        type="button"
        onClick={onExport}
        disabled={isExporting}
        className="flex h-8 items-center gap-1.5 rounded-lg bg-[#0071e3] px-3 text-[10px] font-bold text-white shadow-sm transition hover:bg-[#147ce5] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55"
      >
        {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        {isExporting ? 'Exporting' : 'Export'}
      </button>
    </div>
  </header>
);
