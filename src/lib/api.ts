import {
  UserProfile,
  Couple,
  ChatMessage,
  Book,
  ReadingProgress,
  Bookmark,
  PhotoMemory,
  PhotoAlbum,
  CycleLog,
  CycleSettings,
  CyclePartnerSummary,
  GameSession,
  GameStats,
  CoupleStats,
  AppNotification,
  Achievement,
  DateNightIdea,
  GamePrompt,
  GameType,
  GameMove
} from '../types';
import { getSupabase, SUPABASE_SQL_MIGRATION } from './supabase';
import { realtimeEventBus } from './realtimeEventBus';

function toCamelCaseKey(key: string): string {
  return key.replace(/_([a-z])/g, (_, g) => g.toUpperCase());
}

function mapRowKeysToCamel<T = any>(row: any): T {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return row;
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    result[toCamelCaseKey(k)] = v;
  }
  return result as T;
}

export class ApiService {
  private static activeCoupleId: string | null = null;
  private static coupleListeners: Set<(type: string, data: any) => void> = new Set();
  private static sseEventSource: EventSource | null = null;
  private static activeSupabaseChannel: any = null;

  // Complete teardown of all active Realtime subscriptions and listeners
  static teardownRealtime(): void {
    if (this.sseEventSource) {
      try {
        this.sseEventSource.close();
      } catch (e) {
        // Safe close
      }
      this.sseEventSource = null;
    }

    if (this.activeSupabaseChannel) {
      const supabase = getSupabase();
      if (supabase) {
        try {
          supabase.removeChannel(this.activeSupabaseChannel);
        } catch (e) {
          console.warn('Error removing Supabase channel:', e);
        }
      }
      this.activeSupabaseChannel = null;
    }

    this.coupleListeners.clear();
    this.activeCoupleId = null;
    realtimeEventBus.reset();
  }

  // Dispatch an incoming event to all registered couple listeners and the centralized Event Bus
  private static dispatchCoupleEvent(type: string, data: any): void {
    // 1. Dispatch to centralized event bus
    realtimeEventBus.emit(type, data);

    // 2. Dispatch to legacy direct listeners
    this.coupleListeners.forEach(listener => {
      try {
        listener(type, data);
      } catch (err) {
        console.error(`Error in couple listener for ${type}:`, err);
      }
    });
  }

