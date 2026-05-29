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
    <div className="glass-card p-4 flex flex-wrap gap-3 items-center">
      <input
        type="text"
        placeholder="Search cars..."
        value={filters.search}
        onChange={(e) => set('search', e.target.value)}
        className="flex-1 min-w-[160px] bg-transparent border border-white/10 rounded-xl px-4 py-2 text-sm text-brand-text placeholder-brand-muted focus:outline-none focus:border-brand-red/50 transition-colors"
      />

      <select
        value={filters.brand}
        onChange={(e) => set('brand', e.target.value)}
        className="bg-brand-surface border border-white/10 rounded-xl px-3 py-2 text-sm text-brand-text focus:outline-none focus:border-brand-red/50 transition-colors"
      >
        <option value="">All Brands</option>
        {brands.map((b) => <option key={b} value={b}>{b}</option>)}
      </select>

      <select
        value={filters.type}
        onChange={(e) => set('type', e.target.value)}
        className="bg-brand-surface border border-white/10 rounded-xl px-3 py-2 text-sm text-brand-text focus:outline-none focus:border-brand-red/50 transition-colors"
      >
        <option value="">All Types</option>
        {types.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>

      <div className="flex items-center gap-2">
        <input
          type="range"
          min={50}
          max={700}
          step={10}
          value={filters.maxPrice}
          onChange={(e) => set('maxPrice', parseInt(e.target.value))}
          className="w-24 accent-brand-red"
        />
        <span className="text-sm text-brand-muted whitespace-nowrap">≤ ${filters.maxPrice}/day</span>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={filters.availableOnly}
          onChange={(e) => set('availableOnly', e.target.checked)}
          className="w-4 h-4 accent-brand-red rounded"
        />
        <span className="text-sm text-brand-muted">Available only</span>
      </label>
    </div>
  );
}
