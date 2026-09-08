import React, { useState, useEffect } from 'react';
import { DateNightIdea, UserProfile, Couple } from '../types';
import { ApiService } from '../lib/api';
import {
  Sparkles,
  RefreshCw,
  Clock,
  MapPin,
  DollarSign,
  Heart,
  Music,
  Send,
  CheckCircle2,
  Share2,
  Compass,
  Flame,
  Coffee,
  Palette,
  Dice5,
  BookmarkPlus
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface DateNightIdeaCardProps {
  currentUser: UserProfile;
  couple: Couple | null;
  partner: UserProfile | null;
  onSendToChat?: (text: string) => void;
  onNavigate?: (tab: 'chat' | 'cycle' | 'library' | 'memories' | 'games') => void;
}

const VIBE_PRESETS = [
  { id: 'surprise', label: 'Surprise Us', icon: Dice5, query: 'romantic, spontaneous, and uniquely creative' },
  { id: 'cozy', label: 'Cozy At-Home', icon: Coffee, query: 'cozy at-home indoor, relaxed, warm, and intimate' },
  { id: 'romantic', label: 'Romantic & Deep', icon: Heart, query: 'deeply romantic, candlelight, sensory, and emotionally intimate' },
  { id: 'creative', label: 'Creative & Artsy', icon: Palette, query: 'creative, playful, artsy, and collaborative' },
  { id: 'adventure', label: 'Playful Adventure', icon: Compass, query: 'outdoor exploration, playful city discovery, active and fun' },
  { id: 'budget', label: 'Zero Budget', icon: DollarSign, query: 'completely free or low-budget, thoughtful, DIY, and heartfelt' }
];

export const DateNightIdeaCard: React.FC<DateNightIdeaCardProps> = ({
  currentUser,
  couple,
  partner,
  onSendToChat,
  onNavigate
}) => {
  const [selectedVibe, setSelectedVibe] = useState('surprise');
  const [idea, setIdea] = useState<DateNightIdea | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const fetchIdea = async (vibeId: string = selectedVibe) => {
    setLoading(true);
    setError(null);
    setSentSuccess(false);
    setCompletedSteps([]);

    const preset = VIBE_PRESETS.find(v => v.id === vibeId);
    const vibeQuery = preset ? preset.query : 'romantic and creative';

    try {
      const result = await ApiService.generateDateNightIdea({
        vibe: vibeQuery,
        partner1Name: currentUser.displayName,
        partner2Name: partner?.displayName || 'Partner'
      });
      setIdea(result);
    } catch (err: any) {
      console.error('Error fetching date night idea:', err);
      setError('Could not generate date idea. Please tap refresh to try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch on mount
    fetchIdea('surprise');
  }, []);

  const handleVibeChange = (vibeId: string) => {
    setSelectedVibe(vibeId);
    fetchIdea(vibeId);
  };

  const handleShareToChat = async () => {
    if (!idea) return;
    const chatText = `✨ **Date Night Idea:** ${idea.title}\n📍 *${idea.location}* • ⏱️ *${idea.estimatedTime}*\n\n"${idea.description}"\n\n💬 *Conversation Question:* ${idea.conversationStarter}`;
    
    if (onSendToChat) {
      onSendToChat(chatText);
      setSentSuccess(true);
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.7 } });
      setTimeout(() => setSentSuccess(false), 3500);
    } else if (onNavigate) {
      onNavigate('chat');
    }
  };

  const toggleStep = (index: number) => {
    setCompletedSteps(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  return (
    <div id="random-date-night-card" className="p-6 rounded-3xl bg-white border border-stone-200/90 shadow-sm space-y-5 transition-all">
      {/* CARD HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-rose-100/80 text-rose-600">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-serif text-lg font-bold text-stone-900">
                Random Date Night Idea
              </h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[10px] font-bold text-amber-800 tracking-wide uppercase">
                <Sparkles className="w-2.5 h-2.5 text-amber-600" /> Gemini AI
              </span>
            </div>
            <p className="text-xs text-stone-500 font-medium">
              Personalized activity suggestions for {currentUser.displayName} & {partner?.displayName || 'Partner'}
            </p>
          </div>
        </div>

        {/* Generate / Refresh Button */}
        <button
          id="btn-refresh-date-idea"
          onClick={() => fetchIdea(selectedVibe)}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 text-xs font-semibold border border-rose-200/60 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Consulting AI...' : 'Roll Another Idea 🎲'}</span>
        </button>
      </div>

      {/* VIBE FILTER CHIPS */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {VIBE_PRESETS.map(preset => {
          const Icon = preset.icon;
          const isSelected = selectedVibe === preset.id;
          return (
            <button
              key={preset.id}
              onClick={() => handleVibeChange(preset.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                isSelected
                  ? 'bg-rose-500 text-white font-semibold shadow-xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200/70'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{preset.label}</span>
            </button>
          );
        })}
      </div>

      {/* CONTENT AREA */}
      {loading ? (
        <div className="p-8 rounded-2xl bg-stone-50/70 border border-stone-100 text-center space-y-3 animate-pulse">
          <div className="w-10 h-10 mx-auto rounded-full bg-rose-100 flex items-center justify-center text-rose-500">
            <Sparkles className="w-5 h-5 animate-spin" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-stone-700">Curating the perfect date...</h4>
            <p className="text-xs text-stone-400">Gemini AI is crafting a personalized experience for both of you.</p>
          </div>
        </div>
      ) : error ? (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-center space-y-2">
          <p className="text-xs text-rose-700 font-medium">{error}</p>
          <button
            onClick={() => fetchIdea(selectedVibe)}
            className="text-xs font-bold text-rose-600 underline"
          >
            Try Again
          </button>
        </div>
      ) : idea ? (
        <div className="space-y-4">
          {/* Main Idea Card Container */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-rose-50/50 via-amber-50/30 to-stone-50 border border-rose-100/80 space-y-4">
            {/* Badges & Category */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 text-[11px] font-bold tracking-wide uppercase">
                {idea.category}
              </span>
              <span className="text-[11px] text-stone-500 font-medium italic">
                {idea.vibe}
              </span>
            </div>

            {/* Title & Tagline */}
            <div className="space-y-1">
              <h4 className="font-serif text-xl font-bold text-stone-900 leading-snug">
                {idea.title}
              </h4>
              <p className="text-xs text-rose-900/80 font-medium italic">
                "{idea.tagline}"
              </p>
            </div>

            {/* Key Metadata Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <div className="p-2.5 rounded-xl bg-white/80 border border-rose-100/60 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <div className="overflow-hidden">
                  <div className="text-[10px] text-stone-400 font-semibold uppercase">Time</div>
                  <div className="text-xs font-semibold text-stone-800 truncate">{idea.estimatedTime}</div>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-white/80 border border-rose-100/60 flex items-center gap-2">
                <DollarSign className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <div className="overflow-hidden">
                  <div className="text-[10px] text-stone-400 font-semibold uppercase">Cost</div>
                  <div className="text-xs font-semibold text-stone-800 truncate">{idea.cost}</div>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-white/80 border border-rose-100/60 flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <div className="overflow-hidden">
                  <div className="text-[10px] text-stone-400 font-semibold uppercase">Setting</div>
                  <div className="text-xs font-semibold text-stone-800 truncate">{idea.location}</div>
                </div>
              </div>

              {idea.playlistTheme && (
                <div className="p-2.5 rounded-xl bg-white/80 border border-rose-100/60 flex items-center gap-2">
                  <Music className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <div className="overflow-hidden">
                    <div className="text-[10px] text-stone-400 font-semibold uppercase">Music Vibe</div>
                    <div className="text-xs font-semibold text-stone-800 truncate">{idea.playlistTheme}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Description */}
            <p className="text-xs text-stone-700 font-medium leading-relaxed bg-white/60 p-3.5 rounded-xl border border-rose-100/40">
              {idea.description}
            </p>

            {/* Activity Steps */}
            {idea.steps && idea.steps.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-stone-600 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-rose-500" />
                  <span>How to Make It Happen</span>
                </div>
                <div className="space-y-1.5">
                  {idea.steps.map((step, idx) => {
                    const isDone = completedSteps.includes(idx);
                    return (
                      <div
                        key={idx}
                        onClick={() => toggleStep(idx)}
                        className={`p-2.5 rounded-xl text-xs flex items-start gap-2.5 cursor-pointer transition-all ${
                          isDone
                            ? 'bg-rose-100/70 text-stone-500 line-through'
                            : 'bg-white/80 hover:bg-white text-stone-800 border border-rose-100/40'
                        }`}
                      >
                        <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${
                          isDone ? 'bg-rose-500 text-white' : 'bg-rose-100 text-rose-700'
                        }`}>
                          {idx + 1}
                        </span>
                        <span className="flex-1 font-medium">{step}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Conversation Starter Callout */}
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-rose-100/80 to-amber-100/80 border border-rose-200/60 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-rose-900">
                <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                <span>Intimate Conversation Question for Tonight:</span>
              </div>
              <p className="text-xs text-stone-800 font-serif italic pl-5">
                "{idea.conversationStarter}"
              </p>
            </div>

            {/* Romantic Secret Touch */}
            {idea.romanticTouch && (
              <div className="flex items-start gap-2 text-xs text-stone-600 bg-amber-50/70 p-3 rounded-xl border border-amber-200/50">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-amber-900">Secret Romantic Touch: </span>
                  <span className="font-medium text-stone-700">{idea.romanticTouch}</span>
                </div>
              </div>
            )}
          </div>

          {/* ACTION BUTTONS */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <button
              id="btn-share-date-chat"
              onClick={handleShareToChat}
              className="px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-black active:scale-95 text-white font-semibold text-xs transition-all flex items-center gap-2 shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{sentSuccess ? 'Shared to Chat! ❤️' : 'Share Date to Chat'}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  confetti({ particleCount: 50, spread: 70, origin: { y: 0.6 } });
                }}
                className="px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-rose-50 text-stone-700 hover:text-rose-600 font-semibold text-xs transition-colors flex items-center gap-1.5"
              >
                <Heart className="w-3.5 h-3.5 fill-rose-400 text-rose-400" />
                <span>Save to Favorites</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
