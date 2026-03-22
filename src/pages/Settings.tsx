import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { ChevronRight, ChevronDown, User, Users } from 'lucide-react';

interface UserGroup {
  id: string;
  name: string;
  parent_id: string | null;
}

interface SystemUser {
  id: string;
  username: string;
  nickname?: string;
  role: string;
  user_group_id: string | null;
}

const TreeNode = ({ group, allGroups, allUsers, currentUserId, t }: { group: UserGroup, allGroups: UserGroup[], allUsers: SystemUser[], currentUserId?: string, t: any }) => {
  const [expanded, setExpanded] = useState(true);
  
  const childGroups = allGroups.filter(g => g.parent_id === group.id);
  const groupUsers = allUsers.filter(u => u.user_group_id === group.id);
  
  return (
    <div className="ml-4">
      <div 
        className="flex items-center py-1.5 cursor-pointer hover:bg-slate-100 rounded px-2 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {childGroups.length > 0 || groupUsers.length > 0 ? (
          expanded ? <ChevronDown className="w-4 h-4 text-slate-400 mr-1" /> : <ChevronRight className="w-4 h-4 text-slate-400 mr-1" />
        ) : (
          <span className="w-5" />
        )}
        <Users className="w-4 h-4 text-indigo-500 mr-2" />
        <span className="font-medium text-slate-700">{group.name}</span>
      </div>
      
      {expanded && (
        <div className="ml-2 border-l border-slate-200 pl-2">
          {groupUsers.map(u => (
            <div key={u.id} className={`flex items-center py-1.5 px-2 rounded ml-4 ${u.id === currentUserId ? 'bg-indigo-50 border border-indigo-100' : 'hover:bg-slate-50'}`}>
              <User className={`w-4 h-4 mr-2 ${u.id === currentUserId ? 'text-indigo-600' : 'text-slate-400'}`} />
              <span className={`text-sm ${u.id === currentUserId ? 'text-indigo-700 font-semibold' : 'text-slate-600'}`}>
                {u.nickname || u.username}
                {u.role === 'ADMIN' && <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded uppercase font-bold">{t('adminUser')}</span>}
                {u.id === currentUserId && <span className="ml-2 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{t('yourPosition')}</span>}
              </span>
            </div>
          ))}
          {childGroups.map(cg => (
            <TreeNode key={cg.id} group={cg} allGroups={allGroups} allUsers={allUsers} currentUserId={currentUserId} t={t} />
          ))}
        </div>
      )}
    </div>
  );
};

export default function Settings() {
  const { token, user } = useAuth();
  const { t } = useLanguage();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [usersList, setUsersList] = useState<SystemUser[]>([]);
  const [treeLoading, setTreeLoading] = useState(true);

  useEffect(() => {
    const fetchTree = async () => {
      try {
        const res = await fetch('/api/auth/user-tree', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setGroups(data.groups);
          setUsersList(data.users);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setTreeLoading(false);
      }
    };
    fetchTree();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (newPassword !== confirmPassword) {
      setError(t('passwordMismatch'));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ oldPassword, newPassword })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change password');

      setMessage(t('passwordUpdated'));
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const rootGroups = groups.filter(g => !g.parent_id);
  const unassignedUsers = usersList.filter(u => !u.user_group_id);

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <h1 className="text-xl md:text-2xl font-bold text-slate-900 mb-4 md:mb-6">{t('accountSettings')}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Change Password Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-6 h-fit">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">{t('changePassword')}</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}
            {message && <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg text-sm">{message}</div>}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('currentPassword')}</label>
              <input
                type="password"
                required
                value={oldPassword}
                onChange={e => setOldPassword(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('newPassword')}</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('confirmNewPassword')}</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {loading ? t('updating') : t('updatePassword')}
            </button>
          </form>
        </div>

        {/* User Tree Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">{t('userTree')}</h2>
          
          {treeLoading ? (
            <div className="p-4 text-slate-500 text-center">{t('loading')}</div>
          ) : (
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 overflow-y-auto max-h-[600px]">
              {rootGroups.length === 0 && unassignedUsers.length === 0 ? (
                <div className="text-slate-500 text-sm text-center py-4">No users found</div>
              ) : (
                <>
                  {rootGroups.map(group => (
                    <TreeNode 
                      key={group.id} 
                      group={group} 
                      allGroups={groups} 
                      allUsers={usersList} 
                      currentUserId={user?.id} 
                      t={t} 
                    />
                  ))}
                  
                  {unassignedUsers.length > 0 && (
                    <div className="mt-4">
                      <div className="flex items-center py-1.5 px-2">
                        <Users className="w-4 h-4 text-slate-400 mr-2" />
                        <span className="font-medium text-slate-600">{t('unassignedUsers')}</span>
                      </div>
                      <div className="ml-2 border-l border-slate-200 pl-2">
                        {unassignedUsers.map(u => (
                          <div key={u.id} className={`flex items-center py-1.5 px-2 rounded ml-4 ${u.id === user?.id ? 'bg-indigo-50 border border-indigo-100' : 'hover:bg-slate-50'}`}>
                            <User className={`w-4 h-4 mr-2 ${u.id === user?.id ? 'text-indigo-600' : 'text-slate-400'}`} />
                            <span className={`text-sm ${u.id === user?.id ? 'text-indigo-700 font-semibold' : 'text-slate-600'}`}>
                              {u.nickname || u.username}
                              {u.role === 'ADMIN' && <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded uppercase font-bold">{t('adminUser')}</span>}
                              {u.id === user?.id && <span className="ml-2 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{t('yourPosition')}</span>}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
