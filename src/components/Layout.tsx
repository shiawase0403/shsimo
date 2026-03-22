import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useChatContext } from '../context/ChatContext';
import { Home, Calendar, Map as MapIcon, Settings, LogOut, Shield, MessageSquare, Globe, User } from 'lucide-react';

export default function Layout({ isAdmin = false }: { isAdmin?: boolean }) {
  const { user, logout } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { totalUnread } = useChatContext();
  const location = useLocation();

  const toggleLanguage = () => {
    setLanguage(language === 'zh' ? 'en' : 'zh');
  };

  const navItems = isAdmin ? [
    { name: t('dashboard'), path: '/admin', icon: Shield },
    { name: t('chat'), path: '/admin/chat', icon: MessageSquare },
    { name: t('settings'), path: '/settings', icon: User },
    { name: t('backToApp'), path: '/', icon: Home },
  ] : [
    { name: t('dashboard'), path: '/', icon: Home },
    { name: t('calendar'), path: '/calendar', icon: Calendar },
    { name: t('map'), path: '/map', icon: MapIcon },
    { name: t('chat'), path: '/chat', icon: MessageSquare },
    { name: t('settings'), path: '/settings', icon: User },
    ...(user?.role === 'ADMIN' ? [{ name: t('admin'), path: '/admin', icon: Shield }] : []),
  ];

  return (
    <div className="h-screen bg-slate-50 flex flex-col md:flex-row overflow-hidden">
      {/* Mobile Top Bar */}
      <header className="md:hidden flex-shrink-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <div>
          <h1 className="text-lg font-bold text-indigo-900">SHS IMO 2026</h1>
          <p className="text-xs text-slate-500">{t('volunteerSystem')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleLanguage}
            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1"
            title="Toggle Language"
          >
            <Globe size={18} />
            <span className="text-xs font-medium">{language === 'zh' ? 'EN' : '中'}</span>
          </button>
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
      <aside className="hidden md:flex flex-shrink-0 w-64 bg-white border-r border-slate-200 flex-col sticky top-0 h-screen">
        <div className="p-6 border-b border-slate-200">
          <h1 className="text-xl font-bold text-indigo-900">SHS IMO 2026</h1>
          <p className="text-sm text-slate-500 mt-1">{t('volunteerSystem')}</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            const isChat = item.path === '/chat' || item.path === '/admin/chat';
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
                <div className="relative">
                  <Icon size={20} />
                  {isChat && totalUnread > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                      {totalUnread > 9 ? '9+' : totalUnread}
                    </span>
                  )}
                </div>
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center justify-between mb-3 px-2">
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 transition-colors"
            >
              <Globe size={16} />
              <span>{language === 'zh' ? 'English' : '简体中文'}</span>
            </button>
          </div>
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
      <main className="flex-1 flex flex-col overflow-auto relative pb-20 md:pb-0">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 w-full bg-white border-t border-slate-200 flex justify-around items-center px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] z-20">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          const isChat = item.path === '/chat' || item.path === '/admin/chat';
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center p-2 min-w-[4rem] transition-colors relative ${
                isActive 
                  ? 'text-indigo-600' 
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <div className="relative">
                <Icon size={20} className={isActive ? 'mb-1' : 'mb-1 opacity-80'} />
                {isChat && totalUnread > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center z-10">
                    {totalUnread > 9 ? '9+' : totalUnread}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium truncate w-full text-center">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
