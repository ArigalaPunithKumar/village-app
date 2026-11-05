import { useState, useEffect, useRef } from 'react';
import {
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  MapPin,
  User,
  Phone,
  Camera,
  UploadCloud,
  X,
  ChevronLeft,
  Navigation,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react';
import {
  supabase,
  CATEGORY_META,
  PRIORITY_META,
  fetchCurrentProfile,
  type ComplaintCategory,
  type ComplaintPriority,
} from '@/lib/supabase';
import CategoryIcon from './CategoryIcon';

interface ReportFormProps {
  onSubmitted: (ticketNumber: string) => void;
}

// Village friendly category labels with Telugu
const TELUGU_CATEGORY_LABELS: Record<ComplaintCategory, { en: string; te: string }> = {
  roads: { en: 'Roads & Potholes', te: 'రోడ్లు & గుంతలు' },
  water: { en: 'Water Supply', te: 'తాగునీటి సరఫరా' },
  electricity: { en: 'Electricity', te: 'కరెంట్ & స్తంభాలు' },
  sanitation: { en: 'Sanitation', te: 'పారిశుధ్యం & డ్రైనేజ్' },
  street_light: { en: 'Street Lights', te: 'వీధి లైట్లు' },
  drainage: { en: 'Drainage', te: 'మురుగు కాలువలు' },
  waste: { en: 'Garbage & Waste', te: 'చెత్త సేకరణ' },
  other: { en: 'Other Village Issue', te: 'ఇతర గ్రామ సమస్య' },
};

// Village friendly priority labels with Telugu
const TELUGU_PRIORITY_LABELS: Record<ComplaintPriority, { en: string; te: string }> = {
  low: { en: 'Low', te: 'సాధారణం' },
  medium: { en: 'Normal', te: 'మధ్యస్థం' },
  high: { en: 'High', te: 'ముఖ్యమైనది' },
  urgent: { en: 'Urgent', te: 'అత్యవసరం' },
};

export default function ReportForm({ onSubmitted }: ReportFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ComplaintCategory>('roads');
  const [priority, setPriority] = useState<ComplaintPriority>('medium');
  const [location, setLocation] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [reporterPhone, setReporterPhone] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);

  // Statuses
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // 1. Auto load profile details
  useEffect(() => {
    async function loadUser() {
      const p = await fetchCurrentProfile();
      if (p) {
        if (p.display_name && !reporterName) setReporterName(p.display_name);
        if (p.phone && !reporterPhone) setReporterPhone(p.phone);
      }
    }
    loadUser();
  }, []);

  // 2. Auto detect location on mount
  useEffect(() => {
    detectLocation();
  }, []);

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setGpsStatus('లొకేషన్ సపోర్ట్ లేదు (Location not supported)');
      return;
    }

    setGpsLoading(true);
    setGpsStatus('మీ లొకేషన్ వెతుకుతున్నాము… (Finding your location…)');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 6000);
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
            { signal: controller.signal }
          );
          clearTimeout(timeoutId);

          if (res.ok) {
            const data = await res.json();
            const addr = data.address || {};
            const road = addr.road || addr.suburb || addr.neighbourhood || '';
            const village = addr.village || addr.town || addr.city || addr.county || 'తండ్లం (Thandlam)';
            const placeStr = [road, village].filter(Boolean).join(', ');

            const resolvedLocation = placeStr || `తండ్లం పంచాయతీ (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
            setLocation(resolvedLocation);
            setGpsStatus(`📍 ${resolvedLocation}`);
          } else {
            const coordsStr = `తండ్లం పంచాయతీ పరిధి (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
            setLocation(coordsStr);
            setGpsStatus(`📍 ${coordsStr}`);
          }
        } catch {
          const coordsStr = `తండ్లం పంచాయతీ పరిధి (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
          setLocation(coordsStr);
          setGpsStatus(`📍 ${coordsStr}`);
        } finally {
          setGpsLoading(false);
        }
      },
      (geoErr) => {
        setGpsLoading(false);
        setGpsStatus('లొకేషన్ ఆటోమేటిక్‌గా రాలేదు. కింద ఉన్న బాక్స్‌లో మీ వీధి పేరు రాయండి.');
        console.warn('Geolocation warning:', geoErr);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  // Image compressor & reader
  const handleImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('దయచేసి సరైన ఫోటోను ఎంచుకోండి (JPEG, PNG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.78);
          setImageDataUrl(compressedDataUrl);
          setError(null);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('దయచేసి సమస్య పేరును రాయండి (Please enter problem title).');
      return;
    }
    if (!description.trim()) {
      setError('దయచేసి సమస్య వివరాలను రాయండి (Please describe the problem).');
      return;
    }
    if (!reporterName.trim()) {
      setError('మీ పూర్తి పేరు అవసరం (Full name is required).');
      return;
    }

    const cleanPhone = reporterPhone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setError('దయచేసి మీ 10 అంకెల మొబైల్ నంబర్ రాయండి (Enter 10-digit mobile number).');
      return;
    }

    setSubmitting(true);

    try {
      const { data, error: insertError } = await supabase
        .from('complaints')
        .insert({
          title: title.trim(),
          description: description.trim(),
          category,
          priority,
          location: location.trim() || 'తండ్లం గ్రామ పంచాయతీ',
          reporter_name: reporterName.trim(),
          reporter_phone: cleanPhone,
          image_url: imageDataUrl || null,
        })
        .select('ticket_number')
        .single();

      setSubmitting(false);

      if (insertError || !data) {
        setError(insertError?.message || 'సమస్యను పంపడంలో సమస్య ఏర్పడింది. మళ్ళీ ప్రయత్నించండి.');
        return;
      }

      onSubmitted(data.ticket_number);
    } catch {
      setSubmitting(false);
      setError('ఇంటర్నెట్ కనెక్షన్ సరిగ్గా ఉందో లేదో చూడండి.');
    }
  };

  return (
    <div className="space-y-4 pb-14 animate-slide-up">
      {/* Village Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-800 p-4 text-white shadow-lg">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold tracking-wider backdrop-blur-sm">
            <span>తండ్లం పంచాయతీ ప్రజా ఫిర్యాదు</span>
          </div>
          <h1 className="mt-1.5 text-base font-extrabold tracking-tight sm:text-lg">
            సమస్యను నివేదించండి • Report Issue
          </h1>
          <p className="mt-0.5 text-xs text-emerald-100">
            మీ సమస్య నేరుగా గ్రామ పంచాయతీ అధికారుల డెస్క్‌కు చేరుతుంది.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 1. Category selector */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all hover:shadow-md">
          <div className="mb-2.5 flex items-center justify-between">
            <div>
              <label className="block text-xs font-bold text-slate-800">
                సమస్య రకం • Select Category <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-slate-500">మీ సమస్య దేనికి సంబంధించిందో ఎంచుకోండి</span>
            </div>
          </div>

          <div className="-mx-2 flex gap-2.5 overflow-x-auto px-2 pb-1.5 scrollbar-hide">
            {(Object.keys(CATEGORY_META) as ComplaintCategory[]).map((cat) => {
              const active = category === cat;
              const labels = TELUGU_CATEGORY_LABELS[cat] || { en: cat, te: cat };
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`flex shrink-0 flex-col items-center justify-center gap-1.5 rounded-2xl border p-2.5 transition-all duration-200 active:scale-95 ${
                    active
                      ? 'border-emerald-600 bg-emerald-50/90 text-emerald-950 ring-2 ring-emerald-400 scale-[1.03] shadow-xs'
                      : 'border-slate-200 bg-slate-50/70 text-slate-700 hover:bg-slate-100'
                  }`}
                  style={{ width: '84px', minHeight: '84px' }}
                >
                  <CategoryIcon category={cat} size="sm" />
                  <span className="text-center text-[10px] font-extrabold leading-tight">
                    {labels.te}
                  </span>
                  <span className="text-center text-[9px] font-semibold text-slate-500 leading-none">
                    {labels.en}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Problem Title & Description */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm space-y-3.5">
          <div>
            <label htmlFor="title" className="mb-1 block text-xs font-bold text-slate-800">
              సమస్య పేరు • What is the Problem? <span className="text-rose-500">*</span>
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="ఉదా: రామాలయం వీధిలో వీధి లైటు వెలగడం లేదు"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
              required
            />
          </div>

          <div>
            <label htmlFor="description" className="mb-1 block text-xs font-bold text-slate-800">
              వివరాలు • Detailed Description <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="అధికారులు వెంటనే పరిష్కరించేందుకు సమస్య పూర్తి వివరాలు రాయండి..."
              className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
              required
            />
          </div>

          {/* Urgency */}
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-800">
              ఎంత అత్యవసరం? • Urgency Level
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {(Object.keys(PRIORITY_META) as ComplaintPriority[]).map((p) => {
                const meta = PRIORITY_META[p];
                const active = priority === p;
                const pLabels = TELUGU_PRIORITY_LABELS[p];
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`flex flex-col items-center justify-center rounded-xl border py-2 px-1 text-center transition-all active:scale-95 ${
                      active
                        ? `${meta.color} ring-2 ring-emerald-500 font-bold scale-[1.02] shadow-xs`
                        : 'border-slate-200 bg-slate-50/60 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="text-[11px] font-bold leading-tight">{pLabels.te}</span>
                    <span className="text-[9px] text-slate-500">{pLabels.en}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 3. Location - Simple Village Friendly (No complex jargon) */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm space-y-2.5">
          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="location" className="block text-xs font-bold text-slate-800">
                సమస్య ఉన్న చోటు • Location / Street <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-slate-500">మీ వీధి లేదా దగ్గరలోని ల్యాండ్‌మార్క్</span>
            </div>

            {/* Simple Location Refresh Button */}
            <button
              type="button"
              onClick={detectLocation}
              disabled={gpsLoading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-800 shadow-2xs transition active:scale-95 disabled:opacity-50"
            >
              {gpsLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 text-emerald-600" />
              )}
              {gpsLoading ? 'చూస్తున్నాము…' : '📍 లొకేషన్ మార్చండి'}
            </button>
          </div>

          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600 animate-pulse" />
            <input
              id="location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="ఉదా: రామాలయం వీధి, తండ్లం"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-3.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
              required
            />
          </div>

          {gpsStatus && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50/90 px-3 py-1.5 text-[11px] font-bold text-emerald-900 border border-emerald-100">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="truncate">{gpsStatus}</span>
            </div>
          )}
        </div>

        {/* 4. Photo Proof (Capture or Upload with Large Touch Targets) */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="mb-2">
            <label className="block text-xs font-bold text-slate-800">
              సమస్య ఫోటో • Photo Proof <span className="text-slate-400 font-normal">(ఐచ్ఛికం)</span>
            </label>
            <p className="text-[10px] text-slate-500">
              కెమెరాతో నేరుగా ఫోటో తీయండి లేదా గ్యాలరీ నుండి ఎంచుకోండి.
            </p>
          </div>

          {/* Hidden inputs */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) handleImageFile(e.target.files[0]);
            }}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) handleImageFile(e.target.files[0]);
            }}
          />

          {!imageDataUrl ? (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-emerald-400 bg-emerald-50/80 p-4 text-emerald-900 transition-all hover:bg-emerald-100 active:scale-95 shadow-2xs"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-700/20">
                  <Camera className="h-5 w-5" />
                </div>
                <div className="text-center">
                  <span className="block text-xs font-black">ఫోటో తీయండి</span>
                  <span className="text-[10px] text-emerald-700">Open Camera</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-slate-700 transition-all hover:bg-slate-100 active:scale-95 shadow-2xs"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-700 text-white shadow-md">
                  <UploadCloud className="h-5 w-5" />
                </div>
                <div className="text-center">
                  <span className="block text-xs font-black">గ్యాలరీ నుండి</span>
                  <span className="text-[10px] text-slate-500">From Gallery</span>
                </div>
              </button>
            </div>
          ) : (
            <div className="relative mt-2 overflow-hidden rounded-2xl border-2 border-emerald-500 bg-slate-900 shadow-md">
              <img
                src={imageDataUrl}
                alt="Captured Proof"
                className="max-h-60 w-full object-cover"
              />
              <div className="absolute bottom-2 left-2 rounded-xl bg-black/75 px-3 py-1 text-xs font-bold text-white backdrop-blur-sm">
                ✓ ఫోటో జతచేయబడింది (Photo Attached)
              </div>
              <button
                type="button"
                onClick={() => setImageDataUrl(null)}
                className="absolute right-2 top-2 rounded-full bg-rose-600 p-2 text-white shadow-lg transition hover:bg-rose-700 active:scale-90"
                title="Remove photo"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* 5. Citizen Details (Auto-loaded) */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-800">ఫిర్యాదుదారుని వివరాలు • Reporter Details</h3>
              <span className="text-[10px] text-slate-500">అధికారులు సంప్రదించడానికి</span>
            </div>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
              ఆటోమేటిక్
            </span>
          </div>

          <div>
            <label htmlFor="name" className="mb-1 block text-xs font-semibold text-slate-700">
              మీ పేరు • Full Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="name"
                type="text"
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                maxLength={100}
                placeholder="మీ పూర్తి పేరు"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-3.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="phone" className="mb-1 block text-xs font-semibold text-slate-700">
              మొబైల్ నంబర్ • Mobile Number <span className="text-rose-500">*</span>
            </label>
            <div className="flex gap-2">
              <span className="flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 px-3 text-xs font-bold text-slate-700">
                +91
              </span>
              <div className="relative flex-1">
                <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="phone"
                  type="tel"
                  maxLength={10}
                  value={reporterPhone}
                  onChange={(e) => setReporterPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="10 అంకెల మొబైల్ నంబర్"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-3.5 text-sm font-bold tracking-wider text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                  required
                />
              </div>
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-medium text-rose-700 animate-fade-in">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
            <p className="leading-relaxed">{error}</p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitting || reporterPhone.replace(/\D/g, '').length !== 10}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 px-5 py-4 text-sm font-extrabold text-white shadow-lg shadow-emerald-700/25 transition-all duration-200 hover:opacity-95 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              సమర్పిస్తున్నాము… (Submitting…)
            </>
          ) : (
            <>
              <Send className="h-5 w-5" />
              సమస్యను పంపండి • Submit Complaint
            </>
          )}
        </button>
      </form>
    </div>
  );
}

