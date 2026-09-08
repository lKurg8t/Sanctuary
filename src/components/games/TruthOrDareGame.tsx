import React, { useState, useEffect, useCallback } from 'react';
import { UserProfile, Couple, GamePrompt, GameSession, GameMove } from '../../types';
import { ApiService } from '../../lib/api';
import { Sparkles, Flame, Heart, Shuffle, CheckCircle2, Plus, ArrowLeft, Smartphone, Wifi, History } from 'lucide-react';
import confetti from 'canvas-confetti';

interface TruthOrDareGameProps {
  currentUser: UserProfile;
  couple: Couple | null;
  partner: UserProfile | null;
  initialSessionId?: string | null;
  onBackToHub: () => void;
}

type Category = 'romantic' | 'deep' | 'playful' | 'spicy';

export const TruthOrDareGame: React.FC<TruthOrDareGameProps> = ({
  currentUser,
  couple,
  partner,
  initialSessionId,
  onBackToHub
}) => {
  const [prompts, setPrompts] = useState<GamePrompt[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId || null);
  const [activeSession, setActiveSession] = useState<GameSession | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category>('romantic');
  const [currentPromptType, setCurrentPromptType] = useState<'truth' | 'dare'>('truth');
  const [currentPrompt, setCurrentPrompt] = useState<string>('');
  const [completedPromptsCount, setCompletedPromptsCount] = useState(0);
  const [passAndPlay, setPassAndPlay] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [historyMoves, setHistoryMoves] = useState<GameMove[]>([]);
  const [loading, setLoading] = useState(true);

  // Turn detection
  const currentTurnUserId = activeSession?.currentTurnUserId || currentUser.id;
  const isMyTurn = passAndPlay || currentTurnUserId === currentUser.id;
  const turnPlayerName =
    currentTurnUserId === currentUser.id
      ? currentUser.displayName
      : partner?.displayName || 'Partner';

  // 1. Load prompts
  const loadPrompts = useCallback(async () => {
    try {
      const data = await ApiService.getGamePrompts('truth_or_dare');
      setPrompts(data);
      return data;
    } catch (err) {
      console.error('Failed to load truth or dare prompts:', err);
      return [];
    }
  }, []);

  const pickPromptFromList = useCallback(
    (list: GamePrompt[], cat: Category, type: 'truth' | 'dare') => {
      const filtered = list.filter(
        p => p.category.toLowerCase() === cat.toLowerCase() && p.extraData?.type === type
      );
      if (filtered.length > 0) {
        const item = filtered[Math.floor(Math.random() * filtered.length)];
        return item.prompt;
      }
      return type === 'truth'
        ? 'What is something you love most about our relationship?'
        : 'Give your partner a warm 30-second hug and whisper something sweet.';
    },
    []
  );

  // 2. Initialize or fetch session and moves from Supabase
  const initGameSession = useCallback(async () => {
    if (!couple?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const promptList = await loadPrompts();

      let session: GameSession;
      if (initialSessionId) {
        const allSessions = await ApiService.getGameSessions(couple.id);
        session =
          allSessions.find(s => s.id === initialSessionId) ||
          (await ApiService.createOrGetActiveGameSession({
            coupleId: couple.id,
            gameType: 'truth_or_dare',
            player1Id: currentUser.id,
            player1Name: currentUser.displayName,
            player2Id: partner?.id,
            player2Name: partner?.displayName,
            currentTurnUserId: currentUser.id
          }));
      } else {
        session = await ApiService.createOrGetActiveGameSession({
          coupleId: couple.id,
          gameType: 'truth_or_dare',
          player1Id: currentUser.id,
          player1Name: currentUser.displayName,
          player2Id: partner?.id,
          player2Name: partner?.displayName,
          currentTurnUserId: currentUser.id
        });
      }

      setSessionId(session.id);
      setActiveSession(session);
      setCompletedPromptsCount((session.score1 || 0) + (session.score2 || 0));

      // Load moves
      const moves = await ApiService.getGameMoves(session.id);
      setHistoryMoves(moves);

      if (session.state?.prompt) {
        setCurrentPrompt(session.state.prompt);
        if (session.state.category) setSelectedCategory(session.state.category);
        if (session.state.type) setCurrentPromptType(session.state.type);
      } else {
        const initialP = pickPromptFromList(promptList, 'romantic', 'truth');
        setCurrentPrompt(initialP);
      }
    } catch (err) {
      console.error('Failed to init TruthOrDare session:', err);
    } finally {
      setLoading(false);
    }
  }, [couple?.id, currentUser.id, currentUser.displayName, partner?.id, partner?.displayName, initialSessionId, loadPrompts, pickPromptFromList]);

  useEffect(() => {
    initGameSession();
  }, [initGameSession]);

  // 3. Realtime subscription
  useEffect(() => {
    if (!couple?.id) return;

    const cleanup = ApiService.subscribeToCoupleUpdates(couple.id, (event, data) => {
      if (event === 'game_turn_move') {
        const sId = data.sessionId || data.move?.sessionId;
        if (sId === sessionId) {
          if (data.move) {
            setHistoryMoves(prev => [data.move, ...prev]);
          }
          if (data.nextTurnUserId && activeSession) {
            setActiveSession(prev => (prev ? { ...prev, currentTurnUserId: data.nextTurnUserId } : null));
          }
        }
      } else if (event === 'game_updated' && data.id === sessionId) {
        setActiveSession(data);
        if (data.state?.prompt) {
          setCurrentPrompt(data.state.prompt);
          if (data.state.category) setSelectedCategory(data.state.category);
          if (data.state.type) setCurrentPromptType(data.state.type);
        }
        if (data.score1 !== undefined || data.score2 !== undefined) {
          setCompletedPromptsCount((data.score1 || 0) + (data.score2 || 0));
        }
      }
    });

    return cleanup;
  }, [couple?.id, sessionId, activeSession]);

  const handleCategoryChange = (cat: Category) => {
    setSelectedCategory(cat);
    const p = pickPromptFromList(prompts, cat, currentPromptType);
    setCurrentPrompt(p);
  };

  const handleTypeChange = (type: 'truth' | 'dare') => {
    setCurrentPromptType(type);
    const p = pickPromptFromList(prompts, selectedCategory, type);
    setCurrentPrompt(p);
  };

  const handleShuffle = () => {
    const p = pickPromptFromList(prompts, selectedCategory, currentPromptType);
    setCurrentPrompt(p);
  };

  // Complete current turn and pass to partner
  const handleComplete = async () => {
    const newCount = completedPromptsCount + 1;
    setCompletedPromptsCount(newCount);
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });

    const nextTurnUserId = currentTurnUserId === currentUser.id ? partner?.id || currentUser.id : currentUser.id;
    const isP1 = currentTurnUserId === currentUser.id;
    const score1 = isP1 ? (activeSession?.score1 || 0) + 1 : (activeSession?.score1 || 0);
    const score2 = !isP1 ? (activeSession?.score2 || 0) + 1 : (activeSession?.score2 || 0);

    const nextPrompt = pickPromptFromList(prompts, selectedCategory, currentPromptType);
    setCurrentPrompt(nextPrompt);

    if (couple?.id && sessionId) {
      try {
        await ApiService.recordGameMove({
          sessionId,
          coupleId: couple.id,
          playerId: currentTurnUserId,
          playerName: turnPlayerName,
          moveData: {
            prompt: currentPrompt,
            category: selectedCategory,
            type: currentPromptType
          },
          boardState: {
            prompt: nextPrompt,
            category: selectedCategory,
            type: currentPromptType
          },
          nextTurnUserId,
          score1,
          score2,
          isFinished: false
        });

        setActiveSession(prev =>
          prev
            ? {
                ...prev,
                currentTurnUserId: nextTurnUserId,
                score1,
                score2,
                state: { prompt: nextPrompt, category: selectedCategory, type: currentPromptType }
              }
            : null
        );
      } catch (err) {
        console.error('Error saving TruthOrDare move:', err);
      }
    }
  };

  const handleAddCustomPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPrompt.trim()) return;

    try {
      const newPrompt = await ApiService.createGamePrompt({
        gameType: 'truth_or_dare',
        category: selectedCategory,
        prompt: customPrompt.trim(),
        extraData: { type: currentPromptType }
      });
      setPrompts(prev => [...prev, newPrompt]);
      setCurrentPrompt(newPrompt.prompt);
      setCustomPrompt('');
      setShowAddCustom(false);
    } catch (err) {
      console.error('Failed to create custom prompt:', err);
    }
  };

  return (
    <div className="space-y-6 max-w-xl mx-auto animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between bg-white p-4 rounded-3xl border border-stone-200 shadow-xs">
        <button
          onClick={onBackToHub}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-stone-100 text-stone-700 text-xs font-semibold hover:bg-stone-200 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Game Hub</span>
        </button>

        <h3 className="font-serif font-bold text-sm text-stone-800">
          Truth or Dare • Sanctuary Deck
        </h3>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setPassAndPlay(!passAndPlay)}
            className={`p-1.5 rounded-xl text-xs flex items-center gap-1 border transition-colors cursor-pointer ${
              passAndPlay
                ? 'bg-rose-50 text-rose-600 border-rose-200'
                : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
            }`}
            title="Toggle Pass & Play on same screen"
          >
            {passAndPlay ? <Smartphone className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5 text-emerald-600" />}
            <span className="text-[11px] font-semibold hidden sm:inline">
              {passAndPlay ? 'Same Phone' : 'Live Sync'}
            </span>
          </button>
          <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
            {completedPromptsCount} Done
          </span>
        </div>
      </div>

      {/* Realtime Turn Banner */}
      <div className="flex items-center justify-between px-2 text-xs font-medium text-stone-500">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Supabase Realtime Turn Sync</span>
        </div>
        <div>
          {isMyTurn ? (
            <span className="text-rose-600 font-bold animate-pulse">
              ★ It's your turn to answer or perform!
            </span>
          ) : (
            <span className="text-amber-600 font-bold">
              Waiting for {partner?.displayName || 'partner'}'s turn...
            </span>
          )}
        </div>
      </div>

      {/* Category selector */}
      <div className="grid grid-cols-4 gap-2">
        {(['romantic', 'deep', 'playful', 'spicy'] as const).map(cat => (
          <button
            key={cat}
            onClick={() => handleCategoryChange(cat)}
            className={`py-2.5 px-2 rounded-2xl text-xs font-bold capitalize border transition-all text-center cursor-pointer ${
              selectedCategory === cat
                ? 'bg-stone-900 text-white border-stone-900 shadow-sm'
                : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
            }`}
          >
            {cat === 'romantic' && '❤️ Romantic'}
            {cat === 'deep' && '🌿 Deep'}
            {cat === 'playful' && '🎉 Playful'}
            {cat === 'spicy' && '🔥 Spicy'}
          </button>
        ))}
      </div>

      {/* Choice Buttons: Truth vs Dare */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => handleTypeChange('truth')}
          className={`py-3.5 px-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer ${
            currentPromptType === 'truth'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-200'
              : 'bg-white text-rose-600 border border-rose-200 hover:bg-rose-50'
          }`}
        >
          <Heart className="w-4 h-4" />
          <span>Truth Prompt</span>
        </button>

        <button
          onClick={() => handleTypeChange('dare')}
          className={`py-3.5 px-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer ${
            currentPromptType === 'dare'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-200'
              : 'bg-white text-amber-600 border border-amber-200 hover:bg-amber-50'
          }`}
        >
          <Flame className="w-4 h-4" />
          <span>Dare Challenge</span>
        </button>
      </div>

      {/* Card Visual Presentation */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-500 via-rose-600 to-stone-900 p-8 text-white shadow-xl min-h-[220px] flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-rose-200 uppercase tracking-widest font-semibold">
          <span>{selectedCategory} category</span>
          <span>{currentPromptType?.toUpperCase()}</span>
        </div>

        <div className="my-6">
          <p className="text-xl sm:text-2xl font-serif text-center leading-relaxed font-medium">
            "{currentPrompt || (loading ? 'Loading prompt from database...' : 'No prompt found')}"
          </p>
        </div>

        <div className="flex items-center justify-between text-xs text-rose-200">
          <span className="font-semibold text-white">
            {isMyTurn ? '★ Your Turn' : `${partner?.displayName || 'Partner'}'s Turn`}
          </span>
          <span>Completed: {completedPromptsCount}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleShuffle}
          disabled={!isMyTurn && !passAndPlay}
          className="flex-1 py-3 px-4 rounded-2xl bg-white border border-stone-200 text-stone-700 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-stone-50 shadow-xs cursor-pointer disabled:opacity-50"
        >
          <Shuffle className="w-4 h-4 text-stone-500" />
          <span>Shuffle Card</span>
        </button>

        <button
          onClick={handleComplete}
          disabled={!isMyTurn && !passAndPlay}
          className="flex-2 py-3 px-4 rounded-2xl bg-stone-900 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-stone-800 shadow-md cursor-pointer disabled:opacity-50"
        >
          <CheckCircle2 className="w-4 h-4 text-rose-400" />
          <span>Completed & Pass Turn →</span>
        </button>
      </div>

      {/* Move History */}
      {historyMoves.length > 0 && (
        <div className="bg-white p-4 rounded-3xl border border-stone-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-stone-600 uppercase tracking-wider flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" />
              <span>Turn History</span>
            </h4>
            <span className="text-[10px] text-stone-400">Stored in Supabase game_moves</span>
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
            {historyMoves.slice(0, 10).map((m, i) => (
              <div key={m.id || i} className="text-xs p-2.5 rounded-xl bg-stone-50 border border-stone-100 flex items-center justify-between">
                <span className="font-serif text-stone-700 truncate max-w-[280px]">
                  "{m.moveData?.prompt}"
                </span>
                <span className="font-semibold text-[10px] text-rose-600 capitalize">
                  {m.playerName} ({m.moveData?.type})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Custom Prompt Toggle */}
      <div className="text-center pt-2">
        {!showAddCustom ? (
          <button
            onClick={() => setShowAddCustom(true)}
            className="text-xs text-stone-500 hover:text-stone-800 font-medium inline-flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add your own secret question to this deck</span>
          </button>
        ) : (
          <form onSubmit={handleAddCustomPrompt} className="bg-stone-50 p-4 rounded-2xl border border-stone-200 space-y-3">
            <h4 className="text-xs font-bold text-stone-700 text-left">Create New {currentPromptType?.toUpperCase()} Prompt</h4>
            <textarea
              value={customPrompt}
              onChange={e => setCustomPrompt(e.target.value)}
              placeholder={`Write your custom ${currentPromptType} for ${partner?.displayName || 'your partner'}...`}
              className="w-full text-sm p-3 rounded-xl bg-white border border-stone-200 focus:outline-none focus:ring-2 focus:ring-rose-400"
              rows={2}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddCustom(false)}
                className="px-3 py-1.5 text-xs text-stone-600 rounded-lg hover:bg-stone-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-bold bg-rose-600 text-white rounded-lg hover:bg-rose-700 shadow-xs cursor-pointer"
              >
                Save to Database
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
