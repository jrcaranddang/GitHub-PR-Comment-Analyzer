import { Octokit } from '@octokit/rest';
import toast from 'react-hot-toast';
import dotenv from '../utils/dotenv';

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

export const fetchPRsWithRetry = async (owner: string, repo: string, since: string): Promise<any[]> => {
  try {
    const prs = await octokit.paginate(
      'GET /repos/{owner}/{repo}/pulls',
      {
        owner,
        repo,
        state: 'all',
        per_page: 30,
        sort: 'created',
        direction: 'desc',
        since,
      },
      {
        request: {
          retries: 3,
          retryAfter: 5000,
        },
      }
    );

    return prs;
  } catch (error: any) {
    console.error(`Error fetching PRs for ${owner}/${repo}:`, error);
    
    if (error.status === 404) {
      throw new Error(`Repository ${owner}/${repo} not found`);
    } else if (error.status === 403) {
      throw new Error('API rate limit exceeded. Please try again later.');
    } else if (error.status === 401) {
      throw new Error('Invalid GitHub token. Please check your configuration.');
    } else if (error.status === 500) {
      throw new Error('GitHub API is experiencing issues. Please try again later.');
    }
    
    throw new Error(`Failed to fetch PRs: ${error.message}`);
  }
};

export const fetchPRDetails = async (owner: string, repo: string, prNumber: number) => {
  try {
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

export const fetchLabels = async (owner: string, repo: string) => {
  try {
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