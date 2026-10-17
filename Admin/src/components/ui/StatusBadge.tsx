import React from 'react';

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const s = (status || '').toUpperCase();

  let styles = 'bg-slate-100 text-slate-700 border-slate-200';

  if (['APPROVED', 'COMPLETED', 'VERIFIED', 'SUCCEEDED', 'SUCCESS', 'ACTIVE', 'PAID'].includes(s)) {
    styles = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (['REJECTED', 'CANCELLED', 'FAILED', 'CANCELLED_BY_RIDER', 'CANCELLED_BY_DRIVER'].includes(s)) {
    styles = 'bg-rose-50 text-rose-700 border-rose-200';
  } else if (['UNDER_REVIEW', 'PENDING', 'DOCUMENTS_PENDING', 'SEARCHING_DRIVER', 'DRAFT'].includes(s)) {
    styles = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (['DRIVER_ASSIGNED', 'DRIVER_ARRIVED', 'IN_PROGRESS', 'RESPONDING'].includes(s)) {
    styles = 'bg-blue-50 text-blue-700 border-blue-200';
  } else if (['OPEN', 'CRITICAL', 'SOS'].includes(s)) {
    styles = 'bg-red-600 text-white border-red-700 animate-pulse font-bold';
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles}`}>
      {s.replace(/_/g, ' ')}
    </span>
  );
};

