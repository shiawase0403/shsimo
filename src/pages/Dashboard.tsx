import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { isTodayUTC8, isOngoingUTC8, formatUTC8, isFutureUTC8 } from '../utils/dateUtils';

export default function Dashboard() {
  const { token, user } = useAuth();
  const [schedules, setSchedules] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [schedRes, actRes, locRes] = await Promise.all([
          fetch('/api/schedules', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/activities', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/locations', { headers: { Authorization: `Bearer ${token}` } })
        ]);

        const schedData = await schedRes.json();
        const actData = await actRes.json();
        const locData = await locRes.json();

        setSchedules(schedData);
        setActivities(actData);
        setLocations(locData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  const getLocationPath = (locId: string, visited = new Set<string>()): string => {
    if (visited.has(locId)) return '[Circular Reference]';
    visited.add(locId);
    
    const loc = locations.find((l: any) => l.id === locId);
    if (!loc) return '';
    if (loc.parent_id) {
      return `${getLocationPath(loc.parent_id, visited)} > ${loc.name}`;
    }
    return loc.name;
  };

  // Filter today's schedules that haven't ended
  const todaysSchedules = schedules.filter(s => {
    return isTodayUTC8(s.start_time) && (isOngoingUTC8(s.start_time, s.end_time) || isFutureUTC8(s.start_time));
  });

  // Filter today's activities that haven't ended
  const todaysActivities = activities.filter(a => {
    if (a.time_type === 'permanent') return true;
    if (!a.start_time || !a.end_time) return false;
    return isTodayUTC8(a.start_time) && (isOngoingUTC8(a.start_time, a.end_time) || isFutureUTC8(a.start_time));
  });

  if (loading) return <div className="p-4 md:p-8">Loading dashboard...</div>;

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Welcome back, {user?.username}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
        {/* Today's Schedules */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Today's Tasks
          </h2>
          
          {todaysSchedules.length === 0 ? (
            <p className="text-slate-500 text-sm">No tasks remaining for today.</p>
          ) : (
            <div className="space-y-4">
              {todaysSchedules.map(s => {
                const isOngoing = isOngoingUTC8(s.start_time, s.end_time);
                return (
                  <div key={s.id} className={`p-4 rounded-xl border ${isOngoing ? 'bg-emerald-50 border-emerald-200 shadow-sm' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <h3 className={`font-medium ${isOngoing ? 'text-emerald-900' : 'text-slate-900'}`}>
                        {s.title} {isOngoing && <span className="text-xs ml-2 bg-emerald-500 text-white px-2 py-0.5 rounded-full">Ongoing</span>}
                      </h3>
                      {s.group_name && (
                        <span 
                          className="text-xs px-2 py-1 rounded-full font-medium"
                          style={{ backgroundColor: `${s.group_color}20`, color: s.group_color }}
                        >
                          {s.group_name}
                        </span>
                      )}
                    </div>
                    <p className={`text-sm mb-1 ${isOngoing ? 'text-emerald-700' : 'text-slate-600'}`}>📍 {getLocationPath(s.location_id) || s.location_name}</p>
                    <p className={`text-xs ${isOngoing ? 'text-emerald-600' : 'text-slate-500'}`}>
                      {formatUTC8(s.start_time, 'time')} - {formatUTC8(s.end_time, 'time')}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Today's Activities */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
            Today's Events & Venues
          </h2>
          
          {todaysActivities.length === 0 ? (
            <p className="text-slate-500 text-sm">No activities remaining for today.</p>
          ) : (
            <div className="space-y-4">
              {todaysActivities.map(a => {
                const isOngoing = a.time_type === 'permanent' || isOngoingUTC8(a.start_time, a.end_time);
                return (
                  <div key={a.id} className={`p-4 rounded-xl border ${isOngoing ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <h3 className={`font-medium ${isOngoing ? 'text-indigo-900' : 'text-slate-900'}`}>
                        {a.title} {isOngoing && <span className="text-xs ml-2 bg-indigo-500 text-white px-2 py-0.5 rounded-full">Active</span>}
                      </h3>
                    </div>
                    <p className={`text-sm mb-1 ${isOngoing ? 'text-indigo-700' : 'text-slate-600'}`}>📍 {getLocationPath(a.location_id) || a.location_name}</p>
                    {a.time_type !== 'permanent' && (
                      <p className={`text-xs ${isOngoing ? 'text-indigo-600' : 'text-slate-500'}`}>
                        {formatUTC8(a.start_time, 'time')} - {formatUTC8(a.end_time, 'time')}
                      </p>
                    )}
                    {a.time_type === 'permanent' && (
                      <p className={`text-xs ${isOngoing ? 'text-indigo-600' : 'text-slate-500'}`}>Permanent Venue</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
