import React, { useEffect, useState } from 'react';
import {
  Car,
  Users,
  FileCheck,
  TrendingUp,
  AlertOctagon,
  CheckCircle2,
  XCircle,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import {
  getDashboardStats,
  getDriverApplications,
  reviewDriverApplication,
} from '../api/adminApi';
import { StatusBadge } from '../components/ui/StatusBadge';

export const DashboardPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    activeRides: 0,
    onlineDrivers: 0,
    pendingKYC: 0,
    todayRevenue: '₹0',
    activeSOS: 0,
  });
  const [driverQueue, setDriverQueue] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, driversRes] = await Promise.allSettled([
        getDashboardStats(),
        getDriverApplications({ status: 'PENDING', limit: 10 }),
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value?.data) {
        const s = statsRes.value.data;
        setStats({
          activeRides: s.activeRides ?? 0,
          onlineDrivers: s.onlineDrivers ?? 0,
          pendingKYC: s.pendingKYC ?? 0,
          todayRevenue: s.todayRevenueFormatted || `₹${((s.todayRevenuePaise || 0) / 100).toLocaleString('en-IN')}`,
          activeSOS: s.activeSOS ?? 0,
        });
      }

      if (driversRes.status === 'fulfilled' && driversRes.value?.data) {
        const items = Array.isArray(driversRes.value.data)
          ? driversRes.value.data
          : driversRes.value.data.items || [];
        setDriverQueue(items);
      }
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleReview = async (id: string, decision: 'APPROVED' | 'REJECTED') => {
    try {
      setActionLoading(id);
      await reviewDriverApplication(id, { decision, remarks: `Reviewed as ${decision} from dashboard` });
      setDriverQueue((prev) => prev.filter((d) => (d.id || d._id) !== id));
      setStats((prev) => ({ ...prev, pendingKYC: Math.max(0, prev.pendingKYC - 1) }));
    } catch (err) {
      console.error('Failed to review application:', err);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Overview Dashboard</h1>
          <p className="text-sm text-slate-500">
            Real-time telemetry, fleet tracking, and operations control
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-colors shadow-xs"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
          Refresh Stats
        </button>
      </div>

      {/* Top 5 Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Active Rides */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Rides</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Car className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{stats.activeRides}</span>
            <span className="text-xs font-semibold text-emerald-600 flex items-center">
              <TrendingUp className="w-3 h-3 mr-0.5" /> +8.4%
            </span>
          </div>
        </div>

        {/* Online Drivers */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Online Drivers</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{stats.onlineDrivers}</span>
            <span className="text-xs font-semibold text-slate-500">available</span>
          </div>
        </div>

        {/* Pending KYC */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending KYC</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <FileCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{stats.pendingKYC}</span>
            <span className="text-xs font-semibold text-amber-600">needs review</span>
          </div>
        </div>

        {/* Today's Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Today Revenue</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">{stats.todayRevenue}</span>
          </div>
        </div>

        {/* SOS Emergency Alerts */}
        <div className={`p-5 rounded-2xl border shadow-xs transition-all ${
          stats.activeSOS > 0
            ? 'bg-red-50 border-red-300 ring-2 ring-red-400/20'
            : 'bg-white border-slate-200/80'
        }`}>
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-red-700">SOS Alerts</span>
            <div className={`p-2 rounded-xl ${stats.activeSOS > 0 ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-100 text-slate-600'}`}>
              <AlertOctagon className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-extrabold ${stats.activeSOS > 0 ? 'text-red-700' : 'text-slate-900'}`}>
              {stats.activeSOS} Active
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Live City Tracking Map & Driver KYC Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* City Fleet GPS Tracking Board (Left 2 columns) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-600" />
                Live City Fleet Telemetry & Routes
              </h2>
              <p className="text-xs text-slate-500">Live GPS tracking for active cabs and motorcycles</p>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
              Delhi NCR Region
            </span>
          </div>

          {/* Interactive Map Visual Simulator */}
          <div className="relative flex-1 min-h-[380px] bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
            {/* Grid Map Graphic */}
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: `radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)`,
                backgroundSize: '24px 24px',
              }}
            />

            {/* Simulated Route Lines */}
            <svg className="absolute inset-0 w-full h-full stroke-emerald-500/40 fill-none" strokeWidth="2">
              <path d="M 120 180 Q 240 100 380 220 T 600 150" strokeDasharray="6 6" />
              <path d="M 80 320 Q 300 280 460 340 T 700 260" stroke="#38bdf8" strokeWidth="2" opacity="0.4" />
            </svg>

            {/* Simulated Live Vehicle Markers */}
            <div className="absolute top-1/4 left-1/3 flex items-center gap-1.5 bg-slate-900/90 border border-emerald-500/50 px-2.5 py-1 rounded-full text-white text-xs font-semibold shadow-lg animate-bounce">
              <span>🏍️</span> Moto #DL04
            </div>
            <div className="absolute bottom-1/3 right-1/4 flex items-center gap-1.5 bg-slate-900/90 border border-blue-500/50 px-2.5 py-1 rounded-full text-white text-xs font-semibold shadow-lg">
              <span>🚕</span> Sedan #UP16
            </div>
            <div className="absolute top-1/2 left-2/3 flex items-center gap-1.5 bg-slate-900/90 border border-amber-500/50 px-2.5 py-1 rounded-full text-white text-xs font-semibold shadow-lg">
              <span>🛺</span> Auto #DL01
            </div>

            {/* Map Overlay Stats */}
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between bg-slate-900/80 backdrop-blur-md border border-slate-800 p-3 rounded-xl text-xs text-slate-300">
              <div className="flex items-center gap-4">
                <span>🟢 <strong>318</strong> Vehicles Online</span>
                <span>🔵 <strong>142</strong> In-Trip</span>
                <span>🟡 <strong>24</strong> Waiting Dispatch</span>
              </div>
              <span className="text-slate-400">Map GPS Engine v2.4 Active</span>
            </div>
          </div>
        </div>

        {/* Driver KYC Approval Queue (Right 1 column) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Driver KYC Approval Queue</h2>
              <p className="text-xs text-slate-500">Instant document verification</p>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-200">
              {driverQueue.length} Pending
            </span>
          </div>

          <div className="space-y-3.5 flex-1 overflow-y-auto">
            {driverQueue.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <FileCheck className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-semibold">No pending KYC applications</p>
                <p className="text-xs">All submitted driver documents are up to date.</p>
              </div>
            ) : (
              driverQueue.map((driver) => {
                const id = driver.id || driver._id;
                const isProcessing = actionLoading === id;
                return (
                  <div
                    key={id}
                    className="p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 transition-all bg-slate-50/50 space-y-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center shrink-0 text-sm">
                        {driver.driverName?.[0] || 'D'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-slate-900 truncate">
                            {driver.driverName || 'Driver Partner'}
                          </h4>
                          <StatusBadge status={driver.applicationStatus || driver.status || 'PENDING'} />
                        </div>
                        <p className="text-xs text-slate-500 font-medium">
                          {driver.vehicle?.model || driver.vehicleCategory || 'Hero Splendor / Activa'}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {driver.vehicle?.plateNumber || driver.phone || '+91 9811223344'} • {driver.city || 'Noida'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60">
                      <button
                        onClick={() => handleReview(id, 'APPROVED')}
                        disabled={isProcessing}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button
                        onClick={() => handleReview(id, 'REJECTED')}
                        disabled={isProcessing}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 bg-white border border-rose-200 hover:bg-rose-50 text-rose-600 text-xs font-semibold rounded-lg transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

