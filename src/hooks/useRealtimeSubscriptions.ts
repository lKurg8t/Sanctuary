import React, { useEffect, useRef, useState, useCallback, DependencyList } from 'react';
import {
  UserProfile,
  Couple,
  ChatMessage,
  Book,
  ReadingProgress,
  Bookmark,
  PhotoMemory,
  PhotoAlbum,
  CyclePartnerSummary,
  GameStats,
  CoupleStats
} from '../types';
import { ApiService } from '../lib/api';
import { getSupabase } from '../lib/supabase';
import { Sound } from '../lib/audio';
import { realtimeEventBus, RealtimeEventBus } from '../lib/realtimeEventBus';
import confetti from 'canvas-confetti';

export function deduplicateById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter(item => {
    if (!item?.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export interface UseRealtimeSubscriptionsOptions {
  currentUser: UserProfile | null;
  couple: Couple | null;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setPhotos: React.Dispatch<React.SetStateAction<PhotoMemory[]>>;
  setAlbums: React.Dispatch<React.SetStateAction<PhotoAlbum[]>>;
  setGameStats: React.Dispatch<React.SetStateAction<{ personal: GameStats; couple: CoupleStats } | null>>;
  setPartnerSummary: React.Dispatch<React.SetStateAction<CyclePartnerSummary | null>>;
  setBooks: React.Dispatch<React.SetStateAction<Book[]>>;
  setReadingProgress: React.Dispatch<React.SetStateAction<ReadingProgress[]>>;
  setBookmarks: React.Dispatch<React.SetStateAction<Bookmark[]>>;
  setCouple: React.Dispatch<React.SetStateAction<Couple | null>>;
  setLoveNudgeToast: React.Dispatch<React.SetStateAction<{ sender: string; text: string } | null>>;
}

export interface UseRealtimeSubscriptionsResult {
  isSubscribed: boolean;
  activeCoupleId: string | null;
  eventBus: RealtimeEventBus;
  emit: <T = any>(event: string, data: T) => void;
}

/**
 * Centralized hook that connects the Realtime transport to the Realtime Event Bus
 * and registers listeners that dispatch updates to shared application state.
 *
 * Guarantees:
 * 1. Strictly bound to the current coupleId & userId.
 * 2. Complete teardown of subscriptions, channels, and bus listeners when switching accounts or logging out.
 * 3. Prevention of memory leaks and stale data synchronization.
 */
export function useRealtimeSubscriptions({
  currentUser,
  couple,
  setMessages,
  setPhotos,
  setAlbums,
  setGameStats,
  setPartnerSummary,
  setBooks,
  setReadingProgress,
  setBookmarks,
  setCouple,
  setLoveNudgeToast
}: UseRealtimeSubscriptionsOptions): UseRealtimeSubscriptionsResult {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const nudgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep state setters and current references fresh to avoid stale closures
  const stateRef = useRef({
    currentUser,
    couple,
    setMessages,
    setPhotos,
    setAlbums,
    setGameStats,
    setPartnerSummary,
    setBooks,
    setReadingProgress,
    setBookmarks,
    setCouple,
    setLoveNudgeToast
  });

  useEffect(() => {
    stateRef.current = {
      currentUser,
      couple,
      setMessages,
      setPhotos,
      setAlbums,
      setGameStats,
      setPartnerSummary,
      setBooks,
      setReadingProgress,
      setBookmarks,
      setCouple,
      setLoveNudgeToast
    };
  }, [
    currentUser,
    couple,
    setMessages,
    setPhotos,
    setAlbums,
    setGameStats,
    setPartnerSummary,
    setBooks,
    setReadingProgress,
    setBookmarks,
    setCouple,
    setLoveNudgeToast
  ]);

  // 1. Listen for Supabase Authentication State changes to guarantee immediate teardown on logout
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((authEvent, session) => {
      if (authEvent === 'SIGNED_OUT' || !session?.user) {
        console.log('🔒 Auth signed out: tearing down event bus and realtime subscriptions');
        if (nudgeTimerRef.current) {
          clearTimeout(nudgeTimerRef.current);
          nudgeTimerRef.current = null;
        }
        ApiService.teardownRealtime();
        realtimeEventBus.reset();
        setIsSubscribed(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // 2. Lifecycle management for current coupleId and currentUser account switching
  useEffect(() => {
    const coupleId = couple?.id;
    const userId = currentUser?.id;

    // If logged out or uncoupled, tear down immediately to avoid stale data sync
    if (!coupleId || !userId) {
      console.log('🧹 No active couple or user: clearing event bus and active subscriptions');
      if (nudgeTimerRef.current) {
        clearTimeout(nudgeTimerRef.current);
        nudgeTimerRef.current = null;
      }
      ApiService.teardownRealtime();
      realtimeEventBus.reset();
      setIsSubscribed(false);
      return;
    }

    console.log(`🔌 Initializing Realtime Event Bus for coupleId=${coupleId}, userId=${userId}`);
    realtimeEventBus.setContext(coupleId, userId);

    // Array to collect unregister callbacks for this lifecycle instance
    const unsubs: Array<() => void> = [];

    // --- Chat Event Listeners ---
    unsubs.push(
      realtimeEventBus.on('chat_message', (data: ChatMessage) => {
        const { currentUser: user } = stateRef.current;
        if (user && data.senderId !== user.id) {
          Sound.playIncomingMessageSound();
        }
        stateRef.current.setMessages(prev => deduplicateById([...prev, data]));
      })
    );

    unsubs.push(
      realtimeEventBus.on('chat_reaction', (data: any) => {
        const { currentUser: user } = stateRef.current;
        if (user && data.userId !== user.id) {
          Sound.playReactionSound();
        }
        const messageId = data.messageId || data.id;
        stateRef.current.setMessages(prev =>
          prev.map(m => (m.id === messageId ? { ...m, reactions: data.reactions } : m))
        );
      })
    );

    unsubs.push(
      realtimeEventBus.on('chat_deleted', (data: any) => {
        const delId = data.messageId || data.id;
        stateRef.current.setMessages(prev => prev.filter(m => m.id !== delId));
      })
    );

    // --- Memory Vault (Photos & Albums) Event Listeners ---
    unsubs.push(
      realtimeEventBus.on('photo_added', (data: PhotoMemory) => {
        stateRef.current.setPhotos(prev => deduplicateById([data, ...prev]));
      })
    );

    unsubs.push(
      realtimeEventBus.on('photo_reacted', (data: any) => {
        const photoId = data.photoId || data.id;
        stateRef.current.setPhotos(prev =>
          prev.map(p => (p.id === photoId ? { ...p, reactions: data.reactions } : p))
        );
      })
    );

    unsubs.push(
      realtimeEventBus.on('photo_commented', (data: any) => {
        const photoId = data.photoId || data.id;
        stateRef.current.setPhotos(prev =>
          prev.map(p =>
            p.id === photoId ? { ...p, comments: [...(p.comments || []), data.comment] } : p
          )
        );
      })
    );

    unsubs.push(
      realtimeEventBus.on('photo_deleted', (data: any) => {
        const delPhotoId = data.photoId || data.id;
        stateRef.current.setPhotos(prev => prev.filter(p => p.id !== delPhotoId));
      })
    );

    unsubs.push(
      realtimeEventBus.on('album_added', (data: PhotoAlbum) => {
        stateRef.current.setAlbums(prev => deduplicateById([...prev, data]));
      })
    );

    unsubs.push(
      realtimeEventBus.on('album_updated', (data: any) => {
        stateRef.current.setAlbums(prev =>
          prev.map(a => (a.id === data.id ? { ...a, ...data } : a))
        );
      })
    );

    // --- Arcade & Games Event Listeners ---
    const handleGameRefresh = () => {
      const { couple: c, currentUser: u } = stateRef.current;
      if (c?.id && u?.id) {
        ApiService.getGameStats(c.id, u.id)
          .then(stats => stateRef.current.setGameStats(stats))
          .catch(err => console.warn('Failed to refresh game stats:', err));
      }
    };

    unsubs.push(realtimeEventBus.on('game_created', handleGameRefresh));
    unsubs.push(realtimeEventBus.on('game_updated', handleGameRefresh));
    unsubs.push(realtimeEventBus.on('game_turn_move', handleGameRefresh));
    unsubs.push(realtimeEventBus.on('game_reset', handleGameRefresh));

    // --- Cycle & Health Event Listeners ---
    unsubs.push(
      realtimeEventBus.on('cycle_updated', (data: CyclePartnerSummary) => {
        stateRef.current.setPartnerSummary(data);
      })
    );

    // --- Library & Book Event Listeners ---
    unsubs.push(
      realtimeEventBus.on('book_added', (data: Book) => {
        stateRef.current.setBooks(prev => deduplicateById([data, ...prev]));
      })
    );

    unsubs.push(
      realtimeEventBus.on('reading_progress_updated', (data: ReadingProgress) => {
        stateRef.current.setReadingProgress(prev => {
          const filtered = prev.filter(
            p => !(p.bookId === data.bookId && p.userId === data.userId)
          );
          return [...filtered, data];
        });
      })
    );

    unsubs.push(
      realtimeEventBus.on('bookmark_added', (data: Bookmark) => {
        stateRef.current.setBookmarks(prev => deduplicateById([data, ...prev]));
      })
    );

    unsubs.push(
      realtimeEventBus.on('bookmark_deleted', (data: any) => {
        const bmId = data.id || data.bookmarkId;
        stateRef.current.setBookmarks(prev => prev.filter(b => b.id !== bmId));
      })
    );

    // --- Couple Profile & Settings Event Listeners ---
    unsubs.push(
      realtimeEventBus.on('couple_updated', (data: Couple) => {
        stateRef.current.setCouple(data);
      })
    );

    // --- Love Nudge Toast Listener ---
    unsubs.push(
      realtimeEventBus.on('user_nudge', (data: any) => {
        Sound.playLoveNudgeSound();
        stateRef.current.setLoveNudgeToast({ sender: data.senderName, text: data.text });
        confetti({ particleCount: 70, spread: 85, origin: { y: 0.2 } });

        if (nudgeTimerRef.current) {
          clearTimeout(nudgeTimerRef.current);
        }
        nudgeTimerRef.current = setTimeout(() => {
          stateRef.current.setLoveNudgeToast(null);
          nudgeTimerRef.current = null;
        }, 5000);
      })
    );

    // 3. Connect the underlying transport layer (SSE + Supabase Realtime) for this coupleId
    // ApiService dispatches incoming messages directly into realtimeEventBus
    const unsubscribeTransport = ApiService.subscribeToCoupleUpdates(coupleId, (event, data) => {
      // Direct pass-through if not already emitted by ApiService
    });
    unsubs.push(unsubscribeTransport);

    setIsSubscribed(true);

    // Cleanup: execute when switching users, changing couples, or unmounting
    return () => {
      console.log(`🔌 Cleaning up Realtime Event Bus listeners for coupleId=${coupleId}`);
      unsubs.forEach(cleanup => {
        try {
          cleanup();
        } catch (e) {
          console.warn('Error during event bus cleanup:', e);
        }
      });
      if (nudgeTimerRef.current) {
        clearTimeout(nudgeTimerRef.current);
        nudgeTimerRef.current = null;
      }
      realtimeEventBus.clear();
      setIsSubscribed(false);
    };
  }, [couple?.id, currentUser?.id]);

  return {
    isSubscribed,
    activeCoupleId: couple?.id || null,
    eventBus: realtimeEventBus,
    emit: (event: string, data: any) => realtimeEventBus.emit(event, data)
  };
}

/**
 * Custom React hook for individual components to subscribe to specific events
 * on the centralized Realtime event bus with guaranteed cleanup on unmount.
 */
export function useRealtimeEvent<T = any>(
  event: string,
  handler: (data: T, eventName: string) => void,
  deps: DependencyList = []
): void {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    const unsub = realtimeEventBus.on<T>(event, (data, evt) => {
      handlerRef.current(data, evt);
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, ...deps]);
}

export default useRealtimeSubscriptions;
