import React from 'react';
import { Home, MessageCircleHeart, Flower2, BookOpen, Camera, Gamepad2 } from 'lucide-react';

export type TabType = 'home' | 'chat' | 'cycle' | 'library' | 'memories' | 'games';

interface NavigationProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  unreadChatCount?: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onSelectTab,
  unreadChatCount = 0
}) => {
  const tabs = [
    { id: 'home' as TabType, label: 'Home', icon: Home },
    { id: 'chat' as TabType, label: 'Chat', icon: MessageCircleHeart, badge: unreadChatCount },
    { id: 'cycle' as TabType, label: 'Cycle', icon: Flower2 },
    { id: 'library' as TabType, label: 'Library', icon: BookOpen },
    { id: 'memories' as TabType, label: 'Memories', icon: Camera },
    { id: 'games' as TabType, label: 'Games', icon: Gamepad2 }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-rose-100/80 px-2 py-1.5 shadow-lg shadow-rose-950/5">
      <div className="max-w-md mx-auto grid grid-cols-6 items-center">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`relative flex flex-col items-center justify-center py-1 px-1 rounded-2xl transition-all duration-200 ${
                isActive
                  ? 'text-rose-600 font-semibold'
                  : 'text-stone-400 hover:text-stone-600 font-medium'
              }`}
            >
              {isActive && (
                <span className="absolute -top-1.5 w-6 h-1 bg-rose-500 rounded-full" />
              )}
              <div className="relative p-1">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                {tab.badge && tab.badge > 0 ? (
                  <span className="absolute -top-1 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
                    {tab.badge}
                  </span>
                ) : null}
              </div>
              <span className="text-[11px] tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
