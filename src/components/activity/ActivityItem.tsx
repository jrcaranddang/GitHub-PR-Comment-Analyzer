import React from 'react';
import { PullRequest, Comment } from '../../types/github';
import clsx from 'clsx';

interface ActivityItemProps {
  item: PullRequest | Comment;
}

const ActivityItem: React.FC<ActivityItemProps> = ({ item }) => {
  const isPR = 'state' in item;

  return (
    <li className="py-6">
      <div className="flex items-center space-x-4">
        <img
          className="h-10 w-10 rounded-full"
          src={item.user_avatar_url}
          alt={item.user_login}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-900">
            {isPR ? item.title : item.body}
          </p>
          <p className="text-sm text-gray-500">
            {item.repository} • {new Date(item.created_at).toLocaleDateString()}
          </p>
        </div>
        {isPR && (
          <div
            className={clsx(
              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
              item.state === 'open'
                ? 'bg-green-100 text-green-800'
                : item.state === 'closed'
                ? 'bg-red-100 text-red-800'
                : 'bg-purple-100 text-purple-800'
            )}
          >
            {item.state}
          </div>
        )}
      </div>
    </li>
  );
};

export default ActivityItem;