import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useChatContext } from '../context/ChatContext';
import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import { Send, Users, Hash, Loader2, AlertCircle, MessageSquare, X, ChevronLeft, Paperclip, Calendar, MapPin } from 'lucide-react';

interface Group {
  id: string;
  name: string;
  is_active: boolean;
}

interface GroupMember {
  id: string;
  username: string;
  nickname?: string;
  is_active: boolean;
}

interface Message {
  id: string;
  group_id: string;
  user_id: string | null;
  username?: string;
  nickname?: string;
  content: string;
  is_system: boolean;
  is_admin: boolean;
  created_at: string;
  status?: 'sending' | 'sent' | 'failed';
  attachment_type?: string | null;
  attachment_id?: string | null;
  attachment_data?: any | null;
  attachment_exists?: boolean;
}

export default function Chat() {
  const { user, token } = useAuth();
  const { t } = useLanguage();
  const { unreadCounts, markGroupAsRead, refreshUnreadCounts } = useChatContext();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [inputMessage, setInputMessage] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Record<string, number>>({});
  const [showMembers, setShowMembers] = useState(false);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState<Record<string, boolean>>({});
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [attachableItems, setAttachableItems] = useState<{id: string, title: string, type: 'schedule' | 'activity', date: string}[]>([]);
  const [selectedAttachment, setSelectedAttachment] = useState<{id: string, title: string, type: 'schedule' | 'activity'} | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Fetch groups
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const res = await fetch('/api/chat/groups', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setGroups(data);
          if (data.length > 0) {
            setSelectedGroup(data[0]);
          }
        }
      } catch (err) {
        console.error('Failed to fetch groups', err);
      }
    };
    if (token) {
      fetchGroups();
    }
  }, [token]);

  const messagesRef = useRef<Record<string, Message[]>>(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const selectedGroupRef = useRef<Group | null>(selectedGroup);
  useEffect(() => {
    selectedGroupRef.current = selectedGroup;
  }, [selectedGroup]);

  // Setup Socket.io
  useEffect(() => {
    if (!token) return;

    const newSocket = io({
      auth: { token }
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      
      // Sync messages if we have a last message timestamp
      let lastMessageTime: string | null = null;
      Object.values(messagesRef.current).forEach((groupMsgs: Message[]) => {
        groupMsgs.forEach(msg => {
          if (!lastMessageTime || new Date(msg.created_at) > new Date(lastMessageTime)) {
            lastMessageTime = msg.created_at;
          }
        });
      });

      if (lastMessageTime) {
        newSocket.emit('sync_messages', { last_message_time: lastMessageTime }, (response: any) => {
          if (response.messages && Array.isArray(response.messages) && response.messages.length > 0) {
            setMessages(prev => {
              const newMessages = { ...prev };
              response.messages.forEach((msg: Message) => {
                const groupMsgs = newMessages[msg.group_id] || [];
                if (!groupMsgs.some(m => m.id === msg.id)) {
                  newMessages[msg.group_id] = [...groupMsgs, { ...msg, status: 'sent' }];
                }
              });
              // Sort messages by created_at
              Object.keys(newMessages).forEach(groupId => {
                newMessages[groupId].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
              });
              return newMessages;
            });
            refreshUnreadCounts();
          }
        });
      } else if (selectedGroupRef.current) {
        fetchMessages(selectedGroupRef.current.id);
      }
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('chat_message', (msg: Message) => {
      setMessages(prev => {
        const groupMessages = prev[msg.group_id] || [];
        // Check if message already exists (e.g., our own message that we optimistically added)
        const exists = groupMessages.some(m => m.id === msg.id);
        if (exists) {
          return {
            ...prev,
            [msg.group_id]: groupMessages.map(m => m.id === msg.id ? { ...msg, status: 'sent' } : m)
          };
        }
        return {
          ...prev,
          [msg.group_id]: [...groupMessages, { ...msg, status: 'sent' }]
        };
      });

      // If this message is for the currently selected group, mark as read
      if (selectedGroupRef.current?.id === msg.group_id) {
        markGroupAsRead(msg.group_id);
      } else {
        refreshUnreadCounts();
      }
    });

    newSocket.on('online_count', (data: { group_id: string, count: number }) => {
      setOnlineUsers(prev => ({
        ...prev,
        [data.group_id]: data.count
      }));
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [token]);

  // Fetch initial messages when group changes
  const fetchMessages = async (groupId: string, before?: string) => {
    try {
      let url = `/api/chat/groups/${groupId}/messages`;
      if (before) {
        url += `?before=${encodeURIComponent(before)}`;
      }
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        
        setMessages(prev => {
          const existing = prev[groupId] || [];
          if (before) {
            // Prepend older messages
            return {
              ...prev,
              [groupId]: [...data.map((m: any) => ({ ...m, status: 'sent' })), ...existing]
            };
          } else {
            // Initial load
            return {
              ...prev,
              [groupId]: data.map((m: any) => ({ ...m, status: 'sent' }))
            };
          }
        });

        setHasMore(prev => ({
          ...prev,
          [groupId]: data.length === 30 // Assuming limit is 30
        }));

        if (!before) {
          markGroupAsRead(groupId);
        }
      }
    } catch (err) {
      console.error('Failed to fetch messages', err);
    }
  };

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    if (target.scrollTop < 50 && selectedGroup && !isLoadingMore && hasMore[selectedGroup.id]) {
      const currentMsgs = messages[selectedGroup.id] || [];
      if (currentMsgs.length > 0) {
        setIsLoadingMore(true);
        const oldestMsg = currentMsgs[0];
        
        // Save current scroll height to maintain position after loading
        const scrollHeightBefore = target.scrollHeight;
        
        fetchMessages(selectedGroup.id, oldestMsg.created_at).then(() => {
          setIsLoadingMore(false);
          // Restore scroll position
          requestAnimationFrame(() => {
            if (messagesContainerRef.current) {
              const scrollHeightAfter = messagesContainerRef.current.scrollHeight;
              messagesContainerRef.current.scrollTop = scrollHeightAfter - scrollHeightBefore;
            }
          });
        });
      }
    }
  }, [selectedGroup, messages, isLoadingMore, hasMore]);

  const fetchMembers = async (groupId: string) => {
    try {
      const res = await fetch(`/api/chat/groups/${groupId}/members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMembers(data);
      }
    } catch (err) {
      console.error('Failed to fetch members', err);
    }
  };

  const fetchAttachableItems = async () => {
    try {
      // Fetch schedules
      const schedulesRes = await fetch('/api/schedules', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Fetch activities
      const activitiesRes = await fetch('/api/activities', {
        headers: { Authorization: `Bearer ${token}` }
      });

      let items: {id: string, title: string, type: 'schedule' | 'activity', date: string}[] = [];

      if (schedulesRes.ok) {
        const schedules = await schedulesRes.json();
        items = [...items, ...schedules.map((s: any) => ({
          id: s.id,
          title: s.title,
          type: 'schedule',
          date: s.start_time
        }))];
      }

      if (activitiesRes.ok) {
        const activities = await activitiesRes.json();
        items = [...items, ...activities.map((a: any) => ({
          id: a.id,
          title: a.title,
          type: 'activity',
          date: a.start_time
        }))];
      }

      // Sort by date descending
      items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setAttachableItems(items);
    } catch (err) {
      console.error('Failed to fetch attachable items', err);
    }
  };

  useEffect(() => {
    if (showAttachmentModal && attachableItems.length === 0) {
      fetchAttachableItems();
    }
  }, [showAttachmentModal, token]);

  useEffect(() => {
    if (selectedGroup) {
      if (!messages[selectedGroup.id]) {
        fetchMessages(selectedGroup.id);
      } else {
        markGroupAsRead(selectedGroup.id);
      }
      if (showMembers) {
        fetchMembers(selectedGroup.id);
      }
    }
  }, [selectedGroup, token, showMembers]);

  // Scroll to bottom on new message if we are already near the bottom
  useEffect(() => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      
      if (isNearBottom) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      messagesEndRef.current?.scrollIntoView();
    }
  }, [messages, selectedGroup]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputMessage.trim() && !selectedAttachment) || !selectedGroup || !socket) return;

    const msgId = uuidv4();
    const groupId = selectedGroup.id;
    const newMsg: Message = {
      id: msgId,
      group_id: groupId,
      user_id: user!.id,
      username: user!.username,
      nickname: user!.nickname,
      content: inputMessage.trim(),
      is_system: false,
      is_admin: user!.role === 'ADMIN',
      created_at: new Date().toISOString(),
      status: 'sending',
      attachment_type: selectedAttachment?.type || null,
      attachment_id: selectedAttachment?.id || null,
      attachment_data: selectedAttachment ? { title: selectedAttachment.title } : null,
      attachment_exists: !!selectedAttachment
    };

    // Optimistic update
    setMessages(prev => ({
      ...prev,
      [groupId]: [...(prev[groupId] || []), newMsg]
    }));
    setInputMessage('');
    setSelectedAttachment(null);

    // Send to server
    socket.emit('send_message', {
      id: msgId,
      group_id: groupId,
      content: newMsg.content,
      attachment_type: newMsg.attachment_type,
      attachment_id: newMsg.attachment_id,
      attachment_data: newMsg.attachment_data
    }, (response: any) => {
      setMessages(prev => {
        const groupMsgs = prev[groupId] || [];
        return {
          ...prev,
          [groupId]: groupMsgs.map(m => m.id === msgId ? { ...m, status: response.success ? 'sent' : 'failed' } : m)
        };
      });
    });

    // Timeout for failure
    setTimeout(() => {
      setMessages(prev => {
        const groupMsgs = prev[groupId] || [];
        const msg = groupMsgs.find(m => m.id === msgId);
        if (msg && msg.status === 'sending') {
          return {
            ...prev,
            [groupId]: groupMsgs.map(m => m.id === msgId ? { ...m, status: 'failed' } : m)
          };
        }
        return prev;
      });
    }, 5000);
  };

  const currentMessages = selectedGroup ? (messages[selectedGroup.id] || []) : [];

  return (
    <div className="flex h-[calc(100vh-64px)] md:h-screen bg-white relative overflow-hidden">
      {/* Sidebar */}
      <div className={`${selectedGroup ? 'hidden md:flex' : 'flex'} w-full md:w-64 border-r border-slate-200 flex-col bg-slate-50 shrink-0`}>
        <div className="p-4 border-b border-slate-200 bg-white">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <MessageSquare size={20} className="text-indigo-600" />
            {t('chatGroups')}
          </h2>
          {!isConnected && (
            <div className="mt-2 text-xs text-amber-600 flex items-center gap-1">
              <Loader2 size={12} className="animate-spin" />
              {t('connecting')}
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {groups.map(group => {
            const unreadCount = unreadCounts[group.id] || 0;
            return (
              <button
                key={group.id}
                onClick={() => setSelectedGroup(group)}
                className={`w-full text-left px-3 py-3 rounded-xl flex items-center gap-3 transition-colors relative ${
                  selectedGroup?.id === group.id
                    ? 'bg-indigo-100 text-indigo-900 font-medium'
                    : 'text-slate-600 hover:bg-slate-200'
                } ${!group.is_active ? 'opacity-60' : ''}`}
              >
                <Hash size={18} className={selectedGroup?.id === group.id ? 'text-indigo-600' : 'text-slate-400'} />
                <span className="truncate flex-1">{group.name}</span>
                {unreadCount > 0 && selectedGroup?.id !== group.id && (
                  <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
                {!group.is_active && (
                  <span className="text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded font-medium">
                    {t('leftGroup')}
                  </span>
                )}
              </button>
            );
          })}
          {groups.length === 0 && (
            <div className="p-4 text-center text-sm text-slate-500">
              {t('noChatGroups')}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`${!selectedGroup ? 'hidden md:flex' : 'flex'} flex-1 flex-col min-w-0 bg-white relative`}>
        {selectedGroup ? (
          <>
            {/* Chat Header */}
            <div className="px-4 md:px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between shadow-sm z-10">
              <div className="flex items-center gap-2 md:gap-3">
                <button 
                  onClick={() => setSelectedGroup(null)}
                  className="md:hidden p-1.5 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <ChevronLeft size={24} />
                </button>
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                  <Hash size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{selectedGroup.name}</h2>
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <Users size={12} /> {onlineUsers[selectedGroup.id] || 0} {t('online')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowMembers(!showMembers)}
                className={`p-2 rounded-lg transition-colors ${
                  showMembers ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:bg-slate-100'
                }`}
                title="Toggle Members"
              >
                <Users size={20} />
              </button>
            </div>

            <div className="flex-1 flex overflow-hidden relative">
              {/* Messages Area */}
              <div className="flex-1 flex flex-col min-w-0">
                <div 
                  className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50 space-y-4"
                  ref={messagesContainerRef}
                  onScroll={handleScroll}
                >
                  {isLoadingMore && (
                    <div className="flex justify-center py-2">
                      <Loader2 size={20} className="animate-spin text-indigo-500" />
                    </div>
                  )}
                  {currentMessages.map((msg, index) => {
                    const isMe = msg.user_id === user?.id;
                    const showHeader = index === 0 || currentMessages[index - 1].user_id !== msg.user_id || msg.is_system;

                    if (msg.is_system) {
                      return (
                        <div key={msg.id} className="flex justify-center my-4">
                          <div className="bg-slate-200 text-slate-600 text-xs px-3 py-1 rounded-full">
                            <span className="font-medium">{msg.nickname || msg.username}</span> {msg.content}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        {showHeader && !isMe && (
                          <span className="text-xs font-medium text-slate-500 mb-1 ml-1 flex items-center gap-1">
                            {msg.nickname || msg.username}
                            {msg.is_admin && (
                              <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded font-bold">ADMIN</span>
                            )}
                          </span>
                        )}
                        <div className="flex items-end gap-2 max-w-[80%]">
                          <div
                            className={`px-4 py-2 rounded-2xl ${
                              isMe
                                ? 'bg-indigo-600 text-white rounded-br-sm'
                                : msg.is_admin
                                ? 'bg-amber-100 text-amber-900 border border-amber-200 rounded-bl-sm'
                                : 'bg-white text-slate-800 border border-slate-200 rounded-bl-sm shadow-sm'
                            }`}
                          >
                            {msg.attachment_type && msg.attachment_exists && msg.attachment_data && (
                              <div className={`mb-2 p-2 rounded-lg text-sm flex items-center gap-2 ${
                                isMe ? 'bg-indigo-500/30' : 'bg-slate-100'
                              }`}>
                                {msg.attachment_type === 'schedule' ? <Calendar size={16} /> : <MapPin size={16} />}
                                <span className="font-medium truncate">{msg.attachment_data.title || t('deletedAttachment')}</span>
                              </div>
                            )}
                            {msg.attachment_type && (!msg.attachment_exists || !msg.attachment_data) && (
                              <div className={`mb-2 p-2 rounded-lg text-sm flex items-center gap-2 ${
                                isMe ? 'bg-indigo-500/30 text-indigo-200' : 'bg-slate-100 text-slate-500'
                              }`}>
                                <AlertCircle size={16} />
                                <span className="italic">{t('deletedAttachment')}</span>
                              </div>
                            )}
                            {msg.content && (
                              <p className="text-sm break-words whitespace-pre-wrap">{msg.content}</p>
                            )}
                          </div>
                          {isMe && (
                            <div className="text-[10px] text-slate-400 mb-1">
                              {msg.status === 'sending' && <Loader2 size={12} className="animate-spin" />}
                              {msg.status === 'failed' && <AlertCircle size={12} className="text-red-500" title="Failed to send" />}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white border-t border-slate-200">
                  {selectedAttachment && (
                    <div className="mb-2 flex items-center justify-between bg-indigo-50 text-indigo-700 px-3 py-2 rounded-lg text-sm">
                      <div className="flex items-center gap-2 truncate">
                        {selectedAttachment.type === 'schedule' ? <Calendar size={16} /> : <MapPin size={16} />}
                        <span className="font-medium truncate">{selectedAttachment.title}</span>
                      </div>
                      <button 
                        onClick={() => setSelectedAttachment(null)}
                        className="text-indigo-400 hover:text-indigo-600 p-1"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                  <form onSubmit={sendMessage} className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAttachmentModal(true)}
                      disabled={!isConnected || !selectedGroup.is_active}
                      className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors disabled:opacity-50"
                      title={t('attachScheduleOrActivity')}
                    >
                      <Paperclip size={20} />
                    </button>
                    <input
                      type="text"
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      placeholder={
                        !selectedGroup.is_active
                          ? t('youAreNoLongerMember')
                          : isConnected
                          ? t('typeMessage')
                          : t('connecting')
                      }
                      disabled={!isConnected || !selectedGroup.is_active}
                      className="flex-1 px-4 py-3 bg-slate-100 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 rounded-xl transition-all disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={(!inputMessage.trim() && !selectedAttachment) || !isConnected || !selectedGroup.is_active}
                      className="px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                    >
                      <Send size={20} />
                    </button>
                  </form>
                </div>
              </div>

              {/* Members Sidebar */}
              {showMembers && (
                <>
                  {/* Mobile Backdrop */}
                  <div 
                    className="md:hidden absolute inset-0 bg-slate-900/20 z-20"
                    onClick={() => setShowMembers(false)}
                  />
                  <div className="absolute right-0 inset-y-0 md:relative z-30 w-64 border-l border-slate-200 bg-white flex flex-col shadow-xl md:shadow-none">
                  <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800">{t('members')}</h3>
                    <button
                      onClick={() => setShowMembers(false)}
                      className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2">
                    {members.map(member => (
                      <div
                        key={member.id}
                        className={`px-3 py-2 rounded-lg flex items-center gap-3 ${
                          !member.is_active ? 'opacity-50' : ''
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-medium text-sm uppercase">
                          {(member.nickname || member.username).charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {member.nickname || member.username}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            @{member.username}
                          </p>
                        </div>
                        {!member.is_active && (
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                            {t('leftGroup')}
                          </span>
                        )}
                      </div>
                    ))}
                    {members.length === 0 && (
                      <div className="p-4 text-center text-sm text-slate-500">
                        {t('noMembersFound')}
                      </div>
                    )}
                  </div>
                </div>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-slate-50 text-slate-500">
            {t('selectGroupToChat')}
          </div>
        )}
      </div>
      {/* Attachment Modal */}
      {showAttachmentModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">{t('attachScheduleOrActivity')}</h3>
              <button 
                onClick={() => setShowAttachmentModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {attachableItems.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <Loader2 size={24} className="animate-spin mx-auto mb-2 text-indigo-500" />
                  <p>{t('loading')}</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {attachableItems.map(item => (
                    <button
                      key={`${item.type}-${item.id}`}
                      onClick={() => {
                        setSelectedAttachment(item);
                        setShowAttachmentModal(false);
                      }}
                      className="w-full text-left px-4 py-3 rounded-xl hover:bg-slate-50 flex items-center gap-3 transition-colors"
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        item.type === 'schedule' ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'
                      }`}>
                        {item.type === 'schedule' ? <Calendar size={20} /> : <MapPin size={20} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate">{item.title}</p>
                        <p className="text-xs text-slate-500">
                          {new Date(item.date).toLocaleDateString()} • {item.type === 'schedule' ? t('schedule') : t('activity')}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
