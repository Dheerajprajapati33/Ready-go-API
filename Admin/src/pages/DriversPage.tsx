import React, { useEffect, useState } from 'react';
import {
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Eye,
  FileText,
  AlertCircle,
  Phone,
  Mail,
  ShieldAlert,
} from 'lucide-react';
import { getDriverApplications, reviewDriverApplication, verifyDriverDocument } from '../api/adminApi';
import { StatusBadge } from '../components/ui/StatusBadge';

export const DriversPage: React.FC = () => {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [cityFilter, setCityFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDriver, setSelectedDriver] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const loadDrivers = async () => {
    try {
      setLoading(true);
      const res: any = await getDriverApplications({
        status: statusFilter,
        city: cityFilter,
        limit: 50,
      });
      const items = Array.isArray(res?.data) ? res.data : res?.data?.items || [];
      setDrivers(items);
    } catch (err) {
      console.error('Error fetching drivers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDrivers();
  }, [statusFilter, cityFilter]);

  const handleReview = async (decision: 'APPROVED' | 'REJECTED' | 'ACTION_REQUIRED') => {
    if (!selectedDriver) return;
    try {
      setActionLoading(true);
      const id = selectedDriver.id || selectedDriver._id || selectedDriver.applicationId;
      await reviewDriverApplication(id, {
        decision: decision === 'ACTION_REQUIRED' ? 'ACTION_REQUIRED' : decision,
        remarks: rejectionReason || `Application marked as ${decision}`,
      });
      setSelectedDriver(null);
      setRejectionReason('');
      await loadDrivers();
    } catch (err) {
      console.error('Failed to review application:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredDrivers = drivers.filter((d) => {
    const q = searchTerm.toLowerCase();
    const name = (d.driverName || '').toLowerCase();
    const phone = (d.phone || '').toLowerCase();
    const city = (d.city || '').toLowerCase();
    return name.includes(q) || phone.includes(q) || city.includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Title & Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Driver KYC & Onboarding</h1>
          <p className="text-sm text-slate-500">
            Review submitted licenses, vehicle registrations, and verify driver partner profiles
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[260px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search driver by name, phone, or city..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800"
          />
        </div>

        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          {['ALL', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'].map((st) => (
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
          ))}
        </div>
      </div>

      {/* Drivers Applications Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-bold tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Driver Partner</th>
                <th className="px-6 py-4">City</th>
                <th className="px-6 py-4">Vehicle Category</th>
                <th className="px-6 py-4">Plate / Vehicle</th>
                <th className="px-6 py-4">KYC Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    Loading driver applications...
                  </td>
                </tr>
              ) : filteredDrivers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    No driver applications match the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredDrivers.map((driver) => {
                  const id = driver.id || driver._id || driver.applicationId;
                  return (
                    <tr key={id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-800 font-bold flex items-center justify-center text-sm shrink-0">
                            {driver.driverName?.[0] || 'D'}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{driver.driverName || 'Driver Partner'}</div>
                            <div className="text-xs text-slate-400 flex items-center gap-1">
                              <Phone className="w-3 h-3 inline" /> {driver.phone || '+91 9811223344'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-700">{driver.city || 'Delhi NCR'}</td>
                      <td className="px-6 py-4">
                        <span className="capitalize px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-semibold text-xs">
                          {driver.vehicleCategory || driver.vehicle?.category || 'Moto'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-slate-900 font-semibold text-xs">
                          {driver.vehicle?.plateNumber || driver.vehicle?.registrationNumber || 'DL 01 AB 1234'}
                        </div>
                        <div className="text-xs text-slate-400">{driver.vehicle?.model || 'Hero Splendor'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={driver.applicationStatus || driver.status || 'PENDING'} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setSelectedDriver(driver)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs"
                        >
                          <Eye className="w-3.5 h-3.5" /> Inspect KYC
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

      {/* Driver KYC Inspection Modal */}
      {selectedDriver && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  KYC Verification: {selectedDriver.driverName || 'Driver Partner'}
                </h3>
                <p className="text-xs text-slate-500">
                  Review submitted documents and verify against platform safety standards
                </p>
              </div>
              <button
                onClick={() => setSelectedDriver(null)}
                className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Driver Details Card */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">Phone</span>
                  <span className="font-bold text-slate-800">{selectedDriver.phone || '+91 9811223344'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">City</span>
                  <span className="font-bold text-slate-800">{selectedDriver.city || 'Delhi NCR'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Vehicle Category</span>
                  <span className="font-bold text-slate-800 uppercase">{selectedDriver.vehicleCategory || 'MOTO'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Vehicle Model</span>
                  <span className="font-bold text-slate-800">{selectedDriver.vehicle?.model || 'Hero Splendor'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Plate Number</span>
                  <span className="font-bold text-slate-800">{selectedDriver.vehicle?.plateNumber || 'DL 01 AB 1234'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Application ID</span>
                  <span className="font-bold text-slate-800 truncate block">{selectedDriver.id || selectedDriver._id}</span>
                </div>
              </div>

              {/* Uploaded Documents Preview */}
              <div>
                <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600" /> Uploaded Proofs & Credentials
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Driving License Preview */}
                  <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">Driving License (Front)</span>
                      <span className="text-emerald-600 font-semibold">Ready for Review</span>
                    </div>
                    <div className="h-32 bg-slate-100 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-xs">
                      🪪 Driving License Image Preview
                    </div>
                  </div>

                  {/* Vehicle Registration Certificate */}
                  <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">Vehicle RC Document</span>
                      <span className="text-emerald-600 font-semibold">Ready for Review</span>
                    </div>
                    <div className="h-32 bg-slate-100 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-xs">
                      📄 Vehicle RC Document Preview
                    </div>
                  </div>
                </div>
              </div>

              {/* Review Remarks / Reason */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Admin Verification Notes / Rejection Reason (Optional)
                </label>
                <textarea
                  rows={2}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter notes or explanation if rejecting/requesting re-upload..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setSelectedDriver(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReview('REJECTED')}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-semibold transition-colors"
              >
                <XCircle className="w-4 h-4" /> Reject Application
              </button>
              <button
                onClick={() => handleReview('APPROVED')}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs"
              >
                <CheckCircle2 className="w-4 h-4" /> Approve & Activate Driver
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

