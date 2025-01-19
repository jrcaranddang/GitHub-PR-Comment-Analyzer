import { useState } from 'react';
import { octokit } from '../services/github';
import { supabase } from '../services/supabase';
import toast from 'react-hot-toast';
import dotenv from '../utils/dotenv';

export const useGitHubSync = () => {
  const [isSyncing, setIsSyncing] = useState(false);

  const syncWithGitHub = async () => {
    setIsSyncing(true);
    try {
      const repositories = (dotenv.GITHUB_REPOS || '')
        .split(',')
        .filter(Boolean)
        .map(repo => repo.trim());

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
    } catch (error) {
      console.error('Error syncing with GitHub:', error);
      toast.error('Failed to sync with GitHub');
    } finally {
      setIsSyncing(false);
    }
  };

  return { isSyncing, syncWithGitHub };
};