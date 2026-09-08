import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, Couple, ChatMessage } from '../types';
import { ApiService } from '../lib/api';
import { Send, Image, Smile, Trash2, Reply, Search, X, Check, CheckCheck, Mic, Sparkles, Heart } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Sound } from '../lib/audio';

interface ChatViewProps {
  currentUser: UserProfile;
  couple: Couple | null;
  partner: UserProfile | null;
  messages: ChatMessage[];
  onSendMessage: (text: string, mediaUrl?: string, mediaType?: 'image' | 'voice' | 'sticker', replyTo?: { id: string; text: string }) => void;
  onReact: (messageId: string, emoji: string) => void;
  onDeleteMessage: (messageId: string) => void;
  onSendLoveNudge?: () => void;
}

const EMOJI_REACTIONS = ['❤️', '🥰', '✨', '💖', '🔥', '🥂', '🥺', '😂'];

const STICKER_PRESETS = [
  { emoji: '🧸', label: 'Warm Hug' },
  { emoji: '💌', label: 'Love Letter' },
  { emoji: '🌹', label: 'Single Rose' },
  { emoji: '☕', label: 'Coffee Date' },
  { emoji: '🌙', label: 'Sweet Dreams' },
  { emoji: '🍫', label: 'Sweet Treat' }
];

