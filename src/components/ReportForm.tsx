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
  Copy,
  Check,
  Building2,
  AlertTriangle,
} from 'lucide-react';
import {
  supabase,
  type ComplaintCategory,
  type ComplaintPriority,
  fetchCurrentProfile,
} from '@/lib/supabase';
import CategoryIcon from './CategoryIcon';

interface ReportFormProps {
  onSubmitted: (ticketNumber: string) => void;
}

// Clean English category definitions
const CATEGORIES: { key: ComplaintCategory; label: string; icon: string }[] = [
  { key: 'water', label: 'Drinking Water', icon: 'Droplets' },
  { key: 'roads', label: 'Roads & Potholes', icon: 'Road' },
  { key: 'electricity', label: 'Electricity & Poles', icon: 'Zap' },
  { key: 'street_light', label: 'Street Lights', icon: 'Lightbulb' },
  { key: 'sanitation', label: 'Sanitation & Cleanliness', icon: 'Trash' },
  { key: 'drainage', label: 'Drainage & Sewage', icon: 'Waves' },
  { key: 'waste', label: 'Garbage Collection', icon: 'Recycle' },
  { key: 'other', label: 'Other Village Issue', icon: 'AlertCircle' },
];

const PRIORITIES: { key: ComplaintPriority; label: string; desc: string }[] = [
  { key: 'low', label: 'Low', desc: 'General maintenance' },
  { key: 'medium', label: 'Normal', desc: 'Standard attention' },
  { key: 'high', label: 'High', desc: 'Important issue' },
  { key: 'urgent', label: 'Urgent', desc: 'Emergency response' },
];

// Accurate Tandlam Grama Panchayat locations
const TANDLAM_AREAS = [
  'Tandlam Main Village',
  'Panchayat Office Road',
  'Gandhi Statue Center',
  'Water Tank Road',
  'Harijanawada',
  'BC Colony',
  'ZPH School Road',
  'Ramalayam Street',
  'Bazaar Street',
  'Primary Health Centre (PHC)',
];

