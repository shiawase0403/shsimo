import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { format, parseISO } from 'date-fns';

export default function MapView() {
  const { token } = useAuth();
  const [locations, setLocations] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<any | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/locations', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/schedules', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/activities', { headers: { Authorization: `Bearer ${token}` } })
    ])
    .then(async ([locRes, schedRes, actRes]) => {
      setLocations(await locRes.json());
      setSchedules(await schedRes.json());
      setActivities(await actRes.json());
    })
    .catch(console.error);
  }, [token]);

  // Build hierarchy
  const rootLocations = locations.filter(l => !l.parent_id);
  const getChildren = (parentId: string) => locations.filter(l => l.parent_id === parentId);

  const handleLocationClick = (loc: any) => {
    setSelectedLocation(loc);
  };

  return (
    <div className="flex flex-col md:flex-row h-full bg-slate-100 relative">
      {/* Map Area */}
      <div className="flex-1 p-4 md:p-8 overflow-auto">
        <h1 className="text-xl md:text-2xl font-bold text-slate-900 mb-4 md:mb-6">Campus Map (Simulated)</h1>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {rootLocations.map(root => (
            <div key={root.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-6 flex flex-col items-center justify-center min-h-[150px] md:min-h-[200px] cursor-pointer hover:border-indigo-500 hover:shadow-md transition-all" onClick={() => handleLocationClick(root)}>
              <div className="text-3xl md:text-4xl mb-2 md:mb-4">🏫</div>
              <h3 className="text-base md:text-lg font-bold text-slate-900 text-center">{root.name}</h3>
              
              {/* Show sub-locations count */}
              {getChildren(root.id).length > 0 && (
                <span className="mt-2 text-[10px] md:text-xs font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                  {getChildren(root.id).length} sub-areas
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Side Panel */}
      {selectedLocation && (
        <div className="fixed inset-0 z-30 md:relative md:inset-auto md:z-auto w-full md:w-96 bg-white border-l border-slate-200 shadow-xl flex flex-col">
          <div className="p-4 md:p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
            <h2 className="text-lg md:text-xl font-bold text-slate-900">{selectedLocation.name}</h2>
            <button onClick={() => setSelectedLocation(null)} className="text-slate-400 hover:text-slate-600 p-2 text-2xl leading-none">
              &times;
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 md:space-y-8">
            {/* Sub-locations */}
            {getChildren(selectedLocation.id).length > 0 && (
              <section>
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Sub-Locations</h3>
                <div className="space-y-2">
                  {getChildren(selectedLocation.id).map(child => (
                    <button 
                      key={child.id}
                      onClick={() => handleLocationClick(child)}
                      className="w-full text-left px-4 py-3 rounded-xl bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 transition-colors border border-slate-100"
                    >
                      {child.name}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Schedules */}
            <section>
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Schedules Here</h3>
              <div className="space-y-3">
                {schedules.filter(s => s.location_id === selectedLocation.id).map(s => (
                  <div key={s.id} className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="font-medium text-slate-900">{s.title}</div>
                    <div className="text-sm text-slate-500 mt-1">
                      {format(parseISO(s.start_time), 'MMM d, HH:mm')} - {format(parseISO(s.end_time), 'HH:mm')}
                    </div>
                  </div>
                ))}
                {schedules.filter(s => s.location_id === selectedLocation.id).length === 0 && (
                  <p className="text-sm text-slate-400 italic">No schedules here.</p>
                )}
              </div>
            </section>

            {/* Activities */}
            <section>
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Activities Here</h3>
              <div className="space-y-3">
                {activities.filter(a => a.location_id === selectedLocation.id).map(a => (
                  <div key={a.id} className="p-4 rounded-xl border border-slate-200 bg-indigo-50 shadow-sm">
                    <div className="font-medium text-indigo-900">{a.title}</div>
                    <div className="text-sm text-indigo-700 mt-1 capitalize">{a.time_type.replace('_', ' ')}</div>
                  </div>
                ))}
                {activities.filter(a => a.location_id === selectedLocation.id).length === 0 && (
                  <p className="text-sm text-slate-400 italic">No activities here.</p>
                )}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
