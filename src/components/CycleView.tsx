import React, { useState, useMemo } from 'react';
import { UserProfile, Couple, CycleLog, CycleSettings, CyclePartnerSummary, CyclePhase } from '../types';
import { Flower2, Calendar, Shield, Heart, Sparkles, Moon, Coffee, Info, Check, Plus, AlertCircle, RefreshCw } from 'lucide-react';
import confetti from 'canvas-confetti';

interface CycleViewProps {
  currentUser: UserProfile;
  couple: Couple | null;
  partner: UserProfile | null;
  cycleLogs: CycleLog[];
  cycleSettings: CycleSettings;
  partnerSummary?: CyclePartnerSummary | null;
  onSaveLog: (log: Partial<CycleLog>) => Promise<void>;
  onUpdateSettings: (settings: Partial<CycleSettings>) => Promise<void>;
}

const SYMPTOM_OPTIONS = [
  { id: 'cramps', label: 'Cramps ⚡' },
  { id: 'fatigue', label: 'Fatigue 😴' },
  { id: 'headache', label: 'Headache 🤕' },
  { id: 'bloating', label: 'Bloating 🎈' },
  { id: 'backache', label: 'Backache 🧘‍♀️' },
  { id: 'tender_breasts', label: 'Tender Breasts 🌸' },
  { id: 'acne', label: 'Skin Breakout ✨' }
];

const MOOD_OPTIONS = [
  { id: 'loving', label: 'Loving 🥰' },
  { id: 'calm', label: 'Calm 🌿' },
  { id: 'happy', label: 'Happy ✨' },
  { id: 'sensitive', label: 'Sensitive 🥺' },
  { id: 'anxious', label: 'Anxious 💭' },
  { id: 'irritable', label: 'Irritable 🌩️' },
  { id: 'energetic', label: 'Energetic ⚡' }
];

const CRAVING_OPTIONS = [
  { id: 'dark_chocolate', label: 'Dark Chocolate 🍫' },
  { id: 'salty_snacks', label: 'Salty Snacks 🥨' },
  { id: 'sweet_dessert', label: 'Sweet Treats 🍦' },
  { id: 'warm_soup', label: 'Warm Broth / Tea 🍵' },
  { id: 'comfort_carbs', label: 'Pasta / Bread 🥐' }
];

