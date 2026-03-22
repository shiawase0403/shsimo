import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import Modal from '../../components/Modal';
import { toUTC8InputString, fromUTC8InputString } from '../../utils/dateUtils';
import { Folder, User, MapPin, ChevronRight, Home, Users, Search } from 'lucide-react';
import Map, { Marker } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

export default function AdminDashboard() {
  const { token, user } = useAuth();
  const { t } = useLanguage();
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
  const [userSearchTerm, setUserSearchTerm] = useState('');

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
    setUserSearchTerm('');
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
        setErrorMsg(err.error || t('failedToDelete'));
        return;
      }
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
      fetchData();
    } catch (err) {
      console.error(err);
      setErrorMsg(t('errorDeleting'));
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
        setErrorMsg(err.error || (isEditing ? t('failedToUpdate') : t('failedToAdd')));
        return;
      }
      setIsAddModalOpen(false);
      setFormData({});
      setIsEditing(false);
      fetchData();
    } catch (err) {
      console.error(err);
      setErrorMsg(isEditing ? t('errorUpdating') : t('errorAdding'));
    }
  };

  // Helper to get full location path
  const getLocationPath = (locId: string, visited = new Set<string>()): string => {
    if (visited.has(locId)) return t('circularReference');
    visited.add(locId);
    
    const loc = data.locations.find((l: any) => l.id === locId);
    if (!loc) return '';
    if (loc.parent_id) {
      return `${getLocationPath(loc.parent_id, visited)} > ${loc.name}`;
    }
    return loc.name;
  };

  const getUserGroupPath = (groupId: string, visited = new Set<string>()): string => {
    if (visited.has(groupId)) return t('circularReference');
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
            <Home className="w-4 h-4 mr-1" /> {t('root')}
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
            <Home className="w-4 h-4 mr-1" /> {t('root')}
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
    const idField = isEditing ? (
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-1">{t('id')}</label>
        <input type="text" readOnly className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-100 text-slate-500 cursor-not-allowed" value={formData.id || ''} />
      </div>
    ) : null;

    switch (modalType) {
      case 'users':
        return (
          <>
            {idField}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('username')}</label>
              <input type="text" required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" value={formData.username || ''} onChange={e => setFormData({...formData, username: e.target.value})} />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('nicknameOptional')}</label>
              <input type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" value={formData.nickname || ''} onChange={e => setFormData({...formData, nickname: e.target.value})} />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('password')} {isEditing && t('leaveBlankToKeep')}</label>
              <input type="password" required={!isEditing} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" value={formData.password || ''} onChange={e => setFormData({...formData, password: e.target.value})} />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('userGroupOptional')}</label>
              <select className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" value={formData.user_group_id || ''} onChange={e => setFormData({...formData, user_group_id: e.target.value})}>
                <option value="">{t('none')}</option>
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
            {idField}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('name')}</label>
              <input type="text" required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('parentGroup')}</label>
              <select className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" value={formData.parent_id || ''} onChange={e => setFormData({...formData, parent_id: e.target.value})}>
                <option value="">{t('none')}</option>
                {data.user_groups.map((g: any) => (
                  <option key={g.id} value={g.id} disabled={g.id === formData.id}>{getUserGroupPath(g.id)}</option>
                ))}
              </select>
            </div>
            {isEditing && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('subGroups')}</label>
                <div className="text-sm text-slate-600 bg-slate-50 p-2 rounded border border-slate-200">
                  {data.user_groups.filter((g: any) => g.parent_id === formData.id).length > 0 ? (
                    <ul className="list-disc pl-5">
                      {data.user_groups.filter((g: any) => g.parent_id === formData.id).map((g: any) => (
                        <li key={g.id}>{g.name}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-slate-400 italic">{t('noSubGroups')}</span>
                  )}
                </div>
              </div>
            )}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('usersInGroup')}</label>
              <div className="mb-2 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder={t('searchUsers')} 
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={userSearchTerm}
                  onChange={e => setUserSearchTerm(e.target.value)}
                />
              </div>
              <div className="max-h-48 overflow-y-auto border border-slate-300 rounded-lg p-2 bg-white">
                {data.users.filter((u: any) => u.username.toLowerCase().includes(userSearchTerm.toLowerCase())).map((user: any) => (
                  <label key={user.id} className="flex items-center space-x-2 p-2 hover:bg-slate-50 rounded cursor-pointer">
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
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                    />
                    <span className="text-sm text-slate-700">{user.username}</span>
                  </label>
                ))}
                {data.users.filter((u: any) => u.username.toLowerCase().includes(userSearchTerm.toLowerCase())).length === 0 && (
                  <div className="p-2 text-sm text-slate-500 text-center">{t('noUsersFound')}</div>
                )}
              </div>
              <div className="mt-2 text-xs text-slate-500">
                {(formData.userIds || []).length} {t('usersSelected')}
              </div>
            </div>
          </>
        );
      case 'locations':
        return (
          <>
            {idField}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('name')}</label>
              <input type="text" required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('parentLocation')}</label>
              <select className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" value={formData.parent_id || ''} onChange={e => setFormData({...formData, parent_id: e.target.value})}>
                <option value="">{t('none')}</option>
                {data.locations.map((loc: any) => (
                  <option key={loc.id} value={loc.id} disabled={loc.id === formData.id}>{getLocationPath(loc.id)}</option>
                ))}
              </select>
            </div>
            {!formData.parent_id && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('locationCoordinates')}</label>
                <div className="h-64 rounded-lg overflow-hidden border border-slate-300 relative">
                  <Map
                    initialViewState={{
                      longitude: formData.longitude || 121.432,
                      latitude: formData.latitude || 31.141,
                      zoom: 15
                    }}
                    mapStyle="/style.json"
                    transformRequest={(url) => {
                      if (url.startsWith('/')) {
                        return { url: `${window.location.origin}${url}` };
                      }
                      return { url };
                    }}
                    onClick={(e) => {
                      setFormData({
                        ...formData,
                        longitude: e.lngLat.lng,
                        latitude: e.lngLat.lat
                      });
                    }}
                    minZoom={15}
                    maxZoom={22}
                    maxBounds={[
                      [121.420, 31.130], // Southwest coordinates
                      [121.445, 31.150]  // Northeast coordinates
                    ]}
                  >
                    {formData.longitude && formData.latitude && (
                      <Marker longitude={formData.longitude} latitude={formData.latitude} color="red" />
                    )}
                  </Map>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  {t('clickMapToSetLocation')}
                  {formData.longitude && formData.latitude && ` (${formData.longitude.toFixed(6)}, ${formData.latitude.toFixed(6)})`}
                </div>
              </div>
            )}
          </>
        );
      case 'groups':
        return (
          <>
            {idField}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('name')}</label>
              <input type="text" required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('color')}</label>
              <input type="color" required className="w-full h-10 px-1 py-1 border border-slate-300 rounded-lg cursor-pointer" value={formData.color || '#4f46e5'} onChange={e => setFormData({...formData, color: e.target.value})} />
            </div>
          </>
        );
      case 'schedules':
        return (
          <>
            {idField}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('title')}</label>
              <input type="text" required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" value={formData.title || ''} onChange={e => setFormData({...formData, title: e.target.value})} />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('location')}</label>
              <select required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" value={formData.location_id || ''} onChange={e => setFormData({...formData, location_id: e.target.value})}>
                <option value="">{t('selectLocation')}</option>
                {data.locations.map((loc: any) => (
                  <option key={loc.id} value={loc.id}>{getLocationPath(loc.id)}</option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('groupOptional')}</label>
              <select className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" value={formData.group_id || ''} onChange={e => setFormData({...formData, group_id: e.target.value})}>
                <option value="">{t('none')}</option>
                {data.groups.map((g: any) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('startTime')}</label>
                <input type="datetime-local" required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" value={formData.start_time || ''} onChange={e => setFormData({...formData, start_time: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('endTime')}</label>
                <input type="datetime-local" required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" value={formData.end_time || ''} onChange={e => setFormData({...formData, end_time: e.target.value})} />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('contactInfo')}</label>
              <input type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" value={formData.contact_info || ''} onChange={e => setFormData({...formData, contact_info: e.target.value})} />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('notes')}</label>
              <textarea className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" rows={3} value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})}></textarea>
            </div>
          </>
        );
      case 'activities':
        return (
          <>
            {idField}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('title')}</label>
              <input type="text" required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" value={formData.title || ''} onChange={e => setFormData({...formData, title: e.target.value})} />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('location')}</label>
              <select required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" value={formData.location_id || ''} onChange={e => setFormData({...formData, location_id: e.target.value})}>
                <option value="">{t('selectLocation')}</option>
                {data.locations.map((loc: any) => (
                  <option key={loc.id} value={loc.id}>{getLocationPath(loc.id)}</option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('timeType')}</label>
              <select required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" value={formData.time_type || ''} onChange={e => setFormData({...formData, time_type: e.target.value})}>
                <option value="">{t('selectType')}</option>
                <option value="permanent">{t('permanent')}</option>
                <option value="date_range">{t('dateRange')}</option>
                <option value="exact_time">{t('exactTime')}</option>
              </select>
            </div>
            {formData.time_type !== 'permanent' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('startTime')}</label>
                  <input type="datetime-local" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" value={formData.start_time || ''} onChange={e => setFormData({...formData, start_time: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('endTime')}</label>
                  <input type="datetime-local" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" value={formData.end_time || ''} onChange={e => setFormData({...formData, end_time: e.target.value})} />
                </div>
              </div>
            )}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('contactInfo')}</label>
              <input type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" value={formData.contact_info || ''} onChange={e => setFormData({...formData, contact_info: e.target.value})} />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('notes')}</label>
              <textarea className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" rows={3} value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})}></textarea>
            </div>
          </>
        );
      default:
        return null;
    }
  };

  const tabs = [
    { id: 'users_and_groups', label: t('usersAndGroups') },
    { id: 'locations', label: t('locations') },
    { id: 'groups', label: t('scheduleGroups') },
    { id: 'schedules', label: t('schedules') },
    { id: 'activities', label: t('activities') },
  ];

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-xl md:text-2xl font-bold text-slate-900 mb-4 md:mb-6">{t('adminDashboard')}</h1>

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
            {activeTab === 'users_and_groups' ? t('usersAndGroups') : t(activeTab)} {t('management')}
          </h2>
          <div className="flex space-x-2">
            {activeTab === 'users_and_groups' ? (
              <>
                <button 
                  onClick={() => {
                    setModalType('users');
                    setFormData({ user_group_id: currentGroupId });
                    setErrorMsg('');
                    setUserSearchTerm('');
                    setIsAddModalOpen(true);
                  }}
                  className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
                >
                  + {t('addUser')}
                </button>
                <button 
                  onClick={() => {
                    setModalType('user_groups');
                    setFormData({ parent_id: currentGroupId });
                    setErrorMsg('');
                    setUserSearchTerm('');
                    setIsAddModalOpen(true);
                  }}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  + {t('addGroup')}
                </button>
              </>
            ) : (
              <button 
                onClick={() => {
                  setModalType(activeTab);
                  setFormData(activeTab === 'locations' ? { parent_id: currentLocationId } : (activeTab === 'groups' ? { color: '#4f46e5' } : {}));
                  setErrorMsg('');
                  setUserSearchTerm('');
                  setIsAddModalOpen(true);
                }}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                + {t('addNew')}
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
                  <th className="px-6 py-3">{t('nameTitle')}</th>
                  <th className="px-6 py-3">{t('details')}</th>
                  <th className="px-6 py-3 text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {displayData?.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-slate-400">{t('emptyFolder')}</td>
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
                            {item.nickname ? `${item.nickname} (${item.username})` : item.username}
                          </div>
                        ) : (
                          item.username || item.name || item.title
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {item.itemType === 'users' && `${t('role')}: ${item.role}`}
                        {item.itemType === 'user_groups' && `${data.users.filter((u: any) => u.user_group_id === item.id).length} ${t('usersCount')}`}
                        {item.itemType === 'locations' && `${data.locations.filter((l: any) => l.parent_id === item.id).length} ${t('subLocationsCount')}`}
                        {item.itemType === 'groups' && (
                          <span className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></span>
                            {item.color}
                          </span>
                        )}
                        {item.itemType === 'schedules' && `${t('loc')}: ${getLocationPath(item.location_id)}`}
                        {item.itemType === 'activities' && `${t('type')}: ${item.time_type}`}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => openEditModal(item.itemType, item)}
                          className="text-indigo-600 hover:text-indigo-800 font-medium text-xs px-3 py-1 rounded-md hover:bg-indigo-50 transition-colors mr-2"
                        >
                          {t('edit')}
                        </button>
                        <button 
                          onClick={() => confirmDelete(item.itemType, item.id)}
                          className="text-red-600 hover:text-red-800 font-medium text-xs px-3 py-1 rounded-md hover:bg-red-50 transition-colors"
                        >
                          {t('delete')}
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
        title={`${isEditing ? t('edit') : t('add')} ${t(modalType === 'user_groups' ? 'userGroups' : modalType)}`}
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
              {t('cancel')}
            </button>
            <button 
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
            >
              {t('save')}
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
        title={t('confirmDeletion')}
      >
        <div className="mb-6">
          {errorMsg ? (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">
              {errorMsg}
            </div>
          ) : (
            <p className="text-slate-600">{t('areYouSureDelete')}</p>
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
            {t('cancel')}
          </button>
          <button 
            type="button"
            onClick={handleDelete}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
          >
            {t('delete')}
          </button>
        </div>
      </Modal>
    </div>
  );
}
