import React, { useEffect, useState } from 'react';
import {
  Search,
  Car,
  MapPin,
  Clock,
  User,
  CheckCircle,
  AlertCircle,
  Send,
} from 'lucide-react';
import { getAdminRides, manualAssignRide } from '../api/adminApi';
import { StatusBadge } from '../components/ui/StatusBadge';

export const RidesPage: React.FC = () => {
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedRide, setSelectedRide] = useState<any | null>(null);
  const [driverIdInput, setDriverIdInput] = useState('');
  const [dispatchReason, setDispatchReason] = useState('Manual assignment by support');
  const [assignLoading, setAssignLoading] = useState(false);

  const loadRides = async () => {
    try {
      setLoading(true);
      const res: any = await getAdminRides({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        limit: 50,
      });
      const items = res?.data?.items || (Array.isArray(res?.data) ? res.data : []);
      setRides(items);
    } catch (err) {
      console.error('Error loading rides:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRides();
  }, [statusFilter]);

  const handleManualDispatch = async () => {
    if (!selectedRide || !driverIdInput) return;
    try {
      setAssignLoading(true);
      const id = selectedRide._id || selectedRide.id;
      await manualAssignRide(id, {
        driverId: driverIdInput,
        reason: dispatchReason,
      });
      setSelectedRide(null);
      setDriverIdInput('');
      await loadRides();
    } catch (err) {
      console.error('Manual dispatch failed:', err);
    } finally {
      setAssignLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Live Rides & Dispatch Operations</h1>
          <p className="text-sm text-slate-500">
            Monitor real-time customer bookings, track ride lifecycles, and execute manual driver dispatch
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          {['ALL', 'SEARCHING_DRIVER', 'DRIVER_ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED_BY_RIDER'].map(
            (st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  statusFilter === st
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st.replace(/_/g, ' ')}
              </button>
            )
          )}
        </div>
      </div>

      {/* Rides Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-bold tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Ride ID / Category</th>
                <th className="px-6 py-4">Rider</th>
                <th className="px-6 py-4">Driver Partner</th>
                <th className="px-6 py-4">Pickup & Destination</th>
                <th className="px-6 py-4">Fare (INR)</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Dispatch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    Loading ride bookings...
                  </td>
                </tr>
              ) : rides.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    No rides found for the selected status.
                  </td>
                </tr>
              ) : (
                rides.map((ride) => {
                  const id = ride._id || ride.id;
                  const riderName = ride.riderId?.fullName || 'Rider';
                  const driverName = ride.driverId?.fullName || (ride.driverId ? 'Assigned Driver' : 'Unassigned');
                  const fare = (ride.fareBreakdown?.totalPaise || 5000) / 100;

                  return (
                    <tr key={id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900 text-xs">#{String(id).slice(-6)}</div>
                        <span className="capitalize px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[11px]">
                          {ride.categoryId || 'Moto'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800 text-xs">{riderName}</div>
                        <div className="text-[11px] text-slate-400">{ride.riderId?.phone || '+91 9876543210'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800 text-xs">{driverName}</div>
                        <div className="text-[11px] text-slate-400">{ride.driverId?.phone || 'Awaiting'}</div>
                      </td>
                      <td className="px-6 py-4 max-w-xs">
                        <div className="text-xs text-slate-800 truncate flex items-center gap-1">
                          <span className="text-emerald-600 font-bold">●</span> {ride.pickup?.address || 'Pickup Point'}
                        </div>
                        <div className="text-xs text-slate-500 truncate flex items-center gap-1">
                          <span className="text-rose-600 font-bold">●</span> {ride.dropoff?.address || 'Destination Point'}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-900">₹{fare.toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <StatusBadge status={ride.status || 'SEARCHING_DRIVER'} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setSelectedRide(ride)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs"
                        >
                          <Send className="w-3.5 h-3.5" /> Dispatch
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Dispatch Modal */}
      {selectedRide && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Manual Driver Dispatch</h3>
                <p className="text-xs text-slate-500">
                  Assign a specific driver partner to Ride #{String(selectedRide._id || selectedRide.id).slice(-6)}
                </p>
              </div>
              <button
                onClick={() => setSelectedRide(null)}
                className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Driver User ID / Profile ID</label>
                <input
                  type="text"
                  value={driverIdInput}
                  onChange={(e) => setDriverIdInput(e.target.value)}
                  placeholder="Enter Driver Partner ID (or leave blank to auto-assign default)"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Dispatch Authorization Reason</label>
                <input
                  type="text"
                  value={dispatchReason}
                  onChange={(e) => setDispatchReason(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setSelectedRide(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleManualDispatch}
                disabled={assignLoading}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs"
              >
                <Send className="w-4 h-4" /> Confirm Dispatch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