// ---- Village Friendly Success Screen ----

export function ReportSuccess({
  ticketNumber,
  onClose,
}: {
  ticketNumber: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyTicket = () => {
    navigator.clipboard.writeText(ticketNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-center px-4 py-8 text-center animate-slide-up">
      <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-xl shadow-emerald-600/30 animate-pulse-glow">
        <CheckCircle2 className="h-10 w-10 text-white" />
      </div>

      <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
        <span>✓ సమస్య నమోదు పూర్తయింది</span>
      </div>

      <h1 className="mt-2 text-xl font-black text-slate-900">
        Grievance Submitted!
      </h1>
      <p className="mt-1 text-xs leading-relaxed text-slate-600 max-w-[300px]">
        మీ ఫిర్యాదు తండ్లం గ్రామ పంచాయతీ పోర్టల్‌లో నమోదైంది. సంబంధిత అధికారి త్వరలో పరిశీలిస్తారు.
      </p>

      {/* Ticket Card */}
      <div className="mt-5 w-full max-w-[340px] rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-teal-50/50 to-white p-5 shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
          మీ ఫిర్యాదు నంబర్ • Ticket ID
        </p>
        <div className="mt-2 flex items-center justify-center gap-2">
          <span className="text-2xl font-black tracking-tight text-emerald-950 font-mono">
            {ticketNumber}
          </span>
          <button
            type="button"
            onClick={copyTicket}
            className="rounded-xl bg-white p-2 text-slate-600 shadow-xs border border-slate-200 hover:text-emerald-700 active:scale-90"
            title="Copy Ticket"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          స్టేటస్ తెలుసుకోవడానికి ఈ నంబర్‌ను భద్రపరుచుకోండి.
        </p>
      </div>

      <button
        onClick={onClose}
        className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-700 to-teal-800 px-7 py-3.5 text-xs font-extrabold text-white shadow-md transition-all active:scale-95"
      >
        <ChevronLeft className="h-4 w-4" />
        హోమ్ స్క్రీన్‌కు వెళ్లండి • Return Home
      </button>
    </div>
  );
}
