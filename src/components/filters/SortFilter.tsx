import React from 'react';
import { Menu } from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import clsx from 'clsx';
import { ActivityFilters } from '../../types/github';

interface SortFilterProps {
  value: ActivityFilters['sortBy'];
  onChange: (value: ActivityFilters['sortBy']) => void;
  disabled?: boolean;
}

const SortFilter: React.FC<SortFilterProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const options = [
    { value: 'date', label: 'Date' },
    { value: 'repository', label: 'Repository' },
    { value: 'author', label: 'Author' },
  ];

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">Sort By</label>
      <Menu as="div" className="relative mt-1">
        <Menu.Button
          disabled={disabled}
          className="inline-flex w-full justify-between rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {options.find(opt => opt.value === value)?.label || 'Date'}
          <ChevronDownIcon className="-mr-1 ml-2 h-5 w-5" aria-hidden="true" />
        </Menu.Button>

        <Menu.Items className="absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
          <div className="py-1">
            {options.map((option) => (
              <Menu.Item key={option.value}>
                {({ active }) => (
                  <button
                    onClick={() => onChange(option.value as ActivityFilters['sortBy'])}
                    className={clsx(
                      active ? 'bg-gray-100 text-gray-900' : 'text-gray-700',
                      'block w-full px-4 py-2 text-left text-sm'
                    )}
                  >
                    {option.label}
                  </button>
                )}
              </Menu.Item>
            ))}
          </div>
        </Menu.Items>
      </Menu>
    </div>
  );
};

export default SortFilter;