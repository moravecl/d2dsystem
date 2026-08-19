import { Link } from 'react-router-dom';
import { Users, FolderKanban, Package, HardHat, ArrowRight } from 'lucide-react';
import type { DashboardData } from '../dashboardTypes';

interface Props {
  data: DashboardData;
  editMode: boolean;
}

const CARD_STYLES = [
  {
    bg: 'linear-gradient(135deg, rgba(74,125,255,0.22) 0%, rgba(74,125,255,0.08) 100%)',
    border: 'rgba(74,125,255,0.25)',
    glow: 'rgba(74,125,255,0.15)',
    text: '#4A7DFF',
  },
  {
    bg: 'linear-gradient(135deg, rgba(0,200,140,0.22) 0%, rgba(0,200,140,0.08) 100%)',
    border: 'rgba(0,200,140,0.25)',
    glow: 'rgba(0,200,140,0.15)',
    text: '#00C88C',
  },
  {
    bg: 'linear-gradient(135deg, rgba(255,160,0,0.22) 0%, rgba(255,160,0,0.08) 100%)',
    border: 'rgba(255,160,0,0.25)',
    glow: 'rgba(255,160,0,0.15)',
    text: '#FFA000',
  },
  {
    bg: 'linear-gradient(135deg, rgba(0,180,255,0.22) 0%, rgba(0,180,255,0.08) 100%)',
    border: 'rgba(0,180,255,0.25)',
    glow: 'rgba(0,180,255,0.15)',
    text: '#00B4FF',
  },
];

export default function StatCardsWidget({ data, editMode }: Props) {
  const { stats } = data;
  const cards = [
    { label: 'Klienti', value: stats.clients, icon: Users, href: '/crm' },
    { label: 'Projekty', value: stats.projects, icon: FolderKanban, href: '/projekty' },
    { label: 'Realizace', value: stats.activeProjects, icon: HardHat, href: '/realizace' },
    { label: 'Produkty', value: stats.products, icon: Package, href: '/katalog' },
  ] as const;

  return (
    <div className={`grid grid-cols-2 sm:grid-cols-4 gap-4 ${editMode ? 'ring-2 ring-blue-400/30 ring-offset-2 ring-offset-navy-950 rounded-2xl p-1' : ''}`}>
      {cards.map((card, idx) => {
        const style = CARD_STYLES[idx];
        return (
          <Link
            key={card.label}
            to={card.href}
            className="group relative rounded-2xl p-5 hover:-translate-y-0.5 transition-all duration-300 overflow-hidden animate-count-up"
            style={{
              background: style.bg,
              border: `1px solid ${style.border}`,
              boxShadow: `0 4px 24px -4px ${style.glow}`,
              animationDelay: `${idx * 0.05}s`,
            }}
          >
            <div className="absolute inset-0 bg-white/[0.02] opacity-0 group-hover:opacity-100 transition-opacity" />
            <div
              className="absolute bottom-0 right-0 w-28 h-28 rounded-full blur-3xl translate-x-1/3 translate-y-1/3"
              style={{ background: style.glow }}
            />
            <div className="relative">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                style={{ background: `${style.border}` }}
              >
                <card.icon className="w-5 h-5 text-white" />
              </div>
              <div className="text-3xl font-extrabold text-white mb-1">{card.value}</div>
              <div className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}>{card.label}</div>
            </div>
            <ArrowRight className="absolute top-4 right-4 w-4 h-4 text-white/20 group-hover:text-white/50 group-hover:translate-x-0.5 transition-all duration-300" />
          </Link>
        );
      })}
    </div>
  );
}
