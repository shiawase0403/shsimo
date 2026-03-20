import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/Modal';
import { toUTC8InputString, fromUTC8InputString } from '../../utils/dateUtils';
import { Folder, User, MapPin, ChevronRight, Home, Users } from 'lucide-react';

export default function AdminDashboard() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('users_and_groups');
  const [data, setData] = useState<any>({
    users: [],
    locations: [],
    schedules: [],
    activities: [],
    groups: [],
    user_groups: []
  });

  // Navigation states
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(null);
  const [currentLocationId, setCurrentLocationId] = useState<string | null>(null);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{type: string, id: string} | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [errorMsg, setErrorMsg] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [modalType, setModalType] = useState<string>('');

  const fetchData = async () => {
    try {
      const [users, locations, schedules, activities, groups, user_groups] = await Promise.all([
        fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } }).then(res => res.json()),
        fetch('/api/locations', { headers: { Authorization: `Bearer ${token}` } }).then(res => res.json()),
        fetch('/api/schedules', { headers: { Authorization: `Bearer ${token}` } }).then(res => res.json()),
        fetch('/api/activities', { headers: { Authorization: `Bearer ${token}` } }).then(res => res.json()),
        fetch('/api/groups', { headers: { Authorization: `Bearer ${token}` } }).then(res => res.json()),
        fetch('/api/admin/user-groups', { headers: { Authorization: `Bearer ${token}` } }).then(res => res.json())
      ]);
      setData({ users, locations, schedules, activities, groups, user_groups });
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const confirmDelete = (type: string, id: string) => {
    setItemToDelete({ type, id });
    setIsDeleteModalOpen(true);
  };

  const openEditModal = (type: string, item: any) => {
    setIsEditing(true);
    setModalType(type);
    let editData = { ...item };
    
    // Format dates for input
    if (editData.start_time) editData.start_time = toUTC8InputString(editData.start_time);
    if (editData.end_time) editData.end_time = toUTC8InputString(editData.end_time);
    
    // For users, don't pre-fill password
    if (type === 'users') {
      editData.password = '';
    }
    
    if (type === 'user_groups') {
      editData.userIds = data.users.filter((u: any) => u.user_group_id === item.id).map((u: any) => u.id);
    }
    
    setFormData(editData);
    setErrorMsg('');
    setIsAddModalOpen(true);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      const { type, id } = itemToDelete;
      const endpoint = (type === 'users' || type === 'user_groups') ? `/api/admin/${type.replace('_', '-')}/${id}` : `/api/${type}/${id}`;
      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json();
        setErrorMsg(err.error || 'Failed to delete');
        return;
      }
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
      fetchData();
    } catch (err) {
      console.error(err);
      setErrorMsg('An error occurred while deleting.');
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const endpoint = (modalType === 'users' || modalType === 'user_groups') ? `/api/admin/${modalType.replace('_', '-')}` : `/api/${modalType}`;
      const url = isEditing ? `${endpoint}/${formData.id}` : endpoint;
      const method = isEditing ? 'PUT' : 'POST';
      
      const payload = { ...formData };
      
      // Convert dates back to UTC
      if (payload.start_time) payload.start_time = fromUTC8InputString(payload.start_time);
      if (payload.end_time) payload.end_time = fromUTC8InputString(payload.end_time);

      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json();
        setErrorMsg(err.error || `Failed to ${isEditing ? 'update' : 'add'} item`);
        return;
      }
      setIsAddModalOpen(false);
      setFormData({});
      setIsEditing(false);
      fetchData();
    } catch (err) {
      console.error(err);
      setErrorMsg(`An error occurred while ${isEditing ? 'updating' : 'adding'}.`);
    }
  };

  // Helper to get full location path
  const getLocationPath = (locId: string, visited = new Set<string>()): string => {
    if (visited.has(locId)) return '[Circular Reference]';
    visited.add(locId);
    
    const loc = data.locations.find((l: any) => l.id === locId);
    if (!loc) return '';
    if (loc.parent_id) {
      return `${getLocationPath(loc.parent_id, visited)} > ${loc.name}`;
    }
    return loc.name;
  };

  const getUserGroupPath = (groupId: string, visited = new Set<string>()): string => {
    if (visited.has(groupId)) return '[Circular Reference]';
    visited.add(groupId);
    
    const group = data.user_groups.find((g: any) => g.id === groupId);
    if (!group) return '';
    if (group.parent_id) {
      return `${getUserGroupPath(group.parent_id, visited)} > ${group.name}`;
    }
    return group.name;
  };

  const getDisplayData = () => {
    if (activeTab === 'users_and_groups') {
      const groups = data.user_groups.filter((g: any) => (g.parent_id || null) === currentGroupId).map((g: any) => ({ ...g, itemType: 'user_groups' }));
      const users = data.users.filter((u: any) => (u.user_group_id || null) === currentGroupId).map((u: any) => ({ ...u, itemType: 'users' }));
      return [...groups, ...users];
    } else if (activeTab === 'locations') {
      return data.locations.filter((l: any) => (l.parent_id || null) === currentLocationId).map((l: any) => ({ ...l, itemType: 'locations' }));
    }
    return data[activeTab]?.map((item: any) => ({ ...item, itemType: activeTab })) || [];
  };

  const displayData = getDisplayData();

  const renderBreadcrumbs = () => {
    if (activeTab === 'users_and_groups') {
      const crumbs = [];
      let curr = currentGroupId;
      while (curr) {
        const g = data.user_groups.find((g: any) => g.id === curr);
        if (!g) break;
        crumbs.unshift(g);
        curr = g.parent_id;
      }
      return (
        <div className="flex items-center space-x-2 text-sm text-slate-600 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
          <button onClick={() => setCurrentGroupId(null)} className="flex items-center hover:text-indigo-600 transition-colors font-medium">
            <Home className="w-4 h-4 mr-1" /> Root
          </button>
          {crumbs.map(c => (
            <React.Fragment key={c.id}>
              <ChevronRight className="w-4 h-4 text-slate-400" />
              <button onClick={() => setCurrentGroupId(c.id)} className="hover:text-indigo-600 transition-colors font-medium">{c.name}</button>
            </React.Fragment>
          ))}
        </div>
      );
    } else if (activeTab === 'locations') {
      const crumbs = [];
      let curr = currentLocationId;
      while (curr) {
        const l = data.locations.find((l: any) => l.id === curr);
        if (!l) break;
        crumbs.unshift(l);
        curr = l.parent_id;
      }
      return (
        <div className="flex items-center space-x-2 text-sm text-slate-600 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
          <button onClick={() => setCurrentLocationId(null)} className="flex items-center hover:text-indigo-600 transition-colors font-medium">
            <Home className="w-4 h-4 mr-1" /> Root
          </button>
          {crumbs.map(c => (
            <React.Fragment key={c.id}>
              <ChevronRight className="w-4 h-4 text-slate-400" />
              <button onClick={() => setCurrentLocationId(c.id)} className="hover:text-indigo-600 transition-colors font-medium">{c.name}</button>
            </React.Fragment>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderFormFields = () => {
    switch (modalType) {
      case 'users':
        return (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
              <input type="text" required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" value={formData.username || ''} onChange={e => setFormData({...formData, username: e.target.value})} />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Password {isEditing && '(Leave blank to keep current)'}</label>
              <input type="password" required={!isEditing} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" value={formData.password || ''} onChange={e => setFormData({...formData, password: e.target.value})} />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">User Group (Optional)</label>
              <select className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" value={formData.user_group_id || ''} onChange={e => setFormData({...formData, user_group_id: e.target.value})}>
                <option value="">None</option>
                {data.user_groups.map((g: any) => (
                  <option key={g.id} value={g.id}>{getUserGroupPath(g.id)}</option>
                ))}
              </select>
            </div>
          </>
        );
      case 'user_groups':
        return (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
              <input type="text" required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Parent Group (Optional)</label>
              <select className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" value={formData.parent_id || ''} onChange={e => setFormData({...formData, parent_id: e.target.value})}>
                <option value="">None</option>
                {data.user_groups.map((g: any) => (
                  <option key={g.id} value={g.id} disabled={g.id === formData.id}>{getUserGroupPath(g.id)}</option>
                ))}
              </select>
            </div>
            {isEditing && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Sub-groups</label>
                <div className="text-sm text-slate-600 bg-slate-50 p-2 rounded border border-slate-200">
                  {data.user_groups.filter((g: any) => g.parent_id === formData.id).length > 0 ? (
                    <ul className="list-disc pl-5">
                      {data.user_groups.filter((g: any) => g.parent_id === formData.id).map((g: any) => (
                        <li key={g.id}>{g.name}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-slate-400 italic">No sub-groups</span>
                  )}
                </div>
              </div>
            )}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Users in this Group</label>
              <div className="max-h-48 overflow-y-auto border border-slate-300 rounded-lg p-2">
                {data.users.map((user: any) => (
                  <label key={user.id} className="flex items-center space-x-2 p-1 hover:bg-slate-50 rounded">
                    <input 
                      type="checkbox" 
                      checked={(formData.userIds || []).includes(user.id)}
                      onChange={(e) => {
                        const currentIds = formData.userIds || [];
                        if (e.target.checked) {
                          setFormData({...formData, userIds: [...currentIds, user.id]});
                        } else {
                          setFormData({...formData, userIds: currentIds.filter((id: string) => id !== user.id)});
                        }
                      }}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>{user.username}</span>
                  </label>
                ))}
              </div>
            </div>
          </>
        );
      case 'locations':
        return (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
              <input type="text" required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Parent Location (Optional)</label>
              <select className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" value={formData.parent_id || ''} onChange={e => setFormData({...formData, parent_id: e.target.value})}>
                <option value="">None</option>
                {data.locations.map((loc: any) => (
                  <option key={loc.id} value={loc.id} disabled={loc.id === formData.id}>{getLocationPath(loc.id)}</option>
                ))}
              </select>
            </div>
          </>
        );
      case 'groups':
        return (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
              <input type="text" required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Color</label>
              <input type="color" required className="w-full h-10 px-1 py-1 border border-slate-300 rounded-lg cursor-pointer" value={formData.color || '#4f46e5'} onChange={e => setFormData({...formData, color: e.target.value})} />
            </div>
          </>
        );
      case 'schedules':
        return (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
              <input type="text" required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" value={formData.title || ''} onChange={e => setFormData({...formData, title: e.target.value})} />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
              <select required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" value={formData.location_id || ''} onChange={e => setFormData({...formData, location_id: e.target.value})}>
                <option value="">Select Location</option>
                {data.locations.map((loc: any) => (
                  <option key={loc.id} value={loc.id}>{getLocationPath(loc.id)}</option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Group (Optional)</label>
              <select className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" value={formData.group_id || ''} onChange={e => setFormData({...formData, group_id: e.target.value})}>
                <option value="">None</option>
                {data.groups.map((g: any) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Start Time</label>
                <input type="datetime-local" required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" value={formData.start_time || ''} onChange={e => setFormData({...formData, start_time: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">End Time</label>
                <input type="datetime-local" required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" value={formData.end_time || ''} onChange={e => setFormData({...formData, end_time: e.target.value})} />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Contact Info (Optional)</label>
              <input type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" value={formData.contact_info || ''} onChange={e => setFormData({...formData, contact_info: e.target.value})} />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes (Optional)</label>
              <textarea className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" rows={3} value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})}></textarea>
            </div>
          </>
        );
      case 'activities':
        return (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
              <input type="text" required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" value={formData.title || ''} onChange={e => setFormData({...formData, title: e.target.value})} />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
              <select required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" value={formData.location_id || ''} onChange={e => setFormData({...formData, location_id: e.target.value})}>
                <option value="">Select Location</option>
                {data.locations.map((loc: any) => (
                  <option key={loc.id} value={loc.id}>{getLocationPath(loc.id)}</option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Time Type</label>
              <select required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" value={formData.time_type || ''} onChange={e => setFormData({...formData, time_type: e.target.value})}>
                <option value="">Select Type</option>
                <option value="permanent">Permanent</option>
                <option value="date_range">Date Range</option>
                <option value="exact_time">Exact Time</option>
              </select>
            </div>
            {formData.time_type !== 'permanent' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Start Time</label>
                  <input type="datetime-local" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" value={formData.start_time || ''} onChange={e => setFormData({...formData, start_time: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">End Time</label>
                  <input type="datetime-local" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" value={formData.end_time || ''} onChange={e => setFormData({...formData, end_time: e.target.value})} />
                </div>
              </div>
            )}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Contact Info (Optional)</label>
              <input type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" value={formData.contact_info || ''} onChange={e => setFormData({...formData, contact_info: e.target.value})} />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes (Optional)</label>
              <textarea className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" rows={3} value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})}></textarea>
            </div>
          </>
        );
      default:
        return null;
    }
  };

  const tabs = [
    { id: 'users_and_groups', label: 'Users & Groups' },
    { id: 'locations', label: 'Locations' },
    { id: 'groups', label: 'Schedule Groups' },
    { id: 'schedules', label: 'Schedules' },
    { id: 'activities', label: 'Activities' },
  ];

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-xl md:text-2xl font-bold text-slate-900 mb-4 md:mb-6">Admin Dashboard</h1>

      <div className="flex space-x-4 border-b border-slate-200 mb-6 overflow-x-auto whitespace-nowrap pb-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setCurrentGroupId(null);
              setCurrentLocationId(null);
              setFormData({});
              setErrorMsg('');
            }}
            className={`pb-3 px-2 font-medium text-sm transition-colors ${
              activeTab === tab.id 
                ? 'border-b-2 border-indigo-600 text-indigo-600' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h2 className="font-semibold text-slate-900 capitalize">
            {activeTab === 'users_and_groups' ? 'Users & Groups' : activeTab} Management
          </h2>
          <div className="flex space-x-2">
            {activeTab === 'users_and_groups' ? (
              <>
                <button 
                  onClick={() => {
                    setModalType('users');
                    setFormData({ user_group_id: currentGroupId });
                    setErrorMsg('');
                    setIsAddModalOpen(true);
                  }}
                  className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
                >
                  + Add User
                </button>
                <button 
                  onClick={() => {
                    setModalType('user_groups');
                    setFormData({ parent_id: currentGroupId });
                    setErrorMsg('');
                    setIsAddModalOpen(true);
                  }}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  + Add Group
                </button>
              </>
            ) : (
              <button 
                onClick={() => {
                  setModalType(activeTab);
                  setFormData(activeTab === 'locations' ? { parent_id: currentLocationId } : (activeTab === 'groups' ? { color: '#4f46e5' } : {}));
                  setErrorMsg('');
                  setIsAddModalOpen(true);
                }}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                + Add New
              </button>
            )}
          </div>
        </div>
        
        <div className="p-4">
          {renderBreadcrumbs()}
          
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Name / Title</th>
                  <th className="px-6 py-3">Details</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayData?.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-slate-400">This folder is empty.</td>
                  </tr>
                ) : (
                  displayData?.map((item: any) => (
                    <tr key={item.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900">
                        {item.itemType === 'user_groups' || item.itemType === 'locations' ? (
                          <button 
                            onClick={() => {
                              if (item.itemType === 'user_groups') setCurrentGroupId(item.id);
                              if (item.itemType === 'locations') setCurrentLocationId(item.id);
                            }}
                            className="flex items-center hover:text-indigo-600 transition-colors text-left"
                          >
                            {item.itemType === 'user_groups' ? <Users className="w-5 h-5 mr-2 text-indigo-400" /> : <Folder className="w-5 h-5 mr-2 text-indigo-400" />}
                            {item.name}
                          </button>
                        ) : item.itemType === 'users' ? (
                          <div className="flex items-center">
                            <User className="w-5 h-5 mr-2 text-slate-400" />
                            {item.username}
                          </div>
                        ) : (
                          item.username || item.name || item.title
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {item.itemType === 'users' && `Role: ${item.role}`}
                        {item.itemType === 'user_groups' && `Group ID: ${item.id.slice(0, 8)}...`}
                        {item.itemType === 'locations' && `Location ID: ${item.id.slice(0, 8)}...`}
                        {item.itemType === 'groups' && (
                          <span className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></span>
                            {item.color}
                          </span>
                        )}
                        {item.itemType === 'schedules' && `Loc: ${getLocationPath(item.location_id)}`}
                        {item.itemType === 'activities' && `Type: ${item.time_type}`}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => openEditModal(item.itemType, item)}
                          className="text-indigo-600 hover:text-indigo-800 font-medium text-xs px-3 py-1 rounded-md hover:bg-indigo-50 transition-colors mr-2"
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => confirmDelete(item.itemType, item.id)}
                          className="text-red-600 hover:text-red-800 font-medium text-xs px-3 py-1 rounded-md hover:bg-red-50 transition-colors"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        title={`${isEditing ? 'Edit' : 'Add New'} ${modalType.replace('_', ' ').replace(/s$/, '')}`}
      >
        <form onSubmit={handleAddSubmit}>
          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">
              {errorMsg}
            </div>
          )}
          {renderFormFields()}
          <div className="mt-6 flex justify-end space-x-3">
            <button 
              type="button" 
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
            >
              Save
            </button>
          </div>
        </form>
      </Modal>

      <Modal 
        isOpen={isDeleteModalOpen} 
        onClose={() => {
          setIsDeleteModalOpen(false);
          setErrorMsg('');
        }} 
        title="Confirm Deletion"
      >
        <div className="mb-6">
          {errorMsg ? (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">
              {errorMsg}
            </div>
          ) : (
            <p className="text-slate-600">Are you sure you want to delete this item? This action cannot be undone.</p>
          )}
        </div>
        <div className="flex justify-end space-x-3">
          <button 
            type="button" 
            onClick={() => {
              setIsDeleteModalOpen(false);
              setErrorMsg('');
            }}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button 
            type="button"
            onClick={handleDelete}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
          >
            Delete
          </button>
        </div>
      </Modal>
    </div>
  );
}
