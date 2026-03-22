import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';

interface UnreadCount {
  group_id: string;
  unread_count: string;
}

interface ChatContextType {
  unreadCounts: Record<string, number>;
  totalUnread: number;
  refreshUnreadCounts: () => Promise<void>;
  markGroupAsRead: (groupId: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { token, user } = useAuth();
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  const refreshUnreadCounts = async () => {
    if (!token || !user) return;
    try {
      const res = await fetch('/api/chat/unread', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data: UnreadCount[] = await res.json();
        const counts: Record<string, number> = {};
        data.forEach(item => {
          counts[item.group_id] = parseInt(item.unread_count, 10);
        });
        setUnreadCounts(counts);
      }
    } catch (err) {
      console.error('Failed to fetch unread counts', err);
    }
  };

  const markGroupAsRead = async (groupId: string) => {
    if (!token) return;
    try {
      await fetch(`/api/chat/groups/${groupId}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      setUnreadCounts(prev => ({ ...prev, [groupId]: 0 }));
    } catch (err) {
      console.error('Failed to mark group as read', err);
    }
  };

  useEffect(() => {
    refreshUnreadCounts();
    // Poll every 30 seconds as a fallback, though socket events should ideally trigger this
    const interval = setInterval(refreshUnreadCounts, 30000);
    return () => clearInterval(interval);
  }, [token, user]);

  const totalUnread = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);

  return (
    <ChatContext.Provider value={{ unreadCounts, totalUnread, refreshUnreadCounts, markGroupAsRead }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
};
