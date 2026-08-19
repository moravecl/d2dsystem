import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutGrid, Package, Puzzle, Settings } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Stats {
  categories: number;
  products: number;
  designModules: number;
  presets: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({ categories: 0, products: 0, designModules: 0, presets: 0 });

  useEffect(() => {
    const load = async () => {
      const [c, p, d, pr] = await Promise.all([
        supabase.from('categories').select('id', { count: 'exact', head: true }),
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('design_modules').select('id', { count: 'exact', head: true }),
        supabase.from('design_presets').select('id', { count: 'exact', head: true }),
      ]);
      setStats({
        categories: c.count ?? 0,
        products: p.count ?? 0,
        designModules: d.count ?? 0,
        presets: pr.count ?? 0,
      });
    };
    load();
  }, []);

  const cards = [
    { label: 'Kategorie', count: stats.categories, icon: LayoutGrid, to: '/admin/categories', color: 'bg-emerald-500/10 text-emerald-700' },
    { label: 'Položky', count: stats.products, icon: Package, to: '/admin/products', color: 'bg-blue-500/10 text-blue-400' },
    { label: 'Design moduly', count: stats.designModules, icon: Puzzle, to: '/admin/design-modules', color: 'bg-amber-500/10 text-amber-700' },
    { label: 'Presety', count: stats.presets, icon: Settings, to: '/admin/presets', color: 'bg-cyan-50 text-cyan-700' },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-white">Přehled administrace</h1>
        <p className="text-sm text-slate-500 mt-1">Spravujte katalog, kategorie, položky a konfigurace designových řad.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card) => (
          <Link
            key={card.to}
            to={card.to}
            className="bg-navy-800/60 rounded-2xl border border-white/[0.06] p-6 hover:shadow-md transition group"
          >
            <div className={`w-12 h-12 rounded-2xl ${card.color} flex items-center justify-center mb-4 group-hover:scale-110 transition`}>
              <card.icon className="w-6 h-6" />
            </div>
            <div className="text-3xl font-extrabold text-white">{card.count}</div>
            <div className="text-sm font-extrabold text-slate-500 mt-1">{card.label}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
