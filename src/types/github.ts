import { ReactNode } from 'react';

export interface GitHubLabel {
  id: number;
  node_id: string;
  url: string;
  name: string;
  description: string | null;
  color: string;
  default: boolean;
}

export interface LabelDropdownProps {
  owner: string;
  repo: string;
  selectedLabels: GitHubLabel[];
  onLabelsChange: (labels: GitHubLabel[]) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

export interface PullRequest {
  id: string;
  number: number;
  title: string;
  state: 'open' | 'closed' | 'merged';
  user_login: string;
  user_avatar_url: string;
  created_at: string;
  repository: string;
  html_url: string;
}

export interface Comment {
  id: string;
  body: string;
  user_login: string;
  user_avatar_url: string;
  created_at: string;
  html_url: string;
  repository: string;
  pull_request_number: number;
}

export interface ActivityFilters {
  repository: string | null;
  type: 'all' | 'pr' | 'comment';
  startDate: string;
  endDate: string;
  status: 'all' | 'open' | 'closed' | 'merged';
  sortBy: 'date' | 'repository' | 'author';
  sortOrder: 'asc' | 'desc';
}

export interface LayoutProps {
  children: ReactNode;
}