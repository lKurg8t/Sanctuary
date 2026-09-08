import React, { useState, useEffect, useCallback } from 'react';
import { UserProfile, Couple, GameSession, GameMove } from '../../types';
import { ApiService } from '../../lib/api';
import { ArrowLeft, RefreshCw, Trophy, Sparkles, Smartphone, Wifi } from 'lucide-react';
import confetti from 'canvas-confetti';

interface MemoryMatchGameProps {
  currentUser: UserProfile;
  couple: Couple | null;
  partner: UserProfile | null;
  initialSessionId?: string | null;
  onBackToHub: () => void;
}

const ICONS = ['💌', '🌹', '🥂', '💍', '🧸', '🌅', '🏕️', '🍰'];

interface CardItem {
  id: number;
  icon: string;
  isFlipped: boolean;
  isMatched: boolean;
}

export const MemoryMatchGame: React.FC<MemoryMatchGameProps> = ({
  currentUser,
  couple,
  partner,
  initialSessionId,
  onBackToHub
}) => {
  const [cards, setCards] = useState<CardItem[]>([]);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [scores, setScores] = useState({ p1: 0, p2: 0 });
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId || null);
  const [activeSession, setActiveSession] = useState<GameSession | null>(null);
  const [passAndPlay, setPassAndPlay] = useState(false);
  const [loading, setLoading] = useState(true);

  // Turn calculation
  const currentTurnUserId = activeSession?.currentTurnUserId || currentUser.id;
  const isMyTurn = passAndPlay || currentTurnUserId === currentUser.id;
  const turnPlayerName =
    currentTurnUserId === currentUser.id
      ? currentUser.displayName
      : partner?.displayName || 'Partner';

  const isP1 = !activeSession || activeSession.player1Id === currentUser.id;

  // Initialize or fetch session
  const initGameSession = useCallback(async () => {
    if (!couple?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let session: GameSession;
      if (initialSessionId) {
        const allSessions = await ApiService.getGameSessions(couple.id);
        session =
          allSessions.find(s => s.id === initialSessionId) ||
          (await ApiService.createOrGetActiveGameSession({
            coupleId: couple.id,
            gameType: 'memory_match',
            player1Id: currentUser.id,
            player1Name: currentUser.displayName,
            player2Id: partner?.id,
            player2Name: partner?.displayName,
            currentTurnUserId: currentUser.id
          }));
      } else {
        session = await ApiService.createOrGetActiveGameSession({
          coupleId: couple.id,
          gameType: 'memory_match',
          player1Id: currentUser.id,
          player1Name: currentUser.displayName,
          player2Id: partner?.id,
          player2Name: partner?.displayName,
          currentTurnUserId: currentUser.id
        });
      }

      setSessionId(session.id);
      setActiveSession(session);
      setScores({ p1: session.score1 || 0, p2: session.score2 || 0 });

      // Deck initialization or restore
      let deck: CardItem[];
      if (session.state?.deck && Array.isArray(session.state.deck)) {
        deck = session.state.deck;
      } else {
        // Query live prompt symbols from Supabase
        const livePrompts = await ApiService.getGamePrompts('memory_match');
        const symbolPool = livePrompts.length >= 6 ? livePrompts.map(p => p.prompt) : ICONS;
        deck = [...symbolPool, ...symbolPool]
          .sort(() => Math.random() - 0.5)
          .map((icon, id) => ({
            id,
            icon,
            isFlipped: false,
            isMatched: false
          }));

        // Persist initial deck in Supabase session state
        await ApiService.makeGameMove(session.id, {
          userId: currentUser.id,
          updatedState: { deck }
        });
      }

      // Replay moves to mark matched cards
      const movesList = await ApiService.getGameMoves(session.id);
      setMoves(movesList.length);
      const matchedSet = new Set<number>();
      movesList.forEach(m => {
        if (m.moveData?.matchedIds && Array.isArray(m.moveData.matchedIds)) {
          m.moveData.matchedIds.forEach((id: number) => matchedSet.add(id));
        }
      });

      const updatedDeck = deck.map(c => ({
        ...c,
        isMatched: matchedSet.has(c.id) || c.isMatched
      }));

      setCards(updatedDeck);
    } catch (err) {
      console.error('Failed to init memory game session:', err);
    } finally {
      setLoading(false);
    }
  }, [couple?.id, currentUser.id, currentUser.displayName, partner?.id, partner?.displayName, initialSessionId]);

  useEffect(() => {
    initGameSession();
  }, [initGameSession]);

  // Realtime subscription
  useEffect(() => {
    if (!couple?.id) return;

    const cleanup = ApiService.subscribeToCoupleUpdates(couple.id, (event, data) => {
      if (event === 'game_turn_move') {
        const sId = data.sessionId || data.move?.sessionId;
        if (sId === sessionId) {
          const move = data.move;
          if (move?.moveData?.flippedIndex !== undefined) {
            const fIdx = move.moveData.flippedIndex;
            setCards(prev => {
              const updated = [...prev];
              if (updated[fIdx]) updated[fIdx].isFlipped = true;
              return updated;
            });
          }
          if (move?.moveData?.matchedIds) {
            setCards(prev => {
              const updated = [...prev];
              move.moveData.matchedIds.forEach((id: number) => {
                const card = updated.find(c => c.id === id);
                if (card) {
                  card.isMatched = true;
                  card.isFlipped = false;
                }
              });
              return updated;
            });
          }
          if (move?.moveData?.unflipIds) {
            setTimeout(() => {
              setCards(prev => {
                const updated = [...prev];
                move.moveData.unflipIds.forEach((id: number) => {
                  const card = updated.find(c => c.id === id);
                  if (card) card.isFlipped = false;
                });
                return updated;
              });
            }, 1000);
          }
          if (data.nextTurnUserId) {
            setActiveSession(prev => (prev ? { ...prev, currentTurnUserId: data.nextTurnUserId } : null));
          }
          if (data.score1 !== undefined || data.score2 !== undefined) {
            setScores({ p1: data.score1 ?? scores.p1, p2: data.score2 ?? scores.p2 });
          }
        }
      } else if (event === 'game_updated' && data.id === sessionId) {
        setActiveSession(data);
        if (data.score1 !== undefined || data.score2 !== undefined) {
          setScores({ p1: data.score1 ?? 0, p2: data.score2 ?? 0 });
        }
      }
    });

    return cleanup;
  }, [couple?.id, sessionId, scores.p1, scores.p2]);

  const handleCardClick = async (index: number) => {
    if (!isMyTurn || flippedIndices.length >= 2 || cards[index].isFlipped || cards[index].isMatched) {
      return;
    }

    const newCards = [...cards];
    newCards[index].isFlipped = true;
    setCards(newCards);

    const newFlipped = [...flippedIndices, index];
    setFlippedIndices(newFlipped);

    // Broadcast flip to partner
    if (couple?.id && sessionId) {
      await ApiService.recordGameMove({
        sessionId,
        coupleId: couple.id,
        playerId: currentTurnUserId,
        playerName: turnPlayerName,
        moveData: { flippedIndex: index, cardId: cards[index].id }
      });
    }

    if (newFlipped.length === 2) {
      const newMoves = moves + 1;
      setMoves(newMoves);
      const [firstIdx, secondIdx] = newFlipped;
      const firstCard = newCards[firstIdx];
      const secondCard = newCards[secondIdx];

      if (firstCard.icon === secondCard.icon) {
        // MATCH!
        setTimeout(async () => {
          setCards(prev => {
            const updated = [...prev];
            updated[firstIdx].isMatched = true;
            updated[firstIdx].isFlipped = false;
            updated[secondIdx].isMatched = true;
            updated[secondIdx].isFlipped = false;
            return updated;
          });
          setFlippedIndices([]);

          const isCurrentUserP1 = currentTurnUserId === (activeSession?.player1Id || currentUser.id);
          const newScore1 = isCurrentUserP1 ? scores.p1 + 1 : scores.p1;
          const newScore2 = !isCurrentUserP1 ? scores.p2 + 1 : scores.p2;
          setScores({ p1: newScore1, p2: newScore2 });

          const totalMatched = cards.filter(c => c.isMatched).length + 2;
          const isFinished = totalMatched >= cards.length;

          if (isFinished) {
            confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
          }

          if (couple?.id && sessionId) {
            await ApiService.recordGameMove({
              sessionId,
              coupleId: couple.id,
              playerId: currentTurnUserId,
              playerName: turnPlayerName,
              moveData: {
                matchedIds: [firstCard.id, secondCard.id]
              },
              score1: newScore1,
              score2: newScore2,
              isFinished,
              winnerUserId: isFinished ? (newScore1 > newScore2 ? activeSession?.player1Id : newScore2 > newScore1 ? activeSession?.player2Id : 'draw') : undefined
            });
          }
        }, 600);
      } else {
        // NO MATCH - Turn passes to partner
        const nextTurnUserId = currentTurnUserId === currentUser.id ? partner?.id || currentUser.id : currentUser.id;

        setTimeout(async () => {
          setCards(prev => {
            const updated = [...prev];
            updated[firstIdx].isFlipped = false;
            updated[secondIdx].isFlipped = false;
            return updated;
          });
          setFlippedIndices([]);

          if (couple?.id && sessionId) {
            await ApiService.recordGameMove({
              sessionId,
              coupleId: couple.id,
              playerId: currentTurnUserId,
              playerName: turnPlayerName,
              moveData: {
                unflipIds: [firstCard.id, secondCard.id]
              },
              nextTurnUserId
            });
          }

          setActiveSession(prev => (prev ? { ...prev, currentTurnUserId: nextTurnUserId } : null));
        }, 1200);
      }
    }
  };

  const handleRestart = async () => {
    const newDeck = [...ICONS, ...ICONS]
      .sort(() => Math.random() - 0.5)
      .map((icon, id) => ({
        id,
        icon,
        isFlipped: false,
        isMatched: false
      }));

    setCards(newDeck);
    setFlippedIndices([]);
    setScores({ p1: 0, p2: 0 });
    setMoves(0);

    if (couple?.id && sessionId) {
      await ApiService.makeGameMove(sessionId, {
        userId: currentUser.id,
        updatedState: { deck: newDeck },
        score1: 0,
        score2: 0,
        nextTurnUserId: currentUser.id
      });
      await ApiService.broadcastCoupleEvent(couple.id, 'game_reset', { sessionId });
    }
  };

  const totalMatchedCount = cards.filter(c => c.isMatched).length / 2;
  const isGameOver = cards.length > 0 && cards.every(c => c.isMatched);

  return (
    <div className="space-y-6 max-w-md mx-auto animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between bg-white p-4 rounded-3xl border border-stone-200 shadow-xs">
        <button
          onClick={onBackToHub}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-stone-100 text-stone-700 text-xs font-semibold hover:bg-stone-200 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Game Hub</span>
        </button>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-stone-400">Score</span>
            <p className="text-xs font-bold text-rose-600">
              {currentUser.displayName}: {isP1 ? scores.p1 : scores.p2} • {partner?.displayName || 'Partner'}: {isP1 ? scores.p2 : scores.p1}
            </p>
          </div>
          <button
            onClick={handleRestart}
            className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 cursor-pointer"
            title="Restart Memory Deck"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Realtime Turn Banner */}
      <div className="flex items-center justify-between px-2 text-xs font-medium text-stone-500">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Multiplayer Realtime</span>
        </div>
        <div>
          <button
            onClick={() => setPassAndPlay(!passAndPlay)}
            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
              passAndPlay
                ? 'bg-rose-50 text-rose-600 border-rose-200'
                : 'bg-stone-50 text-stone-600 border-stone-200'
            }`}
          >
            {passAndPlay ? 'Same Phone' : 'Live Sync'}
          </button>
        </div>
      </div>

      <div className="text-center py-1">
        {isGameOver ? (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 font-bold text-sm">
            🎉 All pairs found! Match completed!
          </div>
        ) : isMyTurn ? (
          <p className="text-xs font-bold text-rose-600 animate-pulse">
            ★ Your Turn — Tap 2 cards to find a match!
          </p>
        ) : (
          <p className="text-xs font-bold text-amber-600">
            Waiting for {partner?.displayName || 'partner'} to flip cards...
          </p>
        )}
      </div>

      {/* Grid of Cards */}
      <div className="grid grid-cols-4 gap-3">
        {cards.map((card, index) => {
          const showCard = card.isFlipped || card.isMatched;
          return (
            <button
              key={card.id}
              onClick={() => handleCardClick(index)}
              disabled={card.isMatched || (!isMyTurn && !passAndPlay)}
              className={`aspect-square rounded-2xl text-2xl flex items-center justify-center font-bold transition-all duration-300 transform shadow-xs cursor-pointer ${
                showCard
                  ? card.isMatched
                    ? 'bg-emerald-50 border-2 border-emerald-400 opacity-80 scale-95'
                    : 'bg-white border-2 border-rose-400 rotate-y-180 shadow-md'
                  : 'bg-rose-600 text-white hover:bg-rose-700 active:scale-95'
              }`}
            >
              {showCard ? card.icon : '✨'}
            </button>
          );
        })}
      </div>
    </div>
  );
};
