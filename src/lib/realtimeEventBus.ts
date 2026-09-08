/**
 * Centralized Realtime Event Bus
 *
 * Provides a decoupled Pub/Sub architecture for all realtime synchronization
 * across the application (Chat, Memory Vault, Arcade Games, Reading Library, Cycle, Nudges).
 *
 * Guarantees:
 * - Scoped to the current coupleId & userId context
 * - Automatic listener registration & disposal
 * - Memory leak prevention through comprehensive cleanup methods
 * - Elimination of stale data synchronization when switching partners or logging out
 */

export type RealtimeEventHandler<T = any> = (data: T, eventName: string) => void;

export interface RealtimeContext {
  coupleId: string | null;
  userId: string | null;
}

export class RealtimeEventBus {
  private listeners: Map<string, Set<RealtimeEventHandler>> = new Map();
  private wildcardListeners: Set<RealtimeEventHandler> = new Set();
  private activeCoupleId: string | null = null;
  private activeUserId: string | null = null;

  /**
   * Updates the couple and user context.
   * If coupleId changes or becomes null, clears existing listeners to prevent stale sync.
   */
  setContext(coupleId: string | null, userId: string | null): void {
    const coupleChanged = this.activeCoupleId !== coupleId;
    const userChanged = this.activeUserId !== userId;

    if (coupleChanged || userChanged) {
      console.log(
        `[RealtimeEventBus] Context changed: couple (${this.activeCoupleId} -> ${coupleId}), user (${this.activeUserId} -> ${userId})`
      );
      if (coupleChanged) {
        // Clear listeners when couple changes to prevent cross-couple contamination
        this.clear();
      }
      this.activeCoupleId = coupleId;
      this.activeUserId = userId;
    }
  }

  getContext(): RealtimeContext {
    return {
      coupleId: this.activeCoupleId,
      userId: this.activeUserId
    };
  }

  /**
   * Subscribe to a specific event or '*' for all events.
   * Returns a cleanup function that automatically unregisters the listener.
   */
  on<T = any>(event: string, handler: RealtimeEventHandler<T>): () => void {
    if (event === '*') {
      this.wildcardListeners.add(handler);
      return () => this.off('*', handler);
    }

    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);

    return () => this.off(event, handler);
  }

  /**
   * Synonym for on()
   */
  subscribe<T = any>(event: string, handler: RealtimeEventHandler<T>): () => void {
    return this.on(event, handler);
  }

  /**
   * Unsubscribe a handler from an event
   */
  off<T = any>(event: string, handler: RealtimeEventHandler<T>): void {
    if (event === '*') {
      this.wildcardListeners.delete(handler);
      return;
    }

    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Dispatches an event and payload to all registered listeners.
   */
  emit<T = any>(event: string, data: T): void {
    // 1. Notify wildcard listeners
    this.wildcardListeners.forEach(handler => {
      try {
        handler(data, event);
      } catch (err) {
        console.error(`[RealtimeEventBus] Wildcard listener error for "${event}":`, err);
      }
    });

    // 2. Notify specific event listeners
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data, event);
        } catch (err) {
          console.error(`[RealtimeEventBus] Listener error for "${event}":`, err);
        }
      });
    }
  }

  /**
   * Synonym for emit()
   */
  dispatch<T = any>(event: string, data: T): void {
    this.emit(event, data);
  }

  /**
   * Removes all registered listeners to prevent memory leaks.
   */
  clear(): void {
    this.listeners.clear();
    this.wildcardListeners.clear();
  }

  /**
   * Comprehensive reset: clears listeners and nullifies active context.
   */
  reset(): void {
    this.clear();
    this.activeCoupleId = null;
    this.activeUserId = null;
    console.log('[RealtimeEventBus] Reset complete. All listeners removed and context cleared.');
  }

  /**
   * Get total number of active listeners (for diagnostics / leak detection)
   */
  listenerCount(event?: string): number {
    if (event) {
      if (event === '*') return this.wildcardListeners.size;
      return this.listeners.get(event)?.size || 0;
    }
    let total = this.wildcardListeners.size;
    this.listeners.forEach(set => {
      total += set.size;
    });
    return total;
  }
}

// Global singleton instance for centralized couple realtime pub/sub
export const realtimeEventBus = new RealtimeEventBus();
