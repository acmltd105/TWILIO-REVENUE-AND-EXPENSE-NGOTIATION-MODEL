interface TabsProps {
  tabs: string[];
  activeIndex: number;
  onChange: (index: number) => void;
}

export const Tabs = ({ tabs, activeIndex, onChange }: TabsProps) => (
  <div className="flex flex-wrap gap-3">
    {tabs.map((tab, idx) => (
      <button
        key={tab}
        type="button"
        onClick={() => onChange(idx)}
        className={`rounded-full px-5 py-2 text-sm font-semibold transition-all ${
          idx === activeIndex
            ? 'bg-wave text-midnight shadow-lg ring-4 ring-wave/30'
            : 'bg-white/70 text-ocean hover:bg-white'
        }`}
      >
        {tab}
      </button>
    ))}
  </div>
);
