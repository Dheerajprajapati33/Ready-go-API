import React, { useEffect, useState } from 'react';
import { Tag, Plus, Check, Percent, Sliders, DollarSign, CheckCircle2 } from 'lucide-react';
import { getAdminPromos, createAdminPromo, getFareRules, updateFareRule } from '../api/adminApi';

export const PromosPage: React.FC = () => {
  const [promos, setPromos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [promoForm, setPromoForm] = useState({
    code: '',
    title: '',
    discountType: 'PERCENTAGE' as 'PERCENTAGE' | 'FLAT',
    discountValue: 20,
    maxDiscount: 100,
    usageLimit: 500,
  });
  const [fareRuleSaved, setFareRuleSaved] = useState<string | null>(null);

  // Dynamic fare cards loaded from backend
  const [fareRules, setFareRules] = useState<any[]>([]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [promosRes, fareRes]: any = await Promise.allSettled([
        getAdminPromos(),
        getFareRules(),
      ]);

      if (promosRes.status === 'fulfilled') {
        const items = promosRes.value?.data?.items || (Array.isArray(promosRes.value?.data) ? promosRes.value.data : []);
        setPromos(items);
      }

      if (fareRes.status === 'fulfilled' && fareRes.value?.data) {
        const raw = Array.isArray(fareRes.value.data) ? fareRes.value.data : [];
        setFareRules(
          raw.map((r: any) => ({
            id: r._id || r.id || r.categoryId,
            category: r.name || r.categoryId?.toUpperCase() || 'Category',
            baseFare: (r.baseFarePaise || 3000) / 100,
            perKm: (r.perKmPaise || 1200) / 100,
            minFare: (r.minimumFarePaise || 3000) / 100,
          }))
        );
      }
    } catch (err) {
      console.error('Failed to load promos or fare rules:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createAdminPromo(promoForm);
      setShowPromoModal(false);
      setPromoForm({
        code: '',
        title: '',
        discountType: 'PERCENTAGE',
        discountValue: 20,
        maxDiscount: 100,
        usageLimit: 500,
      });
      await loadData();
    } catch (err) {
      console.error('Error creating promo:', err);
    }
  };

  const handleSaveFareRule = async (ruleId: string, ruleData: any) => {
    try {
      await updateFareRule(ruleId, {
        baseFarePaise: ruleData.baseFare * 100,
        perKmPaise: ruleData.perKm * 100,
        minimumFarePaise: ruleData.minFare * 100,
      });
      setFareRuleSaved(ruleId);
      setTimeout(() => setFareRuleSaved(null), 3000);
    } catch (err) {
      console.error('Failed to update fare rule:', err);
    }
  };

  return (
    <div className="space-y-8">
      {/* Promo Codes Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Promo Codes & Discounts</h1>
            <p className="text-sm text-slate-500">Create promotional discount vouchers and ride coupons</p>
          </div>
          <button
            onClick={() => setShowPromoModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" /> Create Coupon
          </button>
        </div>

        {/* Promo Coupons Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full py-8 text-center text-slate-400">Loading promo codes...</div>
          ) : promos.length === 0 ? (
            <div className="col-span-full py-8 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
              No active promo coupons. Click "Create Coupon" to add one.
            </div>
          ) : (
            promos.map((p) => {
              const id = p._id || p.id || p.code;
              return (
                <div key={id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 font-mono font-bold text-xs uppercase border border-emerald-200">
                      {p.code}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">
                      {p.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{p.title || `${p.discountValue}% OFF`}</h4>
                    <p className="text-xs text-slate-500">
                      {p.discountType === 'PERCENTAGE' ? `${p.discountValue}% Discount` : `₹${p.discountValue} Flat Discount`}
                      {p.maxDiscountPaise ? ` up to ₹${p.maxDiscountPaise / 100}` : ''}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Usage: {p.usageCount || 0} / {p.usageLimit || 500}</span>
                    <span>All Vehicle Types</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Fare Rules & Category Pricing Section */}
      <div className="space-y-4 pt-6 border-t border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Sliders className="w-5 h-5 text-emerald-600" /> Dynamic Fare Rules Configuration
          </h2>
          <p className="text-sm text-slate-500">Configure base rate, per km distance fare, and minimum trip fare</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {fareRules.map((rule, idx) => (
            <div key={rule.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-sm">{rule.category}</h3>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">Standard</span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Base Fare (₹)</label>
                  <input
                    type="number"
                    value={rule.baseFare}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setFareRules((prev) => prev.map((r, i) => (i === idx ? { ...r, baseFare: val } : r)));
                    }}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Per Km Rate (₹)</label>
                  <input
                    type="number"
                    value={rule.perKm}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setFareRules((prev) => prev.map((r, i) => (i === idx ? { ...r, perKm: val } : r)));
                    }}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Minimum Fare (₹)</label>
                  <input
                    type="number"
                    value={rule.minFare}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setFareRules((prev) => prev.map((r, i) => (i === idx ? { ...r, minFare: val } : r)));
                    }}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                  />
                </div>
              </div>

              <button
                onClick={() => handleSaveFareRule(rule.id, rule)}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-xs"
              >
                {fareRuleSaved === rule.id ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Saved!
                  </>
                ) : (
                  'Update Rule'
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Create Promo Modal */}
      {showPromoModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Create New Promo Voucher</h3>
              <button onClick={() => setShowPromoModal(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <form onSubmit={handleCreatePromo} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Coupon Code (e.g. READY50)</label>
                <input
                  type="text"
                  required
                  value={promoForm.code}
                  onChange={(e) => setPromoForm({ ...promoForm, code: e.target.value.toUpperCase() })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs uppercase font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Discount Type</label>
                  <select
                    value={promoForm.discountType}
                    onChange={(e: any) => setPromoForm({ ...promoForm, discountType: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  >
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FLAT">Flat Cash (₹)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Discount Value</label>
                  <input
                    type="number"
                    required
                    value={promoForm.discountValue}
                    onChange={(e) => setPromoForm({ ...promoForm, discountValue: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Max Discount Cap (₹)</label>
                  <input
                    type="number"
                    value={promoForm.maxDiscount}
                    onChange={(e) => setPromoForm({ ...promoForm, maxDiscount: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Usage Limit</label>
                  <input
                    type="number"
                    value={promoForm.usageLimit}
                    onChange={(e) => setPromoForm({ ...promoForm, usageLimit: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPromoModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs"
                >
                  Save Coupon
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

