import { useCallback, useEffect, useState } from 'react';
import { Bell, Building2, CalendarDays, Check, CircleAlert, ImagePlus, Loader2, MapPin, Megaphone, MessageSquareText, Plus, Send, Vote, X } from 'lucide-react';
import { supabase, type UserRole } from '@/lib/supabase';

interface CommunityScreenProps {
  userId: string;
  role: UserRole;
  onOpenOfficials: () => void;
}

interface Announcement {
  id: number;
  author_id: string;
  title: string;
  body: string;
  image_url: string | null;
  is_emergency: boolean;
  published_at: string;
}

interface Poll {
  id: number;
  question: string;
  options: string[];
  closes_at: string | null;
  created_at: string;
  poll_votes: Array<{ voter_id: string; option_index: number }>;
}

interface VillageEvent {
  id: number;
  title: string;
  description: string;
  location: string | null;
  starts_at: string;
}

interface Notice {
  id: number;
  title: string;
  body: string;
  kind: string;
  entity_id: string | null;
  created_at: string;
  read_at: string | null;
}

export default function CommunityScreen({ userId, role, onOpenOfficials }: CommunityScreenProps) {
  const isStaff = role === 'sarpanch' || role === 'admin';
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [events, setEvents] = useState<VillageEvent[]>([]);
  const [notifications, setNotifications] = useState<Notice[]>([]);
  const [feedback, setFeedback] = useState<Array<{ id: number; message: string; created_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');
  const [announcementImage, setAnnouncementImage] = useState('');
  const [emergency, setEmergency] = useState(false);
  const [editAnnouncement, setEditAnnouncement] = useState<number | null>(null);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [feedbackText, setFeedbackText] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventDate, setEventDate] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    const [announcementsResult, pollsResult, eventsResult, notificationsResult, feedbackResult] = await Promise.all([
      supabase.from('announcements').select('id,author_id,title,body,image_url,is_emergency,published_at').is('deleted_at', null).order('published_at', { ascending: false }),
      supabase.from('village_polls').select('id,question,options,closes_at,created_at,poll_votes(voter_id,option_index)').is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('village_events').select('id,title,description,location,starts_at').is('deleted_at', null).gte('starts_at', new Date().toISOString()).order('starts_at'),
      supabase.from('notifications').select('id,title,body,kind,entity_id,created_at,read_at').order('created_at', { ascending: false }).limit(20),
      isStaff ? supabase.from('citizen_feedback').select('id,message,created_at').is('deleted_at', null).order('created_at', { ascending: false }).limit(30) : Promise.resolve({ data: [] as Array<{ id: number; message: string; created_at: string }>, error: null }),
    ]);
    const firstError = announcementsResult.error || pollsResult.error || eventsResult.error || notificationsResult.error || feedbackResult.error;
    if (firstError) setError(firstError.message);
    setAnnouncements((announcementsResult.data ?? []) as Announcement[]);
    setPolls((pollsResult.data ?? []) as unknown as Poll[]);
    setEvents((eventsResult.data ?? []) as VillageEvent[]);
    let notificationPreferences: Record<string, boolean> = {};
    try { notificationPreferences = JSON.parse(localStorage.getItem('palle_preferences') || '{}').notifications || {}; } catch { /* use all notices */ }
    const allowedKinds: Record<string, boolean> = {
      complaint: notificationPreferences.complaints !== false,
      announcement: notificationPreferences.announcements !== false,
      emergency: notificationPreferences.emergency !== false,
      poll: notificationPreferences.polls !== false,
      event: notificationPreferences.announcements !== false,
      feedback: true,
      account: true,
      system: true,
    };
    setNotifications(((notificationsResult.data ?? []) as Notice[]).filter((notice) => allowedKinds[notice.kind] !== false));
    setFeedback((feedbackResult.data ?? []) as Array<{ id: number; message: string; created_at: string }>);
    setLoading(false);
  }, [isStaff]);

  useEffect(() => { void loadData(); }, [loadData]);

  const saveAnnouncement = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError(''); setMessage('');
    const payload = { title: announcementTitle.trim(), body: announcementBody.trim(), image_url: announcementImage.trim() || null, is_emergency: emergency, updated_at: new Date().toISOString() };
    const result = editAnnouncement
      ? await supabase.from('announcements').update(payload).eq('id', editAnnouncement)
      : await supabase.from('announcements').insert({ ...payload, author_id: userId });
    setBusy(false);
    if (result.error) return setError(result.error.message);
    setAnnouncementTitle(''); setAnnouncementBody(''); setAnnouncementImage(''); setEmergency(false); setEditAnnouncement(null);
    setMessage(editAnnouncement ? 'Announcement updated.' : emergency ? 'Emergency notice published and citizens notified.' : 'Announcement published and citizens notified.');
    await loadData();
  };

  const editExistingAnnouncement = (item: Announcement) => {
    setEditAnnouncement(item.id);
    setAnnouncementTitle(item.title);
    setAnnouncementBody(item.body);
    setAnnouncementImage(item.image_url || '');
    setEmergency(item.is_emergency);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const archiveAnnouncement = async (item: Announcement) => {
    if (!window.confirm(`Remove “${item.title}” from village notices?`)) return;
    const { error: archiveError } = await supabase.from('announcements').update({ deleted_at: new Date().toISOString() }).eq('id', item.id);
    if (archiveError) setError(archiveError.message);
    else { setMessage('Announcement removed.'); await loadData(); }
  };

  const handleAnnouncementImage = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return setError('Choose an image file.');
    if (file.size > 1_500_000) return setError('Choose an image smaller than 1.5 MB.');
    const reader = new FileReader();
    reader.onload = () => setAnnouncementImage(String(reader.result || ''));
    reader.onerror = () => setError('Could not read the selected image.');
    reader.readAsDataURL(file);
  };

  const publishPoll = async (event: React.FormEvent) => {
    event.preventDefault();
    const options = pollOptions.map((option) => option.trim()).filter(Boolean);
    if (options.length < 2) return setError('Add at least two poll options.');
    setBusy(true); setError('');
    const { error: pollError } = await supabase.from('village_polls').insert({ author_id: userId, question: pollQuestion.trim(), options });
    setBusy(false);
    if (pollError) return setError(pollError.message);
    setPollQuestion(''); setPollOptions(['', '']); setMessage('Poll published.'); await loadData();
  };

  const castVote = async (poll: Poll, optionIndex: number) => {
    setBusy(true); setError('');
    const { error: voteError } = await supabase.rpc('vote_in_poll', { p_poll_id: poll.id, p_option_index: optionIndex });
    setBusy(false);
    if (voteError) return setError(voteError.message);
    setMessage('Your vote has been recorded.'); await loadData();
  };

  const sendFeedback = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError('');
    const { error: feedbackError } = await supabase.from('citizen_feedback').insert({ author_id: userId, message: feedbackText.trim() });
    setBusy(false);
    if (feedbackError) return setError(feedbackError.message);
    setFeedbackText(''); setMessage('Your suggestion was sent to the Sarpanch.');
  };

  const publishEvent = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError('');
    const { error: eventError } = await supabase.from('village_events').insert({
      author_id: userId, title: eventTitle.trim(), description: eventDescription.trim(),
      location: eventLocation.trim() || null, starts_at: new Date(eventDate).toISOString(),
    });
    setBusy(false);
    if (eventError) return setError(eventError.message);
    setEventTitle(''); setEventDescription(''); setEventLocation(''); setEventDate('');
    setMessage('Village event added.'); await loadData();
  };

  const markRead = async (notice: Notice) => {
    if (notice.read_at) return;
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', notice.id);
    setNotifications((current) => current.map((item) => item.id === notice.id ? { ...item, read_at: new Date().toISOString() } : item));
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-12 animate-fade-in">
      <header className="rounded-3xl bg-gradient-to-br from-emerald-800 via-teal-800 to-slate-900 p-5 text-white shadow-lg sm:p-7">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold"><Megaphone className="h-3.5 w-3.5" />Tandlam community</span>
        <h1 className="mt-3 text-2xl font-black">Village notices &amp; engagement</h1>
        <p className="mt-1 max-w-2xl text-sm text-emerald-100">Announcements, community activities, public polls, and a direct line for your suggestions.</p>
      </header>

      {(error || message) && <div role={error ? 'alert' : 'status'} className={`flex gap-2 rounded-2xl border p-3 text-sm ${error ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{error ? <CircleAlert className="h-4 w-4 shrink-0" /> : <Check className="h-4 w-4 shrink-0" />}{error || message}</div>}

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,.8fr)]">
        <div className="space-y-5">
          {isStaff && (
            <form onSubmit={saveAnnouncement} className="space-y-3 rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-bold text-slate-900"><Megaphone className="h-4 w-4 text-emerald-700" />{editAnnouncement ? 'Edit announcement' : 'Publish announcement'}</h2>{editAnnouncement && <button type="button" onClick={() => { setEditAnnouncement(null); setAnnouncementTitle(''); setAnnouncementBody(''); }} aria-label="Cancel edit"><X className="h-4 w-4" /></button>}</div>
              <input required minLength={3} maxLength={120} value={announcementTitle} onChange={(event) => setAnnouncementTitle(event.target.value)} placeholder="Notice title" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
              <textarea required minLength={3} maxLength={5000} rows={3} value={announcementBody} onChange={(event) => setAnnouncementBody(event.target.value)} placeholder="Share meeting details, public services, or an important update" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-600"><ImagePlus className="h-4 w-4" />Add image<input type="file" accept="image/*" onChange={(event) => handleAnnouncementImage(event.target.files?.[0])} className="min-w-0 flex-1 text-[10px]" /></label>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">Image URL<input type="url" value={announcementImage.startsWith('data:') ? '' : announcementImage} onChange={(event) => setAnnouncementImage(event.target.value)} placeholder="https://…" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 py-2" /></label>
              </div>
              {announcementImage && <img src={announcementImage} alt="Announcement preview" className="max-h-48 rounded-xl object-cover" />}
              <label className="flex items-center gap-2 rounded-xl bg-rose-50 p-2.5 text-xs font-bold text-rose-800"><input type="checkbox" checked={emergency} onChange={(event) => setEmergency(event.target.checked)} />Emergency alert — send an urgent citizen notification</label>
              <button disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{editAnnouncement ? 'Save changes' : 'Publish to village'}</button>
            </form>
          )}

          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-black text-slate-900"><Bell className="h-5 w-5 text-emerald-700" />Village announcements <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">{announcements.length}</span></h2>
            {loading ? <LoadingLine /> : announcements.length === 0 ? <EmptyCard text="There are no announcements yet." /> : announcements.map((item) => (
              <article key={item.id} className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${item.is_emergency ? 'border-rose-300 ring-1 ring-rose-100' : 'border-slate-200'}`}>
                {item.image_url && <img src={item.image_url} alt="Announcement" className="max-h-72 w-full object-cover" />}
                <div className="p-4">
                  <div className="flex flex-wrap items-center gap-2">{item.is_emergency && <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-1 text-[10px] font-black uppercase text-rose-800"><CircleAlert className="h-3 w-3" />Emergency</span>}<h3 className="font-bold text-slate-900">{item.title}</h3></div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{item.body}</p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400"><span>{new Date(item.published_at).toLocaleString()}</span>{isStaff && (item.author_id === userId || role === 'admin') && <span className="flex gap-2"><button onClick={() => editExistingAnnouncement(item)} className="font-bold text-emerald-800">Edit</button><button onClick={() => void archiveAnnouncement(item)} className="font-bold text-rose-700">Remove</button></span>}</div>
                </div>
              </article>
            ))}
          </section>

          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-black text-slate-900"><CalendarDays className="h-5 w-5 text-blue-700" />Upcoming village events</h2>
            {isStaff && <form onSubmit={publishEvent} className="grid gap-2 rounded-2xl border border-blue-100 bg-white p-4 sm:grid-cols-2"><input required minLength={3} value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} placeholder="Event or meeting title" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" /><input required type="datetime-local" value={eventDate} onChange={(event) => setEventDate(event.target.value)} min={new Date().toISOString().slice(0, 16)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" /><input value={eventLocation} onChange={(event) => setEventLocation(event.target.value)} placeholder="Location" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" /><textarea required minLength={3} value={eventDescription} onChange={(event) => setEventDescription(event.target.value)} placeholder="Event details" className="rounded-lg border border-slate-200 px-3 py-2 text-sm sm:col-span-2" /><button disabled={busy} className="w-fit rounded-lg bg-blue-700 px-4 py-2 text-xs font-bold text-white">Add event</button></form>}
            {events.map((item) => <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4"><h3 className="font-bold text-slate-900">{item.title}</h3><p className="mt-1 text-sm text-slate-600">{item.description}</p><p className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500"><span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{new Date(item.starts_at).toLocaleString()}</span>{item.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{item.location}</span>}</p></article>)}
            {!loading && events.length === 0 && <EmptyCard text="No upcoming events have been posted." />}
          </section>
        </div>

        <div className="space-y-5">
          <section className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 font-bold text-slate-900"><Vote className="h-4 w-4 text-violet-700" />Village development polls</h2>
            {isStaff && <form onSubmit={publishPoll} className="space-y-2 rounded-2xl bg-violet-50/70 p-3"><input required minLength={5} maxLength={500} value={pollQuestion} onChange={(event) => setPollQuestion(event.target.value)} placeholder="Ask the village a question" className="w-full rounded-lg border border-violet-100 px-3 py-2 text-xs" />{pollOptions.map((option, index) => <div key={index} className="flex gap-1.5"><input value={option} onChange={(event) => setPollOptions((current) => current.map((value, i) => i === index ? event.target.value : value))} placeholder={`Option ${index + 1}`} className="min-w-0 flex-1 rounded-lg border border-violet-100 px-3 py-2 text-xs" />{pollOptions.length > 2 && <button type="button" onClick={() => setPollOptions((current) => current.filter((_, i) => i !== index))} aria-label="Remove option"><X className="h-4 w-4 text-slate-400" /></button>}</div>)}{pollOptions.length < 8 && <button type="button" onClick={() => setPollOptions((current) => [...current, ''])} className="flex items-center gap-1 text-[11px] font-bold text-violet-800"><Plus className="h-3 w-3" />Add option</button>}<button disabled={busy} className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-bold text-white">Create poll</button></form>}
            {polls.map((poll) => {
              const votes = poll.poll_votes || [];
              const myVote = votes.find((vote) => vote.voter_id === userId)?.option_index;
              const closed = Boolean(poll.closes_at && new Date(poll.closes_at) <= new Date());
              return <article key={poll.id} className="rounded-2xl border border-slate-200 p-3"><h3 className="text-sm font-bold text-slate-900">{poll.question}</h3><div className="mt-2 space-y-2">{(poll.options || []).map((option, index) => { const count = votes.filter((vote) => vote.option_index === index).length; const percent = votes.length ? Math.round(count * 100 / votes.length) : 0; return <button key={option + index} disabled={role !== 'citizen' || closed || busy} onClick={() => void castVote(poll, index)} className={`relative w-full overflow-hidden rounded-lg border px-2.5 py-2 text-left text-xs ${myVote === index ? 'border-violet-400 bg-violet-50 font-bold text-violet-950' : 'border-slate-200 bg-white text-slate-700'} disabled:cursor-default`}><span className="absolute inset-y-0 left-0 bg-violet-100/80" style={{ width: `${percent}%` }} /><span className="relative flex justify-between gap-2"><span>{option}{myVote === index ? ' · Your vote' : ''}</span><span>{count} · {percent}%</span></span></button>; })}</div><p className="mt-2 text-[10px] text-slate-400">{votes.length} vote{votes.length === 1 ? '' : 's'} · {closed ? 'Closed' : 'Open'}</p></article>;
            })}
            {!loading && polls.length === 0 && <p className="text-xs text-slate-500">No active polls. The Sarpanch can post a question here.</p>}
          </section>

          {!isStaff && <form onSubmit={sendFeedback} className="space-y-3 rounded-3xl border border-amber-200 bg-amber-50/60 p-5"><h2 className="flex items-center gap-2 font-bold text-amber-950"><MessageSquareText className="h-4 w-4" />Suggestion for village development</h2><textarea required minLength={3} maxLength={3000} rows={4} value={feedbackText} onChange={(event) => setFeedbackText(event.target.value)} placeholder="Share your suggestion or feedback…" className="w-full rounded-xl border border-amber-200 bg-white p-3 text-sm" /><button disabled={busy} className="rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-bold text-white">Send suggestion</button></form>}

          {isStaff && <section className="space-y-2 rounded-3xl border border-amber-200 bg-white p-5"><h2 className="font-bold text-slate-900">Recent citizen suggestions</h2>{feedback.length ? feedback.map((item) => <article key={item.id} className="rounded-xl bg-amber-50 p-3"><p className="text-sm text-slate-800">{item.message}</p><time className="mt-1 block text-[10px] text-slate-400">{new Date(item.created_at).toLocaleString()}</time></article>) : <p className="text-xs text-slate-500">No suggestions yet.</p>}</section>}

          <section className="space-y-2 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-900">Your notifications</h2>
            {notifications.length ? notifications.map((notice) => <button key={notice.id} onClick={() => void markRead(notice)} className={`block w-full rounded-xl p-3 text-left ${notice.read_at ? 'bg-slate-50' : 'bg-emerald-50'}`}><span className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-slate-900">{notice.title}</span>{!notice.read_at && <span className="h-2 w-2 rounded-full bg-emerald-600" />}</span><span className="mt-1 block text-xs leading-relaxed text-slate-600">{notice.body}</span><time className="mt-1 block text-[10px] text-slate-400">{new Date(notice.created_at).toLocaleString()}</time></button>) : <p className="text-xs text-slate-500">Notifications for complaint updates and village notices will appear here.</p>}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-bold text-slate-900">Tandlam Grama Panchayat</h2><p className="mt-1 text-xs text-slate-500">Tirupati District, Andhra Pradesh</p><div className="mt-3 grid grid-cols-2 gap-2"><a href="tel:112" className="rounded-xl bg-rose-50 p-3 text-center text-xs font-bold text-rose-800">Emergency · 112</a><a href="tel:108" className="rounded-xl bg-blue-50 p-3 text-center text-xs font-bold text-blue-800">Ambulance · 108</a><a href="tel:100" className="rounded-xl bg-amber-50 p-3 text-center text-xs font-bold text-amber-900">Police · 100</a><a href="tel:101" className="rounded-xl bg-orange-50 p-3 text-center text-xs font-bold text-orange-900">Fire · 101</a></div><p className="mt-3 text-[10px] leading-relaxed text-slate-400">Emergency numbers connect to national services. Panchayat office contact details can be found in the team directory.</p><button onClick={onOpenOfficials} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900"><Building2 className="h-4 w-4" />Panchayat team directory</button></section>
        </div>
      </section>
    </div>
  );
}

function LoadingLine() {
  return <div className="flex items-center gap-2 rounded-2xl bg-white p-4 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading village updates…</div>;
}

function EmptyCard({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-5 text-center text-sm text-slate-500">{text}</div>;
}
