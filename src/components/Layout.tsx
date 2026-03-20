import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Home, Calendar, Map as MapIcon, Settings, LogOut, Shield, MessageSquare } from 'lucide-react';

export default function Layout({ isAdmin = false }: { isAdmin?: boolean }) {
  const { user, logout } = useAuth();
  const location = useLocation();

  const navItems = isAdmin ? [
    { name: 'Dashboard', path: '/admin', icon: Shield },
    { name: 'Chat', path: '/admin/chat', icon: MessageSquare },
    { name: 'Settings', path: '/settings', icon: Settings },
    { name: 'Back to App', path: '/', icon: Home },
  ] : [
    { name: 'Dashboard', path: '/', icon: Home },
    { name: 'Calendar', path: '/calendar', icon: Calendar },
    { name: 'Map', path: '/map', icon: MapIcon },
    { name: 'Chat', path: '/chat', icon: MessageSquare },
    { name: 'Settings', path: '/settings', icon: Settings },
    ...(user?.role === 'ADMIN' ? [{ name: 'Admin', path: '/admin', icon: Shield }] : []),
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Mobile Top Bar */}
      <header className="md:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <div>
          <h1 className="text-lg font-bold text-indigo-900">SHS IMO 2026</h1>
          <p className="text-xs text-slate-500">Volunteer System</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-slate-900">{user?.username}</p>
            <p className="text-xs text-slate-500">{user?.role}</p>
          </div>
          <button 
            onClick={logout}
            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 flex-col sticky top-0 h-screen">
        <div className="p-6 border-b border-slate-200">
          <h1 className="text-xl font-bold text-indigo-900">SHS IMO 2026</h1>
          <p className="text-sm text-slate-500 mt-1">Volunteer System</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                  isActive 
                    ? 'bg-indigo-50 text-indigo-700 font-medium' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon size={20} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-xl">
            <div className="truncate">
              <p className="text-sm font-medium text-slate-900 truncate">{user?.username}</p>
              <p className="text-xs text-slate-500">{user?.role}</p>
            </div>
            <button 
              onClick={logout}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 w-full bg-white border-t border-slate-200 flex justify-around items-center px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] z-20">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center p-2 min-w-[4rem] transition-colors ${
                isActive 
                  ? 'text-indigo-600' 
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Icon size={20} className={isActive ? 'mb-1' : 'mb-1 opacity-80'} />
              <span className="text-[10px] font-medium truncate w-full text-center">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
