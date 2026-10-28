import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  ShoppingBag, 
  Tag, 
  LogOut, 
  Sparkles, 
  Bell, 
  ShieldCheck
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { currentUser, activeRole, logout } = useAuth();

  if (!currentUser) return null;

  const isBuyer = activeRole === 'buyer';

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50 backdrop-blur-md bg-slate-900/90">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Platform Tag */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black text-white tracking-tight">
                  Bid<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Nest</span>
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300">
                  Campus Live
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">Where Campus Competes Fairly</p>
            </div>
          </div>

          {/* Account role is fixed at registration. */}
          <div className="hidden md:flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold text-slate-300">
            {isBuyer ? <ShoppingBag className="w-3.5 h-3.5" /> : <Tag className="w-3.5 h-3.5" />}
            {isBuyer ? 'Buyer Account' : 'Seller Account'}
          </div>

          {/* Right Action Icons & User Profile */}
          <div className="flex items-center gap-3">
            
            <span className="md:hidden text-xs text-slate-300">{isBuyer ? 'Buyer' : 'Seller'}</span>

            {/* Notification Bell */}
            <button 
              className="relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-500 ring-2 ring-slate-900"></span>
            </button>

            {/* User Profile Pill */}
            <div className="flex items-center gap-3 pl-2 border-l border-slate-800">
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-9 h-9 rounded-full object-cover ring-2 ring-indigo-500/40"
              />
              <div className="hidden sm:block text-left">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-white leading-tight">
                    {currentUser.name}
                  </span>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="text-[11px] text-slate-400">
                  {currentUser.hostel} • #{currentUser.roomNumber}
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={logout}
                className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                title="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

          </div>

        </div>
      </div>
    </header>
  );
};
