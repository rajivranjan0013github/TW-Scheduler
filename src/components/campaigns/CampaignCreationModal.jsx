import { useState } from 'react';
import { Check, Loader2, Package, X } from 'lucide-react';
import ProductDetailsFields from './ProductDetailsFields';

export const CampaignCreationModal = ({
  form,
  setForm,
  saving,
  error,
  onSubmit,
  onClose,
  canClose = true,
}) => {
  const [validationError, setValidationError] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    setValidationError('');
    if (!String(form.productName || '').trim()) {
      setValidationError('Product name is required.');
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
        className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a] text-white shadow-2xl shadow-black"
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#7831d6]/20 text-[#c4b5fd]">
              <Package className="h-5 w-5" />
            </span>
            <div>
              <h2 className="m-0 text-lg font-semibold text-white">Add product</h2>
              <p className="m-0 mt-0.5 text-xs text-zinc-400">Enter the product name and description.</p>
            </div>
          </div>
          {canClose && (
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
              aria-label="Close product setup"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </header>

        <div className="px-5 py-5">
          {(validationError || error) && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs font-medium text-red-300">
              {validationError || error}
            </div>
          )}
          <ProductDetailsFields form={form} setForm={setForm} showHeader={false} />
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-white/10 px-5 py-4">
          {canClose && (
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-zinc-300 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-[#7831d6] px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#6825bc] disabled:cursor-wait disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? 'Creating...' : 'Create product'}
          </button>
        </footer>
      </form>
    </div>
  );
};

export default CampaignCreationModal;
