import React, { useState } from 'react';
import { Search } from 'lucide-react';

export const SearchBar: React.FC = () => {
  const [query, setQuery] = useState('');

  return (
    <section aria-label="Kolom Pencarian" className="w-full">
      <div className="rounded-2xl bg-white border border-slate-200/80 shadow-[0_2px_12px_rgba(15,23,42,0.04)] p-2.5 sm:p-3">
        <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/15 transition-all duration-150">
          <Search className="w-4 h-4 sm:w-[18px] sm:h-[18px] text-slate-400 shrink-0" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari data siswa, surat, atau guru..."
            aria-label="Cari data siswa, surat, atau guru"
            className="w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
          />
        </div>
      </div>
    </section>
  );
};
