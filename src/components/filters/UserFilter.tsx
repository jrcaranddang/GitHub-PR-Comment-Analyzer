import React from 'react';

interface UserFilterProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const UserFilter: React.FC<UserFilterProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  return (
    <div>
      <label htmlFor="user" className="block text-sm font-medium leading-6 text-gray-900">
        User
      </label>
      <div className="mt-2">
        <input
          type="text"
          name="user"
          id="user"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="GitHub username"
          disabled={disabled}
          className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>
    </div>
  );
};

export default UserFilter;