export default function ReportForm({ onSubmitted }: ReportFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ComplaintCategory>('water');
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

  // Auto load profile details (name & phone)
  useEffect(() => {
    async function loadUser() {
      try {
        const stored = localStorage.getItem('palle_current_user');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.display_name && !reporterName) setReporterName(parsed.display_name);
          if (parsed.phone && !reporterPhone) setReporterPhone(parsed.phone);
        }
      } catch {}

      const p = await fetchCurrentProfile();
      if (p) {
        if (p.display_name && !reporterName) setReporterName(p.display_name);
        if (p.phone && !reporterPhone) setReporterPhone(p.phone);
      }
    }
    loadUser();
  }, []);

  // Accurate GPS Detection - Locates their actual real location
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setGpsStatus('GPS is not supported on this device.');
      return;
    }

    setGpsLoading(true);
    setGpsStatus('Detecting your GPS coordinates & address…');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        let resolvedLocation = `GPS (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`;

        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 6000);
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
            { signal: controller.signal, headers: { 'Accept-Language': 'en' } }
          );
          clearTimeout(timer);

          if (res.ok) {
            const data = await res.json();
            const addr = data.address || {};
            const street = addr.road || addr.street || addr.suburb || addr.neighbourhood || addr.residential || '';
            const locality = addr.village || addr.town || addr.city || addr.county || '';
            const district = addr.state_district || addr.county || '';
            const parts = [street, locality, district].filter(Boolean);
            if (parts.length > 0) {
              resolvedLocation = `${parts.join(', ')} (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
            }
          }
        } catch (err) {
          console.warn('Reverse geocoding error:', err);
        }

        setGpsLoading(false);
        setLocation(resolvedLocation);
        setGpsStatus(`📍 ${resolvedLocation}`);
      },
      (geoErr) => {
        setGpsLoading(false);
        setGpsStatus('GPS unavailable. Please check device location permissions.');
        console.warn('Geolocation notice:', geoErr);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Direct Photo Handling (No annoying repetitive modals!)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      setError('Please select an image smaller than 8MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setImageDataUrl(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Submit Complaint
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Please enter a brief complaint title.');
      return;
    }
    if (!description.trim()) {
      setError('Please describe the problem.');
      return;
    }
    const cleanPhone = reporterPhone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setError('Please enter a valid 10-digit mobile number so officials can contact you.');
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
          location: location.trim() || 'Tandlam Grama Panchayat',
          reporter_name: reporterName.trim() || 'Village Citizen',
          reporter_phone: cleanPhone,
          image_url: imageDataUrl || null,
        })
        .select('ticket_number')
        .single();

      setSubmitting(false);

      if (insertError || !data) {
        setError(insertError?.message || 'Failed to submit complaint. Please try again.');
        return;
      }

      onSubmitted(data.ticket_number);
    } catch {
      setSubmitting(false);
      setError('Connection error while submitting. Please try again.');
    }
  };

  return (
    <div className="space-y-4 pb-12 animate-fade-in">
      {/* Header */}
      <div className="rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-800 p-5 text-white shadow-lg shadow-emerald-950/15">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-emerald-200" />
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-100">
            Tandlam Grama Panchayat
          </span>
        </div>
        <h1 className="mt-1 text-xl font-black text-white">Report Grievance</h1>
        <p className="mt-0.5 text-xs text-emerald-100">
          File public issues directly to the Sarpanch and Panchayat Administration.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 1. Category Selector */}
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-xs">
          <label className="mb-2 block text-xs font-extrabold text-slate-800">
            1. Select Grievance Category
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => setCategory(cat.key)}
                className={`flex items-center gap-2 rounded-2xl border p-2.5 text-left transition ${
                  category === cat.key
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 bg-slate-50/50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="shrink-0">
                  <CategoryIcon category={cat.key} className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold leading-tight">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 2. Title & Description */}
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
          <div>
            <label className="mb-1 block text-xs font-extrabold text-slate-800">
              2. Complaint Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Drinking water pipeline leak near school"
              className="w-full rounded-2xl border border-slate-200 py-2.5 px-3.5 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-extrabold text-slate-800">
              Description <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide exact details of the problem so the Panchayat team can resolve it quickly..."
              className="w-full rounded-2xl border border-slate-200 py-2.5 px-3.5 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
              required
            />
          </div>
        </div>

        {/* 3. Priority Selector */}
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-xs">
          <label className="mb-2 block text-xs font-extrabold text-slate-800">
            3. Urgency Level
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {PRIORITIES.map((pri) => (
              <button
                key={pri.key}
                type="button"
                onClick={() => setPriority(pri.key)}
                className={`rounded-2xl border py-2 px-1 text-center transition ${
                  priority === pri.key
                    ? pri.key === 'urgent'
                      ? 'border-rose-600 bg-rose-50 text-rose-900 ring-2 ring-rose-500/20 font-black'
                      : pri.key === 'high'
                      ? 'border-orange-600 bg-orange-50 text-orange-900 ring-2 ring-orange-500/20 font-black'
                      : 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20 font-black'
                    : 'border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-100 text-xs'
                }`}
              >
                <div className="text-xs font-bold">{pri.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 4. Accurate Location Selector & GPS */}
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-rose-500" />
              <span>4. Location in Tandlam Panchayat</span>
            </label>

            {/* GPS Button */}
            <button
              type="button"
              disabled={gpsLoading}
              onClick={handleDetectLocation}
              className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 border border-emerald-200 hover:bg-emerald-100 active:scale-95 disabled:opacity-50"
            >
              {gpsLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Navigation className="h-3.5 w-3.5" />
              )}
              <span>{gpsLoading ? 'Detecting…' : 'Detect GPS'}</span>
            </button>
          </div>

          {gpsStatus && (
            <p className="text-[11px] font-semibold text-emerald-700 bg-emerald-50/80 px-3 py-1.5 rounded-xl border border-emerald-200">
              {gpsStatus}
            </p>
          )}

          {/* Location Input */}
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Select from below or type landmark/street"
            className="w-full rounded-2xl border border-slate-200 py-2.5 px-3.5 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
          />

          {/* Quick Select Real Tandlam Areas */}
          <div>
            <span className="text-[10px] font-extrabold uppercase text-slate-400">
              Quick Select Tandlam Area:
            </span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {TANDLAM_AREAS.map((area) => (
                <button
                  key={area}
                  type="button"
                  onClick={() => setLocation(area)}
                  className={`rounded-xl px-2.5 py-1 text-xs font-bold transition ${
                    location === area
                      ? 'bg-emerald-700 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {area}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 5. Direct Photo Upload (No Repetitive Modals) */}
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-xs">
          <label className="mb-2 block text-xs font-extrabold text-slate-800">
            5. Attach Photo (Optional)
          </label>

          {/* Hidden inputs */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />

          {imageDataUrl ? (
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-900">
              <img
                src={imageDataUrl}
                alt="Selected preview"
                className="max-h-56 w-full object-contain"
              />
              <button
                type="button"
                onClick={() => setImageDataUrl(null)}
                className="absolute right-2.5 top-2.5 rounded-full bg-black/70 p-1.5 text-white hover:bg-black transition active:scale-95"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-4 text-center text-slate-600 hover:bg-slate-100 active:scale-95 transition"
              >
                <Camera className="h-5 w-5 text-emerald-600" />
                <span className="text-xs font-bold">Take Photo</span>
                <span className="text-[10px] text-slate-400">Use Camera</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-4 text-center text-slate-600 hover:bg-slate-100 active:scale-95 transition"
              >
                <UploadCloud className="h-5 w-5 text-teal-600" />
                <span className="text-xs font-bold">Upload Image</span>
                <span className="text-[10px] text-slate-400">From Gallery</span>
              </button>
            </div>
          )}
        </div>

        {/* 6. Reporter Info */}
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
          <label className="block text-xs font-extrabold text-slate-800">
            6. Reporter Details (For Official Follow-up)
          </label>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-600">Your Name</label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                  placeholder="Citizen Name"
                  className="w-full rounded-2xl border border-slate-200 py-2 pl-9 pr-3 text-xs text-slate-900 outline-none transition focus:border-emerald-600"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-600">Mobile Number</label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="tel"
                  maxLength={10}
                  value={reporterPhone}
                  onChange={(e) => setReporterPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="10-digit number"
                  className="w-full rounded-2xl border border-slate-200 py-2 pl-9 pr-3 text-xs text-slate-900 outline-none transition focus:border-emerald-600"
                  required
                />
              </div>
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-semibold text-rose-800 animate-fade-in">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
            <p>{error}</p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitting || reporterPhone.replace(/\D/g, '').length !== 10}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 px-5 py-4 text-sm font-extrabold text-white shadow-lg shadow-emerald-700/25 transition-all hover:opacity-95 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Submitting Grievance…
            </>
          ) : (
            <>
              <Send className="h-5 w-5" />
              Submit Grievance to Panchayat
            </>
          )}
        </button>
      </form>
    </div>
  );
}

// Success Screen
export function ReportSuccess({
  ticketNumber,
  onViewAll,
  onNewReport,
}: {
  ticketNumber: string;
  onViewAll?: () => void;
  onNewReport?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyTicket = () => {
    navigator.clipboard.writeText(ticketNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-center px-4 py-8 text-center animate-slide-up space-y-4">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-xl shadow-emerald-600/30">
        <CheckCircle2 className="h-10 w-10 text-white" />
      </div>

      <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
        <span>Grievance Registered Successfully</span>
      </div>

      <h1 className="text-xl font-black text-slate-900">Submitted to Tandlam Panchayat</h1>
      <p className="text-xs text-slate-600 max-w-xs">
        Your issue has been recorded and transmitted to the Sarpanch and Panchayat Administration.
      </p>

      {/* Ticket Card */}
      <div className="w-full max-w-xs rounded-3xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-2xs">
        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
          Complaint Ticket ID
        </p>
        <div className="mt-2 flex items-center justify-center gap-2">
          <span className="text-2xl font-black tracking-tight text-emerald-950 font-mono">
            {ticketNumber}
          </span>
          <button
            type="button"
            onClick={copyTicket}
            className="rounded-xl bg-white p-2 text-slate-600 shadow-2xs border border-slate-200 hover:text-emerald-700 active:scale-90"
            title="Copy Ticket"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
        <p className="mt-1.5 text-[10px] text-slate-500">
          Save this ticket number to track live status updates.
        </p>
      </div>

      <div className="w-full max-w-xs space-y-2 pt-2">
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="w-full rounded-2xl bg-emerald-700 py-3 text-xs font-extrabold text-white shadow-md hover:bg-emerald-800 transition active:scale-95"
          >
            View Complaints List
          </button>
        )}
        {onNewReport && (
          <button
            onClick={onNewReport}
            className="w-full rounded-2xl border border-slate-200 bg-white py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 transition active:scale-95"
          >
            Report Another Issue
          </button>
        )}
      </div>
    </div>
  );
}
