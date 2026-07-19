interface FilterState {
  search: string;
  brand: string;
  type: string;
  maxPrice: number;
  availableOnly: boolean;
}

interface Props {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  brands: string[];
  types: string[];
}

export default function FilterBar({ filters, onChange, brands, types }: Props) {
  const set = (key: keyof FilterState, value: string | number | boolean) =>
    onChange({ ...filters, [key]: value });

  return (
    <div className="border border-white/[0.06] bg-brand-dark/60 backdrop-blur-sm p-4 flex flex-wrap gap-3 items-center">
      <input
        type="text"
        placeholder="Search cars..."
        value={filters.search}
        onChange={(e) => set('search', e.target.value)}
        className="flex-1 min-w-[160px] bg-transparent border border-white/10 px-4 py-2.5 text-sm text-brand-text placeholder-brand-muted focus:outline-none focus:border-brand-red/50 transition-colors"
      />

      <select
        value={filters.brand}
        onChange={(e) => set('brand', e.target.value)}
        className="cursor-pointer bg-brand-surface border border-white/10 px-3 py-2.5 text-xs uppercase tracking-[0.1em] text-brand-text focus:outline-none focus:border-brand-red/50 transition-colors"
      >
        <option value="">All Brands</option>
        {brands.map((b) => <option key={b} value={b}>{b}</option>)}
      </select>

      <select
        value={filters.type}
        onChange={(e) => set('type', e.target.value)}
        className="cursor-pointer bg-brand-surface border border-white/10 px-3 py-2.5 text-xs uppercase tracking-[0.1em] text-brand-text focus:outline-none focus:border-brand-red/50 transition-colors"
      >
        <option value="">All Types</option>
        {types.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>

      <div className="flex items-center gap-2.5">
        <input
          type="range"
          min={50}
          max={700}
          step={10}
          value={filters.maxPrice}
          onChange={(e) => set('maxPrice', parseInt(e.target.value))}
          className="cursor-pointer w-24 accent-brand-red"
        />
        <span className="text-xs text-brand-muted whitespace-nowrap uppercase tracking-[0.1em]">≤ {filters.maxPrice} DT/day</span>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={filters.availableOnly}
          onChange={(e) => set('availableOnly', e.target.checked)}
          className="cursor-pointer w-4 h-4 accent-brand-red"
        />
        <span className="text-xs text-brand-muted uppercase tracking-[0.1em]">Available only</span>
      </label>
    </div>
  );
}
