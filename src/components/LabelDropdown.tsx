import React, { useState, useEffect, useMemo, Fragment } from 'react';
import { Combobox } from '@headlessui/react';
import { CheckIcon, ChevronUpDownIcon, XMarkIcon } from '@heroicons/react/20/solid';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { GitHubLabel, LabelDropdownProps } from '../types/github';
import { Octokit } from '@octokit/rest';
import dotenv from '../utils/dotenv';

const octokit = new Octokit({
  auth: dotenv.GITHUB_TOKEN,
});

export const LabelDropdown: React.FC<LabelDropdownProps> = ({
  owner,
  repo,
  selectedLabels,
  onLabelsChange,
  className,
  placeholder = 'Select labels...',
  disabled = false,
}) => {
  const [query, setQuery] = useState('');
  const [labels, setLabels] = useState<GitHubLabel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchLabels = async () => {
      if (!owner || !repo) {
        setError('Repository information is missing');
        return;
      }
      
      setLoading(true);
      setError(null);
      
      try {
        const { data } = await octokit.rest.issues.listLabelsForRepo({
          owner,
          repo,
          per_page: 100,
        });
        
        setLabels(data);
      } catch (err: any) {
        console.error('Error fetching labels:', err);
        setError(err.message || 'Failed to fetch labels');
      } finally {
        setLoading(false);
      }
    };

    fetchLabels();
  }, [owner, repo]);

  const filteredLabels = useMemo(() => {
    return query === ''
      ? labels
      : labels.filter((label) =>
          label.name.toLowerCase().includes(query.toLowerCase())
        );
  }, [labels, query]);

  const removeLabel = (labelToRemove: GitHubLabel) => {
    onLabelsChange(selectedLabels.filter((label) => label.id !== labelToRemove.id));
  };

  return (
    <div className={className}>
      <Combobox
        value={selectedLabels}
        onChange={onLabelsChange}
        multiple
        disabled={disabled || loading}
      >
        <div className="relative">
          <div className="relative w-full cursor-default overflow-hidden rounded-lg bg-white text-left border border-gray-300 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
            <div className="flex flex-wrap gap-1 p-1">
              {selectedLabels.map((label) => (
                <span
                  key={label.id}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium"
                  style={{
                    backgroundColor: `#${label.color}20`,
                    color: `#${label.color}`,
                    border: `1px solid #${label.color}40`
                  }}
                >
                  <span className="truncate max-w-[150px]">{label.name}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      removeLabel(label);
                    }}
                    className="hover:opacity-75 focus:outline-none"
                  >
                    <XMarkIcon className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <Combobox.Input
                className="border-0 p-1.5 text-sm leading-5 text-gray-900 focus:ring-0 flex-1 min-w-[120px]"
                placeholder={selectedLabels.length === 0 ? placeholder : ''}
                onChange={(event) => setQuery(event.target.value)}
                displayValue={() => ''}
              />
            </div>
            <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
              <ChevronUpDownIcon
                className="h-5 w-5 text-gray-400"
                aria-hidden="true"
              />
            </Combobox.Button>
          </div>

          <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
            {loading ? (
              <div className="relative cursor-default select-none px-4 py-2 text-gray-700">
                Loading labels...
              </div>
            ) : error ? (
              <div className="relative cursor-default select-none px-4 py-2 text-red-500">
                {error}
              </div>
            ) : filteredLabels.length === 0 ? (
              <div className="relative cursor-default select-none px-4 py-2 text-gray-700">
                {query === '' ? 'No labels available.' : 'No labels found.'}
              </div>
            ) : (
              filteredLabels.map((label) => (
                <Combobox.Option
                  key={label.id}
                  className={({ active }) =>
                    clsx(
                      'relative cursor-default select-none py-2 pl-10 pr-4',
                      active ? 'bg-blue-600 text-white' : 'text-gray-900'
                    )
                  }
                  value={label}
                >
                  {({ selected, active }) => (
                    <>
                      <span
                        className={clsx(
                          'block truncate',
                          selected ? 'font-medium' : 'font-normal'
                        )}
                      >
                        <span
                          className="inline-block w-3 h-3 rounded-full mr-2"
                          style={{ backgroundColor: `#${label.color}` }}
                        />
                        {label.name}
                        {label.description && (
                          <span className={clsx(
                            'ml-2 text-xs',
                            active ? 'text-blue-100' : 'text-gray-500'
                          )}>
                            {label.description}
                          </span>
                        )}
                      </span>
                      {selected ? (
                        <span
                          className={clsx(
                            'absolute inset-y-0 left-0 flex items-center pl-3',
                            active ? 'text-white' : 'text-blue-600'
                          )}
                        >
                          <CheckIcon className="h-5 w-5" aria-hidden="true" />
                        </span>
                      ) : null}
                    </>
                  )}
                </Combobox.Option>
              ))
            )}
          </Combobox.Options>
        </div>
      </Combobox>
      {error && (
        <div className="mt-2 flex items-center gap-x-2 text-sm text-red-600">
          <ExclamationCircleIcon className="h-4 w-4" />
          {error}
        </div>
      )}
    </div>
  );
};

export default LabelDropdown;