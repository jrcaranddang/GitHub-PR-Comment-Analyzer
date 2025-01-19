import dotenv from '../utils/dotenv';

// Clean up repository strings and ensure they're valid
export const REPOSITORIES = (dotenv.GITHUB_REPOS || '')
  .split(',')
  .map(repo => repo.trim())
  .filter(Boolean); // Filter out empty strings

export const DEFAULT_FILTERS = {
  startDate: new Date().toISOString().split('T')[0],
  endDate: new Date().toISOString().split('T')[0],
  user: '',
  type: 'all',
  status: 'all',
  sortBy: 'date',
  sortOrder: 'desc',
} as const;

export const DEFAULT_OWNER = dotenv.GITHUB_OWNER || '';

// Get the first repository name without owner prefix
export const DEFAULT_REPO = REPOSITORIES[0]?.split('/').pop() || '';

export const ITEMS_PER_PAGE = 20;