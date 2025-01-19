import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables if .env exists
if (fs.existsSync(path.join(__dirname, '.env'))) {
  dotenv.config();
}

/**
 * Validate GitHub token
 * @param {string} token - GitHub personal access token
 * @returns {boolean} - Whether token is valid
 */
const validateGitHubToken = (token) => {
  return typeof token === 'string' && token.length > 0;
};

/**
 * Validate repositories list
 * @param {string} repos - Comma-separated list of repositories
 * @returns {string[]} - Array of validated repository names
 */
const validateRepositories = (repos) => {
  if (!repos) return [];
  const repoList = repos.split(',').map(repo => repo.trim());
  return repoList.filter(repo => repo.length > 0);
};

/**
 * Default configuration values
 * These can be overridden by environment variables
 */
const defaults = {
  // GitHub Configuration
  github: {
    token: null, // Required, no default for security
    owner: 'meetsoci', // Required, no default
    repositories: ['soci', 'soci-services'], // Required, no default
    apiBaseUrl: 'https://api.github.com',
    perPage: 100, // Number of items per API request
    maxRetries: 3, // Maximum number of API retry attempts
  },

  // Analysis Configuration
  analysis: {
    categories: ['question', 'missed_functionality', 'nice_to_have', 'improvement', 'other'],
    defaultCategory: 'other',
    minCommentLength: 5, // Minimum length for a comment to be analyzed
    maxCommentLength: 5000, // Maximum length for a comment to be analyzed
    rateLimitDelay: 1000, // Delay between API requests in milliseconds
  },

  // Filter Configuration
  filters: {
    defaultDateRange: {
      startDate: '2025-01-10', // Default to all time
      endDate: '2025-01-31', // Default to present
    },
    defaultLabel: 'Team: Killer Bees',
    defaultUser: null,
    excludedUsers: ['dependabot[bot]', 'github-actions[bot]'],
  },

  // Progress Bar Configuration
  progress: {
    barCompleteChar: '=',
    barIncompleteChar: '-',
    hideCursor: true,
    format: 'Progress | {bar} | {percentage}% | {value}/{total} | ETA: {eta}s',
  },
};

/**
 * Environment-specific overrides
 */
const environments = {
  development: {
    analysis: {
      rateLimitDelay: 2000, // Increased delay for development
    },
    debug: true,
  },
  production: {
    analysis: {
      rateLimitDelay: 1000,
    },
    debug: false,
  },
};

/**
 * Build the final configuration by combining defaults, environment-specific settings,
 * and environment variables
 */
const buildConfig = () => {
  // Determine environment
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  // Start with default configuration
  let config = { ...defaults };
  
  // Apply environment-specific settings
  if (environments[nodeEnv]) {
    config = {
      ...config,
      ...environments[nodeEnv],
    };
  }

  // Override with environment variables
  config.github.token = process.env.GITHUB_TOKEN;
  config.github.owner = process.env.GITHUB_OWNER;
  config.github.repositories = validateRepositories(process.env.GITHUB_REPOS);

  // Validate critical values
  if (!validateGitHubToken(config.github.token)) {
    throw new Error('Invalid or missing GitHub token');
  }

  if (!config.github.owner) {
    throw new Error('GitHub owner is required');
  }

  if (config.github.repositories.length === 0) {
    throw new Error('At least one repository must be specified');
  }

  return Object.freeze(config);
};

// Export the frozen configuration object
export default buildConfig();