import React from 'react';
import { ActivityFilters } from '../../types/github';
import DateRangeFilter from './DateRangeFilter';
import UserFilter from './UserFilter';
import TypeFilter from './TypeFilter';
import StatusFilter from './StatusFilter';
import SortFilter from './SortFilter';

interface FilterPanelProps {
  filters: ActivityFilters;
  onFilterChange: (key: keyof ActivityFilters, value: any) => void;
  loading?: boolean;
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  onFilterChange,
  loading = false,
}) => {
  return (
    <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl">
      <div className="px-4 py-6 sm:p-8">
        <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
          <div className="sm:col-span-6">
            <DateRangeFilter
              startDate={filters.startDate}
              endDate={filters.endDate}
              onStartDateChange={(value) => onFilterChange('startDate', value)}
              onEndDateChange={(value) => onFilterChange('endDate', value)}
              disabled={loading}
            />
          </div>

          <div className="sm:col-span-2">
            <TypeFilter
              value={filters.type}
              onChange={(value) => onFilterChange('type', value)}
              disabled={loading}
            />
          </div>

          <div className="sm:col-span-2">
            <StatusFilter
              value={filters.status}
              onChange={(value) => onFilterChange('status', value)}
              disabled={loading}
              typeFilter={filters.type}
            />
          </div>

          <div className="sm:col-span-2">
            <SortFilter
              value={filters.sortBy}
              onChange={(value) => onFilterChange('sortBy', value)}
              disabled={loading}
            />
          </div>

          <div className="sm:col-span-3">
            <UserFilter
              value={filters.user}
              onChange={(value) => onFilterChange('user', value)}
              disabled={loading}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilterPanel;