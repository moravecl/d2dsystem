interface Tab {
  key: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
}

export default function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="border-b border-white/[0.07] px-1">
      <nav className="flex gap-0 -mb-px overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`relative px-4 py-3 text-sm font-medium whitespace-nowrap transition-all ${
              active === tab.key
                ? 'text-white'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-md font-semibold ${
                  active === tab.key
                    ? 'bg-blue-500/20 text-blue-300'
                    : 'bg-white/[0.07] text-slate-400'
                }`}
              >
                {tab.count}
              </span>
            )}
            {active === tab.key && (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-500 rounded-full" />
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}
