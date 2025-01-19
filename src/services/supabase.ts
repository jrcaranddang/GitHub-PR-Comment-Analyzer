import { createClient } from '@supabase/supabase-js';
import { PullRequest, Comment } from '../types/github';

// Initialize Supabase client
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);

export const storePullRequest = async (pr: PullRequest) => {
  try {
    await supabase.from('pull_requests').upsert({
      number: pr.number,
      title: pr.title,
      state: pr.state,
      user_login: pr.user_login,
      user_avatar_url: pr.user_avatar_url,
      created_at: pr.created_at,
      repository: pr.repository,
      html_url: pr.html_url,
    }, {
      onConflict: 'repository,number'
    });
  } catch (error) {
    console.error('Error storing PR in database:', error);
    throw error;
  }
};

export const storeComment = async (comment: Comment) => {
  try {
    await supabase.from('comments').upsert({
      body: comment.body,
      user_login: comment.user_login,
      user_avatar_url: comment.user_avatar_url,
      created_at: comment.created_at,
      html_url: comment.html_url,
      repository: comment.repository,
      pull_request_number: comment.pull_request_number,
    }, {
      onConflict: 'repository,pull_request_number'
    });
  } catch (error) {
    console.error('Error storing comment in database:', error);
    throw error;
  }
};

export const fetchActivity = async (filters: any, page: number) => {
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

  const { data, error } = await query;

  if (error) throw error;
  return data;
};