  // Broadcast a couple event via Supabase Realtime Channel & Server SSE
  static async broadcastCoupleEvent(coupleId: string, event: string, payload: any): Promise<void> {
    if (!coupleId) return;

    // 1. Deliver via Supabase Realtime Broadcast if active
    if (this.activeSupabaseChannel) {
      try {
        await this.activeSupabaseChannel.send({
          type: 'broadcast',
          event,
          payload
        });
      } catch (err) {
        console.warn('Supabase broadcast attempt notice:', err);
      }
    }

    // 2. Deliver via server SSE endpoint for cross-client reliability
    try {
      await fetch(`/api/realtime/${coupleId}/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, payload })
      });
    } catch (err) {
      // Non-blocking fallback
    }
  }

  // Realtime subscription handler (SSE + Supabase Realtime Channel with postgres_changes & broadcast)
  static subscribeToCoupleUpdates(
    coupleId: string,
    onEvent: (type: string, data: any) => void
  ): () => void {
    if (!coupleId) return () => {};

    // If couple context changed, tear down old session completely before establishing new
    if (this.activeCoupleId && this.activeCoupleId !== coupleId) {
      this.teardownRealtime();
    }

    this.coupleListeners.add(onEvent);

    // If already connected to this couple channel, reuse connection without re-subscribing
    if (this.activeCoupleId === coupleId && (this.sseEventSource || this.activeSupabaseChannel)) {
      return () => {
        this.coupleListeners.delete(onEvent);
      };
    }

    this.activeCoupleId = coupleId;

    // Connect SSE stream
    try {
      const es = new EventSource(`/api/realtime/${coupleId}`);
      this.sseEventSource = es;

      const eventTypes = [
        'connected',
        'couple_updated',
        'couple_linked',
        'user_nudge',
        'chat_message',
        'chat_reaction',
        'chat_deleted',
        'chat_typing',
        'book_added',
        'reading_progress_updated',
        'bookmark_added',
        'bookmark_deleted',
        'photo_added',
        'photo_reacted',
        'photo_commented',
        'photo_deleted',
        'album_added',
        'album_updated',
        'cycle_updated',
        'game_created',
        'game_updated',
        'game_move',
        'game_turn_move',
        'game_draw',
        'game_draw_clear',
        'game_round_start',
        'game_action',
        'game_reset',
        'game_guess'
      ];

      eventTypes.forEach(evt => {
        es.addEventListener(evt, (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            this.dispatchCoupleEvent(evt, data);
          } catch (err) {
            console.error(`Error parsing SSE ${evt}:`, err);
          }
        });
      });

      es.onerror = () => {
        // Automatic reconnection handled by browser
      };
    } catch (sseErr) {
      console.warn('Could not initialize SSE connection:', sseErr);
    }

    // Connect to Supabase Realtime Channel
    const supabase = getSupabase();
    if (supabase) {
      try {
        const channel = supabase.channel(`couple-room-${coupleId}`, {
          config: { broadcast: { ack: false, self: false } }
        });

        // 1. Broadcast channel events (instant chat messages, game moves, drawings, typing indicators, nudges)
        channel.on('broadcast', { event: '*' }, (payload: any) => {
          if (payload && payload.event) {
            this.dispatchCoupleEvent(payload.event, payload.payload);
          }
        });

        // 2. Supabase Postgres Replication changes for Chat Module
        channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'chat_messages', filter: `couple_id=eq.${coupleId}` },
          (payload: any) => {
            if (payload.eventType === 'INSERT') {
              this.dispatchCoupleEvent('chat_message', mapRowKeysToCamel(payload.new));
            } else if (payload.eventType === 'UPDATE') {
              this.dispatchCoupleEvent('chat_reaction', mapRowKeysToCamel(payload.new));
            } else if (payload.eventType === 'DELETE') {
              this.dispatchCoupleEvent('chat_deleted', {
                messageId: payload.old?.id,
                id: payload.old?.id
              });
            }
          }
        );

        // 3. Supabase Postgres Replication changes for Memory Vault Module (Photos & Albums)
        channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'photos', filter: `couple_id=eq.${coupleId}` },
          (payload: any) => {
            if (payload.eventType === 'INSERT') {
              this.dispatchCoupleEvent('photo_added', mapRowKeysToCamel(payload.new));
            } else if (payload.eventType === 'UPDATE') {
              this.dispatchCoupleEvent('photo_reacted', mapRowKeysToCamel(payload.new));
            } else if (payload.eventType === 'DELETE') {
              this.dispatchCoupleEvent('photo_deleted', {
                photoId: payload.old?.id,
                id: payload.old?.id
              });
            }
          }
        );

        channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'photo_albums', filter: `couple_id=eq.${coupleId}` },
          (payload: any) => {
            if (payload.eventType === 'INSERT') {
              this.dispatchCoupleEvent('album_added', mapRowKeysToCamel(payload.new));
            } else if (payload.eventType === 'UPDATE') {
              this.dispatchCoupleEvent('album_updated', mapRowKeysToCamel(payload.new));
            }
          }
        );

        // 4. Supabase Postgres Replication changes for Games Module (Sessions)
        channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'game_sessions', filter: `couple_id=eq.${coupleId}` },
          (payload: any) => {
            if (payload.eventType === 'INSERT') {
              this.dispatchCoupleEvent('game_created', mapRowKeysToCamel(payload.new));
            } else if (payload.eventType === 'UPDATE') {
              this.dispatchCoupleEvent('game_updated', mapRowKeysToCamel(payload.new));
            }
          }
        );

        // 5. Supabase Postgres Replication changes for Game Moves (Turn-by-Turn Realtime Sync)
        channel.on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'game_moves', filter: `couple_id=eq.${coupleId}` },
          (payload: any) => {
            const mapped = mapRowKeysToCamel(payload.new);
            this.dispatchCoupleEvent('game_turn_move', {
              sessionId: mapped.sessionId,
              move: mapped,
              moveData: mapped.moveData,
              boardState: mapped.boardState,
              playerId: mapped.playerId,
              playerName: mapped.playerName,
              moveNumber: mapped.moveNumber
            });
          }
        );

        channel.subscribe((status: string) => {
          console.log(`[Supabase Realtime] couple-room-${coupleId} status:`, status);
        });

        this.activeSupabaseChannel = channel;
      } catch (err) {
        console.warn('Supabase realtime channel subscription fallback:', err);
      }
    }

    return () => {
      this.coupleListeners.delete(onEvent);
    };
  }

  // --- AUTH & PROFILES ---
  static async login(email: string, password?: string): Promise<{ user: UserProfile; couple: Couple | null }> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to log in');
    }
    return res.json();
  }

  static async register(data: Partial<UserProfile>): Promise<{ user: UserProfile; couple: Couple | null }> {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create profile');
    }
    return res.json();
  }

  static async updateProfile(data: Partial<UserProfile> & { userId: string }): Promise<{ user: UserProfile }> {
    const res = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  }

  static async getAllProfiles(): Promise<UserProfile[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase.from('profiles').select('*').limit(20);
        if (!error && data && data.length > 0) {
          return data.map(mapRowKeysToCamel);
        }
      } catch (err) {
        console.warn('Supabase getAllProfiles query notice:', err);
      }
    }
    const res = await fetch('/api/auth/profiles');
    return res.json();
  }

  static async getAllDemoUsers(): Promise<UserProfile[]> {
    return this.getAllProfiles();
  }

  // --- COUPLE SANCTUARY ---
  static async createCouple(userId: string, relationshipStartDate?: string): Promise<{ couple: Couple; user: UserProfile }> {
    const res = await fetch('/api/couples/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, relationshipStartDate })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create couple sanctuary');
    }
    return res.json();
  }

  static async joinCouple(userId: string, inviteCode: string): Promise<{ couple: Couple; user: UserProfile }> {
    const res = await fetch('/api/couples/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, inviteCode })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to join couple with invite code');
    }
    return res.json();
  }

  static async getCouple(coupleId: string): Promise<{ couple: Couple }> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data: coupleRow, error } = await supabase
          .from('couples')
          .select('*')
          .eq('id', coupleId)
          .maybeSingle();

        if (!error && coupleRow) {
          const coupleObj = mapRowKeysToCamel<Couple>(coupleRow);
          const { data: memberProfiles } = await supabase
            .from('profiles')
            .select('*')
            .eq('couple_id', coupleId);

          if (memberProfiles && memberProfiles.length > 0) {
            coupleObj.members = memberProfiles.map(mapRowKeysToCamel<UserProfile>);
          }
          return { couple: coupleObj };
        }
      } catch (err) {
        console.warn('Supabase getCouple direct query notice:', err);
      }
    }

    const res = await fetch(`/api/couples/${coupleId}`);
    return res.json();
  }

  static async updateCouple(coupleId: string, data: { relationshipStartDate?: string }): Promise<{ couple: Couple }> {
    const supabase = getSupabase();
    if (supabase && data.relationshipStartDate) {
      try {
        await supabase
          .from('couples')
          .update({
            relationship_start_date: data.relationshipStartDate,
            updated_at: new Date().toISOString()
          })
          .eq('id', coupleId);
      } catch (err) {
        console.warn('Supabase updateCouple notice:', err);
      }
    }

    const res = await fetch(`/api/couples/${coupleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  }

  // --- LOVE NUDGE & CHAT MESSAGES ---
  static async sendLoveNudge(data: {
    coupleId: string;
    senderId: string;
    senderName?: string;
    text?: string;
  }): Promise<{ success: boolean; senderName: string; text: string }> {
    const res = await fetch('/api/couples/nudge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  }

  static async getMessages(coupleId: string): Promise<ChatMessage[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('couple_id', coupleId)
          .order('created_at', { ascending: true });

        if (!error && data) {
          return data.map(mapRowKeysToCamel<ChatMessage>);
        }
      } catch (err) {
        console.warn('Supabase getMessages query notice:', err);
      }
    }

    const res = await fetch(`/api/chat/messages?coupleId=${coupleId}`);
    return res.json();
  }

  static async sendMessage(data: {
    coupleId: string;
    senderId: string;
    senderName?: string;
    senderAvatar?: string;
    text: string;
    mediaUrl?: string;
    mediaType?: 'image' | 'voice' | 'sticker';
    replyToId?: string;
    replyToText?: string;
  }): Promise<ChatMessage> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data: inserted, error } = await supabase
          .from('chat_messages')
          .insert({
            couple_id: data.coupleId,
            sender_id: data.senderId,
            sender_name: data.senderName || 'Partner',
            sender_avatar: data.senderAvatar,
            text: data.text,
            media_url: data.mediaUrl,
            media_type: data.mediaType,
            reply_to_id: data.replyToId,
            reply_to_text: data.replyToText
          })
          .select()
          .single();

        if (!error && inserted) {
          const mapped = mapRowKeysToCamel<ChatMessage>(inserted);
          // Background sync to server if active
          fetch('/api/chat/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          }).catch(() => {});
          return mapped;
        }
      } catch (err) {
        console.warn('Supabase sendMessage notice:', err);
      }
    }

    const res = await fetch('/api/chat/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to send message');
    }
    return res.json();
  }

  static async reactToMessage(messageId: string, userId: string, emoji: string): Promise<ChatMessage> {
    const res = await fetch('/api/chat/messages/react', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId, userId, emoji })
    });
    return res.json();
  }

  static async deleteMessage(messageId: string): Promise<{ success: boolean }> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('chat_messages').delete().eq('id', messageId);
      } catch (err) {
        console.warn('Supabase deleteMessage notice:', err);
      }
    }

    const res = await fetch(`/api/chat/messages/${messageId}`, {
      method: 'DELETE'
    });
    return res.json();
  }

  static async sendTyping(coupleId: string, userId: string, isTyping: boolean): Promise<void> {
    await fetch('/api/chat/typing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coupleId, userId, isTyping })
    });
  }

  // --- LIBRARY & READING PROGRESS ---
  static async getBooks(coupleId: string): Promise<Book[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('books')
          .select('*')
          .eq('couple_id', coupleId)
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          return data.map(mapRowKeysToCamel<Book>);
        }
      } catch (err) {
        console.warn('Supabase getBooks direct query notice:', err);
      }
    }

    const res = await fetch(`/api/books?coupleId=${coupleId}`);
    return res.json();
  }

  static async addBook(data: Partial<Book>): Promise<Book> {
    const supabase = getSupabase();
    if (supabase && data.coupleId && data.title && data.author) {
      try {
        const { data: inserted, error } = await supabase
          .from('books')
          .insert({
            couple_id: data.coupleId,
            title: data.title,
            author: data.author,
            cover_url: data.coverUrl,
            description: data.description,
            category: data.category || 'Literature',
            total_pages: data.totalPages || 1,
            content: data.content || [],
            uploaded_by: data.uploadedBy,
            uploader_name: data.uploaderName || 'Partner'
          })
          .select()
          .single();

        if (!error && inserted) {
          const mapped = mapRowKeysToCamel<Book>(inserted);
          fetch('/api/books', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          }).catch(() => {});
          return mapped;
        }
      } catch (err) {
        console.warn('Supabase addBook direct insert notice:', err);
      }
    }

    const res = await fetch('/api/books', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to add book');
    }
    return res.json();
  }

  static async getReadingProgress(bookId?: string, userId?: string): Promise<ReadingProgress[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        let query = supabase.from('reading_progress').select('*');
        if (bookId) query = query.eq('book_id', bookId);
        if (userId) query = query.eq('user_id', userId);
        const { data, error } = await query;
        if (!error && data) {
          return data.map(mapRowKeysToCamel<ReadingProgress>);
        }
      } catch (err) {
        console.warn('Supabase getReadingProgress notice:', err);
      }
    }

    const params = new URLSearchParams();
    if (bookId) params.append('bookId', bookId);
    if (userId) params.append('userId', userId);
    const res = await fetch(`/api/books/progress?${params.toString()}`);
    const data = await res.json();
    return Array.isArray(data) ? data : (data ? [data] : []);
  }

  static async updateReadingProgress(data: {
    bookId: string;
    userId: string;
    currentPage: number;
    totalPages?: number;
    readingTimeMinutes?: number;
  }): Promise<ReadingProgress> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const percentage = data.totalPages ? Math.round((data.currentPage / data.totalPages) * 100) : 0;
        const { data: updated, error } = await supabase
          .from('reading_progress')
          .upsert({
            book_id: data.bookId,
            user_id: data.userId,
            current_page: data.currentPage,
            percentage,
            reading_time_minutes: data.readingTimeMinutes || 0,
            is_finished: percentage >= 100,
            last_read_at: new Date().toISOString()
          })
          .select()
          .single();

        if (!error && updated) {
          fetch('/api/books/progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          }).catch(() => {});
          return mapRowKeysToCamel<ReadingProgress>(updated);
        }
      } catch (err) {
        console.warn('Supabase updateReadingProgress notice:', err);
      }
    }

    const res = await fetch('/api/books/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  }

  static async getBookmarks(bookId?: string, coupleId?: string): Promise<Bookmark[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        let query = supabase.from('bookmarks').select('*');
        if (bookId) query = query.eq('book_id', bookId);
        const { data, error } = await query;
        if (!error && data) {
          return data.map(mapRowKeysToCamel<Bookmark>);
        }
      } catch (err) {
        console.warn('Supabase getBookmarks notice:', err);
      }
    }

    const params = new URLSearchParams();
    if (bookId) params.append('bookId', bookId);
    if (coupleId) params.append('coupleId', coupleId);
    const res = await fetch(`/api/books/bookmarks?${params.toString()}`);
    return res.json();
  }

  static async addBookmark(data: {
    bookId: string;
    userId: string;
    userName: string;
    pageNumber: number;
    chapterTitle?: string;
    note?: string;
    isShared?: boolean;
  }): Promise<Bookmark> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data: inserted, error } = await supabase
          .from('bookmarks')
          .insert({
            book_id: data.bookId,
            user_id: data.userId,
            user_name: data.userName,
            page_number: data.pageNumber,
            chapter_title: data.chapterTitle,
            note: data.note,
            is_shared: data.isShared ?? true
          })
          .select()
          .single();

        if (!error && inserted) {
          fetch('/api/books/bookmarks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          }).catch(() => {});
          return mapRowKeysToCamel<Bookmark>(inserted);
        }
      } catch (err) {
        console.warn('Supabase addBookmark notice:', err);
      }
    }

    const res = await fetch('/api/books/bookmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  }

  static async deleteBookmark(bookmarkId: string): Promise<void> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('bookmarks').delete().eq('id', bookmarkId);
      } catch (err) {
        console.warn('Supabase deleteBookmark notice:', err);
      }
    }
    await fetch(`/api/books/bookmarks/${bookmarkId}`, { method: 'DELETE' });
  }

  // --- MEMORIES & PHOTOS ---
  static async getPhotos(coupleId: string): Promise<PhotoMemory[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('photos')
          .select('*')
          .eq('couple_id', coupleId)
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          return data.map(mapRowKeysToCamel<PhotoMemory>);
        }
      } catch (err) {
        console.warn('Supabase getPhotos notice:', err);
      }
    }

    const res = await fetch(`/api/photos?coupleId=${coupleId}`);
    return res.json();
  }

  static async uploadPhoto(data: {
    coupleId: string;
    uploaderId: string;
    uploaderName?: string;
    imageUrl: string;
    thumbnailUrl?: string;
    caption?: string;
    albumId?: string;
    albumName?: string;
    memoryDate?: string;
  }): Promise<PhotoMemory> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data: inserted, error } = await supabase
          .from('photos')
          .insert({
            couple_id: data.coupleId,
            uploader_id: data.uploaderId,
            uploader_name: data.uploaderName || 'Partner',
            image_url: data.imageUrl,
            thumbnail_url: data.thumbnailUrl || data.imageUrl,
            caption: data.caption,
            album_id: data.albumId,
            album_name: data.albumName || 'General',
            memory_date: data.memoryDate || new Date().toISOString().split('T')[0]
          })
          .select()
          .single();

        if (!error && inserted) {
          fetch('/api/photos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          }).catch(() => {});
          return mapRowKeysToCamel<PhotoMemory>(inserted);
        }
      } catch (err) {
        console.warn('Supabase uploadPhoto notice:', err);
      }
    }

    const res = await fetch('/api/photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  }

  static async reactToPhoto(photoId: string, userId: string, emoji: string): Promise<PhotoMemory> {
    const res = await fetch('/api/photos/react', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoId, userId, emoji })
    });
    return res.json();
  }

  static async commentPhoto(photoId: string, userId: string, userName: string, text: string, userAvatar?: string): Promise<PhotoMemory> {
    const res = await fetch('/api/photos/comment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoId, userId, userName, text, userAvatar })
    });
    return res.json();
  }

  static async deletePhoto(photoId: string): Promise<void> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('photos').delete().eq('id', photoId);
      } catch (err) {
        console.warn('Supabase deletePhoto notice:', err);
      }
    }
    await fetch(`/api/photos/${photoId}`, { method: 'DELETE' });
  }

  static async getAlbums(coupleId: string): Promise<PhotoAlbum[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('photo_albums')
          .select('*')
          .eq('couple_id', coupleId);

        if (!error && data && data.length > 0) {
          return data.map(mapRowKeysToCamel<PhotoAlbum>);
        }
      } catch (err) {
        console.warn('Supabase getAlbums notice:', err);
      }
    }

    const res = await fetch(`/api/photos/albums?coupleId=${coupleId}`);
    return res.json();
  }

  static async createAlbum(coupleId: string, name: string, description?: string, coverUrl?: string): Promise<PhotoAlbum> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data: inserted, error } = await supabase
          .from('photo_albums')
          .insert({
            couple_id: coupleId,
            name,
            description,
            cover_url: coverUrl
          })
          .select()
          .single();

        if (!error && inserted) {
          fetch('/api/photos/albums', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ coupleId, name, description, coverUrl })
          }).catch(() => {});
          return mapRowKeysToCamel<PhotoAlbum>(inserted);
        }
      } catch (err) {
        console.warn('Supabase createAlbum notice:', err);
      }
    }

    const res = await fetch('/api/photos/albums', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coupleId, name, description, coverUrl })
    });
    return res.json();
  }

  // --- CYCLE & FLO TRACKING ---
  static async getCycleSettings(userId: string): Promise<CycleSettings> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('cycle_settings')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (!error && data) {
          return mapRowKeysToCamel<CycleSettings>(data);
        }
      } catch (err) {
        console.warn('Supabase getCycleSettings notice:', err);
      }
    }

    const res = await fetch(`/api/cycle/settings?userId=${userId}`);
    return res.json();
  }

  static async updateCycleSettings(settings: Partial<CycleSettings> & { userId: string }): Promise<CycleSettings> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data: updated, error } = await supabase
          .from('cycle_settings')
          .upsert({
            user_id: settings.userId,
            cycle_length_days: settings.cycleLengthDays,
            period_length_days: settings.periodLengthDays,
            last_period_start_date: settings.lastPeriodStartDate,
            partner_sharing_level: settings.partnerSharingLevel,
            shared_symptoms: settings.sharedSymptoms,
            show_support_cards: settings.showSupportCards,
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (!error && updated) {
          fetch('/api/cycle/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
          }).catch(() => {});
          return mapRowKeysToCamel<CycleSettings>(updated);
        }
      } catch (err) {
        console.warn('Supabase updateCycleSettings notice:', err);
      }
    }

    const res = await fetch('/api/cycle/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    return res.json();
  }

  static async getCycleLogs(userId: string): Promise<CycleLog[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('cycle_logs')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: false });

        if (!error && data) {
          return data.map(mapRowKeysToCamel<CycleLog>);
        }
      } catch (err) {
        console.warn('Supabase getCycleLogs notice:', err);
      }
    }

    const res = await fetch(`/api/cycle/logs?userId=${userId}`);
    return res.json();
  }

  static async saveCycleLog(log: Partial<CycleLog> & { userId: string; date: string }): Promise<CycleLog> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data: updated, error } = await supabase
          .from('cycle_logs')
          .upsert({
            user_id: log.userId,
            date: log.date,
            is_period_start: log.isPeriodStart,
            is_period_end: log.isPeriodEnd,
            flow_intensity: log.flowIntensity,
            symptoms: log.symptoms,
            moods: log.moods,
            energy_level: log.energyLevel,
            sleep_hours: log.sleepHours,
            cravings: log.cravings,
            notes: log.notes
          })
          .select()
          .single();

        if (!error && updated) {
          fetch('/api/cycle/logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(log)
          }).catch(() => {});
          return mapRowKeysToCamel<CycleLog>(updated);
        }
      } catch (err) {
        console.warn('Supabase saveCycleLog notice:', err);
      }
    }

    const res = await fetch('/api/cycle/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(log)
    });
    return res.json();
  }

  static async getPartnerCycleSummary(coupleId: string, userId: string): Promise<CyclePartnerSummary | null> {
    const res = await fetch(`/api/cycle/partner-summary?coupleId=${coupleId}&userId=${userId}`);
    return res.json();
  }

  // --- GAME PROMPTS & REAL SESSIONS ---
  static async getGamePrompts(gameType?: string, category?: string): Promise<GamePrompt[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        let query = supabase.from('game_prompts').select('*').eq('active', true);
        if (gameType) query = query.eq('game_type', gameType);
        if (category) query = query.eq('category', category);
        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          return data.map(mapRowKeysToCamel);
        }
      } catch (err) {
        console.warn('Supabase getGamePrompts direct query notice:', err);
      }
    }

    const params = new URLSearchParams();
    if (gameType) params.append('gameType', gameType);
    if (category) params.append('category', category);
    const res = await fetch(`/api/games/prompts?${params.toString()}`);
    return res.json();
  }

  static async createGamePrompt(prompt: Partial<GamePrompt>): Promise<GamePrompt> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('game_prompts')
          .insert({
            game_type: prompt.gameType,
            category: prompt.category,
            prompt: prompt.prompt,
            extra_data: prompt.extraData || {},
            active: prompt.active ?? true
          })
          .select()
          .single();

        if (!error && data) {
          const mapped = mapRowKeysToCamel<GamePrompt>(data);
          // Sync with server API
          fetch('/api/games/prompts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(prompt)
          }).catch(() => {});
          return mapped;
        }
      } catch (err) {
        console.warn('Supabase createGamePrompt notice:', err);
      }
    }

    const res = await fetch('/api/games/prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prompt)
    });
    return res.json();
  }

  static async getGameSessions(coupleId: string, status?: string): Promise<GameSession[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        let query = supabase
          .from('game_sessions')
          .select('*')
          .eq('couple_id', coupleId);
        if (status) {
          query = query.eq('status', status);
        }
        const { data, error } = await query.order('created_at', { ascending: false });
        if (!error && data) {
          return data.map(mapRowKeysToCamel);
        }
      } catch (err) {
        console.warn('Supabase getGameSessions fallback:', err);
      }
    }

    const params = new URLSearchParams({ coupleId });
    if (status) params.append('status', status);
    const res = await fetch(`/api/games/sessions?${params.toString()}`);
    return res.json();
  }

  static async getActiveGameSessions(coupleId: string): Promise<GameSession[]> {
    return this.getGameSessions(coupleId, 'in_progress');
  }

  static async createOrGetActiveGameSession(data: {
    coupleId: string;
    gameType: GameType;
    player1Id: string;
    player1Name?: string;
    player2Id?: string;
    player2Name?: string;
    currentTurnUserId?: string;
    state?: Record<string, any>;
    forceNew?: boolean;
  }): Promise<GameSession> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        // If not forcing a new game, see if an in_progress session already exists
        if (!data.forceNew) {
          const { data: existing, error: findError } = await supabase
            .from('game_sessions')
            .select('*')
            .eq('couple_id', data.coupleId)
            .eq('game_type', data.gameType)
            .eq('status', 'in_progress')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!findError && existing) {
            return mapRowKeysToCamel(existing);
          }
        }

        // Insert new active game session into Supabase
        const { data: newRow, error: insertError } = await supabase
          .from('game_sessions')
          .insert({
            couple_id: data.coupleId,
            game_type: data.gameType,
            status: 'in_progress',
            player1_id: data.player1Id,
            player1_name: data.player1Name || 'Partner 1',
            player2_id: data.player2Id || null,
            player2_name: data.player2Name || 'Partner 2',
            current_turn_user_id: data.currentTurnUserId || data.player1Id,
            score1: 0,
            score2: 0,
            state: data.state || {}
          })
          .select()
          .single();

        if (!insertError && newRow) {
          const mapped = mapRowKeysToCamel<GameSession>(newRow);
          // Sync with server API for in-memory and SSE clients
          fetch('/api/games/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...data, status: 'in_progress' })
          }).catch(() => {});

          await this.broadcastCoupleEvent(data.coupleId, 'game_created', mapped);
          return mapped;
        }
      } catch (err) {
        console.warn('Supabase createOrGetActiveGameSession error, falling back to API:', err);
      }
    }

    const res = await fetch('/api/games/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        status: 'in_progress',
        createOrFindActive: !data.forceNew
      })
    });
    return res.json();
  }

  static async getGameMoves(sessionId: string): Promise<GameMove[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('game_moves')
          .select('*')
          .eq('session_id', sessionId)
          .order('move_number', { ascending: true });

        if (!error && data) {
          return data.map(mapRowKeysToCamel);
        }
      } catch (err) {
        console.warn('Supabase getGameMoves fallback to server API:', err);
      }
    }

    const res = await fetch(`/api/games/sessions/${sessionId}/moves`);
    return res.json();
  }

  static async recordGameMove(data: {
    sessionId: string;
    coupleId: string;
    playerId: string;
    playerName: string;
    moveNumber?: number;
    moveData: Record<string, any>;
    boardState?: any;
    nextTurnUserId?: string;
    isFinished?: boolean;
    winnerUserId?: string;
    score1?: number;
    score2?: number;
  }): Promise<{ move: GameMove; session?: GameSession }> {
    let savedMove: GameMove | null = null;
    let savedSession: GameSession | null = null;

    const supabase = getSupabase();
    if (supabase) {
      try {
        // 1. Insert turn into game_moves table
        const { data: moveRow, error: moveError } = await supabase
          .from('game_moves')
          .insert({
            session_id: data.sessionId,
            couple_id: data.coupleId,
            player_id: data.playerId,
            player_name: data.playerName,
            move_number: data.moveNumber || 1,
            move_data: data.moveData,
            board_state: data.boardState
          })
          .select()
          .single();

        if (!moveError && moveRow) {
          savedMove = mapRowKeysToCamel(moveRow);
        }

        // 2. Update parent game_sessions table
        const sessionUpdate: Record<string, any> = {
          state: data.boardState !== undefined ? { board: data.boardState, lastMove: data.moveData } : data.moveData,
          current_turn_user_id: data.nextTurnUserId,
          updated_at: new Date().toISOString()
        };
        if (data.score1 !== undefined) sessionUpdate.score1 = data.score1;
        if (data.score2 !== undefined) sessionUpdate.score2 = data.score2;
        if (data.isFinished) {
          sessionUpdate.status = 'completed';
          sessionUpdate.winner_user_id = data.winnerUserId;
        }

        const { data: updatedSessionRow, error: sessionErr } = await supabase
          .from('game_sessions')
          .update(sessionUpdate)
          .eq('id', data.sessionId)
          .select()
          .maybeSingle();

        if (!sessionErr && updatedSessionRow) {
          savedSession = mapRowKeysToCamel(updatedSessionRow);
        }
      } catch (err) {
        console.warn('Supabase recordGameMove error, syncing to server:', err);
      }
    }

    // Always sync with backend server for backup & SSE
    try {
      const res = await fetch(`/api/games/sessions/${data.sessionId}/moves`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const serverResult = await res.json();
      if (!savedMove && serverResult.move) savedMove = serverResult.move;
      if (!savedSession && serverResult.session) savedSession = serverResult.session;
    } catch (e) {
      // Non-blocking
    }

    // Broadcast the turn move across devices in real-time
    await this.broadcastCoupleEvent(data.coupleId, 'game_turn_move', {
      sessionId: data.sessionId,
      move: savedMove || {
        sessionId: data.sessionId,
        playerId: data.playerId,
        playerName: data.playerName,
        moveNumber: data.moveNumber || 1,
        moveData: data.moveData,
        boardState: data.boardState
      },
      boardState: data.boardState,
      nextTurnUserId: data.nextTurnUserId,
      isFinished: data.isFinished,
      winnerUserId: data.winnerUserId,
      score1: data.score1,
      score2: data.score2
    });

    return {
      move: savedMove || {
        id: `move-local-${Date.now()}`,
        sessionId: data.sessionId,
        coupleId: data.coupleId,
        playerId: data.playerId,
        playerName: data.playerName,
        moveNumber: data.moveNumber || 1,
        moveData: data.moveData,
        boardState: data.boardState,
        createdAt: new Date().toISOString()
      },
      session: savedSession || undefined
    };
  }

  static async recordGameSession(data: {
    coupleId: string;
    gameType: GameType;
    player1Id: string;
    player1Name?: string;
    player2Id?: string;
    player2Name?: string;
    winnerUserId?: string;
    score1?: number;
    score2?: number;
    state?: Record<string, any>;
  }): Promise<GameSession> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data: newRow, error } = await supabase
          .from('game_sessions')
          .insert({
            couple_id: data.coupleId,
            game_type: data.gameType,
            status: 'completed',
            player1_id: data.player1Id,
            player1_name: data.player1Name || 'Partner 1',
            player2_id: data.player2Id || null,
            player2_name: data.player2Name || 'Partner 2',
            score1: data.score1 || 0,
            score2: data.score2 || 0,
            winner_user_id: data.winnerUserId,
            state: data.state || {}
          })
          .select()
          .single();

        if (!error && newRow) {
          const mapped = mapRowKeysToCamel<GameSession>(newRow);
          // Sync with server API
          fetch('/api/games/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          }).catch(() => {});

          await this.broadcastCoupleEvent(data.coupleId, 'game_created', mapped);
          return mapped;
        }
      } catch (err) {
        console.warn('Supabase recordGameSession fallback to server:', err);
      }
    }

    const res = await fetch('/api/games/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  }

  static async makeGameMove(sessionId: string, data: {
    userId: string;
    move?: any;
    nextTurnUserId?: string;
    updatedState?: Record<string, any>;
    isFinished?: boolean;
    winnerUserId?: string;
    score1?: number;
    score2?: number;
  }): Promise<GameSession> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const updatePayload: Record<string, any> = {
          updated_at: new Date().toISOString()
        };
        if (data.updatedState) updatePayload.state = data.updatedState;
        if (data.nextTurnUserId) updatePayload.current_turn_user_id = data.nextTurnUserId;
        if (data.isFinished) updatePayload.status = 'completed';
        if (data.winnerUserId) updatePayload.winner_user_id = data.winnerUserId;
        if (data.score1 !== undefined) updatePayload.score1 = data.score1;
        if (data.score2 !== undefined) updatePayload.score2 = data.score2;

        const { data: updatedRow, error } = await supabase
          .from('game_sessions')
          .update(updatePayload)
          .eq('id', sessionId)
          .select()
          .maybeSingle();

        if (!error && updatedRow) {
          // Sync with server API
          fetch(`/api/games/${sessionId}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          }).catch(() => {});
          return mapRowKeysToCamel<GameSession>(updatedRow);
        }
      } catch (err) {
        console.warn('Supabase makeGameMove notice:', err);
      }
    }

    const res = await fetch(`/api/games/${sessionId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  }

  static async updateGameSessionStatus(sessionId: string, status: 'in_progress' | 'completed' | 'cancelled', coupleId?: string): Promise<void> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase
          .from('game_sessions')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('id', sessionId);
      } catch (err) {
        console.warn('Supabase updateGameSessionStatus fallback:', err);
      }
    }
    try {
      await fetch(`/api/games/sessions/${sessionId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
    } catch (e) {
      // Non-blocking
    }

    if (coupleId) {
      await this.broadcastCoupleEvent(coupleId, 'game_updated', { id: sessionId, status });
    }
  }

  static async getGameStats(coupleId: string, userId: string): Promise<{ personal: GameStats; couple: CoupleStats }> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('game_sessions')
          .select('*')
          .eq('couple_id', coupleId);

        if (!error && data) {
          const coupleGames = data.map(mapRowKeysToCamel<GameSession>);
          const completedCoupleGames = coupleGames.filter(g => g.status === 'completed');
          const userGames = completedCoupleGames.filter(g => g.player1Id === userId || g.player2Id === userId);
          const wins = userGames.filter(g => g.winnerUserId === userId).length;
          const losses = userGames.filter(g => g.winnerUserId && g.winnerUserId !== 'draw' && g.winnerUserId !== userId).length;
          const draws = userGames.filter(g => g.winnerUserId === 'draw').length;

          // Favorite game calculation from real sessions
          const gameTypeCounts: Record<string, number> = {};
          userGames.forEach(g => {
            gameTypeCounts[g.gameType] = (gameTypeCounts[g.gameType] || 0) + 1;
          });
          let favoriteGame = 'None yet';
          let maxPlayed = 0;
          for (const [gt, count] of Object.entries(gameTypeCounts)) {
            if (count > maxPlayed) {
              maxPlayed = count;
              favoriteGame = gt.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            }
          }

          // Streak calculation from real completed sessions
          let currentStreak = 0;
          let bestStreak = 0;
          let tempStreak = 0;
          userGames.forEach(g => {
            if (g.winnerUserId === userId) {
              tempStreak++;
              if (tempStreak > bestStreak) bestStreak = tempStreak;
            } else if (g.winnerUserId && g.winnerUserId !== 'draw') {
              tempStreak = 0;
            }
          });
          currentStreak = tempStreak;

          const personal: GameStats = {
            gamesPlayed: userGames.length,
            wins,
            losses,
            draws,
            favoriteGame,
            currentStreak,
            bestStreak
          };

          const p1Wins = completedCoupleGames.filter(g => g.winnerUserId === g.player1Id).length;
          const p2Wins = completedCoupleGames.filter(g => g.winnerUserId && g.winnerUserId === g.player2Id).length;

          const coupleStats: CoupleStats = {
            totalGames: coupleGames.length,
            scribbleRounds: coupleGames.filter(g => g.gameType === 'scribble').length,
            wyrMatches: coupleGames.filter(g => g.gameType === 'would_you_rather').length,
            photosShared: 0,
            messagesSent: 0,
            booksFinished: 0,
            relationshipDays: 0,
            daysStreak: 0
          };

          return { personal, couple: coupleStats };
        }
      } catch (err) {
        console.warn('Supabase getGameStats direct query error:', err);
      }
    }

    const res = await fetch(`/api/games/stats?coupleId=${coupleId}&userId=${userId}`);
    return res.json();
  }

  // --- NOTIFICATIONS & ACHIEVEMENTS ---
  static async getNotifications(userId: string): Promise<AppNotification[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('app_notifications')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data.map(mapRowKeysToCamel<AppNotification>);
        }
      } catch (err) {
        console.warn('Supabase getNotifications notice:', err);
      }
    }

    const res = await fetch(`/api/notifications?userId=${userId}`);
    return res.json();
  }

  static async markNotificationsRead(userId: string): Promise<void> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase
          .from('app_notifications')
          .update({ is_read: true })
          .eq('user_id', userId);
      } catch (err) {
        console.warn('Supabase markNotificationsRead notice:', err);
      }
    }

    await fetch('/api/notifications/read-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
  }

  static async getAchievements(): Promise<Achievement[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase.from('achievements').select('*');
        if (!error && data && data.length > 0) {
          return data.map(mapRowKeysToCamel<Achievement>);
        }
      } catch (err) {
        console.warn('Supabase getAchievements notice:', err);
      }
    }

    const res = await fetch('/api/achievements');
    return res.json();
  }

  static getSupabaseSchemaSql(): string {
    return SUPABASE_SQL_MIGRATION;
  }

  // --- GEMINI AI DATE NIGHT GENERATOR ---
  static async generateDateNightIdea(params?: {
    vibe?: string;
    budget?: string;
    location?: string;
    season?: string;
    timeAvailable?: string;
    customNote?: string;
    partner1Name?: string;
    partner2Name?: string;
  }): Promise<DateNightIdea> {
    const res = await fetch('/api/date-night/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params || {})
    });
    if (!res.ok) {
      throw new Error('Failed to generate date night idea from AI');
    }
    return res.json();
  }
}
