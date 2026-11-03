import {
  Construction,
  Droplet,
  Zap,
  Sparkles,
  Lightbulb,
  Waves,
  Trash2,
  Flag,
  type LucideIcon,
} from 'lucide-react';
import { CATEGORY_META, type ComplaintCategory } from '@/lib/supabase';

const ICONS: Record<string, LucideIcon> = {
  road: Construction,
  droplet: Droplet,
  zap: Zap,
  sparkles: Sparkles,
  lightbulb: Lightbulb,
  waves: Waves,
  trash: Trash2,
  flag: Flag,
};

const COLOR_MAP: Record<string, { bg: string; text: string; ring: string }> = {
  amber: { bg: 'bg-amber-50', text: 'text-amber-600', ring: 'ring-amber-200' },
  sky: { bg: 'bg-sky-50', text: 'text-sky-600', ring: 'ring-sky-200' },
  yellow: { bg: 'bg-yellow-50', text: 'text-yellow-600', ring: 'ring-yellow-200' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-200' },
  violet: { bg: 'bg-violet-50', text: 'text-violet-600', ring: 'ring-violet-200' },
  cyan: { bg: 'bg-cyan-50', text: 'text-cyan-600', ring: 'ring-cyan-200' },
  lime: { bg: 'bg-lime-50', text: 'text-lime-600', ring: 'ring-lime-200' },
  slate: { bg: 'bg-slate-50', text: 'text-slate-600', ring: 'ring-slate-200' },
};

interface CategoryIconProps {
  category: ComplaintCategory;
  size?: 'sm' | 'md' | 'lg';
  withLabel?: boolean;
}

export default function CategoryIcon({ category, size = 'md', withLabel = false }: CategoryIconProps) {
  const meta = CATEGORY_META[category];
  const Icon = ICONS[meta.icon] ?? Flag;
  const colors = COLOR_MAP[meta.color] ?? COLOR_MAP.slate;

  const iconSize = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-7 w-7' : 'h-5 w-5';
  const containerSize = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-14 w-14' : 'h-10 w-10';
  const radius = size === 'lg' ? 'rounded-2xl' : 'rounded-xl';

  return (
    <div className="flex items-center gap-2.5">
      <div
        className={`${containerSize} ${radius} ${colors.bg} ${colors.text} flex items-center justify-center ring-1 ${colors.ring}`}
      >
        <Icon className={iconSize} />
      </div>
      {withLabel && (
        <span className="text-sm font-medium text-slate-700">{meta.label}</span>
      )}
    </div>
  );
}
