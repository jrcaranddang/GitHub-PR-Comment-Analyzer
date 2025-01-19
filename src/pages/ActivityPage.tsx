import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { Menu } from '@headlessui/react';
import clsx from 'clsx';
import { PullRequest, Comment, ActivityFilters } from '../types/github';
import { createClient } from '@supabase/supabase-js';
import { Octokit } from '@octokit/rest';
import dotenv from '../utils/dotenv';
import toast from 'react-hot-toast';

// Initialize Supabase client
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Initialize GitHub client
const octokit = new Octokit({
  auth: dotenv.GITHUB_TOKEN,
});

const repositories = (dotenv.GITHUB_REPOS || '').split(',').filter(Boolean);

export default function ActivityPage() {
  const [filters, setFilters] = useState<ActivityFilters>({
    repository: null,
    type: 'all',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    status: 'all',
    sortBy: 'date',
    sortOrder: 'desc',
  });

  const [items, setItems] = useState<(PullRequest | Comment)[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    fetchActivity();
  }, [filters, page]);

  const syncWithGitHub = async () => {
    setIsSyncing(true);
    try {
      for (const repo of repositories) {
        const [owner, repoName] = repo.split('/');
        
        // Fetch pull requests
        const prs = await octokit.paginate(octokit.rest.pulls.list, {
          owner,
          repo: repoName,
          state: 'all',
          per_page: 100,
        });

        // Insert PRs into database
        for (const pr of prs) {
          if (!pr.user) continue;
          
          await supabase.from('pull_requests').upsert({
            number: pr.number,
            title: pr.title,
            state: pr.state,
            user_login: pr.user.login,
            user_avatar_url: pr.user.avatar_url,
            created_at: pr.created_at,
            repository: repo,
            html_url: pr.html_url,
          }, {
            onConflict: 'repository,number'
          });

          // Fetch and insert comments for each PR
          const comments = await octokit.paginate(octokit.rest.issues.listComments, {
            owner,
            repo: repoName,
            issue_number: pr.number,
            per_page: 100,
          });

          for (const comment of comments) {
            await supabase.from('comments').upsert({
              body: comment.body,
              user_login: comment.user.login,
              user_avatar_url: comment.user.avatar_url,
              created_at: comment.created_at,
              html_url: comment.html_url,
              repository: repo,
              pull_request_number: pr.number,
            }, {
              onConflict: 'repository,pull_request_number'
            });
          }
        }
      }
      toast.success('Successfully synced with GitHub');
      fetchActivity(); // Refresh the displayed data
    } catch (error) {
      console.error('Error syncing with GitHub:', error);
      toast.error('Failed to sync with GitHub');
    } finally {
      setIsSyncing(false);
    }
  };

  const fetchActivity = async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from(filters.type === 'comment' ? 'comments' : 'pull_requests')
        .select('*')
        .range((page - 1) * 20, page * 20 - 1);

      // Apply filters
      if (filters.repository) {
        query = query.eq('repository', filters.repository);
      }

      if (filters.status !== 'all' && filters.type !== 'comment') {
        query = query.eq('state', filters.status);
      }

      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate);
      }

      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate);
      }

      // Apply sorting
      const sortColumn = filters.sortBy === 'author' ? 'user_login' : 
                        filters.sortBy === 'repository' ? 'repository' : 'created_at';
      query = query.order(sortColumn, { ascending: filters.sortOrder === 'asc' });

      const { data, error: queryError } = await query;

      if (queryError) throw queryError;

      setItems(prev => (page === 1 ? data || [] : [...prev, ...(data || [])]));
      setHasMore(data?.length === 20);
    } catch (err) {
      setError('Failed to fetch activity data');
      console.error('Error fetching activity:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      setPage(prev => prev + 1);
    }
  };

  const handleFilterChange = (key: keyof ActivityFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Repository Activity</h1>
          <p className="mt-2 text-sm text-gray-500">
            View and filter activity across all repositories
          </p>
        </div>
        <button
          onClick={syncWithGitHub}
          disabled={isSyncing}
          className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50"
        >
          {isSyncing ? 'Syncing...' : 'Sync with GitHub'}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl">
        <div className="px-4 py-6 sm:p-8">
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
            <div>
              <label htmlFor="repository" className="block text-sm font-medium text-gray-700">
                Repository
              </label>
              <select
                id="repository"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                value={filters.repository || ''}
                onChange={(e) => handleFilterChange('repository', e.target.value || null)}
              >
                <option value="">All repositories</option>
                {repositories.map((repo) => (
                  <option key={repo} value={repo}>
                    {repo}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="type" className="block text-sm font-medium text-gray-700">
                Type
              </label>
              <select
                id="type"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                value={filters.type}
                onChange={(e) => handleFilterChange('type', e.target.value as ActivityFilters['type'])}
              >
                <option value="all">All</option>
                <option value="pr">Pull Requests</option>
                <option value="comment">Comments</option>
              </select>
            </div>

            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                Status
              </label>
              <select
                id="status"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value as ActivityFilters['status'])}
                disabled={filters.type === 'comment'}
              >
                <option value="all">All</option>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
                <option value="merged">Merged</option>
              </select>
            </div>

            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">
                Start Date
              </label>
              <input
                type="date"
                id="startDate"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">
                End Date
              </label>
              <input
                type="date"
                id="endDate"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Sort By</label>
              <Menu as="div" className="relative mt-1">
                <Menu.Button className="inline-flex w-full justify-between rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                  {filters.sortBy === 'date'
                    ? 'Date'
                    : filters.sortBy === 'repository'
                    ? 'Repository'
                    : 'Author'}
                  <ChevronDownIcon className="-mr-1 ml-2 h-5 w-5" aria-hidden="true" />
                </Menu.Button>
                <Menu.Items className="absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                  <div className="py-1">
                    {['date', 'repository', 'author'].map((sort) => (
                      <Menu.Item key={sort}>
                        {({ active }) => (
                          <button
                            onClick={() => handleFilterChange('sortBy', sort as ActivityFilters['sortBy'])}
                            className={clsx(
                              active ? 'bg-gray-100 text-gray-900' : 'text-gray-700',
                              'block w-full px-4 py-2 text-left text-sm'
                            )}
                          >
                            {sort.charAt(0).toUpperCase() + sort.slice(1)}
                          </button>
                        )}
                      </Menu.Item>
                    ))}
                  </div>
                </Menu.Items>
              </Menu>
            </div>
          </div>
        </div>
      </div>

      {/* Activity List */}
      <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl">
        <div className="px-4 py-6 sm:px-6 lg:px-8">
          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">{error}</h3>
                </div>
              </div>
            </div>
          )}

          <div className="flow-root">
            <ul role="list" className="-my-6 divide-y divide-gray-200">
              {items.map((item) => (
                <li key={item.id} className="py-6">
                  <div className="flex items-center space-x-4">
                    <img
                      className="h-10 w-10 rounded-full"
                      src={item.user_avatar_url}
                      alt={item.user_login}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {'title' in item ? item.title : item.body}
                      </p>
                      <p className="text-sm text-gray-500">
                        {item.repository} • {format(new Date(item.created_at), 'PPP')}
                      </p>
                    </div>
                    {'state' in item && (
                      <div
                        className={clsx(
                          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                          item.state === 'open'
                            ? 'bg-green-100 text-green-800'
                            : item.state === 'closed'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-purple-100 text-purple-800'
                        )}
                      >
                        {item.state}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="mt-6 text-center">
              <button
                onClick={loadMore}
                disabled={loading}
                className="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}