export const CycleView: React.FC<CycleViewProps> = ({
  currentUser,
  couple,
  partner,
  cycleLogs,
  cycleSettings,
  partnerSummary,
  onSaveLog,
  onUpdateSettings
}) => {
  // Mode selector: "Tracker" vs "Partner Perspective"
  const [activeViewMode, setActiveViewMode] = useState<'my_tracker' | 'partner_perspective'>('my_tracker');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isPeriodStart, setIsPeriodStart] = useState(false);
  const [flowIntensity, setFlowIntensity] = useState<'none' | 'spotting' | 'light' | 'medium' | 'heavy'>('none');
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [energyLevel, setEnergyLevel] = useState<number>(3);
  const [sleepHours, setSleepHours] = useState<number>(8);
  const [selectedCravings, setSelectedCravings] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  // Load existing log for selected date
  React.useEffect(() => {
    const existing = cycleLogs.find(l => l.date === selectedDate);
    if (existing) {
      setIsPeriodStart(!!existing.isPeriodStart);
      setFlowIntensity(existing.flowIntensity || 'none');
      setSelectedSymptoms(existing.symptoms || []);
      setSelectedMoods(existing.moods || []);
      setEnergyLevel(existing.energyLevel || 3);
      setSleepHours(existing.sleepHours || 8);
      setSelectedCravings(existing.cravings || []);
      setNotes(existing.notes || '');
    } else {
      setIsPeriodStart(false);
      setFlowIntensity('none');
      setSelectedSymptoms([]);
      setSelectedMoods([]);
      setEnergyLevel(3);
      setSleepHours(8);
      setSelectedCravings([]);
      setNotes('');
    }
  }, [selectedDate, cycleLogs]);

  // Compute Cycle Day & Predictions
  const { currentCycleDay, cyclePhase, phaseDescription, nextPeriodEstimatedDate, daysUntilPeriod, ovulationEstimateDay } = useMemo(() => {
    const lastStart = new Date(cycleSettings.lastPeriodStartDate || '2024-01-01');
    const now = new Date(selectedDate);
    const diffDays = Math.floor((now.getTime() - lastStart.getTime()) / (1000 * 60 * 60 * 24));
    const cycleDay = Math.max(1, (diffDays % cycleSettings.cycleLengthDays) + 1);
    const daysLeft = cycleSettings.cycleLengthDays - cycleDay + 1;

    const nextDate = new Date(now.getTime() + daysLeft * 24 * 60 * 60 * 1000);
    const nextDateStr = nextDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    let phase: CyclePhase = 'follicular';
    let phaseDesc = 'Follicular Phase — Estrogen rises, energy is increasing and creativity begins to peak.';

    if (cycleDay <= cycleSettings.periodLengthDays) {
      phase = 'menstrual';
      phaseDesc = 'Menstrual Phase — Your body is shedding and recharging. Gentle movement, warmth, and rest are deeply restorative.';
    } else if (cycleDay >= 12 && cycleDay <= 16) {
      phase = 'ovulation';
      phaseDesc = 'Ovulation Window — Peak estrogen and confidence. High mood, social energy, and closeness.';
    } else if (cycleDay > 16) {
      phase = 'luteal';
      phaseDesc = 'Luteal Phase — Progesterone dominant. Nurturing, slow evenings, nourishing comfort foods, and deep cozy conversations.';
    }

    return {
      currentCycleDay: cycleDay,
      cyclePhase: phase,
      phaseDescription: phaseDesc,
      nextPeriodEstimatedDate: nextDateStr,
      daysUntilPeriod: daysLeft,
      ovulationEstimateDay: Math.round(cycleSettings.cycleLengthDays / 2)
    };
  }, [cycleSettings, selectedDate]);

  const toggleSymptom = (id: string) => {
    setSelectedSymptoms(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const toggleMood = (id: string) => {
    setSelectedMoods(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  };

  const toggleCraving = (id: string) => {
    setSelectedCravings(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const handleSaveLog = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    await onSaveLog({
      userId: currentUser.id,
      date: selectedDate,
      isPeriodStart,
      flowIntensity,
      symptoms: selectedSymptoms,
      moods: selectedMoods,
      energyLevel,
      sleepHours,
      cravings: selectedCravings,
      notes
    });
    setIsSaving(false);
    confetti({ particleCount: 40, spread: 60, origin: { y: 0.8 } });
  };

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-300">
      {/* 1. HEADER & MODE SWITCHER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-2xl bg-rose-100 text-rose-600">
              <Flower2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-serif font-bold text-stone-800">
                Cycle & Wellness Sanctuary
              </h2>
              <p className="text-xs text-stone-500 font-medium">
                Mutual understanding, gentle care, and rhythm awareness.
              </p>
            </div>
          </div>
        </div>

        {/* Perspective toggle (My Log vs Partner Care Hub) */}
        <div className="flex items-center bg-stone-100 p-1 rounded-2xl border border-stone-200 self-start sm:self-auto">
          <button
            onClick={() => setActiveViewMode('my_tracker')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeViewMode === 'my_tracker'
                ? 'bg-white text-rose-700 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            My Cycle Log
          </button>
          <button
            onClick={() => setActiveViewMode('partner_perspective')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 ${
              activeViewMode === 'partner_perspective'
                ? 'bg-white text-rose-700 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
            <span>Partner Care View</span>
          </button>
        </div>
      </div>

      {activeViewMode === 'my_tracker' ? (
        <>
          {/* 2. CYCLE OVERVIEW ORB CARD */}
          <div className="p-6 rounded-3xl bg-gradient-to-br from-rose-50 via-pink-50 to-amber-50 border border-rose-200/80 shadow-xs relative overflow-hidden">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              {/* Animated Cycle Progress Ring */}
              <div className="relative w-36 h-36 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#fce7f3"
                    strokeWidth="8"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="url(#gradient)"
                    strokeWidth="8"
                    strokeDasharray={251.2}
                    strokeDashoffset={251.2 - (251.2 * (currentCycleDay / cycleSettings.cycleLengthDays))}
                    strokeLinecap="round"
                    className="transition-all duration-1000"
                  />
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#f43f5e" />
                      <stop offset="100%" stopColor="#f59e0b" />
                    </linearGradient>
                  </defs>
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-rose-500">Day</span>
                  <span className="text-3xl font-serif font-extrabold text-stone-800">{currentCycleDay}</span>
                  <span className="text-[10px] text-stone-500 font-medium">of {cycleSettings.cycleLengthDays}</span>
                </div>
              </div>

              {/* Cycle Status and Insights */}
              <div className="flex-1 space-y-2 text-center md:text-left">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-rose-200 text-xs font-bold text-rose-700 shadow-xs">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>{cyclePhase.toUpperCase()} PHASE</span>
                </div>

                <h3 className="font-serif text-lg font-bold text-stone-800">
                  Estimated next period: <span className="text-rose-600">{nextPeriodEstimatedDate}</span> (in ~{daysUntilPeriod} days)
                </h3>

                <p className="text-xs text-stone-600 font-medium leading-relaxed max-w-lg">
                  {phaseDescription}
                </p>

                <div className="pt-2 flex items-center justify-center md:justify-start gap-3 text-[11px] text-stone-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-rose-500" />
                    Avg Cycle: {cycleSettings.cycleLengthDays} days
                  </span>
                  <span>•</span>
                  <button
                    onClick={() => setShowPrivacyModal(true)}
                    className="text-rose-600 font-semibold hover:underline flex items-center gap-1"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Sharing Privacy: {cycleSettings.partnerSharingLevel}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Medical Disclaimer Badge */}
            <div className="mt-4 pt-3 border-t border-rose-200/50 flex items-center gap-2 text-[10px] text-stone-500">
              <Info className="w-3.5 h-3.5 text-stone-400 shrink-0" />
              <span>
                Predictions are estimates based on your logged history, not medical diagnoses.
              </span>
            </div>
          </div>

          {/* 3. LOGGING FORM FOR SELECTED DATE */}
          <form onSubmit={handleSaveLog} className="p-6 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-rose-500" />
                <h3 className="text-sm font-bold text-stone-800">Log Daily Symptoms & Mood</h3>
              </div>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="text-xs font-semibold bg-stone-50 border border-stone-200 px-3 py-1.5 rounded-xl text-stone-700 focus:outline-none focus:ring-1 focus:ring-rose-400"
              />
            </div>

            {/* Period Flow Intensity */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Period Flow Intensity
              </label>
              <div className="grid grid-cols-5 gap-2">
                {(['none', 'spotting', 'light', 'medium', 'heavy'] as const).map(flow => (
                  <button
                    key={flow}
                    type="button"
                    onClick={() => {
                      setFlowIntensity(flow);
                      if (flow !== 'none') setIsPeriodStart(true);
                    }}
                    className={`py-2 px-1 rounded-2xl text-xs font-semibold capitalize border transition-all text-center ${
                      flowIntensity === flow
                        ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                        : 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-700'
                    }`}
                  >
                    {flow}
                  </button>
                ))}
              </div>
            </div>

            {/* Symptoms Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Symptoms
              </label>
              <div className="flex flex-wrap gap-2">
                {SYMPTOM_OPTIONS.map(s => {
                  const isSel = selectedSymptoms.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleSymptom(s.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        isSel
                          ? 'bg-rose-500 text-white border-rose-500 shadow-xs'
                          : 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-700'
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mood Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Mood & Feelings
              </label>
              <div className="flex flex-wrap gap-2">
                {MOOD_OPTIONS.map(m => {
                  const isSel = selectedMoods.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleMood(m.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        isSel
                          ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                          : 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-700'
                      }`}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Energy Level & Sleep Hours */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="font-bold uppercase tracking-wider text-stone-500">Energy Level</span>
                  <span className="font-bold text-rose-600">{energyLevel} / 5</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={energyLevel}
                  onChange={e => setEnergyLevel(Number(e.target.value))}
                  className="w-full accent-rose-500 cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="font-bold uppercase tracking-wider text-stone-500">Sleep (Hours)</span>
                  <span className="font-bold text-stone-700">{sleepHours} hrs</span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="12"
                  value={sleepHours}
                  onChange={e => setSleepHours(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Cravings */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Cravings
              </label>
              <div className="flex flex-wrap gap-2">
                {CRAVING_OPTIONS.map(c => {
                  const isSel = selectedCravings.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCraving(c.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        isSel
                          ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                          : 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-700'
                      }`}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Personal Diary Notes
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="How did you feel today? Any sweet thoughts..."
                rows={2}
                className="w-full p-3 text-xs bg-stone-50 rounded-2xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-rose-400 text-stone-800"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-md shadow-rose-200 transition-colors flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>{isSaving ? 'Saving...' : 'Save Log Entry'}</span>
              </button>
            </div>
          </form>
        </>
      ) : (
        /* PARTNER CARE SUPPORT VIEW */
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-rose-200 text-xs font-bold tracking-wider uppercase">
              <Heart className="w-4 h-4 fill-white text-white" />
              <span>Partner Support Dashboard</span>
            </div>

            <h3 className="font-serif text-2xl font-bold">
              {partner?.displayName || 'Partner'}'s Current Rhythm: <span className="text-amber-200">{partnerSummary?.phaseDisplayName || 'Follicular Phase'}</span>
            </h3>

            <p className="text-xs text-rose-100 font-medium leading-relaxed max-w-xl">
              This space helps you stay attuned, thoughtful, and supportive without your partner needing to say a word.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10">
                <span className="text-[10px] text-rose-200 font-medium uppercase">Cycle Day</span>
                <p className="text-xl font-bold font-serif">Day {partnerSummary?.cycleDay || 14}</p>
              </div>
              <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10">
                <span className="text-[10px] text-rose-200 font-medium uppercase">Next Period</span>
                <p className="text-xl font-bold font-serif">~{partnerSummary?.daysUntilNextPeriod || 14} days</p>
              </div>
              <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 col-span-2 sm:col-span-1">
                <span className="text-[10px] text-rose-200 font-medium uppercase">Reported Energy</span>
                <p className="text-xl font-bold font-serif">{partnerSummary?.energyLevel || 4} / 5</p>
              </div>
            </div>
          </div>

          {/* Supportive Action Cards */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Gentle Ways to Care Right Now
            </h4>

            {partnerSummary?.supportTips.map((tip, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs flex items-start gap-3"
              >
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600 shrink-0">
                  <Coffee className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h5 className="text-xs font-bold text-stone-800">Support Suggestion #{idx + 1}</h5>
                  <p className="text-xs text-stone-600 font-medium leading-relaxed">{tip}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Shared Symptoms & Moods */}
          <div className="p-5 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Shared Moods & Comforts
            </h4>
            <div className="flex flex-wrap gap-2">
              {partnerSummary?.reportedMoods && partnerSummary.reportedMoods.length > 0 ? (
                partnerSummary.reportedMoods.map(m => (
                  <span
                    key={m}
                    className="px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-medium capitalize"
                  >
                    ✨ {m}
                  </span>
                ))
              ) : (
                <span className="text-xs text-stone-400 italic">No specific moods reported today.</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PRIVACY SETTINGS MODAL */}
      {showPrivacyModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="font-serif font-bold text-base text-stone-800 flex items-center gap-2">
                <Shield className="w-4 h-4 text-rose-500" />
                <span>Cycle Sharing Privacy</span>
              </h3>
              <button onClick={() => setShowPrivacyModal(false)} className="text-stone-400 hover:text-stone-600">
                ✕
              </button>
            </div>

            <p className="text-xs text-stone-600">
              You have complete control over what your partner can see. Choose your preferred comfort level:
            </p>

            <div className="space-y-2">
              {(['private', 'summary', 'full'] as const).map(lvl => (
                <button
                  key={lvl}
                  onClick={() => onUpdateSettings({ partnerSharingLevel: lvl })}
                  className={`w-full p-3 rounded-2xl border text-left flex items-start justify-between transition-all ${
                    cycleSettings.partnerSharingLevel === lvl
                      ? 'border-rose-500 bg-rose-50/50'
                      : 'border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-stone-800 capitalize">{lvl} Sharing</span>
                    <p className="text-[11px] text-stone-500">
                      {lvl === 'private' && 'Only you see your cycle details.'}
                      {lvl === 'summary' && 'Partner sees general phase & gentle care suggestions.'}
                      {lvl === 'full' && 'Partner sees all logged symptoms, moods, and notes.'}
                    </p>
                  </div>
                  {cycleSettings.partnerSharingLevel === lvl && (
                    <Check className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                </button>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowPrivacyModal(false)}
                className="px-4 py-2 rounded-xl bg-stone-800 text-white font-semibold text-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
