import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameDay, isSameMonth, addMonths, subMonths } from 'date-fns';
import { formatUTC8, isSameDayUTC8 } from '../utils/dateUtils';

export default function CalendarView() {
  const { token } = useAuth();
  const { t } = useLanguage();
  const [schedules, setSchedules] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [locations, setLocations] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      fetch('/api/schedules', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/locations', { headers: { Authorization: `Bearer ${token}` } })
    ])
      .then(async ([schedRes, locRes]) => {
        setSchedules(await schedRes.json());
        setLocations(await locRes.json());
      })
      .catch(console.error);
  }, [token]);

  const getLocationPath = (locId: string, visited = new Set<string>()): string => {
    if (visited.has(locId)) return t('circularReference');
    visited.add(locId);
    
    const loc = locations.find((l: any) => l.id === locId);
    if (!loc) return '';
    if (loc.parent_id) {
      return `${getLocationPath(loc.parent_id, visited)} > ${loc.name}`;
    }
    return loc.name;
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const dateFormat = "d";
  const rows = [];
  let days = [];
  let day = startDate;
  let formattedDate = "";

  while (day <= endDate) {
    for (let i = 0; i < 7; i++) {
      formattedDate = format(day, dateFormat);
      const cloneDay = day;
      
      // Check if day has schedules
      const hasSchedules = schedules.some(s => isSameDayUTC8(s.start_time, cloneDay));

      days.push(
        <div
          className={`p-1 md:p-2 border-r border-b border-slate-200 min-h-[60px] md:min-h-[80px] cursor-pointer transition-colors ${
            !isSameMonth(day, monthStart)
              ? "text-slate-400 bg-slate-50"
              : isSameDay(day, selectedDate)
              ? "bg-indigo-50 border-indigo-500 relative z-10"
              : "bg-white hover:bg-slate-50"
          }`}
          key={day.toISOString()}
          onClick={() => setSelectedDate(cloneDay)}
        >
          <div className="flex flex-col md:flex-row justify-between items-center md:items-start">
            <span className={`font-medium text-sm md:text-base ${isSameDay(day, new Date()) ? 'bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center' : ''}`}>
              {formattedDate}
            </span>
            {hasSchedules && (
              <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-emerald-500 mt-1 md:mt-2"></span>
            )}
          </div>
        </div>
      );
      day = addDays(day, 1);
    }
    rows.push(
      <div className="grid grid-cols-7" key={day.toISOString()}>
        {days}
      </div>
    );
    days = [];
  }

  const selectedDaySchedules = schedules.filter(s => isSameDayUTC8(s.start_time, selectedDate));

  return (
    <div className="p-4 md:p-8 h-full flex flex-col md:flex-row gap-4 md:gap-8">
      {/* Calendar Grid */}
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-6 flex flex-col">
        <div className="flex justify-between items-center mb-4 md:mb-6">
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">{t('calendar')}</h1>
          <div className="flex items-center gap-2 md:gap-4">
            <button 
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              className="p-1 md:p-2 rounded-lg hover:bg-slate-100"
            >
              &larr;
            </button>
            <span className="font-medium text-base md:text-lg w-32 md:w-40 text-center">{format(currentDate, 'MMM yyyy')}</span>
            <button 
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              className="p-1 md:p-2 rounded-lg hover:bg-slate-100"
            >
              &rarr;
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 mb-2">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
            <div key={d} className="text-center font-medium text-slate-500 text-xs md:text-sm py-1 md:py-2">
              <span className="md:hidden">{t(d.toLowerCase() as any).charAt(0)}</span>
              <span className="hidden md:inline">{t(d.toLowerCase() as any)}</span>
            </div>
          ))}
        </div>
        <div className="border-l border-t border-slate-200 rounded-lg overflow-hidden flex-1 flex flex-col">
          {rows}
        </div>
      </div>

      {/* Selected Day Details */}
      <div className="w-full md:w-96 bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-6 flex flex-col h-[400px] md:h-[calc(100vh-8rem)]">
        <h2 className="text-lg md:text-xl font-bold text-slate-900 mb-4 md:mb-6 pb-4 border-b border-slate-100">
          {format(selectedDate, 'EEEE, MMMM d')}
        </h2>
        
        <div className="flex-1 overflow-y-auto pr-2 space-y-4">
          {selectedDaySchedules.length === 0 ? (
            <p className="text-slate-500 text-center py-8">{t('noTasksScheduled')}</p>
          ) : (
            selectedDaySchedules.map(s => (
              <div 
                key={s.id} 
                className="p-4 rounded-xl border"
                style={{ 
                  backgroundColor: s.group_color ? `${s.group_color}10` : '#f8fafc',
                  borderColor: s.group_color ? `${s.group_color}30` : '#e2e8f0',
                  borderLeftWidth: '4px',
                  borderLeftColor: s.group_color || '#94a3b8'
                }}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-medium text-slate-900">{s.title}</h3>
                  {s.group_name && (
                    <span 
                      className="text-xs px-2 py-1 rounded-full font-medium"
                      style={{ backgroundColor: `${s.group_color}20`, color: s.group_color }}
                    >
                      {s.group_name}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-600 mb-2">📍 {getLocationPath(s.location_id) || s.location_name}</p>
                <div className="flex items-center text-xs text-slate-500 bg-white/50 inline-block px-2 py-1 rounded">
                  🕒 {formatUTC8(s.start_time, 'time')} - {formatUTC8(s.end_time, 'time')}
                </div>
                {s.notes && (
                  <p className="text-sm text-slate-600 mt-3 pt-3 border-t border-slate-200/50">
                    {s.notes}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
