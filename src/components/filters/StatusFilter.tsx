import React from 'react';
import { ActivityFilters } from '../../types/github';

interface StatusFilterProps {
  value: ActivityFilters['status'];
  onChange: (value: ActivityFilters['status']) => void;
  disabled?: boolean;
  typeFilter: ActivityFilters['type'];
}

const StatusFilter: React.FC<StatusFilterProps> = ({
  value,
  onChange,
  disabled = false,
  typeFilter,
}) => {
  return (
    <div>
      <label htmlFor="status" className="block text-sm font-medium text-gray-700">
        Status
      </label>
      <select
        id="status"
        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        value={value}
        onChange={(e) => onChange(e.target.value as ActivityFilters['status'])}
        disabled={disabled || typeFilter === 'comment'}
      >
        <option value="all">All</option>
        <option value="open">Open</option>
        <option value="closed">Closed</option>
        <option value="merged">Merged</option>
      </select>
    </div>
  );
};

export default StatusFilter;