export const ChatView: React.FC<ChatViewProps> = ({
  currentUser,
  couple,
  partner,
  messages,
  onSendMessage,
  onReact,
  onDeleteMessage,
  onSendLoveNudge
}) => {
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<any>(null);

  // Listen for realtime typing indicator & auto-reset on session changes
  useEffect(() => {
    setInputText('');
    setSearchQuery('');
    setShowSearch(false);
    setShowEmojiPicker(false);
    setReplyTarget(null);
    setSelectedPhotoUrl(null);
    setIsRecordingVoice(false);
    setPartnerTyping(false);

    if (!couple?.id) return;

    const cleanup = ApiService.subscribeToCoupleUpdates(couple.id, (event, data) => {
      if (event === 'chat_typing' && data.userId !== currentUser.id) {
        setPartnerTyping(data.isTyping);
      }
    });

    return cleanup;
  }, [couple?.id, currentUser?.id]);

  // Guarantee message uniqueness across any transient network/render race conditions
  const uniqueMessages = React.useMemo(() => {
    const seen = new Set<string>();
    return messages.filter(m => {
      if (!m?.id) return false;
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  }, [messages]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [uniqueMessages.length]);

  // Handle typing debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    if (!couple) return;

    ApiService.sendTyping(couple.id, currentUser.id, true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      if (couple) ApiService.sendTyping(couple.id, currentUser.id, false);
    }, 2000);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !selectedPhotoUrl) return;

    Sound.playSentMessageSound();

    onSendMessage(
      inputText.trim(),
      selectedPhotoUrl || undefined,
      selectedPhotoUrl ? 'image' : undefined,
      replyTarget ? { id: replyTarget.id, text: replyTarget.text } : undefined
    );

    setInputText('');
    setSelectedPhotoUrl(null);
    setReplyTarget(null);
    setShowEmojiPicker(false);
  };

  const handleVoiceNote = () => {
    setIsRecordingVoice(true);
    Sound.playHeartbeatSound();
    setTimeout(() => {
      setIsRecordingVoice(false);
      Sound.playSentMessageSound();
      onSendMessage('🎙️ Voice Note (0:14) • "Thinking of you right now..."', undefined, 'voice');
      confetti({ particleCount: 30, spread: 50, origin: { y: 0.8 } });
    }, 1500);
  };

  const handleReactWithSound = (messageId: string, emoji: string) => {
    Sound.playReactionSound();
    onReact(messageId, emoji);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedPhotoUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const filteredMessages = uniqueMessages.filter(m => {
    if (!searchQuery.trim()) return true;
    return m.text.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] bg-stone-50 rounded-3xl border border-stone-200 overflow-hidden shadow-sm animate-in fade-in duration-200">
      {/* 1. CHAT TOP BAR */}
      <div className="px-4 py-3 bg-white border-b border-stone-200/80 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={partner?.avatarUrl || 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80'}
              alt={partner?.displayName || 'Partner'}
              className="w-10 h-10 rounded-full object-cover ring-2 ring-rose-200"
            />
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white" />
          </div>
          <div>
            <h3 className="font-serif font-bold text-sm text-stone-800 flex items-center gap-1.5">
              {partner?.displayName || 'Partner'}
              <Sparkles className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
            </h3>
            <p className="text-[11px] text-stone-500 font-medium">
              {partnerTyping ? (
                <span className="text-rose-600 animate-pulse font-semibold">typing a message...</span>
              ) : (
                'End-to-End Private Space'
              )}
            </p>
          </div>
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-1">
          {onSendLoveNudge && (
            <button
              onClick={() => {
                Sound.playLoveNudgeSound();
                onSendLoveNudge();
              }}
              title={`Send Love Nudge to ${partner?.displayName || 'Partner'}`}
              className="p-2 text-rose-500 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition-all active:scale-95 flex items-center gap-1"
            >
              <Heart className="w-4 h-4 fill-rose-500 animate-pulse" />
              <span className="hidden sm:inline text-xs font-semibold text-rose-600">Nudge</span>
            </button>
          )}

          {showSearch ? (
            <div className="flex items-center bg-stone-100 rounded-xl px-2 py-1 gap-1">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search words..."
                className="text-xs bg-transparent focus:outline-none w-28 text-stone-800"
                autoFocus
              />
              <button onClick={() => { setSearchQuery(''); setShowSearch(false); }}>
                <X className="w-3.5 h-3.5 text-stone-400" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowSearch(true)}
              className="p-2 text-stone-500 hover:text-stone-700 rounded-xl hover:bg-stone-100 transition-colors"
            >
              <Search className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 2. MESSAGES STREAM */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-3">
            <div className="w-14 h-14 rounded-3xl bg-rose-100 text-rose-500 flex items-center justify-center shadow-inner">
              <Smile className="w-8 h-8" />
            </div>
            <h4 className="font-serif font-bold text-base text-stone-800">
              This is your private space. Say hello ❤️
            </h4>
            <p className="text-xs text-stone-500 max-w-xs">
              Every message, photo, and voice note here is only visible to you and your partner.
            </p>
            <div className="flex flex-wrap gap-2 justify-center pt-2">
              <button
                onClick={() => onSendMessage('I love you! ❤️')}
                className="px-3 py-1.5 rounded-full bg-white border border-rose-200 text-rose-700 text-xs font-semibold hover:bg-rose-50 shadow-xs transition-colors"
              >
                "I love you! ❤️"
              </button>
              <button
                onClick={() => onSendMessage('Missing you already 🥰')}
                className="px-3 py-1.5 rounded-full bg-white border border-rose-200 text-rose-700 text-xs font-semibold hover:bg-rose-50 shadow-xs transition-colors"
              >
                "Missing you already 🥰"
              </button>
            </div>
          </div>
        ) : (
          filteredMessages.map((msg, index) => {
            const isMe = msg.senderId === currentUser.id;
            const timeStr = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group relative`}
              >
                {/* Reply context pill */}
                {msg.replyToText && (
                  <div className="text-[11px] text-stone-500 bg-stone-200/70 px-2.5 py-1 rounded-t-xl mb-0.5 max-w-xs truncate border-l-2 border-rose-500">
                    Replying to: "{msg.replyToText}"
                  </div>
                )}

                {/* Message Bubble Container */}
                <div className="flex items-end gap-1.5 max-w-[85%] sm:max-w-md">
                  {/* Action hover tools */}
                  {isMe && (
                    <div className="hidden group-hover:flex items-center gap-1 mr-1 text-stone-400">
                      <button
                        onClick={() => onDeleteMessage(msg.id)}
                        className="p-1 hover:text-rose-600 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setReplyTarget(msg)}
                        className="p-1 hover:text-stone-700 rounded"
                        title="Reply"
                      >
                        <Reply className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <div
                    className={`rounded-2xl p-3.5 shadow-xs relative ${
                      isMe
                        ? 'bg-rose-600 text-white rounded-br-xs'
                        : 'bg-white text-stone-800 border border-stone-200 rounded-bl-xs'
                    }`}
                  >
                    {/* Media image */}
                    {msg.mediaUrl && (
                      <div className="mb-2 rounded-xl overflow-hidden max-h-60">
                        <img
                          src={msg.mediaUrl}
                          alt="Attachment"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    {/* Text content */}
                    {msg.text && (
                      <p className="text-xs sm:text-sm font-medium leading-relaxed whitespace-pre-wrap break-words">
                        {msg.text}
                      </p>
                    )}

                    {/* Timestamp & Read Receipts */}
                    <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${isMe ? 'text-rose-200' : 'text-stone-400'}`}>
                      <span>{timeStr}</span>
                      {isMe && <CheckCheck className="w-3 h-3 text-rose-200" />}
                    </div>
                  </div>

                  {!isMe && (
                    <div className="hidden group-hover:flex items-center gap-1 ml-1 text-stone-400">
                      <button
                        onClick={() => setReplyTarget(msg)}
                        className="p-1 hover:text-stone-700 rounded"
                        title="Reply"
                      >
                        <Reply className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Quick Emoji Reaction Buttons Bar (Hover or Rendered) */}
                <div className="flex items-center gap-1 mt-1">
                  {/* Rendered active reactions */}
                  {msg.reactions && Object.entries(msg.reactions as Record<string, string[]>).map(([emoji, uids]) => (
                    <button
                      key={emoji}
                      onClick={() => handleReactWithSound(msg.id, emoji)}
                      className={`text-[11px] px-1.5 py-0.5 rounded-full border flex items-center gap-1 ${
                        Array.isArray(uids) && uids.includes(currentUser.id)
                          ? 'bg-rose-100 border-rose-300 text-rose-800'
                          : 'bg-white border-stone-200 text-stone-700'
                      }`}
                    >
                      <span>{emoji}</span>
                      <span className="text-[10px] font-bold">{Array.isArray(uids) ? uids.length : 0}</span>
                    </button>
                  ))}

                  {/* Add reaction trigger */}
                  <div className="relative group/emoji">
                    <button className="text-xs text-stone-400 hover:text-rose-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      ❤️+
                    </button>
                    <div className="absolute bottom-6 left-0 hidden group-hover/emoji:flex bg-white shadow-lg border border-stone-200 rounded-full p-1 gap-1 z-20">
                      {EMOJI_REACTIONS.map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => handleReactWithSound(msg.id, emoji)}
                          className="hover:scale-125 transition-transform p-1 text-sm"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 3. REPLY PREVIEW BAR */}
      {replyTarget && (
        <div className="px-4 py-2 bg-rose-50 border-t border-rose-200 flex items-center justify-between text-xs text-rose-800">
          <div className="flex items-center gap-2 truncate">
            <Reply className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span className="font-semibold">{replyTarget.senderName}:</span>
            <span className="truncate text-stone-600">"{replyTarget.text}"</span>
          </div>
          <button onClick={() => setReplyTarget(null)}>
            <X className="w-4 h-4 text-stone-400 hover:text-stone-600" />
          </button>
        </div>
      )}

      {/* 4. PHOTO PREVIEW BEFORE SENDING */}
      {selectedPhotoUrl && (
        <div className="p-3 bg-stone-100 border-t border-stone-200 flex items-center gap-3">
          <div className="relative w-16 h-16 rounded-xl overflow-hidden shadow-xs ring-1 ring-stone-300">
            <img src={selectedPhotoUrl} alt="Preview" className="w-full h-full object-cover" />
            <button
              onClick={() => setSelectedPhotoUrl(null)}
              className="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 text-white"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <span className="text-xs text-stone-600 font-medium">Ready to send photo attachment</span>
        </div>
      )}

      {/* 5. STICKER POPUP PICKER */}
      {showEmojiPicker && (
        <div className="p-3 bg-white border-t border-stone-200 flex items-center gap-3 overflow-x-auto">
          {STICKER_PRESETS.map(st => (
            <button
              key={st.label}
              onClick={() => {
                onSendMessage(`${st.emoji} [${st.label}]`, undefined, 'sticker');
                setShowEmojiPicker(false);
              }}
              className="flex flex-col items-center justify-center p-2 hover:bg-rose-50 rounded-2xl transition-colors shrink-0"
            >
              <span className="text-2xl">{st.emoji}</span>
              <span className="text-[10px] text-stone-600 font-medium">{st.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* 6. INPUT CONTROL BAR */}
      <form onSubmit={handleSend} className="p-3 bg-white border-t border-stone-200 flex items-center gap-2">
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* Upload photo button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-2 text-stone-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
          title="Send Photo"
        >
          <Image className="w-5 h-5" />
        </button>

        {/* Sticker / emoji button */}
        <button
          type="button"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className="p-2 text-stone-500 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-colors"
          title="Couple Stickers"
        >
          <Smile className="w-5 h-5" />
        </button>

        {/* Text Input */}
        <input
          type="text"
          value={inputText}
          onChange={handleInputChange}
          placeholder="Whisper something sweet..."
          className="flex-1 px-4 py-2.5 text-xs sm:text-sm bg-stone-100 rounded-2xl border border-transparent focus:border-rose-300 focus:bg-white focus:outline-none text-stone-800 placeholder-stone-400"
        />

        {/* Voice Note Simulation */}
        <button
          type="button"
          onClick={handleVoiceNote}
          className={`p-2.5 rounded-xl transition-colors ${
            isRecordingVoice
              ? 'bg-rose-500 text-white animate-pulse'
              : 'text-stone-500 hover:text-rose-600 hover:bg-rose-50'
          }`}
          title="Hold/Tap for Voice Note"
        >
          <Mic className="w-5 h-5" />
        </button>

        {/* Send Button */}
        <button
          type="submit"
          disabled={!inputText.trim() && !selectedPhotoUrl}
          className="p-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white transition-all shadow-md shadow-rose-200"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
