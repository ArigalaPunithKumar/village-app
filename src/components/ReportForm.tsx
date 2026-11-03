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

  // 1. Auto get full name and mobile number on mount
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
      setGpsStatus('GPS is not supported on this browser.');
      return;
    }

    setGpsLoading(true);
    setGpsStatus('Detecting your GPS location…');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          // OpenStreetMap Reverse Geocoding
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
            const village = addr.village || addr.town || addr.city || addr.county || 'Tirupati Area';
            const placeStr = [road, village].filter(Boolean).join(', ');

            const resolvedLocation = placeStr || `Near GPS (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
            setLocation(resolvedLocation);
            setGpsStatus(`📍 ${resolvedLocation}`);
          } else {
            const coordsStr = `GPS (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
            setLocation(coordsStr);
            setGpsStatus(`📍 ${coordsStr}`);
          }
        } catch {
          const coordsStr = `GPS Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
          setLocation(coordsStr);
          setGpsStatus(`📍 ${coordsStr}`);
        } finally {
          setGpsLoading(false);
        }
      },
      (geoErr) => {
        setGpsLoading(false);
        setGpsStatus('Could not get automatic GPS location. You can enter landmark manually.');
        console.warn('Geolocation error:', geoErr);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  // Image compressor & reader
  const handleImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please choose a valid image file (JPEG, PNG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Compress using Canvas
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

    // Validation
    if (!title.trim()) {
      setError('Please provide a title for the problem.');
      return;
    }
    if (!description.trim()) {
      setError('Please describe the problem in detail.');
      return;
    }
    if (!reporterName.trim()) {
      setError('Full name is required.');
      return;
    }

    // Phone is MANDATORY
    const cleanPhone = reporterPhone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setError('Please enter a valid 10-digit mobile number.');
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
          location: location.trim() || 'Village Location',
          reporter_name: reporterName.trim(),
          reporter_phone: cleanPhone,
          image_url: imageDataUrl || null,
        })
        .select('ticket_number')
        .single();

      setSubmitting(false);

      if (insertError || !data) {
        setError(insertError?.message || 'Something went wrong while submitting. Please try again.');
        return;
      }

      onSubmitted(data.ticket_number);
    } catch {
      setSubmitting(false);
      setError('Could not submit complaint. Please check your connection.');
    }
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 p-4 text-white shadow-md">
        <h1 className="text-lg font-bold">Report a Village Grievance</h1>
        <p className="mt-1 text-xs text-emerald-50">
          Your complaint will be submitted directly to the Gram Panchayat authority desk.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Category selector */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
          <label className="mb-2 block text-xs font-bold text-slate-700">
            Select Category <span className="text-rose-500">*</span>
          </label>
          <div className="-mx-2 flex gap-2 overflow-x-auto px-2 pb-1 scrollbar-hide">
            {(Object.keys(CATEGORY_META) as ComplaintCategory[]).map((cat) => {
              const meta = CATEGORY_META[cat];
              const active = category === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`flex shrink-0 flex-col items-center gap-1.5 rounded-2xl border p-2.5 transition-all ${
                    active
                      ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200 scale-105'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                  style={{ width: '74px' }}
                >
                  <CategoryIcon category={cat} size="sm" />
                  <span className="text-center text-[10px] font-bold leading-tight text-slate-700">
                    {meta.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Title & Description */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm space-y-3">
          <div>
            <label htmlFor="title" className="mb-1 block text-xs font-bold text-slate-700">
              Problem Title <span className="text-rose-500">*</span>
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="e.g. Broken water pipe near temple street"
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              required
            />
          </div>

          <div>
            <label htmlFor="description" className="mb-1 block text-xs font-bold text-slate-700">
              Description <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Provide exact details so officials can take swift action..."
              className="w-full resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              required
            />
          </div>

          {/* Priority */}
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">Urgency Level</label>
            <div className="grid grid-cols-4 gap-2">
              {(Object.keys(PRIORITY_META) as ComplaintPriority[]).map((p) => {
                const meta = PRIORITY_META[p];
                const active = priority === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-bold transition-all ${
                      active
                        ? `${meta.color} ring-2 ring-slate-400`
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Auto Location with GPS */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="location" className="block text-xs font-bold text-slate-700">
              Village Location / Landmark <span className="text-rose-500">*</span>
            </label>
            <button
              type="button"
              onClick={detectLocation}
              disabled={gpsLoading}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:underline disabled:opacity-50"
            >
              {gpsLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              {gpsLoading ? 'Detecting…' : 'Re-detect GPS'}
            </button>
          </div>

          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600" />
            <input
              id="location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Near Ram Temple, Thandlam"
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              required
            />
          </div>

          {gpsStatus && (
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 bg-emerald-50/80 rounded-lg px-2.5 py-1">
              <Navigation className="h-3 w-3 shrink-0" />
              {gpsStatus}
            </p>
          )}
        </div>

        {/* Photo Upload or Capture (No URL pasting allowed) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
          <label className="mb-1 block text-xs font-bold text-slate-700">
            Photo Proof <span className="text-slate-400 font-normal">(Capture or upload)</span>
          </label>
          <p className="mb-2 text-[11px] text-slate-500">
            Directly take a photo or select an image from your device.
          </p>

          {/* Hidden file inputs */}
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
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-emerald-400 bg-emerald-50/70 p-4 text-emerald-800 transition hover:bg-emerald-100/70 active:scale-95"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
                  <Camera className="h-5 w-5" />
                </div>
                <span className="text-xs font-bold">Take Photo</span>
                <span className="text-[10px] text-emerald-700/80">Open Camera</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-slate-700 transition hover:bg-slate-100 active:scale-95"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-700 text-white shadow-sm">
                  <UploadCloud className="h-5 w-5" />
                </div>
                <span className="text-xs font-bold">Choose File</span>
                <span className="text-[10px] text-slate-400">From Gallery</span>
              </button>
            </div>
          ) : (
            <div className="relative mt-2 overflow-hidden rounded-2xl border-2 border-emerald-500 bg-slate-900 shadow-sm">
              <img
                src={imageDataUrl}
                alt="Captured Proof"
                className="max-h-56 w-full object-cover"
              />
              <div className="absolute bottom-2 left-2 rounded-lg bg-black/70 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                ✓ Photo Attached
              </div>
              <button
                type="button"
                onClick={() => setImageDataUrl(null)}
                className="absolute right-2 top-2 rounded-full bg-rose-600 p-1.5 text-white shadow-lg transition hover:bg-rose-700 active:scale-90"
                title="Remove photo"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Reporter Info (Auto pre-filled) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-700">Citizen Reporter Details</h3>
            <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
              Auto-Loaded
            </span>
          </div>

          <div>
            <label htmlFor="name" className="mb-1 block text-xs font-semibold text-slate-700">
              Your Full Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="name"
                type="text"
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                maxLength={100}
                placeholder="Full name"
                className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="phone" className="mb-1 block text-xs font-semibold text-slate-700">
              Mobile Number <span className="text-rose-500">*</span>
            </label>
            <div className="flex gap-2">
              <span className="flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-600">
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
                  placeholder="10-digit mobile number"
                  className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3.5 text-sm font-semibold tracking-wider text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  required
                />
              </div>
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-medium text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
            <p>{error}</p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitting || reporterPhone.replace(/\D/g, '').length !== 10}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-700/25 transition hover:opacity-95 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Submitting Grievance…
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Submit Official Complaint
            </>
          )}
        </button>
      </form>
    </div>
  );
}

// ---- Success screen ----

export function ReportSuccess({
  ticketNumber,
  onClose,
}: {
  ticketNumber: string;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col items-center px-4 py-12 text-center">
      <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-xl shadow-emerald-600/30">
        <CheckCircle2 className="h-10 w-10 text-white" />
      </div>
      <h1 className="mt-5 text-xl font-black text-slate-900">Grievance Submitted!</h1>
      <p className="mt-2 text-xs leading-relaxed text-slate-500 max-w-[280px]">
        Your complaint has been registered in the Gram Panchayat portal. Officials have been notified.
      </p>

      <div className="mt-6 w-full max-w-[340px] rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50/50 p-5 shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
          Official Ticket ID
        </p>
        <p className="mt-1 text-2xl font-black tracking-tight text-emerald-950 font-mono">
          {ticketNumber}
        </p>
        <p className="mt-2 text-[11px] text-slate-500">
          Save this ticket number to track progress or verify action taken.
        </p>
      </div>

      <button
        onClick={onClose}
        className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[#0c4774] px-6 py-3 text-xs font-bold text-white shadow-md transition hover:bg-[#083659] active:scale-95"
      >
        <ChevronLeft className="h-4 w-4" />
        Return to Home
      </button>
    </div>
  );
}
