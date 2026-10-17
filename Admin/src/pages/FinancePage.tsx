import React, { useEffect, useState } from 'react';
import { CreditCard, DollarSign, ArrowUpRight, ArrowDownRight, RefreshCw, Filter } from 'lucide-react';
import { getPaymentReconciliation } from '../api/adminApi';
import { StatusBadge } from '../components/ui/StatusBadge';

export const FinancePage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [methodFilter, setMethodFilter] = useState('ALL');

  const loadReconciliation = async () => {
    try {
      setLoading(true);
      const res: any = await getPaymentReconciliation({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        paymentMethod: methodFilter === 'ALL' ? undefined : methodFilter,
      });
      setData(res?.data || null);
    } catch (err) {
      console.error('Failed to load reconciliation:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReconciliation();
  }, [statusFilter, methodFilter]);

  const transactions = data?.items || data?.transactions || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Financial Reconciliation & Settlements</h1>
          <p className="text-sm text-slate-500">
            Reconcile payments, commission dues, online UPI gateways, and cash settlements
          </p>
        </div>
        <button
          onClick={loadReconciliation}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-colors shadow-xs"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh Settlements
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Total Volume Processed
          </div>
          <div className="text-2xl font-bold text-slate-900">
            ₹{((data?.summary?.totalAmountPaise ?? 0) / 100).toLocaleString('en-IN')}
          </div>
          <span className="text-xs text-emerald-600 font-semibold flex items-center mt-1">
            <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> Reconciled
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Platform Commission (20%)
          </div>
          <div className="text-2xl font-bold text-emerald-600">
            ₹{((data?.summary?.platformCommissionPaise ?? 0) / 100).toLocaleString('en-IN')}
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Net revenue retained</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Driver Partner Payouts
          </div>
          <div className="text-2xl font-bold text-purple-600">
            ₹{((data?.summary?.driverPayoutPaise ?? 0) / 100).toLocaleString('en-IN')}
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Payable settlements</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          {['ALL', 'SUCCEEDED', 'PENDING', 'FAILED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                statusFilter === st
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-bold tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Transaction ID</th>
                <th className="px-6 py-4">Purpose</th>
                <th className="px-6 py-4">Method</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">Loading records...</td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    No transactions found for the selected filter.
                  </td>
                </tr>
              ) : (
                transactions.map((tx: any) => {
                  const id = tx._id || tx.id || tx.paymentId;
                  const amt = (tx.amountPaise || 5000) / 100;
                  return (
                    <tr key={id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs font-bold text-slate-900">
                        #{String(id).slice(-8)}
                      </td>
                      <td className="px-6 py-4 font-medium text-xs text-slate-700">
                        {tx.purpose || 'RIDE_PAYMENT'}
                      </td>
                      <td className="px-6 py-4">
                        <span className="uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[11px]">
                          {tx.paymentMethodId || tx.paymentMethod || 'UPI'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-900">₹{amt.toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <StatusBadge status={tx.status || 'SUCCEEDED'} />
                      </td>
                      <td className="px-6 py-4 text-right text-xs text-slate-400">
                        {new Date(tx.createdAt || Date.now()).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

