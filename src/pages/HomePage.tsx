import React, { useState } from 'react';
import { format } from 'date-fns';
import { Switch } from '@headlessui/react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { LabelDropdown } from '../components';
import { GitHubLabel } from '../types/github';
import { fetchPRsWithRetry, fetchPRDetails } from '../services/github';
import { supabase } from '../services/supabase';
import { REPOSITORIES } from '../constants';
import { ChatBubbleLeftIcon, TagIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import { Card, CardContent, CardFooter, CardHeader, Button } from '../components/common';
import dotenv from '../utils/dotenv';

interface PullRequest {
  number: number;
  title: string;
  selected: boolean;
  author: string;
  createdAt: string;
  status: 'open' | 'closed' | 'merged';
  commentsCount: number;
  reviewsCount: number;
  labels: GitHubLabel[];
  assignees: Array<{ login: string; avatar_url: string }>;
}

interface RepositoryPRs {
  [key: string]: PullRequest[];
}

interface Filters {
  startDate: string;
  endDate: string;
  user: string;
}

interface FetchError {
  repository: string;
  error: string;
}

const DEFAULT_FILTERS: Filters = {
  startDate: format(new Date(), 'yyyy-MM-dd'),
  endDate: format(new Date(), 'yyyy-MM-dd'),
  user: '',
};

const DEFAULT_OWNER = dotenv.GITHUB_OWNER || 'meetsoci';
const DEFAULT_REPO = REPOSITORIES[0]?.split('/')[1] || 'soci';

const HomePage: React.FC = () => {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [selectedLabels, setSelectedLabels] = useState<GitHubLabel[]>([]);
  const [pullRequests, setPullRequests] = useState<RepositoryPRs | null>(null);
  const [selectedPRs, setSelectedPRs] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [errors, setErrors] = useState<FetchError[]>([]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const fetchPRs = async () => {
    setLoading(true);
    setErrors([]);
    setPullRequests(null);
    const newPRs: RepositoryPRs = {};

    try {
      for (const repoString of REPOSITORIES) {
        try {
          const prs = await fetchPRsWithRetry(repoString, filters.startDate);

          // Filter by labels if any are selected
          const filteredPRs = prs.filter(pr => {
            if (selectedLabels.length === 0) return true;
            return pr.labels?.some(prLabel => 
              selectedLabels.some(selectedLabel => selectedLabel.id === prLabel.id)
            ) ?? false;
          });

          // Filter by user if specified
          const userFilteredPRs = filters.user
            ? filteredPRs.filter(pr => pr.user?.login?.toLowerCase() === filters.user.toLowerCase())
            : filteredPRs;

          // Filter by date range
          const dateFilteredPRs = userFilteredPRs.filter(pr => {
            const prDate = new Date(pr.created_at);
            const startDate = new Date(filters.startDate);
            const endDate = new Date(filters.endDate);
            return prDate >= startDate && prDate <= endDate;
          });

          // Process PRs in batches to avoid overwhelming the API
          const batchSize = 5;
          const enrichedPRs = [];
          
          for (let i = 0; i < dateFilteredPRs.length; i += batchSize) {
            const batch = dateFilteredPRs.slice(i, i + batchSize);
            const batchResults = await Promise.all(
              batch.map(async (pr) => {
                if (!pr.user) return null;

                const details = await fetchPRDetails(repoString, pr.number);

                try {
                  // Store in database
                  await supabase.from('pull_requests').upsert({
                    number: pr.number,
                    title: pr.title,
                    state: pr.state,
                    user_login: pr.user.login,
                    user_avatar_url: pr.user.avatar_url,
                    created_at: pr.created_at,
                    repository: repoString,
                    html_url: pr.html_url,
                  }, {
                    onConflict: 'repository,number'
                  });
                } catch (dbError) {
                  console.error('Error storing PR in database:', dbError);
                  // Continue processing even if database storage fails
                }

                return {
                  number: pr.number,
                  title: pr.title,
                  selected: true,
                  author: pr.user.login,
                  createdAt: pr.created_at,
                  status: pr.merged_at ? 'merged' : pr.state as 'open' | 'closed',
                  commentsCount: details.commentsCount,
                  reviewsCount: details.reviewsCount,
                  labels: pr.labels || [],
                  assignees: pr.assignees || [],
                };
              })
            );

            enrichedPRs.push(...batchResults.filter((pr): pr is PullRequest => pr !== null));

            // Add a small delay between batches to avoid rate limiting
            if (i + batchSize < dateFilteredPRs.length) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }

          if (enrichedPRs.length > 0) {
            newPRs[repoString] = enrichedPRs;
          }

        } catch (error: any) {
          console.error(`Error fetching PRs for ${repoString}:`, error);
          setErrors(prev => [...prev, {
            repository: repoString,
            error: error.message || 'Failed to fetch pull requests',
          }]);
          continue;
        }
      }

      if (Object.keys(newPRs).length > 0) {
        setPullRequests(newPRs);
        
        // Select all PRs by default
        const allPRNumbers = Object.values(newPRs)
          .flat()
          .map(pr => pr.number);
        setSelectedPRs(new Set(allPRNumbers));
        
        toast.success('Successfully fetched pull requests');
      } else if (errors.length === 0) {
        toast.error('No pull requests found for the given criteria');
      }
    } catch (error: any) {
      console.error('Error fetching pull requests:', error);
      toast.error(error.message || 'Failed to fetch pull requests');
    } finally {
      setLoading(false);
    }
  };

  const togglePR = (number: number) => {
    setSelectedPRs(prev => {
      const next = new Set(prev);
      if (next.has(number)) {
        next.delete(number);
      } else {
        next.add(number);
      }
      return next;
    });
  };

  const startAnalysis = async () => {
    if (selectedPRs.size === 0) {
      toast.error('Please select at least one PR to analyze');
      return;
    }
    setAnalyzing(true);
    try {
      // Implement your analysis logic here
      await new Promise(r => setTimeout(r, 2000));
      toast.success('Analysis completed successfully!');
    } catch (error: any) {
      console.error('Analysis failed:', error);
      toast.error(error.message || 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
            GitHub PR Comment Analyzer
          </h2>
          <div className="mt-1 flex flex-col sm:mt-0 sm:flex-row sm:flex-wrap sm:space-x-6">
            <div className="mt-2 flex items-center text-sm text-gray-500">
              <UserCircleIcon className="mr-1.5 h-5 w-5 flex-shrink-0 text-gray-400" />
              Organization: {DEFAULT_OWNER}
            </div>
            <div className="mt-2 flex items-center text-sm text-gray-500">
              <TagIcon className="mr-1.5 h-5 w-5 flex-shrink-0 text-gray-400" />
              Repositories: {REPOSITORIES.join(', ')}
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card className="mt-8">
        <CardContent>
          <div className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
            <div className="sm:col-span-3">
              <label htmlFor="startDate" className="block text-sm font-medium leading-6 text-gray-900">
                Start Date
              </label>
              <div className="mt-2">
                <input
                  type="date"
                  name="startDate"
                  id="startDate"
                  value={filters.startDate}
                  onChange={handleFilterChange}
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                />
              </div>
            </div>

            <div className="sm:col-span-3">
              <label htmlFor="endDate" className="block text-sm font-medium leading-6 text-gray-900">
                End Date
              </label>
              <div className="mt-2">
                <input
                  type="date"
                  name="endDate"
                  id="endDate"
                  value={filters.endDate}
                  onChange={handleFilterChange}
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                />
              </div>
            </div>

            <div className="sm:col-span-3">
              <label htmlFor="labels" className="block text-sm font-medium leading-6 text-gray-900">
                Labels
              </label>
              <div className="mt-2">
                <LabelDropdown
                  owner={DEFAULT_OWNER}
                  repo={DEFAULT_REPO}
                  selectedLabels={selectedLabels}
                  onLabelsChange={setSelectedLabels}
                  placeholder="Select labels..."
                />
              </div>
            </div>

            <div className="sm:col-span-3">
              <label htmlFor="user" className="block text-sm font-medium leading-6 text-gray-900">
                User
              </label>
              <div className="mt-2">
                <input
                  type="text"
                  name="user"
                  id="user"
                  value={filters.user}
                  onChange={handleFilterChange}
                  placeholder="GitHub username"
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                />
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            onClick={fetchPRs}
            disabled={loading}
            isLoading={loading}
          >
            {loading ? 'Fetching...' : 'Fetch Pull Requests'}
          </Button>
        </CardFooter>
      </Card>

      {/* Error Messages */}
      {errors.length > 0 && (
        <div className="mt-4">
          {errors.map((error, index) => (
            <div key={index} className="mb-2 rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Error in {error.repository}: {error.error}
                  </h3>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pull Requests List */}
      {pullRequests && (
        <Card className="mt-8">
          <CardContent>
            <h3 className="text-base font-semibold leading-7 text-gray-900">
              Pull Requests to Analyze
            </h3>
            <div className="mt-4 divide-y divide-gray-100">
              {Object.entries(pullRequests).map(([repo, prs]) => (
                <div key={repo} className="py-4">
                  <h4 className="text-sm font-medium text-gray-900">{repo}</h4>
                  <ul className="mt-2 space-y-2">
                    {prs.map((pr) => (
                      <li key={pr.number} className="flex items-center gap-x-3">
                        <Switch
                          checked={selectedPRs.has(pr.number)}
                          onChange={() => togglePR(pr.number)}
                          className={clsx(
                            selectedPRs.has(pr.number) ? 'bg-blue-600' : 'bg-gray-200',
                            'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2'
                          )}
                        >
                          <span
                            className={clsx(
                              selectedPRs.has(pr.number) ? 'translate-x-5' : 'translate-x-0',
                              'pointer-events-none relative inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                            )}
                          />
                        </Switch>
                        <div className="flex flex-col">
                          <span className="text-sm text-gray-900">
                            #{pr.number} - {pr.title}
                          </span>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <UserCircleIcon className="h-4 w-4" />
                              {pr.author}
                            </span>
                            <span className="flex items-center gap-1">
                              <ChatBubbleLeftIcon className="h-4 w-4" />
                              {pr.commentsCount}
                            </span>
                            {pr.labels.length > 0 && (
                              <span className="flex items-center gap-1">
                                <TagIcon className="h-4 w-4" />
                                {pr.labels.length}
                              </span>
                            )}
                            <span
                              className={clsx(
                                'px-2 py-0.5 rounded-full text-xs font-medium',
                                pr.status === 'open' ? 'bg-green-100 text-green-800' :
                                pr.status === 'merged' ? 'bg-purple-100 text-purple-800' :
                                'bg-red-100 text-red-800'
                              )}
                            >
                              {pr.status}
                            </span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter>
            <Button
              onClick={startAnalysis}
              disabled={analyzing || selectedPRs.size === 0}
              isLoading={analyzing}
            >
              {analyzing ? 'Analyzing...' : 'Start Analysis'}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
};

export default HomePage;