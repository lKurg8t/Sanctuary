import React, { useState, useEffect } from 'react';
import { UserProfile, Couple, GameSession, GameMove } from '../../types';
import { ApiService } from '../../lib/api';
import { ArrowLeft, RefreshCw, Trophy, Heart, Sparkles, Smartphone, Users, Wifi } from 'lucide-react';
import confetti from 'canvas-confetti';

interface TicTacToeGameProps {
  currentUser: UserProfile;
  couple: Couple | null;
  partner: UserProfile | null;
  initialSessionId?: string | null;
  onBackToHub: () => void;
}

type CellValue = 'X' | 'O' | null;

export const TicTacToeGame: React.FC<TicTacToeGameProps> = ({
  currentUser,
  couple,
  partner,
  initialSessionId,
  onBackToHub
}) => {
  const [board, setBoard] = useState<CellValue[]>(Array(9).fill(null));
  const [isXNext, setIsXNext] = useState(true);
  const [scores, setScores] = useState({ p1: 0, p2: 0, ties: 0 });
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId || null);
  const [activeSession, setActiveSession] = useState<GameSession | null>(null);
  const [moveHistory, setMoveHistory] = useState<GameMove[]>([]);
  const [passAndPlay, setPassAndPlay] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  // Determine whose turn it is
  const isPlayer1 = !activeSession || activeSession.player1Id === currentUser.id;
  const currentTurnUserId = activeSession?.currentTurnUserId || (isXNext ? activeSession?.player1Id : activeSession?.player2Id) || currentUser.id;
  const isMyTurn = passAndPlay || !couple?.id || currentTurnUserId === currentUser.id;

  // Initialize or resume real game session from Supabase game_sessions and game_moves
  useEffect(() => {
    let isCancelled = false;

    async function initSession() {
      if (!couple?.id) {
        setIsLoadingSession(false);
        return;
      }

      setIsLoadingSession(true);
      try {
        let session: GameSession;
        if (initialSessionId) {
          const sessions = await ApiService.getGameSessions(couple.id);
          session = sessions.find(s => s.id === initialSessionId) || await ApiService.createOrGetActiveGameSession({
            coupleId: couple.id,
            gameType: 'tic_tac_toe',
            player1Id: currentUser.id,
            player1Name: currentUser.displayName,
            player2Id: partner?.id,
            player2Name: partner?.displayName
          });
        } else {
          session = await ApiService.createOrGetActiveGameSession({
            coupleId: couple.id,
            gameType: 'tic_tac_toe',
            player1Id: currentUser.id,
            player1Name: currentUser.displayName,
            player2Id: partner?.id,
            player2Name: partner?.displayName,
            currentTurnUserId: currentUser.id
          });
        }

        if (isCancelled) return;

        setSessionId(session.id);
        setActiveSession(session);
        setScores({
          p1: session.score1 || 0,
          p2: session.score2 || 0,
          ties: 0
        });

        // Load moves from Supabase game_moves table
        const moves = await ApiService.getGameMoves(session.id);
        if (isCancelled) return;
        setMoveHistory(moves);

        // Reconstruct board from moves or saved session state
        if (session.state?.board && Array.isArray(session.state.board)) {
          setBoard(session.state.board);
          const xCount = session.state.board.filter((c: CellValue) => c === 'X').length;
          const oCount = session.state.board.filter((c: CellValue) => c === 'O').length;
          setIsXNext(xCount <= oCount);
        } else if (moves.length > 0) {
          const reconstructed: CellValue[] = Array(9).fill(null);
          moves.forEach(m => {
            if (m.moveData && typeof m.moveData.index === 'number') {
              reconstructed[m.moveData.index] = m.moveData.mark as CellValue;
            }
          });
          setBoard(reconstructed);
          setIsXNext(moves.length % 2 === 0);
        }
      } catch (err) {
        console.error('Failed to initialize TicTacToe Supabase session:', err);
      } finally {
        if (!isCancelled) setIsLoadingSession(false);
      }
    }

    initSession();

    return () => {
      isCancelled = true;
    };
  }, [couple?.id, currentUser?.id, initialSessionId]);

  // Realtime subscription for Supabase game_moves, game_sessions, and broadcast events
  useEffect(() => {
    if (!couple?.id) return;

    const cleanup = ApiService.subscribeToCoupleUpdates(couple.id, (event, data) => {
      // Handle turn moves from game_moves or realtime broadcast
      if (event === 'game_turn_move') {
        const targetSessionId = data.sessionId;
        if (sessionId && targetSessionId && targetSessionId !== sessionId) {
          return;
        }

        if (data.boardState && Array.isArray(data.boardState)) {
          setBoard(data.boardState);
        } else if (data.moveData && typeof data.moveData.index === 'number') {
          setBoard(prev => {
            const next = [...prev];
            next[data.moveData.index] = data.moveData.mark;
            return next;
          });
        }

        if (data.nextTurnUserId) {
          setActiveSession(prev => prev ? { ...prev, currentTurnUserId: data.nextTurnUserId } : null);
        }

        // Check if finished
        if (data.isFinished && data.winnerUserId) {
          if (data.winnerUserId === currentUser.id) {
            setScores(s => ({ ...s, p1: s.p1 + 1 }));
          } else if (data.winnerUserId === partner?.id) {
            setScores(s => ({ ...s, p2: s.p2 + 1 }));
            confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
          } else if (data.winnerUserId === 'draw') {
            setScores(s => ({ ...s, ties: s.ties + 1 }));
          }
        }

        // Toggle next
        setIsXNext(prev => !prev);
      } else if (event === 'game_reset' && data.gameType === 'tictactoe' && data.senderId !== currentUser.id) {
        setBoard(Array(9).fill(null));
        setIsXNext(true);
      } else if (event === 'game_updated' && data.id === sessionId) {
        setActiveSession(data);
      }
    });

    return cleanup;
  }, [couple?.id, currentUser.id, partner?.id, sessionId]);

  const calculateWinner = (squares: CellValue[]) => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];
    for (const [a, b, c] of lines) {
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
        return { winner: squares[a], line: [a, b, c] };
      }
    }
    if (squares.every(Boolean)) return { winner: 'Tie' as const, line: [] };
    return null;
  };

  const result = calculateWinner(board);

  const handleClick = async (index: number) => {
    if (board[index] || result) return;
    if (!isMyTurn) return;

    const newBoard = [...board];
    const mark: CellValue = isXNext ? 'X' : 'O';
    newBoard[index] = mark;
    setBoard(newBoard);
    setIsXNext(!isXNext);

    const winCheck = calculateWinner(newBoard);
    let winnerId: string | undefined = undefined;
    let nextTurn: string | undefined = undefined;

    if (winCheck) {
      if (winCheck.winner === 'X') {
        setScores(s => ({ ...s, p1: s.p1 + 1 }));
        winnerId = isPlayer1 ? currentUser.id : (partner?.id || currentUser.id);
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      } else if (winCheck.winner === 'O') {
        setScores(s => ({ ...s, p2: s.p2 + 1 }));
        winnerId = isPlayer1 ? (partner?.id || 'partner') : currentUser.id;
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      } else {
        setScores(s => ({ ...s, ties: s.ties + 1 }));
        winnerId = 'draw';
      }
    } else {
      nextTurn = partner?.id ? (currentTurnUserId === currentUser.id ? partner.id : currentUser.id) : currentUser.id;
      setActiveSession(prev => prev ? { ...prev, currentTurnUserId: nextTurn } : null);
    }

    // Persist real turn move to Supabase game_moves and game_sessions
    if (couple?.id && sessionId) {
      try {
        await ApiService.recordGameMove({
          sessionId,
          coupleId: couple.id,
          playerId: currentUser.id,
          playerName: currentUser.displayName,
          moveNumber: moveHistory.length + 1,
          moveData: { index, mark },
          boardState: newBoard,
          nextTurnUserId: nextTurn,
          isFinished: !!winCheck,
          winnerUserId: winnerId,
          score1: winCheck?.winner === 'X' ? scores.p1 + 1 : scores.p1,
          score2: winCheck?.winner === 'O' ? scores.p2 + 1 : scores.p2
        });
      } catch (err) {
        console.error('Error persisting game move to Supabase:', err);
      }
    }
  };

  const resetGame = async () => {
    setBoard(Array(9).fill(null));
    setIsXNext(true);

    if (couple?.id) {
      try {
        // Create fresh new session in game_sessions
        const fresh = await ApiService.createOrGetActiveGameSession({
          coupleId: couple.id,
          gameType: 'tic_tac_toe',
          player1Id: currentUser.id,
          player1Name: currentUser.displayName,
          player2Id: partner?.id,
          player2Name: partner?.displayName,
          currentTurnUserId: currentUser.id,
          forceNew: true
        });
        setSessionId(fresh.id);
        setActiveSession(fresh);
        setMoveHistory([]);

        ApiService.broadcastCoupleEvent(couple.id, 'game_reset', {
          gameType: 'tictactoe',
          senderId: currentUser.id
        });
      } catch (e) {
        console.error('Error resetting game session:', e);
      }
    }
  };

  return (
    <div className="space-y-6 max-w-md mx-auto animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between bg-white p-4 rounded-3xl border border-stone-200 shadow-xs">
        <button
          onClick={onBackToHub}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-stone-100 text-stone-700 text-xs font-semibold hover:bg-stone-200 cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Game Hub</span>
        </button>

        <div className="text-center">
          <h3 className="font-serif font-bold text-sm text-stone-800 flex items-center justify-center gap-1.5">
            <span>Tic Tac Toe</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Connected to Supabase Realtime" />
          </h3>
          <span className="text-[10px] text-stone-400 font-medium">Synced via Supabase Realtime</span>
        </div>

        <button
          onClick={resetGame}
          className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 cursor-pointer transition-colors"
          title="New Round"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Mode & Realtime Sync Bar */}
      <div className="flex items-center justify-between bg-white px-4 py-2.5 rounded-2xl border border-stone-200 shadow-2xs text-xs">
        <div className="flex items-center gap-2">
          <Wifi className="w-3.5 h-3.5 text-emerald-600" />
          <span className="text-stone-600 font-medium text-[11px]">
            {passAndPlay ? 'Pass & Play Mode' : 'Cross-Device Multiplayer'}
          </span>
        </div>
        <button
          onClick={() => setPassAndPlay(!passAndPlay)}
          className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold border transition-all ${
            passAndPlay
              ? 'bg-rose-50 text-rose-700 border-rose-200'
              : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
          }`}
        >
          {passAndPlay ? 'Switch to Live Sync' : 'Play Same Phone'}
        </button>
      </div>

      {/* Scoreboard */}
      <div className="grid grid-cols-3 gap-2 bg-white p-3 rounded-3xl border border-stone-200 shadow-xs text-center">
        <div className="p-2.5 rounded-2xl bg-rose-50 border border-rose-100">
          <span className="text-[10px] uppercase font-bold text-rose-600 truncate block">
            {currentUser.displayName} (❤️ X)
          </span>
          <p className="text-lg font-bold text-rose-700">{scores.p1}</p>
        </div>

        <div className="p-2.5 rounded-2xl bg-stone-50 border border-stone-100">
          <span className="text-[10px] uppercase font-bold text-stone-500 block">Ties</span>
          <p className="text-lg font-bold text-stone-700">{scores.ties}</p>
        </div>

        <div className="p-2.5 rounded-2xl bg-amber-50 border border-amber-100">
          <span className="text-[10px] uppercase font-bold text-amber-600 truncate block">
            {partner?.displayName || 'Partner'} (✨ O)
          </span>
          <p className="text-lg font-bold text-amber-700">{scores.p2}</p>
        </div>
      </div>

      {/* Turn & Status Banner */}
      <div className="text-center py-2 px-4 rounded-2xl bg-white border border-stone-200 shadow-2xs font-serif text-sm font-semibold">
        {result ? (
          result.winner === 'Tie' ? (
            <span className="text-stone-600">🤝 It's a peaceful draw!</span>
          ) : (
            <span className="text-rose-600 flex items-center justify-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>
                {result.winner === 'X' ? currentUser.displayName : (partner?.displayName || 'Partner')} Wins the Round!
              </span>
            </span>
          )
        ) : (
          <div className="flex items-center justify-center gap-2">
            {isMyTurn ? (
              <span className="text-emerald-600 flex items-center gap-1.5 font-sans text-xs font-bold bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                ✨ Your Turn - Tap an empty cell
              </span>
            ) : (
              <span className="text-stone-500 flex items-center gap-1.5 font-sans text-xs font-medium bg-stone-50 px-3 py-1 rounded-full border border-stone-200">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                Waiting for {partner?.displayName || 'Partner'} to move...
              </span>
            )}
          </div>
        )}
      </div>

      {/* 3x3 Grid */}
      <div className="grid grid-cols-3 gap-3 p-4 bg-white rounded-3xl border border-stone-200 shadow-md relative">
        {isLoadingSession && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-2xs rounded-3xl flex items-center justify-center z-20">
            <span className="text-xs font-semibold text-stone-600 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-rose-500" />
              Syncing board with Supabase...
            </span>
          </div>
        )}

        {board.map((cell, index) => {
          const isWinningCell = result && result.winner !== 'Tie' && result.line.includes(index);
          return (
            <button
              key={index}
              onClick={() => handleClick(index)}
              disabled={!!cell || !!result || (!isMyTurn && !passAndPlay)}
              className={`h-24 sm:h-28 rounded-2xl font-serif text-3xl sm:text-4xl font-bold flex items-center justify-center transition-all cursor-pointer ${
                isWinningCell
                  ? 'bg-rose-500 text-white shadow-lg shadow-rose-200 scale-105 z-10'
                  : cell === 'X'
                  ? 'bg-rose-50 text-rose-600 border border-rose-200'
                  : cell === 'O'
                  ? 'bg-amber-50 text-amber-600 border border-amber-200'
                  : isMyTurn
                  ? 'bg-stone-50 hover:bg-rose-50/50 border border-stone-200 hover:border-rose-300 active:scale-95'
                  : 'bg-stone-50/50 border border-stone-100 opacity-75 cursor-not-allowed'
              }`}
            >
              {cell === 'X' && '❤️'}
              {cell === 'O' && '✨'}
            </button>
          );
        })}
      </div>

      {result && (
        <div className="text-center">
          <button
            onClick={resetGame}
            className="py-3 px-8 rounded-2xl bg-stone-900 text-white font-bold text-xs hover:bg-stone-800 shadow-md cursor-pointer transition-all"
          >
            Play Another Round
          </button>
        </div>
      )}
    </div>
  );
};
