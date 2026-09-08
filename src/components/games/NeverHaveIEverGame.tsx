import React, { useState, useEffect, useCallback } from 'react';
import { UserProfile, Couple, GamePrompt, GameSession, GameMove } from '../../types';
import { ApiService } from '../../lib/api';
import { ArrowLeft, Sparkles, Heart, Check, X, Shuffle, Trophy, Plus, Smartphone, Wifi } from 'lucide-react';
import confetti from 'canvas-confetti';

interface NeverHaveIEverGameProps {
  currentUser: UserProfile;
  couple: Couple | null;
  partner: UserProfile | null;
  initialSessionId?: string | null;
  onBackToHub: () => void;
}

export const NeverHaveIEverGame: React.FC<NeverHaveIEverGameProps> = ({
  currentUser,
  couple,
  partner,
  initialSessionId,
  onBackToHub
}) => {
  const [prompts, setPrompts] = useState<GamePrompt[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId || null);
  const [activeSession, setActiveSession] = useState<GameSession | null>(null);
  const [index, setIndex] = useState(0);
  const [myAnswer, setMyAnswer] = useState<'have' | 'never' | null>(null);
  const [partnerAnswer, setPartnerAnswer] = useState<'have' | 'never' | null>(null);
  const [history, setHistory] = useState<{ question: string; my: string; partner: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [passAndPlay, setPassAndPlay] = useState(false);
  const [customQuestion, setCustomQuestion] = useState('');
  const [showAddCustom, setShowAddCustom] = useState(false);

  // 1. Load prompts
  const loadPrompts = useCallback(async () => {
    try {
      const data = await ApiService.getGamePrompts('never_have_i_ever');
      setPrompts(data);
    } catch (err) {
      console.error('Failed to load Never Have I Ever prompts:', err);
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
            gameType: 'never_have_i_ever',
            player1Id: currentUser.id,
            player1Name: currentUser.displayName,
            player2Id: partner?.id,
            player2Name: partner?.displayName
          }));
      } else {
        session = await ApiService.createOrGetActiveGameSession({
          coupleId: couple.id,
          gameType: 'never_have_i_ever',
          player1Id: currentUser.id,
          player1Name: currentUser.displayName,
          player2Id: partner?.id,
          player2Name: partner?.displayName
        });
      }

      setSessionId(session.id);
      setActiveSession(session);

      const qIdx = session.state?.questionIndex ?? 0;
      setIndex(qIdx);

      // Load moves from Supabase game_moves table
      const moves = await ApiService.getGameMoves(session.id);
      rebuildHistoryAndCurrentFromMoves(moves, qIdx, currentUser.id, partner?.id);
    } catch (err) {
      console.error('Failed to init NeverHaveIEver session:', err);
    } finally {
      setLoading(false);
    }
  }, [couple?.id, currentUser.id, currentUser.displayName, partner?.id, partner?.displayName, initialSessionId, loadPrompts]);

  const rebuildHistoryAndCurrentFromMoves = (
    moves: GameMove[],
    currentQIdx: number,
    userId: string,
    partnerId?: string
  ) => {
    // Current question answers
    const movesForCurrent = moves.filter(m => m.moveData?.questionIndex === currentQIdx);
    const userMove = movesForCurrent.find(m => m.playerId === userId);
    const partnerMove = partnerId ? movesForCurrent.find(m => m.playerId === partnerId) : undefined;

    setMyAnswer(userMove ? userMove.moveData?.answer : null);
    setPartnerAnswer(partnerMove ? partnerMove.moveData?.answer : null);

    // Rebuild history of completed questions
    const roundMap: Record<number, { question: string; my: string; partner: string }> = {};
    moves.forEach(m => {
      const qIdx = m.moveData?.questionIndex;
      if (qIdx !== undefined && qIdx !== currentQIdx) {
        if (!roundMap[qIdx]) {
          roundMap[qIdx] = {
            question: m.moveData?.question || `Confession #${qIdx + 1}`,
            my: '—',
            partner: '—'
          };
        }
        if (m.playerId === userId) {
          roundMap[qIdx].my = m.moveData?.answer;
        } else {
          roundMap[qIdx].partner = m.moveData?.answer;
        }
      }
    });

    const histList = Object.values(roundMap).reverse();
    setHistory(histList);
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
            if (moveQIdx === index) {
              if (move.playerId === currentUser.id) {
                setMyAnswer(move.moveData.answer);
              } else {
                setPartnerAnswer(move.moveData.answer);
              }
            }
          }
        }
      } else if (event === 'game_updated' && data.id === sessionId) {
        setActiveSession(data);
        if (data.state?.questionIndex !== undefined && data.state.questionIndex !== index) {
          setIndex(data.state.questionIndex);
          setMyAnswer(null);
          setPartnerAnswer(null);
        }
      }
    });

    return cleanup;
  }, [couple?.id, sessionId, index, currentUser.id]);

  const currentQ = prompts.length > 0 ? prompts[index % prompts.length]?.prompt : 'Never have I ever smiled just thinking about you.';

  const handleAnswer = async (ans: 'have' | 'never', forPlayerId?: string) => {
    const actingPlayerId = forPlayerId || currentUser.id;
    const actingPlayerName = actingPlayerId === currentUser.id ? currentUser.displayName : (partner?.displayName || 'Partner');

    if (actingPlayerId === currentUser.id && myAnswer) return;
    if (actingPlayerId === partner?.id && partnerAnswer) return;

    if (actingPlayerId === currentUser.id) {
      setMyAnswer(ans);
    } else {
      setPartnerAnswer(ans);
    }

    if (!couple?.id || !sessionId) return;

    try {
      const otherAns = actingPlayerId === currentUser.id ? partnerAnswer : myAnswer;
      const bothAnswered = otherAns !== null;

      if (bothAnswered) {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
        setHistory(prev => [
          {
            question: currentQ,
            my: actingPlayerId === currentUser.id ? ans : otherAns!,
            partner: actingPlayerId === currentUser.id ? otherAns! : ans
          },
          ...prev
        ]);
      }

      // Persist move to Supabase game_moves table
      await ApiService.recordGameMove({
        sessionId,
        coupleId: couple.id,
        playerId: actingPlayerId,
        playerName: actingPlayerName,
        moveData: {
          questionIndex: index,
          question: currentQ,
          answer: ans
        },
        boardState: {
          questionIndex: index,
          [actingPlayerId]: ans
        },
        isFinished: false
      });
    } catch (err) {
      console.error('Error recording Never Have I Ever move:', err);
    }
  };

  const handleNext = async () => {
    const nextIdx = index + 1;
    setMyAnswer(null);
    setPartnerAnswer(null);
    setIndex(nextIdx);

    if (couple?.id && sessionId) {
      try {
        await ApiService.makeGameMove(sessionId, {
          userId: currentUser.id,
          updatedState: {
            questionIndex: nextIdx
          }
        });
      } catch (err) {
        console.error('Failed to advance confession:', err);
      }
    }
  };

  const handleAddCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customQuestion.trim()) return;

    let formatted = customQuestion.trim();
    if (!formatted.toLowerCase().startsWith('never have i ever')) {
      formatted = `Never have I ever ${formatted}`;
    }

    try {
      const newPrompt = await ApiService.createGamePrompt({
        gameType: 'never_have_i_ever',
        category: 'Confessions',
        prompt: formatted
      });
      setPrompts(prev => [...prev, newPrompt]);
      setCustomQuestion('');
      setShowAddCustom(false);
      setIndex(prompts.length);
      setMyAnswer(null);
      setPartnerAnswer(null);
    } catch (err) {
      console.error('Failed to add custom question:', err);
    }
  };

  const bothAnswered = myAnswer !== null && partnerAnswer !== null;

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

        <h3 className="font-serif font-bold text-sm text-stone-800">
          Never Have I Ever
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
            Card {index + 1}
          </span>
        </div>
      </div>

      {/* Realtime Status Indicator */}
      <div className="flex items-center justify-between px-2 text-xs font-medium text-stone-500">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Multiplayer Realtime Sync</span>
        </div>
        <div>
          {myAnswer && !partnerAnswer ? (
            <span className="text-amber-600 font-semibold animate-pulse">
              Waiting for {partner?.displayName || 'partner'}'s confession...
            </span>
          ) : !myAnswer && partnerAnswer ? (
            <span className="text-rose-600 font-semibold">
              {partner?.displayName || 'Partner'} answered! Your turn.
            </span>
          ) : bothAnswered ? (
            <span className="text-emerald-700 font-semibold">Both answered!</span>
          ) : (
            <span>Both answer to reveal confessions</span>
          )}
        </div>
      </div>

      {/* Main Card */}
      <div className="p-8 rounded-3xl bg-gradient-to-br from-rose-50 to-amber-50 border border-rose-200 shadow-sm text-center space-y-6">
        <span className="text-xs font-bold uppercase tracking-wider text-rose-700 bg-white px-3 py-1 rounded-full border border-rose-200 shadow-xs">
          Couple Confessions
        </span>

        <p className="font-serif text-xl sm:text-2xl font-bold text-stone-800 leading-relaxed max-w-md mx-auto">
          "{currentQ}"
        </p>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
          <button
            onClick={() => handleAnswer('have')}
            disabled={!!myAnswer || loading}
            className={`py-3.5 px-4 rounded-2xl font-bold text-xs transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer ${
              myAnswer === 'have'
                ? 'bg-rose-600 text-white shadow-rose-200'
                : 'bg-white text-rose-700 border border-rose-200 hover:bg-rose-50'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>I HAVE 🙈</span>
          </button>

          <button
            onClick={() => handleAnswer('never')}
            disabled={!!myAnswer || loading}
            className={`py-3.5 px-4 rounded-2xl font-bold text-xs transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer ${
              myAnswer === 'never'
                ? 'bg-stone-800 text-white shadow-stone-300'
                : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-50'
            }`}
          >
            <X className="w-4 h-4" />
            <span>NEVER 😇</span>
          </button>
        </div>

        {/* Pass and play buttons for same phone */}
        {passAndPlay && myAnswer && !partnerAnswer && (
          <div className="p-3 bg-white/80 border border-rose-200 rounded-2xl space-y-2">
            <p className="text-xs font-semibold text-rose-800">
              Pass phone to {partner?.displayName || 'Partner'}:
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => handleAnswer('have', partner?.id)}
                className="px-4 py-1.5 bg-rose-100 text-rose-800 rounded-xl text-xs font-bold hover:bg-rose-200 cursor-pointer"
              >
                Partner: I HAVE 🙈
              </button>
              <button
                onClick={() => handleAnswer('never', partner?.id)}
                className="px-4 py-1.5 bg-stone-100 text-stone-800 rounded-xl text-xs font-bold hover:bg-stone-200 cursor-pointer"
              >
                Partner: NEVER 😇
              </button>
            </div>
          </div>
        )}

        {/* Result banner */}
        {bothAnswered && (
          <div className="pt-2 border-t border-rose-200/60 animate-in fade-in">
            <p className="text-xs font-bold text-stone-700">
              You: <span className="uppercase text-rose-600 font-bold">{myAnswer}</span> • {partner?.displayName || 'Partner'}: <span className="uppercase text-stone-800 font-bold">{partnerAnswer}</span>
            </p>
            <button
              onClick={handleNext}
              className="mt-4 py-2 px-6 rounded-xl bg-stone-900 text-white text-xs font-bold hover:bg-stone-800 shadow-xs cursor-pointer"
            >
              Next Confession →
            </button>
          </div>
        )}
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="bg-white p-4 rounded-3xl border border-stone-200 shadow-xs space-y-3">
          <h4 className="text-xs font-bold text-stone-600 uppercase tracking-wider">Round History</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {history.map((h, i) => (
              <div key={i} className="text-xs p-2.5 rounded-xl bg-stone-50 border border-stone-100 flex items-center justify-between">
                <span className="font-serif text-stone-700 truncate max-w-[220px]">{h.question}</span>
                <div className="flex gap-2 font-bold text-[10px]">
                  <span className={h.my === 'have' ? 'text-rose-600' : 'text-stone-500'}>You: {h.my}</span>
                  <span className={h.partner === 'have' ? 'text-rose-600' : 'text-stone-500'}>{partner?.displayName || 'Partner'}: {h.partner}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Custom question */}
      <div className="text-center pt-2">
        {!showAddCustom ? (
          <button
            onClick={() => setShowAddCustom(true)}
            className="text-xs text-stone-500 hover:text-stone-800 font-medium inline-flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add a spicy or sweet Never Have I Ever question</span>
          </button>
        ) : (
          <form onSubmit={handleAddCustom} className="bg-stone-50 p-4 rounded-2xl border border-stone-200 space-y-3 text-left">
            <h4 className="text-xs font-bold text-stone-700">Add New Confession Question</h4>
            <input
              type="text"
              value={customQuestion}
              onChange={e => setCustomQuestion(e.target.value)}
              placeholder="e.g. cooked a surprise candlelit dinner at 1am..."
              className="w-full text-xs p-2.5 rounded-xl bg-white border border-stone-200 focus:outline-none focus:ring-2 focus:ring-rose-400"
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
                Save
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
