import React, { useEffect, useState } from 'react';
import {
  AlertOctagon,
  ShieldAlert,
  PhoneCall,
  CheckCircle2,
  Clock,
  UserCheck,
  AlertTriangle,
  MapPin,
} from 'lucide-react';
import { io } from 'socket.io-client';
import {
  getSafetyEvents,
  assignSafetyEvent,
  resolveSafetyEvent,
  acknowledgeSafetyEvent,
} from '../api/adminApi';
import { SOCKET_URL } from '../api/axiosClient';
import { StatusBadge } from '../components/ui/StatusBadge';

export const SafetyPage: React.FC = () => {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadIncidents = async () => {
    try {
      setLoading(true);
      const res: any = await getSafetyEvents();
      const items = Array.isArray(res?.data) ? res.data : [];
      setIncidents(items);
    } catch (err) {
      console.error('Failed to load safety events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIncidents();

    // Connect to WebSocket for real-time SOS broadcast
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
    });

    socket.on('safety:sos_status', (data) => {
      console.log('[Real-time SOS Alert received]:', data);
      loadIncidents();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleAction = async (id: string, actionType: 'assign' | 'resolve' | 'acknowledge') => {
    try {
      setActionLoading(id);
      if (actionType === 'assign') {
        await assignSafetyEvent(id, { note: 'Admin responder assigned to SOS incident' });
      } else if (actionType === 'resolve') {
        await resolveSafetyEvent(id, { note: 'Incident verified and marked resolved by Admin' });
      } else if (actionType === 'acknowledge') {
        await acknowledgeSafetyEvent(id, { note: 'Emergency alert acknowledged by Operations Desk' });
      }
      await loadIncidents();
    } catch (err) {
      console.error(`Failed to ${actionType} event:`, err);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* High Priority Emergency Banner */}
      <div className="bg-red-600 text-white rounded-2xl p-6 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
            <AlertOctagon className="w-7 h-7 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">SOS Emergency Control Room</h1>
            <p className="text-red-100 text-xs">
              Live priority desk for rider/driver emergency assistance and safety dispatch
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3.5 py-1.5 rounded-full bg-white/20 text-xs font-bold uppercase tracking-wider backdrop-blur-xs">
            {incidents.length} Active Incident{incidents.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/* Incidents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-16 text-center text-slate-400">
            Checking safety telemetry...
          </div>
        ) : incidents.length === 0 ? (
          <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-slate-200">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
            <h3 className="text-base font-bold text-slate-800">All Clear! No Active SOS Incidents</h3>
            <p className="text-xs text-slate-500">Fleet operations are running safely with zero open emergency alerts.</p>
          </div>
        ) : (
          incidents.map((event) => {
            const id = event._id || event.id || event.eventId;
            const isActing = actionLoading === id;

            return (
              <div
                key={id}
                className="bg-white rounded-2xl border-2 border-red-200 p-5 shadow-xs flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-mono font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                      SOS #{String(id).slice(-6)}
                    </span>
                    <StatusBadge status={event.status || 'OPEN'} />
                  </div>

                  <h3 className="text-base font-bold text-slate-900 mb-1">
                    {event.message || 'Emergency Assistance Requested'}
                  </h3>

                  <div className="space-y-1.5 text-xs text-slate-500 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{new Date(event.createdAt || Date.now()).toLocaleTimeString()}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-red-500" />
                      <span>
                        Lat: {event.location?.latitude?.toFixed(4) || '28.6139'}, Lng: {event.location?.longitude?.toFixed(4) || '77.2090'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Trigger: {event.triggerSource || 'HOLD_BUTTON'}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => handleAction(id, 'assign')}
                    disabled={isActing}
                    className="inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors"
                  >
                    <UserCheck className="w-3.5 h-3.5" /> Assign Desk
                  </button>
                  <button
                    onClick={() => handleAction(id, 'resolve')}
                    disabled={isActing}
                    className="inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Mark Resolved
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

