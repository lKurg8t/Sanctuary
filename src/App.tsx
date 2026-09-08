import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  GameStats,
  CoupleStats,
  AppNotification,
  Achievement
} from './types';
import { ApiService } from './lib/api';
import { Header } from './components/Header';
import { Navigation, TabType } from './components/Navigation';
import { DashboardView } from './components/DashboardView';
import { ChatView } from './components/ChatView';
import { CycleView } from './components/CycleView';
import { LibraryView } from './components/LibraryView';
import { MemoriesView } from './components/MemoriesView';
import { GamesHubView } from './components/GamesHubView';
import { LoginScreen } from './components/LoginScreen';
import {
  getSupabase,
  testSupabaseProfilesConnection,
  SupabaseDiagnosticResult,
  DEFAULT_SUPABASE_URL
} from './lib/supabase';
import {
  Heart,
  Sparkles,
  Database,
  Copy,
  Check,
  X,
  ShieldCheck,
  Award,
  Bell,
  Link2,
  Volume2,
  RefreshCw,
  Activity,
  CheckCircle2,
  AlertCircle,
  LogOut,
  ExternalLink
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Sound } from './lib/audio';
import { useRealtimeSubscriptions, deduplicateById } from './hooks/useRealtimeSubscriptions';

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<TabType>('home');

  // Active user / couple state
  const [registeredProfiles, setRegisteredProfiles] = useState<UserProfile[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [partner, setPartner] = useState<UserProfile | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);

  // App Data
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [readingProgress, setReadingProgress] = useState<ReadingProgress[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [photos, setPhotos] = useState<PhotoMemory[]>([]);
  const [albums, setAlbums] = useState<PhotoAlbum[]>([]);
  const [cycleLogs, setCycleLogs] = useState<CycleLog[]>([]);
  const [cycleSettings, setCycleSettings] = useState<CycleSettings>({
    userId: '',
    cycleLengthDays: 28,
    periodLengthDays: 5,
    lastPeriodStartDate: '2024-05-01',
    partnerSharingLevel: 'summary',
    sharedSymptoms: ['cramps', 'fatigue', 'headache'],
    showSupportCards: true
  });
  const [partnerSummary, setPartnerSummary] = useState<CyclePartnerSummary | null>(null);
  const [gameStats, setGameStats] = useState<{ personal: GameStats; couple: CoupleStats } | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  // Reader state
  const [activeBookId, setActiveBookId] = useState<string | null>(null);

  // Diagnostic state for Supabase
  const [diagnosticResult, setDiagnosticResult] = useState<SupabaseDiagnosticResult | null>(null);
  const [isRunningDiagnostic, setIsRunningDiagnostic] = useState(false);

  // Modals & Overlays
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showAchievementsModal, setShowAchievementsModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteInputCode, setInviteInputCode] = useState('');
  const [supabaseSchema, setSupabaseSchema] = useState<string>('');
  const [copiedSchema, setCopiedSchema] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [loveNudgeToast, setLoveNudgeToast] = useState<{ sender: string; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const activeLoadIdRef = useRef(0);

  // Complete session reset to prevent stale data appearing across auth changes
  const resetSessionState = useCallback(() => {
    // 1. Immediately teardown active Realtime channels and listeners
    ApiService.teardownRealtime();

    // 2. Clear all sensitive couple & user state
    setCurrentUser(null);
    setPartner(null);
    setCouple(null);
    setMessages([]);
    setBooks([]);
    setReadingProgress([]);
    setBookmarks([]);
    setPhotos([]);
    setAlbums([]);
    setCycleLogs([]);
    setCycleSettings(null);
    setPartnerSummary(null);
    setGameStats(null);
    setNotifications([]);
    setAchievements([]);
    setLoveNudgeToast(null);
    setActiveBookId(null);
    setShowSettingsModal(false);
    setShowAchievementsModal(false);
    setShowNotificationsModal(false);
    setShowInviteModal(false);
    setIsLoading(false);
  }, []);

  // Real Database Read Diagnostic Test Function
  const runDiagnostic = async () => {
    setIsRunningDiagnostic(true);
    try {
      const result = await testSupabaseProfilesConnection();
      setDiagnosticResult(result);
    } catch (err: any) {
      setDiagnosticResult({
        success: false,
        timestamp: new Date().toISOString(),
        latencyMs: 0,
        profilesTableStatus: 'error',
        rlsStatus: 'error',
        message: err?.message || 'Database read against profiles failed'
      });
    } finally {
      setIsRunningDiagnostic(false);
    }
  };

  // Load app data with real Supabase Auth Session & race-condition cancellation
  const loadAppData = useCallback(async (customUser?: UserProfile) => {
    const loadId = ++activeLoadIdRef.current;
    setIsLoading(true);
    try {
      let activeUser: UserProfile | null = customUser || null;

      if (!activeUser) {
        const supabase = getSupabase();
        if (supabase) {
          const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
          if (sessionErr) {
            console.warn('Supabase getSession notice:', sessionErr);
          }

          if (session?.user) {
            // Real database read against profiles table
            try {
              const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .maybeSingle();

              if (profile) {
                activeUser = {
                  id: profile.id,
                  email: profile.email || session.user.email || '',
                  displayName: profile.display_name || session.user.email?.split('@')[0] || 'Partner',
                  username: profile.username || (profile.display_name || 'partner').toLowerCase().replace(/\s+/g, ''),
                  avatarUrl:
                    profile.avatar_url ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
                  dateOfBirth: profile.date_of_birth,
                  timezone: profile.timezone || 'UTC',
                  coupleId: profile.couple_id,
                  createdAt: profile.created_at || new Date().toISOString(),
                  updatedAt: profile.updated_at || new Date().toISOString()
                };
              }
            } catch (pErr) {
              console.warn('Profile lookup notice:', pErr);
            }

            // Sync with backend API if needed
            if (!activeUser && session.user.email) {
              try {
                const sAuth = await ApiService.login(session.user.email);
                if (sAuth?.user) {
                  activeUser = sAuth.user;
                }
              } catch (sErr) {
                console.warn('Server auth sync notice:', sErr);
              }
            }

            // Fallback object from active session
            if (!activeUser) {
              const fallbackName = session.user.email?.split('@')[0] || 'Partner';
              activeUser = {
                id: session.user.id,
                email: session.user.email || '',
                displayName: fallbackName.charAt(0).toUpperCase() + fallbackName.slice(1),
                username: fallbackName.toLowerCase(),
                avatarUrl:
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
                timezone: 'UTC',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };
            }
          }
        }
      }

      // If another load was dispatched while awaiting, discard this stale result
      if (activeLoadIdRef.current !== loadId) return;

      if (!activeUser) {
        resetSessionState();
        return;
      }

      setCurrentUser(activeUser);

      // Resolve couple and partner
      let coupleData: Couple | null = null;
      let partnerUser: UserProfile | null = null;

      if (activeUser.coupleId) {
        try {
          const cRes = await ApiService.getCouple(activeUser.coupleId);
          coupleData = cRes.couple;
          if (activeLoadIdRef.current !== loadId) return;
          setCouple(coupleData);
          if (coupleData?.members) {
            partnerUser = coupleData.members.find(m => m.id !== activeUser!.id) || null;
            setPartner(partnerUser);
          }
        } catch (cErr) {
          console.warn('Could not fetch couple data:', cErr);
        }
      } else {
        setCouple(null);
        setPartner(null);
      }

      const targetCoupleId = coupleData?.id || activeUser.coupleId;

      if (targetCoupleId) {
        const [
          chatList,
          bookList,
          progList,
          bmList,
          photoList,
          albumList,
          cLogs,
          cSettings,
          pSummary,
          gStats,
          notifs,
          achievs
        ] = await Promise.all([
          ApiService.getMessages(targetCoupleId).catch(() => []),
          ApiService.getBooks(targetCoupleId).catch(() => []),
          ApiService.getReadingProgress().catch(() => []),
          ApiService.getBookmarks(undefined, targetCoupleId).catch(() => []),
          ApiService.getPhotos(targetCoupleId).catch(() => []),
          ApiService.getAlbums(targetCoupleId).catch(() => []),
          ApiService.getCycleLogs(activeUser.id).catch(() => []),
          ApiService.getCycleSettings(activeUser.id).catch(() => null),
          ApiService.getPartnerCycleSummary(targetCoupleId, activeUser.id).catch(() => null),
          ApiService.getGameStats(targetCoupleId, activeUser.id).catch(() => null),
          ApiService.getNotifications(activeUser.id).catch(() => []),
          ApiService.getAchievements().catch(() => [])
        ]);

        if (activeLoadIdRef.current !== loadId) return;

        // Deduplicate loaded lists by id to prevent duplicate keys
        setMessages(deduplicateById(chatList));
        setBooks(deduplicateById(bookList));
        setReadingProgress(progList);
        setBookmarks(deduplicateById(bmList));
        setPhotos(deduplicateById(photoList));
        setAlbums(deduplicateById(albumList));
        setCycleLogs(cLogs);
        if (cSettings) setCycleSettings(cSettings);
        setPartnerSummary(pSummary);
        setGameStats(gStats);
        setNotifications(notifs);
        setAchievements(achievs);
      } else {
        const [cLogs, cSettings, notifs, achievs] = await Promise.all([
          ApiService.getCycleLogs(activeUser.id).catch(() => []),
          ApiService.getCycleSettings(activeUser.id).catch(() => null),
          ApiService.getNotifications(activeUser.id).catch(() => []),
          ApiService.getAchievements().catch(() => [])
        ]);

        if (activeLoadIdRef.current !== loadId) return;

        // Clear couple data so no stale data from prior session lingers
        setMessages([]);
        setBooks([]);
        setReadingProgress([]);
        setBookmarks([]);
        setPhotos([]);
        setAlbums([]);
        setPartnerSummary(null);
        setGameStats(null);

        setCycleLogs(cLogs);
        if (cSettings) setCycleSettings(cSettings);
        setNotifications(notifs);
        setAchievements(achievs);
      }
    } catch (err) {
      console.error('Failed to load Sanctuary data:', err);
    } finally {
      if (activeLoadIdRef.current === loadId) {
        setIsLoading(false);
      }
    }
  }, [resetSessionState]);

  // Supabase Auth State Change Listener & initial mount
  useEffect(() => {
    loadAppData();

    const supabase = getSupabase();
    if (!supabase) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔒 Supabase Auth State Change:', event, session?.user?.email);
      if (event === 'SIGNED_OUT' || !session?.user) {
        resetSessionState();
      } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
        await loadAppData();
      }
    });

    return () => {
      subscription.unsubscribe();
      ApiService.teardownRealtime();
    };
  }, [loadAppData, resetSessionState]);

  // Consolidated Realtime subscription handler hook with auth & couple lifecycle management
  useRealtimeSubscriptions({
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

  // Quick switch role between partners in the couple sanctuary
  const handleSwitchPartner = async () => {
    if (!currentUser) return;
    if (partner) {
      setIsLoading(true);
      resetSessionState();
      await loadAppData(partner);
      return;
    }
    const profiles = await ApiService.getAllProfiles();
    if (profiles.length > 1) {
      const nextUser = profiles.find(u => u.id !== currentUser.id) || profiles[0];
      setIsLoading(true);
      resetSessionState();
      await loadAppData(nextUser);
    }
  };

  // Love Nudge Action
  const handleSendLoveNudge = async (customText?: string) => {
    if (!currentUser || !couple) return;
    Sound.playLoveNudgeSound();
    confetti({ particleCount: 50, spread: 70, origin: { y: 0.25 } });
    await ApiService.sendLoveNudge({
      coupleId: couple.id,
      senderId: currentUser.id,
      senderName: currentUser.displayName,
      text: customText || 'is sending you a warm loving embrace ❤️'
    });
  };

  // Chat Actions
  const handleSendMessage = async (text: string, mediaUrl?: string, mediaType?: 'image' | 'voice' | 'sticker', replyTo?: { id: string; text: string }) => {
    if (!currentUser || !couple) return;
    const newMsg = await ApiService.sendMessage({
      coupleId: couple.id,
      senderId: currentUser.id,
      text,
      mediaUrl,
      mediaType,
      replyToId: replyTo?.id,
      replyToText: replyTo?.text
    });
    setMessages(prev => {
      if (prev.some(m => m.id === newMsg.id)) return prev;
      return [...prev, newMsg];
    });
  };

  const handleReactMessage = async (messageId: string, emoji: string) => {
    if (!currentUser) return;
    const res = await ApiService.reactToMessage(messageId, currentUser.id, emoji);
    setMessages(prev =>
      prev.map(m => (m.id === messageId ? { ...m, reactions: res.reactions } : m))
    );
  };

  const handleDeleteMessage = async (messageId: string) => {
    await ApiService.deleteMessage(messageId);
    setMessages(prev => prev.filter(m => m.id !== messageId));
  };

  // Cycle Actions
  const handleSaveCycleLog = async (log: Partial<CycleLog>) => {
    if (!currentUser) return;
    const dateStr = log.date || new Date().toISOString().split('T')[0];
    const saved = await ApiService.saveCycleLog({ ...log, userId: currentUser.id, date: dateStr });
    setCycleLogs(prev => {
      const idx = prev.findIndex(l => l.date === saved.date && l.userId === currentUser.id);
      if (idx > -1) {
        const updated = [...prev];
        updated[idx] = saved;
        return updated;
      }
      return [...prev, saved];
    });
  };

  const handleUpdateCycleSettings = async (settings: Partial<CycleSettings>) => {
    if (!currentUser) return;
    const updated = await ApiService.updateCycleSettings({ ...settings, userId: currentUser.id });
    setCycleSettings(updated);
  };

  // Library Actions
  const handleAddBook = async (book: Partial<Book>) => {
    if (!couple || !currentUser) return;
    const created = await ApiService.addBook({
      ...book,
      coupleId: couple.id,
      uploadedBy: currentUser.id,
      uploaderName: currentUser.displayName
    });
    setBooks(prev => {
      if (prev.some(b => b.id === created.id)) return prev;
      return [created, ...prev];
    });
  };

  const handleUpdateProgress = async (bookId: string, page: number, totalPages: number) => {
    if (!currentUser) return;
    const prog = await ApiService.updateReadingProgress({
      bookId,
      userId: currentUser.id,
      currentPage: page,
      totalPages
    });
    setReadingProgress(prev => {
      const filtered = prev.filter(p => !(p.bookId === bookId && p.userId === currentUser.id));
      return [...filtered, prog];
    });
  };

  const handleAddBookmark = async (bookId: string, pageNumber: number, chapterTitle: string, note: string, isShared: boolean) => {
    if (!currentUser) return;
    const bm = await ApiService.addBookmark({
      bookId,
      userId: currentUser.id,
      userName: currentUser.displayName,
      pageNumber,
      chapterTitle,
      note,
      isShared
    });
    setBookmarks(prev => {
      if (prev.some(b => b.id === bm.id)) return prev;
      return [bm, ...prev];
    });
  };

  const handleDeleteBookmark = async (bookmarkId: string) => {
    await ApiService.deleteBookmark(bookmarkId);
    setBookmarks(prev => prev.filter(b => b.id !== bookmarkId));
  };

  // Memory Vault Actions
  const handleUploadPhoto = async (data: { imageUrl: string; caption?: string; albumId?: string; memoryDate?: string }) => {
    if (!currentUser || !couple) return;
    const created = await ApiService.uploadPhoto({
      ...data,
      coupleId: couple.id,
      uploaderId: currentUser.id,
      uploaderName: currentUser.displayName
    });
    setPhotos(prev => {
      if (prev.some(p => p.id === created.id)) return prev;
      return [created, ...prev];
    });
  };

  const handleReactPhoto = async (photoId: string, emoji: string) => {
    if (!currentUser) return;
    const res = await ApiService.reactToPhoto(photoId, currentUser.id, emoji);
    setPhotos(prev =>
      prev.map(p => (p.id === photoId ? { ...p, reactions: res.reactions } : p))
    );
  };

  const handleCommentPhoto = async (photoId: string, text: string) => {
    if (!currentUser) return;
    const res = await ApiService.commentPhoto(photoId, currentUser.id, currentUser.displayName, text, currentUser.avatarUrl);
    setPhotos(prev =>
      prev.map(p => (p.id === photoId ? { ...p, comments: res.comments } : p))
    );
  };

  const handleCreateAlbum = async (name: string, description: string, coverUrl?: string) => {
    if (!couple) return;
    const created = await ApiService.createAlbum(couple.id, name, description, coverUrl);
    setAlbums(prev => [...prev, created]);
  };

  // Supabase Schema modal & Diagnostic
  const handleOpenSupabaseSchema = async () => {
    setShowSettingsModal(true);
    runDiagnostic();
    try {
      const schema = await ApiService.getSupabaseSchemaSql();
      setSupabaseSchema(schema);
    } catch {
      // ignore
    }
  };

  const handleCopySchema = () => {
    navigator.clipboard.writeText(supabaseSchema);
    setCopiedSchema(true);
    setTimeout(() => setCopiedSchema(false), 2000);
  };

  const handleLoginSuccess = async (user: UserProfile) => {
    await loadAppData(user);
  };

  const handleSignOut = async () => {
    const supabase = getSupabase();
    if (supabase) {
      await supabase.auth.signOut().catch(() => {});
    }
    resetSessionState();
  };

  const handleExploreDemo = async () => {
    try {
      setIsLoading(true);
      resetSessionState();
      const profiles = await ApiService.getAllProfiles();
      if (profiles && profiles.length > 0) {
        await loadAppData(profiles[0]);
      }
    } catch (err) {
      console.error('Explore profiles error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinCouple = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !inviteInputCode.trim()) return;
    try {
      const res = await ApiService.joinCouple(currentUser.id, inviteInputCode.trim());
      setCouple(res.couple);
      setCurrentUser(res.user);
      setShowInviteModal(false);
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      await loadAppData(res.user);
    } catch (err: any) {
      alert(err.message || 'Failed to join sanctuary');
    }
  };

  const handleCreateCouple = async () => {
    if (!currentUser) return;
    try {
      const res = await ApiService.createCouple(currentUser.id);
      setCouple(res.couple);
      setCurrentUser(res.user);
      setShowInviteModal(false);
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      await loadAppData(res.user);
    } catch (err: any) {
      alert(err.message || 'Failed to create couple sanctuary');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#faf8f5] flex flex-col items-center justify-center space-y-4 text-stone-700">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center animate-pulse">
          <Heart className="w-6 h-6 text-rose-500 fill-rose-500" />
        </div>
        <div className="text-center space-y-1">
          <h2 className="font-serif font-bold text-lg text-stone-800">Opening My Space...</h2>
          <p className="text-xs text-stone-400">Verifying Supabase authentication</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <LoginScreen
        onLoginSuccess={handleLoginSuccess}
        onExploreDemo={handleExploreDemo}
      />
    );
  }

  const unreadNotifsCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="min-h-screen bg-[#faf8f5] text-stone-900 flex flex-col selection:bg-rose-100 selection:text-rose-900 font-sans">
      {/* 1. TOP HEADER */}
      <Header
        currentUser={currentUser}
        couple={couple}
        partner={partner}
        unreadNotifsCount={unreadNotifsCount}
        onOpenNotifications={() => setShowNotificationsModal(true)}
        onOpenAchievements={() => setShowAchievementsModal(true)}
        onOpenSettings={handleOpenSupabaseSchema}
        onSwitchPartner={handleSwitchPartner}
        onOpenInviteModal={() => setShowInviteModal(true)}
        onSendLoveNudge={handleSendLoveNudge}
        onSignOut={handleSignOut}
      />

      {/* 2. LOVE NUDGE TOAST */}
      {loveNudgeToast && (
        <div className="fixed top-20 right-4 z-50 p-4 rounded-3xl bg-gradient-to-r from-rose-600 to-amber-500 text-white shadow-2xl flex items-center gap-3 animate-in slide-in-from-top duration-300">
          <button
            onClick={() => Sound.playLoveNudgeSound()}
            title="Play sound again"
            className="p-2 rounded-2xl bg-white/20 hover:bg-white/30 transition-colors"
          >
            <Heart className="w-5 h-5 fill-white text-white animate-ping" />
          </button>
          <div className="text-xs">
            <p className="font-bold flex items-center gap-1">
              <span>{loveNudgeToast.sender} sent you love!</span>
              <Volume2 className="w-3 h-3 opacity-80" />
            </p>
            <p className="text-rose-100">{loveNudgeToast.text}</p>
          </div>
          <button onClick={() => setLoveNudgeToast(null)} className="text-white/80 hover:text-white pl-2">
            ✕
          </button>
        </div>
      )}

      {/* 3. MAIN APP VIEW CONTENT */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 pt-4 sm:pt-6">
        {activeTab === 'home' && (
          <DashboardView
            currentUser={currentUser}
            couple={couple}
            partner={partner}
            books={books}
            readingProgress={readingProgress}
            photos={photos}
            partnerCycleSummary={partnerSummary}
            gameStats={gameStats}
            onNavigate={tab => setActiveTab(tab)}
            onOpenBook={bookId => {
              setActiveBookId(bookId);
              setActiveTab('library');
            }}
            onOpenPhoto={() => setActiveTab('memories')}
            onSendToChat={handleSendMessage}
            onSendLoveNudge={handleSendLoveNudge}
          />
        )}

        {activeTab === 'chat' && (
          <ChatView
            currentUser={currentUser}
            couple={couple}
            partner={partner}
            messages={messages}
            onSendMessage={handleSendMessage}
            onReact={handleReactMessage}
            onDeleteMessage={handleDeleteMessage}
            onSendLoveNudge={handleSendLoveNudge}
          />
        )}

        {activeTab === 'cycle' && (
          <CycleView
            currentUser={currentUser}
            couple={couple}
            partner={partner}
            cycleLogs={cycleLogs}
            cycleSettings={cycleSettings}
            partnerSummary={partnerSummary}
            onSaveLog={handleSaveCycleLog}
            onUpdateSettings={handleUpdateCycleSettings}
          />
        )}

        {activeTab === 'library' && (
          <LibraryView
            currentUser={currentUser}
            couple={couple}
            partner={partner}
            books={books}
            readingProgress={readingProgress}
            bookmarks={bookmarks}
            activeBookId={activeBookId}
            onCloseReader={() => setActiveBookId(null)}
            onOpenBook={id => setActiveBookId(id)}
            onAddBook={handleAddBook}
            onUpdateProgress={handleUpdateProgress}
            onAddBookmark={handleAddBookmark}
            onDeleteBookmark={handleDeleteBookmark}
          />
        )}

        {activeTab === 'memories' && (
          <MemoriesView
            currentUser={currentUser}
            couple={couple}
            partner={partner}
            photos={photos}
            albums={albums}
            onUploadPhoto={handleUploadPhoto}
            onReactPhoto={handleReactPhoto}
            onCommentPhoto={handleCommentPhoto}
            onCreateAlbum={handleCreateAlbum}
          />
        )}

        {activeTab === 'games' && (
          <GamesHubView
            currentUser={currentUser}
            couple={couple}
            partner={partner}
          />
        )}
      </main>

      {/* 4. BOTTOM NAVIGATION DOCK */}
      <Navigation
        currentTab={activeTab}
        onSelectTab={tab => {
          setActiveBookId(null);
          setActiveTab(tab);
        }}
        unreadChatCount={0}
      />

      {/* 5. SUPABASE MIGRATION / SETTINGS & DIAGNOSTIC MODAL */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[88vh] flex flex-col overflow-hidden shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-xs">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-stone-900">
                    Database & Supabase Connection
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    Live connection diagnostics, Row-Level Security (RLS) status, and schema migration.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-xl hover:bg-stone-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              {/* Supabase Diagnostic Live Test Card */}
              <div className="p-5 rounded-3xl bg-stone-50 border border-stone-200/80 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold uppercase tracking-wider text-stone-800">
                      Live Connection & RLS Diagnostic
                    </span>
                  </div>

                  <button
                    onClick={runDiagnostic}
                    disabled={isRunningDiagnostic}
                    className="px-3 py-1.5 rounded-xl bg-white border border-stone-200 hover:border-emerald-300 hover:bg-emerald-50/50 text-stone-700 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${isRunningDiagnostic ? 'animate-spin' : ''}`} />
                    <span>{isRunningDiagnostic ? 'Testing...' : 'Run Diagnostic Test'}</span>
                  </button>
                </div>

                {/* Diagnostic Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Status */}
                  <div className="p-3 bg-white rounded-2xl border border-stone-200/60 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                      Profiles Table Read
                    </span>
                    <div className="flex items-center gap-1.5">
                      {diagnosticResult?.profilesTableStatus === 'active' ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="text-xs font-bold text-emerald-700">Active / 200 OK</span>
                        </>
                      ) : diagnosticResult?.profilesTableStatus === 'error' ? (
                        <>
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span className="text-xs font-bold text-rose-700">Error</span>
                        </>
                      ) : (
                        <span className="text-xs text-stone-400">Testing...</span>
                      )}
                    </div>
                  </div>

                  {/* RLS Status */}
                  <div className="p-3 bg-white rounded-2xl border border-stone-200/60 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                      RLS Configuration
                    </span>
                    <div className="flex items-center gap-1.5">
                      {diagnosticResult?.rlsStatus === 'enforced' ? (
                        <>
                          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="text-xs font-bold text-emerald-700">Enforced & Safe</span>
                        </>
                      ) : (
                        <span className="text-xs text-stone-500 font-medium">
                          {diagnosticResult ? 'Check policy' : 'Testing...'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Latency */}
                  <div className="p-3 bg-white rounded-2xl border border-stone-200/60 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                      Roundtrip Latency
                    </span>
                    <div className="text-xs font-bold text-stone-800">
                      {diagnosticResult ? `${diagnosticResult.latencyMs} ms` : '—'}
                    </div>
                  </div>
                </div>

                {/* Diagnostic message box */}
                {diagnosticResult && (
                  <div className={`p-3 rounded-2xl text-xs flex items-start gap-2.5 ${
                    diagnosticResult.success
                      ? 'bg-emerald-50/80 border border-emerald-200/80 text-emerald-900'
                      : 'bg-rose-50/80 border border-rose-200/80 text-rose-900'
                  }`}>
                    {diagnosticResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-0.5 leading-relaxed">
                      <p className="font-semibold">{diagnosticResult.message}</p>
                      <p className="text-[11px] opacity-75">
                        Target table: <code className="font-mono bg-white/60 px-1 py-0.5 rounded">public.profiles</code> • Verified at: {new Date(diagnosticResult.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                )}

                {/* Supabase Endpoint and Auth Info */}
                <div className="pt-2 border-t border-stone-200/60 text-[11px] text-stone-500 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-medium text-stone-700">Endpoint:</span>{' '}
                    <code className="font-mono text-[10px] bg-stone-200/60 px-1.5 py-0.5 rounded text-stone-700">
                      {DEFAULT_SUPABASE_URL}
                    </code>
                  </div>
                  {currentUser && (
                    <div>
                      <span className="font-medium text-stone-700">Session:</span> {currentUser.email}
                    </div>
                  )}
                </div>
              </div>

              {/* SQL Migration Accordion */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                    PostgreSQL Schema & RLS Policies
                  </span>
                  <button
                    onClick={handleCopySchema}
                    className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold flex items-center gap-1 transition-colors"
                  >
                    {copiedSchema ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedSchema ? 'Copied SQL' : 'Copy SQL'}</span>
                  </button>
                </div>

                <div className="relative">
                  <pre className="p-4 rounded-2xl bg-stone-950 text-emerald-400 font-mono text-[11px] max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                    {supabaseSchema || 'Loading schema...'}
                  </pre>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-stone-100 bg-stone-50 flex items-center justify-between">
              <button
                onClick={handleSignOut}
                className="px-3.5 py-2 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>

              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 rounded-xl bg-stone-800 text-white text-xs font-semibold hover:bg-stone-900 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. ACHIEVEMENTS MODAL */}
      {showAchievementsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-stone-800">
                    Couple Milestones & Achievements
                  </h3>
                  <p className="text-[11px] text-stone-500">Every goal unlocked together makes your bond deeper.</p>
                </div>
              </div>
              <button onClick={() => setShowAchievementsModal(false)} className="text-stone-400 hover:text-stone-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3">
              {achievements.map(ach => (
                <div
                  key={ach.id}
                  className="p-4 rounded-2xl bg-stone-50 border border-stone-200 flex items-center gap-3.5"
                >
                  <span className="text-3xl p-2 rounded-2xl bg-white shadow-xs">{ach.icon}</span>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-stone-800">{ach.title}</h4>
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        {ach.progress}/{ach.maxProgress}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-500">{ach.description}</p>
                    <div className="w-full bg-stone-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-amber-500 h-1.5 rounded-full"
                        style={{ width: `${Math.min(100, (ach.progress / ach.maxProgress) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 7. NOTIFICATIONS MODAL */}
      {showNotificationsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-rose-100 text-rose-700">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-stone-800">
                    Sanctuary Notifications
                  </h3>
                  <p className="text-[11px] text-stone-500">Love notes, reading updates, and alerts.</p>
                </div>
              </div>
              <button onClick={() => setShowNotificationsModal(false)} className="text-stone-400 hover:text-stone-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-2.5">
              {notifications.length === 0 ? (
                <p className="text-xs text-stone-400 text-center py-6">No new notifications.</p>
              ) : (
                notifications.map(n => (
                  <div key={n.id} className="p-3 rounded-2xl bg-stone-50 border border-stone-100 space-y-1 text-xs">
                    <h5 className="font-bold text-stone-800">{n.title}</h5>
                    <p className="text-stone-600">{n.body}</p>
                    <span className="text-[10px] text-stone-400">
                      {new Date(n.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 8. INVITE / LINK PARTNER MODAL */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-rose-100 text-rose-700">
                  <Link2 className="w-5 h-5" />
                </div>
                <h3 className="font-serif font-bold text-base text-stone-800">
                  {couple ? 'Link Partner to Sanctuary' : 'Create Couple Sanctuary'}
                </h3>
              </div>
              <button onClick={() => setShowInviteModal(false)} className="text-stone-400 hover:text-stone-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {couple ? (
              <>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Share your private invitation code with your partner, or enter their code to merge your couple sanctuary.
                </p>

                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-center space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600">Your Invitation Code</span>
                  <div className="text-2xl font-mono font-bold tracking-widest text-stone-800 select-all">
                    {couple.inviteCode}
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(couple.inviteCode);
                      setCopiedInvite(true);
                      setTimeout(() => setCopiedInvite(false), 2000);
                    }}
                    className="px-4 py-1.5 rounded-xl bg-rose-600 text-white font-semibold text-xs inline-flex items-center gap-1 shadow-xs"
                  >
                    {copiedInvite ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedInvite ? 'Code Copied!' : 'Copy Code'}</span>
                  </button>
                </div>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-stone-200" />
                  <span className="flex-shrink mx-3 text-stone-400 text-xs uppercase font-bold">Or Join with Code</span>
                  <div className="flex-grow border-t border-stone-200" />
                </div>

                <form onSubmit={handleJoinCouple} className="space-y-3">
                  <input
                    type="text"
                    value={inviteInputCode}
                    onChange={e => setInviteInputCode(e.target.value)}
                    placeholder="Enter Partner's Code (e.g. US-XXXXXX)"
                    className="w-full px-3.5 py-2.5 text-xs bg-stone-50 rounded-xl border border-stone-200 focus:outline-none focus:ring-1 focus:ring-rose-400 text-center uppercase font-mono tracking-wider font-bold"
                  />
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-stone-800 hover:bg-stone-900 text-white font-semibold text-xs transition-colors"
                  >
                    Join Couple Sanctuary
                  </button>
                </form>
              </>
            ) : (
              <>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Create a new couple sanctuary to share your private space with your partner, or join an existing sanctuary using their invite code.
                </p>

                <button
                  onClick={handleCreateCouple}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-700 hover:to-rose-600 text-white font-semibold text-xs transition-all shadow-md shadow-rose-200 flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Create New Couple Sanctuary</span>
                </button>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-stone-200" />
                  <span className="flex-shrink mx-3 text-stone-400 text-xs uppercase font-bold">Or Join Existing</span>
                  <div className="flex-grow border-t border-stone-200" />
                </div>

                <form onSubmit={handleJoinCouple} className="space-y-3">
                  <input
                    type="text"
                    value={inviteInputCode}
                    onChange={e => setInviteInputCode(e.target.value)}
                    placeholder="Enter Partner's Code (e.g. US-XXXXXX)"
                    className="w-full px-3.5 py-2.5 text-xs bg-stone-50 rounded-xl border border-stone-200 focus:outline-none focus:ring-1 focus:ring-rose-400 text-center uppercase font-mono tracking-wider font-bold"
                  />
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-stone-800 hover:bg-stone-900 text-white font-semibold text-xs transition-colors"
                  >
                    Join Partner's Sanctuary
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
