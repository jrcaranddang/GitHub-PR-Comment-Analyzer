import dotenv from './utils/dotenv'

/**
 * Validate GitHub token
 * @param {string} token - GitHub personal access token
 * @returns {boolean} - Whether token is valid
 */
const validateGitHubToken = (token: string | undefined): boolean => {
  return typeof token === 'string' && token.length > 0
}

/**
 * Default configuration values
 * These can be overridden by environment variables
 */
const defaults = {
  // GitHub Configuration
  github: {
    token: null as string | null, // Required, no default for security
    owner: 'meetsoci', // Required, no default
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
}

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
}

/**
 * Build the final configuration by combining defaults, environment-specific settings,
 * and environment variables
 */
const buildConfig = () => {
  // Determine environment
  const nodeEnv = import.meta.env.MODE || 'development'
  
  // Start with default configuration
  let config = { ...defaults }
  
  // Apply environment-specific settings
  if (environments[nodeEnv as keyof typeof environments]) {
    config = {
      ...config,
      ...environments[nodeEnv as keyof typeof environments],
    }
  }

  // Override with environment variables
  config.github.token = dotenv.GITHUB_TOKEN
  config.github.owner = dotenv.GITHUB_OWNER || config.github.owner

  // Validate critical values
  if (!validateGitHubToken(config.github.token)) {
    throw new Error('Invalid or missing GitHub token')
  }

  if (!config.github.owner) {
    throw new Error('GitHub owner is required')
  }

  return Object.freeze(config)
}

// Export the frozen configuration object
export default buildConfig()