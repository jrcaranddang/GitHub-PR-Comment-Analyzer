export interface GitHubError extends Error {
  status?: number;
  response?: {
    status: number;
    data: any;
  };
}

export interface PRDetails {
  commentsCount: number;
  reviewsCount: number;
}

export interface GitHubConfig {
  owner: string;
  token: string;
  repositories: string[];
  apiBaseUrl: string;
}