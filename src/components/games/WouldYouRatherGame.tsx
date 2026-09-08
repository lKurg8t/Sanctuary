import React, { useState, useEffect, useCallback } from 'react';
import { UserProfile, Couple, GamePrompt, GameSession, GameMove } from '../../types';
import { ApiService } from '../../lib/api';
import { Sparkles, Heart, ArrowLeft, Check, RefreshCw, Trophy, Plus, Smartphone, Users, Wifi } from 'lucide-react';
import confetti from 'canvas-confetti';

interface WouldYouRatherGameProps {
  currentUser: UserProfile;
  couple: Couple | null;
  partner: UserProfile | null;
  initialSessionId?: string | null;
  onBackToHub: () => void;
}

export const WouldYouRatherGame: React.FC<WouldYouRatherGameProps> = ({
  currentUser,
  couple,
  partner,
  initialSessionId,
  onBackToHub
}) => {
  const [prompts, setPrompts] = useState<GamePrompt[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId || null);
  const [activeSession, setActiveSession] = useState<GameSession | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [myChoice, setMyChoice] = useState<'A' | 'B' | null>(null);
  const [partnerChoice, setPartnerChoice] = useState<'A' | 'B' | null>(null);
  const [matchedCount, setMatchedCount] = useState(0);
  const [totalRounds, setTotalRounds] = useState(0);
  const [loading, setLoading] = useState(true);
  const [passAndPlay, setPassAndPlay] = useState(false);
  const [customOptA, setCustomOptA] = useState('');
  const [customOptB, setCustomOptB] = useState('');
  const [customCategory, setCustomCategory] = useState('Daily Romance');
  const [showAddCustom, setShowAddCustom] = useState(false);

  // 1. Load prompts
  const loadPrompts = useCallback(async () => {
    try {
      const data = await ApiService.getGamePrompts('would_you_rather');
      setPrompts(data);
    } catch (err) {
      console.error('Failed to load would you rather prompts:', err);
    }
  }, []);

  // 2. Initialize or fetch game session and moves from Supabase
  const initGameSession = useCallback(async () => {
    if (!couple?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      await loadPrompts();

      let session: GameSession;
      if (initialSessionId) {
        const allSessions = await ApiService.getGameSessions(couple.id);
        session =
          allSessions.find(s => s.id === initialSessionId) ||
          (await ApiService.createOrGetActiveGameSession({
            coupleId: couple.id,
            gameType: 'would_you_rather',
            player1Id: currentUser.id,
            player1Name: currentUser.displayName,
            player2Id: partner?.id,
            player2Name: partner?.displayName
          }));
      } else {
        session = await ApiService.createOrGetActiveGameSession({
          coupleId: couple.id,
          gameType: 'would_you_rather',
          player1Id: currentUser.id,
          player1Name: currentUser.displayName,
          player2Id: partner?.id,
          player2Name: partner?.displayName
        });
      }

      setSessionId(session.id);
      setActiveSession(session);

      const qIdx = session.state?.questionIndex ?? 0;
      setQuestionIndex(qIdx);
      setMatchedCount(session.score1 || 0);
      setTotalRounds(session.score2 || 0);

      // Load moves from Supabase game_moves table
      const moves = await ApiService.getGameMoves(session.id);
      syncChoicesFromMoves(moves, qIdx, currentUser.id, partner?.id);
    } catch (err) {
      console.error('Failed to init WouldYouRather session:', err);
    } finally {
      setLoading(false);
    }
  }, [couple?.id, currentUser.id, currentUser.displayName, partner?.id, partner?.displayName, initialSessionId, loadPrompts]);

  const syncChoicesFromMoves = (
    moves: GameMove[],
    currentQIdx: number,
    userId: string,
    partnerId?: string
  ) => {
    const movesForCurrentQ = moves.filter(
      m => m.moveData?.questionIndex === currentQIdx
    );

    const userMove = movesForCurrentQ.find(m => m.playerId === userId);
    const partnerMove = partnerId
      ? movesForCurrentQ.find(m => m.playerId === partnerId)
      : undefined;

    setMyChoice(userMove ? userMove.moveData?.choice : null);
    setPartnerChoice(partnerMove ? partnerMove.moveData?.choice : null);
  };

  useEffect(() => {
    initGameSession();
  }, [initGameSession]);

  // 3. Realtime subscription for moves and session updates
  useEffect(() => {
    if (!couple?.id) return;

    const cleanup = ApiService.subscribeToCoupleUpdates(couple.id, (event, data) => {
      if (event === 'game_turn_move') {
        const move = data.move;
        const sId = data.sessionId || move?.sessionId;
        if (sId === sessionId) {
          if (move?.moveData?.questionIndex !== undefined) {
            const moveQIdx = move.moveData.questionIndex;
            if (moveQIdx === questionIndex) {
              if (move.playerId === currentUser.id) {
                setMyChoice(move.moveData.choice);
              } else {
                setPartnerChoice(move.moveData.choice);
              }
            }
          }
        }
      } else if (event === 'game_updated' && data.id === sessionId) {
        setActiveSession(data);
        if (data.state?.questionIndex !== undefined && data.state.questionIndex !== questionIndex) {
          setQuestionIndex(data.state.questionIndex);
          setMyChoice(null);
          setPartnerChoice(null);
        }
        if (data.score1 !== undefined) setMatchedCount(data.score1);
        if (data.score2 !== undefined) setTotalRounds(data.score2);
      }
    });

    return cleanup;
  }, [couple?.id, sessionId, questionIndex, currentUser.id]);

  const currentPrompt = prompts.length > 0 ? prompts[questionIndex % prompts.length] : null;
  const optionA = currentPrompt?.extraData?.optionA || currentPrompt?.prompt?.split(' OR ')[0] || 'Option A';
  const optionB = currentPrompt?.extraData?.optionB || currentPrompt?.prompt?.split(' OR ')[1] || 'Option B';
  const category = currentPrompt?.category || 'Connection';

  // Handle user selecting an option
  const handleSelectOption = async (opt: 'A' | 'B', forPlayerId?: string) => {
    const actingPlayerId = forPlayerId || currentUser.id;
    const actingPlayerName = actingPlayerId === currentUser.id ? currentUser.displayName : (partner?.displayName || 'Partner');

    if (actingPlayerId === currentUser.id && myChoice) return;
    if (actingPlayerId === partner?.id && partnerChoice) return;

    if (actingPlayerId === currentUser.id) {
      setMyChoice(opt);
    } else {
      setPartnerChoice(opt);
    }

    if (!couple?.id || !sessionId) return;

    try {
      // Determine other player choice for matching calculation
      const otherChoice = actingPlayerId === currentUser.id ? partnerChoice : myChoice;
      const bothAnswered = otherChoice !== null;
      const isMatch = bothAnswered && otherChoice === opt;

      const newTotal = bothAnswered ? totalRounds + 1 : totalRounds;
      const newMatched = isMatch ? matchedCount + 1 : matchedCount;

      if (bothAnswered) {
        setTotalRounds(newTotal);
        if (isMatch) {
          setMatchedCount(newMatched);
          confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
        }
      }

      // Persist turn move to Supabase game_moves table
      await ApiService.recordGameMove({
        sessionId,
        coupleId: couple.id,
        playerId: actingPlayerId,
        playerName: actingPlayerName,
        moveData: {
          questionIndex,
          choice: opt,
          prompt: currentPrompt?.prompt
        },
        boardState: {
          questionIndex,
          [actingPlayerId]: opt
        },
        score1: newMatched,
        score2: newTotal,
        isFinished: false
      });
    } catch (err) {
      console.error('Error saving game move:', err);
    }
  };

  // Advance to next question
  const handleNext = async () => {
    const nextQIdx = questionIndex + 1;
    setMyChoice(null);
    setPartnerChoice(null);
    setQuestionIndex(nextQIdx);

    if (couple?.id && sessionId) {
      try {
        await ApiService.makeGameMove(sessionId, {
          userId: currentUser.id,
          updatedState: {
            questionIndex: nextQIdx
          },
          score1: matchedCount,
          score2: totalRounds
        });
      } catch (err) {
        console.error('Failed to advance question in Supabase session:', err);
      }
    }
  };

  const handleAddCustomPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customOptA.trim() || !customOptB.trim()) return;

    try {
      const newPrompt = await ApiService.createGamePrompt({
        gameType: 'would_you_rather',
        category: customCategory,
        prompt: `${customOptA.trim()} OR ${customOptB.trim()}`,
        extraData: { optionA: customOptA.trim(), optionB: customOptB.trim() }
      });
      setPrompts(prev => [...prev, newPrompt]);
      setCustomOptA('');
      setCustomOptB('');
      setShowAddCustom(false);
      setQuestionIndex(prompts.length);
      setMyChoice(null);
      setPartnerChoice(null);
    } catch (err) {
      console.error('Failed to create custom prompt:', err);
    }
  };

  const isMatched = myChoice && partnerChoice && myChoice === partnerChoice;
  const compatibilityPercentage = totalRounds > 0 ? Math.round((matchedCount / totalRounds) * 100) : 0;
  const bothAnswered = myChoice !== null && partnerChoice !== null;

  return (
    <div className="space-y-6 max-w-xl mx-auto animate-in fade-in duration-200">
      {/* Top Bar */}
      <div className="flex items-center justify-between bg-white p-4 rounded-3xl border border-stone-200 shadow-xs">
        <button
          onClick={onBackToHub}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-stone-100 text-stone-700 text-xs font-semibold hover:bg-stone-200 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Game Hub</span>
        </button>

        <div className="text-center">
          <span className="text-[10px] uppercase font-bold text-stone-400">Compatibility</span>
          <p className="text-xs font-bold text-rose-600">
            {compatibilityPercentage}% Match ({matchedCount}/{totalRounds})
          </p>
        </div>

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
          <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
            Round {questionIndex + 1}
          </span>
        </div>
      </div>

      {/* Realtime Turn Banner */}
      <div className="flex items-center justify-between px-2 text-xs font-medium text-stone-500">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Supabase Realtime Synced</span>
        </div>
        <div>
          {myChoice && !partnerChoice ? (
            <span className="text-amber-600 font-semibold animate-pulse">
              Waiting for {partner?.displayName || 'partner'} to answer...
            </span>
          ) : !myChoice && partnerChoice ? (
            <span className="text-rose-600 font-semibold">
              {partner?.displayName || 'Partner'} has answered! Your turn.
            </span>
          ) : bothAnswered ? (
            <span className="text-emerald-700 font-semibold">Both partners answered!</span>
          ) : (
            <span>Both choose an option to reveal compatibility</span>
          )}
        </div>
      </div>

      {/* Question Header */}
      <div className="text-center space-y-1">
        <span className="text-xs font-bold uppercase tracking-wider text-rose-600 bg-rose-50 px-3 py-1 rounded-full">
          {category}
        </span>
        <h3 className="text-xl font-serif font-bold text-stone-800 pt-2">
          Would you rather...
        </h3>
      </div>

      {/* The Two Choice Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Option A */}
        <button
          onClick={() => handleSelectOption('A')}
          disabled={!!myChoice || loading}
          className={`p-6 rounded-3xl border text-left flex flex-col justify-between space-y-4 transition-all shadow-sm cursor-pointer ${
            myChoice === 'A'
              ? 'bg-rose-600 text-white border-rose-600 shadow-rose-200'
              : 'bg-white hover:bg-stone-50 border-stone-200 text-stone-800'
          }`}
        >
          <span
            className={`w-8 h-8 rounded-xl font-bold text-xs flex items-center justify-center ${
              myChoice === 'A' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-700'
            }`}
          >
            A
          </span>
          <p className="text-base font-serif font-medium leading-snug">{optionA}</p>
          <div className="text-xs font-semibold pt-2 flex items-center justify-between">
            {myChoice === 'A' && (
              <span className="flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Your Choice
              </span>
            )}
            {bothAnswered && partnerChoice === 'A' && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] ${
                  myChoice === 'A' ? 'bg-white/20 text-white' : 'bg-rose-50 text-rose-600'
                }`}
              >
                {partner?.displayName || 'Partner'}'s Choice
              </span>
            )}
          </div>
        </button>

        {/* Option B */}
        <button
          onClick={() => handleSelectOption('B')}
          disabled={!!myChoice || loading}
          className={`p-6 rounded-3xl border text-left flex flex-col justify-between space-y-4 transition-all shadow-sm cursor-pointer ${
            myChoice === 'B'
              ? 'bg-rose-600 text-white border-rose-600 shadow-rose-200'
              : 'bg-white hover:bg-stone-50 border-stone-200 text-stone-800'
          }`}
        >
          <span
            className={`w-8 h-8 rounded-xl font-bold text-xs flex items-center justify-center ${
              myChoice === 'B' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-700'
            }`}
          >
            B
          </span>
          <p className="text-base font-serif font-medium leading-snug">{optionB}</p>
          <div className="text-xs font-semibold pt-2 flex items-center justify-between">
            {myChoice === 'B' && (
              <span className="flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Your Choice
              </span>
            )}
            {bothAnswered && partnerChoice === 'B' && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] ${
                  myChoice === 'B' ? 'bg-white/20 text-white' : 'bg-rose-50 text-rose-600'
                }`}
              >
                {partner?.displayName || 'Partner'}'s Choice
              </span>
            )}
          </div>
        </button>
      </div>

      {/* Same-phone pass and play helper button if partner wants to submit on this device */}
      {passAndPlay && myChoice && !partnerChoice && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-center space-y-2">
          <p className="text-xs text-amber-800 font-semibold">
            Pass phone to {partner?.displayName || 'Partner'} to select Option A or B:
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => handleSelectOption('A', partner?.id)}
              className="px-4 py-1.5 bg-white border border-amber-300 text-amber-900 rounded-xl text-xs font-bold hover:bg-amber-100 cursor-pointer"
            >
              Partner chooses A
            </button>
            <button
              onClick={() => handleSelectOption('B', partner?.id)}
              className="px-4 py-1.5 bg-white border border-amber-300 text-amber-900 rounded-xl text-xs font-bold hover:bg-amber-100 cursor-pointer"
            >
              Partner chooses B
            </button>
          </div>
        </div>
      )}

      {/* Match Result Banner (shown once both answer) */}
      {bothAnswered && (
        <div
          className={`p-4 rounded-3xl text-center space-y-2 border transition-all animate-in zoom-in-95 ${
            isMatched
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          <div className="flex items-center justify-center gap-1.5 font-serif font-bold text-sm">
            {isMatched ? (
              <>
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>Perfect Match! You both chose Option {myChoice}.</span>
              </>
            ) : (
              <>
                <Heart className="w-4 h-4 text-amber-600" />
                <span>
                  Playful Contrast! You picked {myChoice} while {partner?.displayName || 'partner'} picked {partnerChoice}.
                </span>
              </>
            )}
          </div>
          <button
            onClick={handleNext}
            className="mt-2 py-2 px-6 rounded-xl bg-stone-900 text-white text-xs font-bold hover:bg-stone-800 shadow-xs cursor-pointer"
          >
            Next Question →
          </button>
        </div>
      )}

      {/* Custom Question Form */}
      <div className="text-center pt-2">
        {!showAddCustom ? (
          <button
            onClick={() => setShowAddCustom(true)}
            className="text-xs text-stone-500 hover:text-stone-800 font-medium inline-flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create a custom Would You Rather question</span>
          </button>
        ) : (
          <form onSubmit={handleAddCustomPrompt} className="bg-stone-50 p-4 rounded-2xl border border-stone-200 space-y-3 text-left">
            <h4 className="text-xs font-bold text-stone-700">Add New Would You Rather</h4>
            <div>
              <label className="text-[11px] font-semibold text-stone-500">Option A</label>
              <input
                type="text"
                value={customOptA}
                onChange={e => setCustomOptA(e.target.value)}
                placeholder="e.g. Spend a weekend in a mountain cabin..."
                className="w-full text-xs p-2.5 rounded-xl bg-white border border-stone-200 focus:outline-none focus:ring-2 focus:ring-rose-400"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-stone-500">Option B</label>
              <input
                type="text"
                value={customOptB}
                onChange={e => setCustomOptB(e.target.value)}
                placeholder="e.g. Spend a weekend in an oceanfront villa..."
                className="w-full text-xs p-2.5 rounded-xl bg-white border border-stone-200 focus:outline-none focus:ring-2 focus:ring-rose-400"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
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
                Save Question
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
