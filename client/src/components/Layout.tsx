import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Layers,
  Settings,
  MessageSquare,
  Send,
  Radio,
  PlayCircle,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  LogOut,
  User,
} from 'lucide-react';
import { api } from '../api/client';
import { IntegrationStatus } from '../types';
import { useAuth } from '../context/AuthContext';

export const Layout: React.FC = () => {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const { admin, logout } = useAuth();
  const location = useLocation();

  useEffect(() => {
    api.getIntegrationStatus()
      .then((res) => setStatus(res.data))
      .catch((err) => console.error('Failed to load status', err));
  }, [location.pathname]);

  const navItems = [
    { to: '/', label: 'Overview', icon: LayoutDashboard },
    { to: '/resources', label: 'Resource Library', icon: Layers },
    { to: '/settings', label: 'Automation Settings', icon: Settings },
    { to: '/events', label: 'Event Logs', icon: MessageSquare },
    { to: '/replies', label: 'Reply Logs', icon: Send },
    { to: '/integration', label: 'Integration & Simulator', icon: Radio },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-green-500 flex items-center justify-center text-white shadow-md shadow-green-500/20">
                <PlayCircle className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div>
                <span className="text-lg font-bold tracking-tight text-slate-900 block leading-tight">
                  Reel to Resource Matcher
                </span>
                <span className="text-xs text-slate-500 font-medium">Self-Hosted Instagram DM Automation</span>
              </div>
            </div>

            <div className="flex items-center space-x-3 sm:space-x-4">
              {/* Automation Engine Status Badge */}
              {status && (
                <div className="hidden sm:flex items-center space-x-2">
                  {status.simulationMode ? (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                      <span className="w-2 h-2 mr-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                      Simulation Mode
                    </span>
                  ) : status.readinessStatus === 'ready' ? (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <span className="w-2 h-2 mr-1.5 rounded-full bg-emerald-500"></span>
                      Meta Live
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                      <AlertTriangle className="w-3.5 h-3.5 mr-1 text-slate-500" />
                      Local Setup
                    </span>
                  )}
                </div>
              )}

              {/* Administrator Profile & Logout Button */}
              {admin && (
                <div className="flex items-center space-x-2 border-l border-slate-200 pl-3">
                  <div className="flex items-center text-xs font-medium text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                    <User className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                    <span>{admin.username}</span>
                  </div>
                  <button
                    onClick={logout}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-2 sm:space-x-6 overflow-x-auto scrollbar-none py-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `flex items-center px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      isActive
                        ? 'border-emerald-600 text-emerald-700 font-semibold'
                        : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Page Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500 gap-2">
          <span>Reel to Resource Matcher &copy; 2026 &bull; Production-grade self-hosted Instagram DM automation</span>
          <div className="flex items-center space-x-4">
            <span className="flex items-center text-slate-600">
              <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Authenticated &bull; Exact Matching
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};
