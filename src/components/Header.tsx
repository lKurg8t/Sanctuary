import React, { useState } from 'react';
import { UserProfile, Couple } from '../types';
import { Bell, Settings, Award, Users, RefreshCw, Sparkles, Heart, Volume2, VolumeX, LogOut } from 'lucide-react';
import { Sound } from '../lib/audio';

interface HeaderProps {
  currentUser: UserProfile;
  couple: Couple | null;
  partner: UserProfile | null;
  unreadNotifsCount: number;
  onOpenNotifications: () => void;
  onOpenAchievements: () => void;
  onOpenSettings: () => void;
  onSwitchPartner: () => void;
  onOpenInviteModal: () => void;
  onSendLoveNudge?: () => void;
  onSignOut?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  couple,
  partner,
  unreadNotifsCount,
  onOpenNotifications,
  onOpenAchievements,
  onOpenSettings,
  onSwitchPartner,
  onOpenInviteModal,
  onSendLoveNudge,
  onSignOut
}) => {
  const [isMuted, setIsMuted] = useState(Sound.getMuted());
  const [nudgeSentRecently, setNudgeSentRecently] = useState(false);

  const handleToggleSound = () => {
    const muted = Sound.toggleMute();
    setIsMuted(muted);
    if (!muted) {
      Sound.playReactionSound();
    }
  };

  const handleNudgeClick = () => {
    if (onSendLoveNudge) {
      onSendLoveNudge();
      setNudgeSentRecently(true);
      setTimeout(() => setNudgeSentRecently(false), 2500);
    }
  };

  // Calculate days together
  const daysTogether = React.useMemo(() => {
    if (!couple?.relationshipStartDate) return 0;
    const start = new Date(couple.relationshipStartDate);
    const now = new Date();
    const diff = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(1, diff);
  }, [couple?.relationshipStartDate]);

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-rose-100 shadow-xs px-4 py-3 transition-colors">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
        {/* Left: App Logo & Intimate Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-500 via-rose-400 to-amber-300 flex items-center justify-center shadow-md shadow-rose-200 text-white font-semibold">
            <Heart className="w-5 h-5 fill-white text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-serif text-lg font-bold tracking-tight text-stone-800">
                My Space
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200/60">
                Us
              </span>
            </div>
            <p className="text-xs text-stone-500 font-medium flex items-center gap-1">
              {couple ? (
                <>
                  <span className="text-rose-600 font-semibold">{daysTogether} days</span> together
                </>
              ) : (
                'Private Sanctuary'
              )}
            </p>
          </div>
        </div>

        {/* Center/Right: Partner Status Pill, Nudge & Quick Switch */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {couple && partner ? (
            <div className="flex items-center gap-1.5">
              <div className="flex items-center bg-stone-100/90 rounded-full pl-1.5 pr-3 py-1 gap-2 border border-stone-200/70">
                <div className="relative">
                  <img
                    src={partner.avatarUrl}
                    alt={partner.displayName}
                    className="w-6 h-6 rounded-full object-cover ring-1 ring-white"
                  />
                  <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-white" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-semibold text-stone-700 leading-tight max-w-[85px] truncate">
                    {partner.displayName}
                  </span>
                  <span className="text-[9px] text-emerald-600 font-medium">Online</span>
                </div>
              </div>

              {/* Instant Love Nudge Button */}
              <button
                onClick={handleNudgeClick}
                disabled={nudgeSentRecently}
                title={`Send Love Nudge to ${partner.displayName}`}
                className={`p-2 rounded-xl transition-all flex items-center gap-1 ${
                  nudgeSentRecently
                    ? 'bg-rose-100 text-rose-600 scale-95'
                    : 'bg-rose-50 hover:bg-rose-100 text-rose-600 hover:scale-105 active:scale-95 shadow-xs border border-rose-200/70'
                }`}
              >
                <Heart className={`w-4 h-4 fill-rose-500 ${nudgeSentRecently ? 'animate-bounce' : 'animate-pulse'}`} />
                <span className="hidden md:inline text-xs font-bold">{nudgeSentRecently ? 'Sent!' : 'Nudge'}</span>
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenInviteModal}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-full border border-rose-200 transition-colors"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Link Partner</span>
            </button>
          )}

          {/* Partner Quick Switch (for instant 2-partner testing) */}
          <button
            onClick={onSwitchPartner}
            title={`Switch to partner view (${partner ? partner.displayName : 'Partner'})`}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-stone-500" />
            <span className="hidden sm:inline">Switch Role</span>
          </button>

          {/* Sound Mute/Unmute Toggle */}
          <button
            onClick={handleToggleSound}
            title={isMuted ? 'Sound is muted (tap to enable audio)' : 'Sound enabled (tap to mute)'}
            className={`p-2 rounded-xl transition-colors ${
              isMuted ? 'text-stone-400 hover:bg-stone-100' : 'text-rose-600 bg-rose-50/70 hover:bg-rose-100'
            }`}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Milestones / Achievements */}
          <button
            onClick={onOpenAchievements}
            title="Relationship Milestones"
            className="p-2 text-stone-600 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-colors"
          >
            <Award className="w-5 h-5" />
          </button>

          {/* Notification Bell */}
          <button
            onClick={onOpenNotifications}
            title="Notifications"
            className="relative p-2 text-stone-600 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unreadNotifsCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white" />
            )}
          </button>

          {/* Settings Modal */}
          <button
            onClick={onOpenSettings}
            title="Settings & Privacy"
            className="p-2 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>

          {/* Sign Out */}
          {onSignOut && (
            <button
              onClick={onSignOut}
              title="Sign Out"
              className="p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
