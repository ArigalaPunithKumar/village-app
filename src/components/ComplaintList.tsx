import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Loader2,
  Inbox,
  ArrowUpDown,
  ThumbsUp,
  MapPin,
  SlidersHorizontal,
} from 'lucide-react';
import {
  supabase,
  CATEGORY_META,
  STATUS_META,
  type Complaint,
  type ComplaintCategory,
  type ComplaintStatus,
} from '@/lib/supabase';
import CategoryIcon from './CategoryIcon';
import StatusBadge from './StatusBadge';
import PriorityBadge from './PriorityBadge';

interface ComplaintListProps {
  onSelectComplaint: (id: number) => void;
}

type SortKey = 'newest' | 'oldest' | 'upvotes';

const STATUS_PILLS: (ComplaintStatus | 'all')[] = [
  'all',
  'pending',
  'under_review',
  'in_progress',
  'resolved',
  'rejected',
];

export default function ComplaintList({ onSelectComplaint }: ComplaintListProps) {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ComplaintStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<ComplaintCategory | 'all'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('newest');
  const [showFilters, setShowFilters] = useState(false);
  const [upvotedIds, setUpvotedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('complaints')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) setComplaints(data as Complaint[]);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    let result = complaints;
    if (statusFilter !== 'all') result = result.filter((c) => c.status === statusFilter);
    if (categoryFilter !== 'all') result = result.filter((c) => c.category === categoryFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.ticket_number.toLowerCase().includes(q) ||
          (c.location ?? '').toLowerCase().includes(q),
      );
    }
    const sorted = [...result];
    if (sortKey === 'newest') sorted.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    if (sortKey === 'oldest') sorted.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
    if (sortKey === 'upvotes') sorted.sort((a, b) => b.upvotes - a.upvotes);
    return sorted;
  }, [complaints, statusFilter, categoryFilter, search, sortKey]);

  const handleUpvote = async (id: number) => {
    if (upvotedIds.has(id)) return;
    setUpvotedIds((prev) => new Set(prev).add(id));
    setComplaints((prev) =>
      prev.map((c) => (c.id === id ? { ...c, upvotes: c.upvotes + 1 } : c)),
    );
    await supabase.rpc('increment_complaint_upvote', { p_complaint_id: id });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search + filter toggle */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search complaints..."
            className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
        </div>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border transition-colors ${
            showFilters || categoryFilter !== 'all' || sortKey !== 'newest'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-600'
              : 'border-slate-200 bg-white text-slate-500'
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      </div>

      {/* Status pills - horizontal scroll */}
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 scrollbar-hide">
        {STATUS_PILLS.map((s) => {
          const active = statusFilter === s;
          const label = s === 'all' ? 'All' : STATUS_META[s as ComplaintStatus].label;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors ${
                active
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-500 border border-slate-200'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Expandable filters */}
      {showFilters && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-500">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as ComplaintCategory | 'all')}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            >
              <option value="all">All Categories</option>
              {(Object.keys(CATEGORY_META) as ComplaintCategory[]).map((c) => (
                <option key={c} value={c}>{CATEGORY_META[c].label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-slate-500">
              <ArrowUpDown className="h-3 w-3" /> Sort by
            </label>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="upvotes">Most Upvoted</option>
            </select>
          </div>
        </div>
      )}

      {/* Count */}
      <p className="text-[11px] text-slate-400">
        {filtered.length} of {complaints.length} complaints
      </p>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white py-14 text-center">
          <Inbox className="h-10 w-10 text-slate-300" />
          <p className="mt-2.5 text-[13px] font-medium text-slate-600">No complaints found</p>
          <p className="mt-0.5 text-[11px] text-slate-400">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelectComplaint(c.id)}
              className="w-full rounded-2xl border border-slate-200 bg-white p-3.5 text-left shadow-sm transition-all active:scale-[0.98]"
            >
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex min-w-0 items-start gap-2.5">
                  <CategoryIcon category={c.category} size="sm" />
                  <div className="min-w-0">
                    <h3 className="line-clamp-2 text-[13px] font-semibold text-slate-900">
                      {c.title}
                    </h3>
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">
                      {c.description}
                    </p>
                  </div>
                </div>
                <StatusBadge status={c.status} size="sm" />
              </div>

              {c.location && (
                <div className="mt-2 inline-flex items-center gap-0.5 text-[10px] text-slate-400">
                  <MapPin className="h-2.5 w-2.5" />
                  {c.location}
                </div>
              )}

              <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2.5">
                <span className="font-mono text-[10px] text-slate-400">{c.ticket_number}</span>
                <div className="flex items-center gap-1.5">
                  <PriorityBadge priority={c.priority} size="sm" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUpvote(c.id);
                    }}
                    disabled={upvotedIds.has(c.id)}
                    className={`inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                      upvotedIds.has(c.id)
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-slate-50 text-slate-500'
                    }`}
                  >
                    <ThumbsUp className="h-2.5 w-2.5" />
                    {c.upvotes}
                  </button>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
