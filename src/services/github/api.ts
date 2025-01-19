import { Octokit } from '@octokit/rest';
import toast from 'react-hot-toast';
import dotenv from '../../utils/dotenv';
import { GitHubError, PRDetails } from './types';

// Initialize GitHub client with improved retry configuration
export const octokit = new Octokit({
  auth: dotenv.GITHUB_TOKEN,
  retry: {
    enabled: true,
    retries: 3,
  },
  throttle: {
    onRateLimit: (retryAfter: number, options: any) => {
      toast.error(`Rate limit exceeded. Retrying in ${retryAfter} seconds.`);
      return options.request.retryCount <= 3;
    },
    onSecondaryRateLimit: (retryAfter: number, options: any) => {
      toast.error(`Secondary rate limit hit. Retrying in ${retryAfter} seconds.`);
      return options.request.retryCount <= 3;
    },
  },
});

const parseRepoString = (repoString: string): { owner: string; repo: string } => {
  const defaultOwner = dotenv.GITHUB_OWNER;
  if (!defaultOwner) {
    throw new Error('GitHub owner is not configured in environment variables');
  }

  // Clean up the repository string and remove any date suffixes
  const cleanRepo = repoString.split('/').pop()?.split('-20')[0] || '';
  
  if (!cleanRepo) {
    throw new Error(`Invalid repository format: ${repoString}`);
  }

  return {
    owner: defaultOwner,
    repo: cleanRepo
  };
};

export const fetchPRsWithRetry = async (repoString: string, since: string): Promise<any[]> => {
  try {
    const { owner, repo } = parseRepoString(repoString);

    const prs = await octokit.paginate(octokit.rest.pulls.list, {
      owner,
      repo,
      state: 'all',
      per_page: 30,
      sort: 'created',
      direction: 'desc',
      since: new Date(since).toISOString(),
    });

    return prs;
  } catch (error: any) {
    const err = error as GitHubError;
    console.error(`Error fetching PRs for ${repoString}:`, err);
    
    if (err.status === 404) {
      throw new Error(`Repository ${repoString} not found`);
    } else if (err.status === 403) {
      throw new Error('API rate limit exceeded. Please try again later.');
    } else if (err.status === 401) {
      throw new Error('Invalid GitHub token. Please check your configuration.');
    } else if (err.status === 500) {
      throw new Error('GitHub API is experiencing issues. Please try again later.');
    }
    
    throw new Error(`Failed to fetch PRs: ${err.message}`);
  }
};

export const fetchPRDetails = async (repoString: string, prNumber: number): Promise<PRDetails> => {
  try {
    const { owner, repo } = parseRepoString(repoString);

    const [comments, reviews] = await Promise.all([
      octokit.rest.issues.listComments({
        owner,
        repo,
        issue_number: prNumber,
        per_page: 1,
      }),
      octokit.rest.pulls.listReviews({
        owner,
        repo,
        pull_number: prNumber,
        per_page: 1,
      }),
    ]);

    return {
      commentsCount: Number(comments.headers['x-total-count'] || comments.data.length),
      reviewsCount: Number(reviews.headers['x-total-count'] || reviews.data.length),
    };
  } catch (error) {
    console.error(`Error fetching details for PR #${prNumber}:`, error);
    return {
      commentsCount: 0,
      reviewsCount: 0,
    };
  }
};

export const fetchLabels = async (repoString: string) => {
  try {
    const { owner, repo } = parseRepoString(repoString);

    const { data } = await octokit.rest.issues.listLabelsForRepo({
      owner,
      repo,
      per_page: 100,
    });
    
    return data;
  } catch (error) {
    console.error('Error fetching labels:', error);
    throw new Error('Failed to fetch labels');
  }
};