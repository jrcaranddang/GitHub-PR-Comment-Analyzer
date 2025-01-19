import React from 'react';
import { ActivityFilters } from '../../types/github';

interface TypeFilterProps {
  value: ActivityFilters['type'];
  onChange: (value: ActivityFilters['type']) => void;
  disabled?: boolean;
}

const TypeFilter: React.FC<TypeFilterProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  return (
    <div>
      <label htmlFor="type" className="block text-sm font-medium text-gray-700">
        Type
      </label>
      <select
        id="type"
        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        value={value}
        onChange={(e) => onChange(e.target.value as ActivityFilters['type'])}
        disabled={disabled}
      >
        <option value="all">All</option>
        <option value="pr">Pull Requests</option>
        <option value="comment">Comments</option>
      </select>
    </div>
  );
};

export default TypeFilter;