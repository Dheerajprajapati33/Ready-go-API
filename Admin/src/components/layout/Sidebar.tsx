import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  UserCheck,
  Car,
  AlertTriangle,
  Tag,
  CreditCard,
  ShieldCheck,
} from 'lucide-react';

const navItems = [
  { name: 'Overview Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Driver Onboarding & KYC', path: '/drivers', icon: UserCheck },
  { name: 'Live Rides & Map', path: '/rides', icon: Car },
  { name: 'SOS Emergency Room', path: '/safety', icon: AlertTriangle, alertBadge: true },
  { name: 'Promos & Fare Rules', path: '/promos', icon: Tag },
  { name: 'Reconciliation', path: '/finance', icon: CreditCard },
  { name: 'Audit Logs', path: '/audit-logs', icon: ShieldCheck },
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 min-h-screen border-r border-slate-800">
      {/* Brand Logo Header */}
      <div className="h-16 flex items-center px-6 gap-3 border-b border-slate-800 bg-slate-950/40">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-xl">
          🚕
        </div>
        <div>
          <span className="text-xl font-bold tracking-tight text-white flex items-center gap-1">
            Ready<span className="text-emerald-400">Go</span>
          </span>
          <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
            Admin Operations
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-6 space-y-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                }`
              }
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="flex-1">{item.name}</span>
              {item.alertBadge && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Environment / System Footer */}
      <div className="p-4 m-3 rounded-xl bg-slate-800/40 border border-slate-800/80 text-xs text-slate-400">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
          <span className="font-semibold text-slate-200">API Connected</span>
        </div>
        <p className="text-[11px] text-slate-400">Backend: localhost:5000</p>
      </div>
    </aside>
  );
};

