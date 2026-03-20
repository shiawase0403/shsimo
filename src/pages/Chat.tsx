import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import { Send, Users, Hash, Loader2, AlertCircle, MessageSquare, X } from 'lucide-react';

interface Group {
  id: string;
  name: string;
  is_active: boolean;
}

interface GroupMember {
  id: string;
  username: string;
  full_name: string;
  is_active: boolean;
}

interface Message {
  id: string;
  group_id: string;
  user_id: string | null;
  username?: string;
  content: string;
  is_system: boolean;
  is_admin: boolean;
  created_at: string;
  status?: 'sending' | 'sent' | 'failed';
}

export default function Chat() {
  const { user, token } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [inputMessage, setInputMessage] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Record<string, number>>({});
  const [showMembers, setShowMembers] = useState(false);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
  const fetchMessages = async (groupId: string) => {
    try {
      const res = await fetch(`/api/chat/groups/${groupId}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => ({
          ...prev,
          [groupId]: data.map((m: any) => ({ ...m, status: 'sent' }))
        }));
      }
    } catch (err) {
      console.error('Failed to fetch messages', err);
    }
  };

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

  useEffect(() => {
    if (selectedGroup && !messages[selectedGroup.id]) {
      fetchMessages(selectedGroup.id);
    }
    if (selectedGroup && showMembers) {
      fetchMembers(selectedGroup.id);
    }
  }, [selectedGroup, token, showMembers]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedGroup]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !selectedGroup || !socket) return;

    const msgId = uuidv4();
    const groupId = selectedGroup.id;
    const newMsg: Message = {
      id: msgId,
      group_id: groupId,
      user_id: user!.id,
      username: user!.username,
      content: inputMessage.trim(),
      is_system: false,
      is_admin: user!.role === 'ADMIN',
      created_at: new Date().toISOString(),
      status: 'sending'
    };

    // Optimistic update
    setMessages(prev => ({
      ...prev,
      [groupId]: [...(prev[groupId] || []), newMsg]
    }));
    setInputMessage('');

    // Send to server
    socket.emit('send_message', {
      id: msgId,
      group_id: groupId,
      content: newMsg.content
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
    <div className="flex h-[calc(100vh-64px)] md:h-screen bg-white">
      {/* Sidebar */}
      <div className="w-64 border-r border-slate-200 flex flex-col bg-slate-50">
        <div className="p-4 border-b border-slate-200 bg-white">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <MessageSquare size={20} className="text-indigo-600" />
            Chat Groups
          </h2>
          {!isConnected && (
            <div className="mt-2 text-xs text-amber-600 flex items-center gap-1">
              <Loader2 size={12} className="animate-spin" />
              Connecting...
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {groups.map(group => (
            <button
              key={group.id}
              onClick={() => setSelectedGroup(group)}
              className={`w-full text-left px-3 py-3 rounded-xl flex items-center gap-3 transition-colors ${
                selectedGroup?.id === group.id
                  ? 'bg-indigo-100 text-indigo-900 font-medium'
                  : 'text-slate-600 hover:bg-slate-200'
              } ${!group.is_active ? 'opacity-60' : ''}`}
            >
              <Hash size={18} className={selectedGroup?.id === group.id ? 'text-indigo-600' : 'text-slate-400'} />
              <span className="truncate flex-1">{group.name}</span>
              {!group.is_active && (
                <span className="text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded font-medium">
                  Left
                </span>
              )}
            </button>
          ))}
          {groups.length === 0 && (
            <div className="p-4 text-center text-sm text-slate-500">
              No chat groups available.
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedGroup ? (
          <>
            {/* Chat Header */}
            <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between shadow-sm z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                  <Hash size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{selectedGroup.name}</h2>
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <Users size={12} /> {onlineUsers[selectedGroup.id] || 0} online
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

            <div className="flex-1 flex overflow-hidden">
              {/* Messages Area */}
              <div className="flex-1 flex flex-col min-w-0">
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-4">
                  {currentMessages.map((msg, index) => {
                    const isMe = msg.user_id === user?.id;
                    const showHeader = index === 0 || currentMessages[index - 1].user_id !== msg.user_id || msg.is_system;

                    if (msg.is_system) {
                      return (
                        <div key={msg.id} className="flex justify-center my-4">
                          <div className="bg-slate-200 text-slate-600 text-xs px-3 py-1 rounded-full">
                            <span className="font-medium">{msg.username}</span> {msg.content}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        {showHeader && !isMe && (
                          <span className="text-xs font-medium text-slate-500 mb-1 ml-1 flex items-center gap-1">
                            {msg.username}
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
                            <p className="text-sm break-words whitespace-pre-wrap">{msg.content}</p>
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
                  <form onSubmit={sendMessage} className="flex gap-2">
                    <input
                      type="text"
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      placeholder={
                        !selectedGroup.is_active
                          ? "You are no longer a member of this group"
                          : isConnected
                          ? "Type a message..."
                          : "Connecting..."
                      }
                      disabled={!isConnected || !selectedGroup.is_active}
                      className="flex-1 px-4 py-3 bg-slate-100 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 rounded-xl transition-all disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={!inputMessage.trim() || !isConnected || !selectedGroup.is_active}
                      className="px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                    >
                      <Send size={20} />
                    </button>
                  </form>
                </div>
              </div>

              {/* Members Sidebar */}
              {showMembers && (
                <div className="w-64 border-l border-slate-200 bg-white flex flex-col">
                  <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800">Members</h3>
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
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-medium text-sm">
                          {member.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {member.full_name}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            @{member.username}
                          </p>
                        </div>
                        {!member.is_active && (
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                            Left
                          </span>
                        )}
                      </div>
                    ))}
                    {members.length === 0 && (
                      <div className="p-4 text-center text-sm text-slate-500">
                        No members found.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-slate-50 text-slate-500">
            Select a group to start chatting
          </div>
        )}
      </div>
    </div>
  );
}
