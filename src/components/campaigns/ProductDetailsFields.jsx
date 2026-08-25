import { Package } from 'lucide-react';

export const ProductDetailsFields = ({ form, setForm, heading = 'Product details', showHeader = true }) => (
  <section className={showHeader ? 'rounded-xl border border-white/10 bg-white/[0.025] p-5' : ''}>
    {showHeader && (
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#7831d6]/20 text-[#c4b5fd]">
          <Package className="h-4 w-4" />
        </span>
        <div>
          <h3 className="m-0 text-sm font-semibold text-white">{heading}</h3>
          <p className="m-0 mt-0.5 text-[11px] text-zinc-400">Tell us what you sell.</p>
        </div>
      </div>
    )}

    <div className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold text-zinc-300">Product name</span>
        <input
          value={form.productName || ''}
          onChange={(event) => {
            const productName = event.target.value;
            setForm((current) => ({ ...current, productName, name: productName }));
          }}
          placeholder="What are you selling?"
          autoFocus
          className="w-full rounded-lg border border-white/10 bg-black px-3 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-[#7831d6] focus:ring-2 focus:ring-[#7831d6]/20"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold text-zinc-300">Product description</span>
        <textarea
          value={form.productDescription || ''}
          onChange={(event) => {
            const productDescription = event.target.value;
            setForm((current) => ({ ...current, productDescription, description: productDescription }));
          }}
          placeholder="Describe what you sell..."
          rows={4}
          className="w-full resize-y rounded-lg border border-white/10 bg-black px-3 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-zinc-600 focus:border-[#7831d6] focus:ring-2 focus:ring-[#7831d6]/20"
        />
      </label>
    </div>
  </section>
);

export default ProductDetailsFields;
