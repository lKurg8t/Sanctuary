import React, { useState, useEffect } from 'react';
import { UserProfile, Couple, Book, ReadingProgress, PhotoMemory, CyclePartnerSummary, GameStats, CoupleStats } from '../types';
import { Heart, Calendar, Sparkles, BookOpen, Camera, Gamepad2, ArrowRight, Flame, MessageCircle, Moon, Sun, Coffee, Plus } from 'lucide-react';
import confetti from 'canvas-confetti';
import { DateNightIdeaCard } from './DateNightIdeaCard';
import { Sound } from '../lib/audio';
import { ApiService } from '../lib/api';

interface DashboardViewProps {
  currentUser: UserProfile;
  couple: Couple | null;
  partner: UserProfile | null;
  books: Book[];
  readingProgress: ReadingProgress[];
  photos: PhotoMemory[];
  partnerCycleSummary?: CyclePartnerSummary | null;
  gameStats?: { personal: GameStats; couple: CoupleStats } | null;
  onNavigate: (tab: 'chat' | 'cycle' | 'library' | 'memories' | 'games') => void;
  onOpenBook: (bookId: string) => void;
  onOpenPhoto: (photo: PhotoMemory) => void;
  onSendToChat?: (text: string) => void;
  onSendLoveNudge?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentUser,
  couple,
  partner,
  books,
  readingProgress,
  photos,
  partnerCycleSummary,
  gameStats,
  onNavigate,
  onOpenBook,
  onOpenPhoto,
  onSendToChat,
  onSendLoveNudge
}) => {
  const [dailyAnswer, setDailyAnswer] = useState('');
  const [hasAnsweredDaily, setHasAnsweredDaily] = useState(false);
  const [dailyPromptText, setDailyPromptText] = useState('What is one tiny moment this week where you felt especially loved by me?');

  useEffect(() => {
    let isCancelled = false;
    async function loadLiveDailyPrompt() {
      try {
        const prompts = await ApiService.getGamePrompts('daily_reflection');
        if (!isCancelled && prompts && prompts.length > 0) {
          setDailyPromptText(prompts[0].prompt);
        }
      } catch (err) {
        console.warn('Notice loading daily reflection prompt:', err);
      }
    }
    loadLiveDailyPrompt();
    return () => {
      isCancelled = true;
    };
  }, []);

  // Relationship duration calculations
  const { daysTogether, monthsTogether, yearsTogether, anniversaryCountdown } = React.useMemo(() => {
    if (!couple?.relationshipStartDate) {
      return { daysTogether: 1, monthsTogether: 0, yearsTogether: '0.0', anniversaryCountdown: 365 };
    }
    const start = new Date(couple.relationshipStartDate);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const days = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    const months = Math.floor(days / 30.4);
    const years = (days / 365.25).toFixed(1);

    // Next anniversary calculation
    const currentYear = now.getFullYear();
    let nextAnniv = new Date(start);
    nextAnniv.setFullYear(currentYear);
    if (nextAnniv.getTime() < now.getTime()) {
      nextAnniv.setFullYear(currentYear + 1);
    }
    const daysToAnniv = Math.ceil((nextAnniv.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return {
      daysTogether: days,
      monthsTogether: months,
      yearsTogether: years,
      anniversaryCountdown: daysToAnniv
    };
  }, [couple?.relationshipStartDate]);

  // Current reading book
  const currentReading = React.useMemo(() => {
    const userProg = readingProgress.find(p => p.userId === currentUser.id && !p.isFinished);
    if (userProg) {
      const book = books.find(b => b.id === userProg.bookId);
      if (book) return { book, progress: userProg };
    }
    if (books.length > 0) {
      return { book: books[0], progress: { percentage: 0, currentPage: 1 } };
    }
    return null;
  }, [books, readingProgress, currentUser.id]);

  // Latest shared memory
  const latestPhoto = photos.length > 0 ? photos[0] : null;

  const handleCelebrate = () => {
    Sound.playLoveNudgeSound();
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });
    if (onSendLoveNudge) {
      onSendLoveNudge();
    }
  };

  const handleDailySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dailyAnswer.trim()) return;
    setHasAnsweredDaily(true);
    if (onSendToChat) {
      onSendToChat(`💌 **Daily Prompt Reflection:**\n"${dailyAnswer}"`);
    }
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
  };

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-300">
      {/* 1. HERO RELATIONSHIP CARD */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-500 via-rose-600 to-amber-500 text-white p-6 shadow-xl shadow-rose-500/15">
        {/* Soft background aesthetics */}
        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-48 h-48 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-40 h-40 rounded-full bg-amber-400/20 blur-xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-semibold tracking-wide border border-white/20">
              <Sparkles className="w-3.5 h-3.5 text-amber-200" />
              <span>Our Sacred Space</span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-serif font-extrabold tracking-tight">
              Together for <span className="underline decoration-amber-300 decoration-wavy underline-offset-4">{daysTogether} days</span>
            </h2>

            <p className="text-rose-100 text-sm max-w-md font-medium">
              Since {couple?.relationshipStartDate ? new Date(couple.relationshipStartDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'our beginning'} • Every moment belongs to us.
            </p>
          </div>

          {/* Quick interactive celebration button */}
          <div className="flex sm:flex-col items-center gap-3">
            <button
              onClick={handleCelebrate}
              className="px-4 py-2.5 rounded-2xl bg-white text-rose-600 hover:bg-rose-50 active:scale-95 font-semibold text-xs shadow-md transition-all flex items-center gap-2"
            >
              <Heart className="w-4 h-4 fill-rose-500 text-rose-500 animate-pulse" />
              <span>Send Heartbeat</span>
            </button>

            <div className="text-center bg-black/20 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/10 text-[11px] text-rose-100 font-medium">
              🎉 Next Anniversary in <span className="font-bold text-white">{anniversaryCountdown} days</span>
            </div>
          </div>
        </div>

        {/* Partner Connection Bar */}
        <div className="mt-6 pt-4 border-t border-white/20 flex items-center justify-between text-xs text-rose-100">
          <div className="flex items-center gap-2">
            <img
              src={currentUser.avatarUrl}
              alt={currentUser.displayName}
              className="w-7 h-7 rounded-full object-cover ring-2 ring-white/60"
            />
            <Heart className="w-3.5 h-3.5 fill-amber-200 text-amber-200" />
            <img
              src={partner?.avatarUrl || 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80'}
              alt={partner?.displayName || 'Partner'}
              className="w-7 h-7 rounded-full object-cover ring-2 ring-white/60"
            />
            <span className="font-semibold text-white ml-1">
              {currentUser.displayName} & {partner?.displayName || 'Partner'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-white/15 px-2.5 py-1 rounded-full text-[11px] font-semibold text-white">
            <Flame className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
            <span>Loving Together</span>
          </div>
        </div>
      </div>

      {/* 2. GEMINI AI RANDOM DATE NIGHT IDEA CARD */}
      <DateNightIdeaCard
        currentUser={currentUser}
        couple={couple}
        partner={partner}
        onSendToChat={onSendToChat}
        onNavigate={onNavigate}
      />

      {/* 3. PARTNER CARE / CYCLE GENTLE SUPPORT NOTIFICATION */}
      {partnerCycleSummary && partnerCycleSummary.supportTips.length > 0 && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-50 via-pink-50 to-amber-50 border border-rose-200/70 shadow-xs flex items-start gap-3">
          <div className="p-2 rounded-xl bg-rose-100 text-rose-600 shrink-0">
            <Coffee className="w-5 h-5" />
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-800">
                Partner Support Insight • {partnerCycleSummary.phaseDisplayName}
              </h4>
              <button
                onClick={() => onNavigate('cycle')}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-0.5"
              >
                View Flo <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <p className="text-xs text-stone-700 font-medium leading-relaxed">
              {partnerCycleSummary.supportTips[0]}
            </p>
          </div>
        </div>
      )}

      {/* 4. DAILY INTIMATE COUPLE QUESTION */}
      <div className="p-5 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200/60 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-600" /> Daily Prompt
          </span>
          <span className="text-xs text-stone-400 font-medium">Daily Reflection</span>
        </div>

        <h3 className="font-serif text-base font-semibold text-stone-800 leading-snug">
          "{dailyPromptText}"
        </h3>

        {!hasAnsweredDaily ? (
          <form onSubmit={handleDailySubmit} className="space-y-2">
            <input
              type="text"
              value={dailyAnswer}
              onChange={e => setDailyAnswer(e.target.value)}
              placeholder="Write your secret answer to share..."
              className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-stone-50 border border-stone-200 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:bg-white text-stone-800 placeholder-stone-400"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-900 text-white font-semibold text-xs transition-colors"
              >
                Reveal to Partner
              </button>
            </div>
          </form>
        ) : (
          <div className="p-3 rounded-2xl bg-rose-50/70 border border-rose-100 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-rose-800 font-semibold">
              <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
              <span>You answered:</span>
            </div>
            <p className="text-stone-700 italic">"{dailyAnswer}"</p>
            <div className="pt-2 border-t border-rose-200/50 flex items-center justify-between text-[11px] text-stone-500">
              <span>{partner?.displayName || 'Partner'} can view this in chat!</span>
              <button
                onClick={() => onNavigate('chat')}
                className="font-semibold text-rose-600 hover:underline"
              >
                Open Chat
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. CURRENT READING & RECENT MEMORY DUAL SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Continue Reading Card */}
        {currentReading ? (
          <div className="p-5 rounded-3xl bg-white border border-stone-200 shadow-xs flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-stone-700">
                <BookOpen className="w-4 h-4 text-rose-500" />
                <span className="text-xs font-bold uppercase tracking-wider">Shared Reading</span>
              </div>
              <span className="text-xs font-bold text-rose-600">
                {currentReading.progress.percentage}% completed
              </span>
            </div>

            <div className="flex gap-3.5 items-center">
              <img
                src={currentReading.book.coverUrl}
                alt={currentReading.book.title}
                className="w-14 h-20 object-cover rounded-xl shadow-md shrink-0 ring-1 ring-stone-200"
              />
              <div className="space-y-1 overflow-hidden">
                <h4 className="text-sm font-serif font-bold text-stone-800 truncate">
                  {currentReading.book.title}
                </h4>
                <p className="text-xs text-stone-500 truncate">{currentReading.book.author}</p>
                <div className="w-full bg-stone-100 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div
                    className="bg-rose-500 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${currentReading.progress.percentage}%` }}
                  />
                </div>
              </div>
            </div>

            <button
              onClick={() => onOpenBook(currentReading.book.id)}
              className="w-full py-2 px-3 rounded-xl bg-stone-100 hover:bg-rose-50 hover:text-rose-700 text-stone-700 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <span>{currentReading.progress.percentage > 0 ? `Continue Reading (Page ${currentReading.progress.currentPage})` : 'Start Reading Together'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="p-5 rounded-3xl bg-white border border-stone-200 shadow-xs flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-stone-700">
                <BookOpen className="w-4 h-4 text-rose-500" />
                <span className="text-xs font-bold uppercase tracking-wider">Shared Reading</span>
              </div>
            </div>
            <div className="text-center py-4 space-y-2">
              <p className="text-xs text-stone-500 font-medium">Add or explore books in your shared library.</p>
              <button
                onClick={() => onNavigate('library')}
                className="px-3.5 py-1.5 rounded-xl bg-rose-50 text-rose-700 text-xs font-semibold hover:bg-rose-100"
              >
                Browse Library
              </button>
            </div>
          </div>
        )}

        {/* Latest Shared Photo Memory */}
        {latestPhoto ? (
          <div className="p-5 rounded-3xl bg-white border border-stone-200 shadow-xs flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-stone-700">
                <Camera className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold uppercase tracking-wider">Shared Memory</span>
              </div>
              <span className="text-[11px] text-stone-400 font-medium">
                {latestPhoto.memoryDate}
              </span>
            </div>

            <div
              onClick={() => onOpenPhoto(latestPhoto)}
              className="relative h-24 rounded-2xl overflow-hidden cursor-pointer group shadow-sm"
            >
              <img
                src={latestPhoto.imageUrl}
                alt={latestPhoto.caption}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-2.5">
                <p className="text-white text-xs font-medium truncate drop-shadow-sm">
                  {latestPhoto.caption || latestPhoto.albumName}
                </p>
              </div>
            </div>

            <button
              onClick={() => onNavigate('memories')}
              className="w-full py-2 px-3 rounded-xl bg-stone-100 hover:bg-amber-50 hover:text-amber-700 text-stone-700 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <span>View Memory Vault</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="p-5 rounded-3xl bg-white border border-stone-200 shadow-xs flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-stone-700">
                <Camera className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold uppercase tracking-wider">Shared Memory</span>
              </div>
            </div>
            <div className="text-center py-4 space-y-2">
              <p className="text-xs text-stone-500 font-medium">No memories uploaded yet. Capture your golden moments together!</p>
              <button
                onClick={() => onNavigate('memories')}
                className="px-3.5 py-1.5 rounded-xl bg-amber-50 text-amber-800 text-xs font-semibold hover:bg-amber-100 inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Upload First Memory</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 6. QUICK COUPLE GAME LAUNCHER */}
      <div className="p-5 rounded-3xl bg-gradient-to-br from-stone-900 to-stone-800 text-white shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">Game Night Hub</h3>
              <p className="text-[11px] text-stone-400 font-medium">9 Multiplayer Couple Games Ready</p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('games')}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold transition-colors flex items-center gap-1"
          >
            <span>Play Now</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div
            onClick={() => onNavigate('games')}
            className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 cursor-pointer border border-white/5 transition-all text-center space-y-1"
          >
            <div className="text-lg">🎨</div>
            <div className="text-xs font-bold">Scribble</div>
            <div className="text-[10px] text-stone-400">Live Drawing</div>
          </div>
          <div
            onClick={() => onNavigate('games')}
            className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 cursor-pointer border border-white/5 transition-all text-center space-y-1"
          >
            <div className="text-lg">🔥</div>
            <div className="text-xs font-bold">Truth / Dare</div>
            <div className="text-[10px] text-stone-400">4 Categories</div>
          </div>
          <div
            onClick={() => onNavigate('games')}
            className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 cursor-pointer border border-white/5 transition-all text-center space-y-1"
          >
            <div className="text-lg">✨</div>
            <div className="text-xs font-bold">Match WYR</div>
            <div className="text-[10px] text-stone-400">Find Compatibility</div>
          </div>
        </div>
      </div>
    </div>
  );
};
