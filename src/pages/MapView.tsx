import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { format, parseISO } from 'date-fns';
import Map, { Marker, NavigationControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapPin } from 'lucide-react';

export default function MapView() {
  const { token } = useAuth();
  const { t } = useLanguage();
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
    <div className="flex flex-col md:flex-row flex-1 w-full bg-slate-100 relative overflow-hidden">
      {/* Map Area */}
      <div className="flex-1 relative h-full w-full">
        <Map
          initialViewState={{
            longitude: 121.432,
            latitude: 31.141,
            zoom: 15,
            pitch: 45,
            bearing: -17.6
          }}
          style={{ width: '100%', height: '100%' }}
          mapStyle="/style.json"
          transformRequest={(url) => {
            if (url.startsWith('/')) {
              return { url: `${window.location.origin}${url}` };
            }
            return { url };
          }}
          minZoom={15}
          maxZoom={22}
          maxBounds={[
            [121.420, 31.130], // Southwest coordinates
            [121.445, 31.150]  // Northeast coordinates
          ]}
        >
          <NavigationControl position="top-right" />
          
          {rootLocations.map(root => (
            root.longitude && root.latitude ? (
              <Marker 
                key={root.id} 
                longitude={root.longitude} 
                latitude={root.latitude}
                anchor="bottom"
                onClick={e => {
                  e.originalEvent.stopPropagation();
                  handleLocationClick(root);
                }}
              >
                <div className="flex flex-col items-center cursor-pointer transform hover:scale-110 transition-transform">
                  <div className="bg-white px-2 py-1 rounded-md shadow-md text-xs font-bold text-slate-800 mb-1 whitespace-nowrap">
                    {root.name}
                  </div>
                  <MapPin className="text-indigo-600 w-8 h-8 drop-shadow-md" fill="white" />
                </div>
              </Marker>
            ) : null
          ))}
        </Map>
        
        {/* Fallback for locations without coordinates */}
        <div className="absolute bottom-4 left-4 right-4 md:right-auto md:w-80 bg-white/90 backdrop-blur-sm p-4 rounded-xl shadow-lg max-h-48 overflow-y-auto">
          <h3 className="text-sm font-bold text-slate-700 mb-2">{t('unmappedLocations')}</h3>
          <div className="flex flex-wrap gap-2">
            {rootLocations.filter(l => !l.longitude || !l.latitude).map(root => (
              <button 
                key={root.id}
                onClick={() => handleLocationClick(root)}
                className="text-xs bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 px-3 py-1.5 rounded-full border border-slate-200 transition-colors"
              >
                {root.name}
              </button>
            ))}
            {rootLocations.filter(l => !l.longitude || !l.latitude).length === 0 && (
              <span className="text-xs text-slate-500 italic">{t('allLocationsMapped')}</span>
            )}
          </div>
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
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">{t('subLocations')}</h3>
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
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">{t('schedulesHere')}</h3>
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
                  <p className="text-sm text-slate-400 italic">{t('noSchedulesHere')}</p>
                )}
              </div>
            </section>

            {/* Activities */}
            <section>
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">{t('activitiesHere')}</h3>
              <div className="space-y-3">
                {activities.filter(a => a.location_id === selectedLocation.id).map(a => (
                  <div key={a.id} className="p-4 rounded-xl border border-slate-200 bg-indigo-50 shadow-sm">
                    <div className="font-medium text-indigo-900">{a.title}</div>
                    <div className="text-sm text-indigo-700 mt-1 capitalize">{a.time_type.replace('_', ' ')}</div>
                  </div>
                ))}
                {activities.filter(a => a.location_id === selectedLocation.id).length === 0 && (
                  <p className="text-sm text-slate-400 italic">{t('noActivitiesHere')}</p>
                )}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
