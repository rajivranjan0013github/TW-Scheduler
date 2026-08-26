import { useState } from 'react';
import { Check, Loader2, Smartphone, X } from 'lucide-react';
import ProductDetailsFields from './ProductDetailsFields';

export const CampaignCreationModal = ({
  form,
  setForm,
  saving,
  error,
  onSubmit,
  onClose,
  canClose = true,
  title = 'Add Mobile App / Product',
  description = 'Paste your App Store or Play Store link to auto-fill hooks.',
  submitLabel = 'Create workspace',
}) => {
  const [validationError, setValidationError] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    setValidationError('');
    if (!String(form.productName || '').trim()) {
      if (String(form.productUrl || '').trim()) {
        setValidationError('Please click "Auto-Extract" to load product details or enter a name manually.');
      } else {
        setValidationError('Product or app name is required.');
      }
      return;
    }
    if (!String(form.productDescription || '').trim()) {
      setValidationError('Product description is required.');
      return;
    }
    onSubmit(event);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a] text-white shadow-2xl shadow-black"
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#7831d6]/20 text-[#c4b5fd]">
              <Smartphone className="h-5 w-5" />
            </span>
            <div>
              <h2 className="m-0 text-base font-semibold text-white">{title}</h2>
              <p className="m-0 mt-0.5 text-xs text-zinc-400">{description}</p>
            </div>
          </div>
          {canClose && (
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
              aria-label="Close product modal"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 custom-scrollbar">
          {(validationError || error) && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs font-medium text-red-300">
              {validationError || error}
            </div>
          )}
          <ProductDetailsFields form={form} setForm={setForm} showHeader={false} />
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-white/10 px-5 py-3.5 shrink-0 bg-[#070707]">
          {canClose && (
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-zinc-300 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-[#7831d6] px-5 py-2 text-xs font-semibold text-white transition hover:bg-[#6825bc] disabled:cursor-wait disabled:opacity-60 shadow-md shadow-purple-950/40"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? 'Saving...' : submitLabel}
          </button>
        </footer>
      </form>
    </div>
  );
};

export default CampaignCreationModal;
