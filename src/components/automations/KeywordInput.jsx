import { useState } from 'react';
import { X } from 'lucide-react';

export const KeywordInput = ({ keywords, onChange }) => {
  const [value, setValue] = useState('');
  const addKeyword = (raw) => {
    const keyword = raw.trim().toLowerCase();
    if (keyword && !keywords.includes(keyword)) onChange([...keywords, keyword]);
    setValue('');
  };

  return (
    <div className="flex min-h-[46px] flex-wrap items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-2 transition focus-within:border-[#7831d6]">
      {keywords.map((keyword) => (
        <span key={keyword} className="inline-flex items-center gap-1 rounded-lg bg-[#7831d6]/20 py-1 pl-2.5 pr-1 text-sm text-[#d6c2fa]">
          {keyword}
          <button
            type="button"
            onClick={() => onChange(keywords.filter((item) => item !== keyword))}
            className="rounded p-0.5 text-[#b99cf0] hover:bg-white/10 hover:text-white"
            aria-label={`Remove ${keyword}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        value={value}
        onChange={(event) => {
          const next = event.target.value;
          if (next.endsWith(',')) addKeyword(next.slice(0, -1));
          else setValue(next);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') { event.preventDefault(); addKeyword(value); }
          if (event.key === 'Backspace' && !value && keywords.length) onChange(keywords.slice(0, -1));
        }}
        onBlur={() => value && addKeyword(value)}
        placeholder={keywords.length ? 'Add another…' : 'Type a keyword and press Enter'}
        className="min-w-[140px] flex-1 bg-transparent px-1 py-1 text-sm text-white placeholder:text-zinc-500 outline-none"
        aria-label="Add keyword"
      />
    </div>
  );
};
