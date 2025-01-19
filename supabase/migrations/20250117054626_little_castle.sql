/*
  # Repository Activity Schema

  1. New Tables
    - `pull_requests`
      - `id` (uuid, primary key)
      - `number` (integer)
      - `title` (text)
      - `state` (text)
      - `user_login` (text)
      - `user_avatar_url` (text)
      - `created_at` (timestamptz)
      - `repository` (text)
      - `html_url` (text)
      
    - `comments`
      - `id` (uuid, primary key)
      - `body` (text)
      - `user_login` (text)
      - `user_avatar_url` (text)
      - `created_at` (timestamptz)
      - `html_url` (text)
      - `repository` (text)
      - `pull_request_number` (integer)
      - Foreign key to pull_requests(number)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to read data
*/

-- Create pull_requests table
CREATE TABLE IF NOT EXISTS pull_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number integer NOT NULL,
  title text NOT NULL,
  state text NOT NULL,
  user_login text NOT NULL,
  user_avatar_url text NOT NULL,
  created_at timestamptz NOT NULL,
  repository text NOT NULL,
  html_url text NOT NULL,
  UNIQUE(repository, number)
);

-- Create comments table
CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  body text NOT NULL,
  user_login text NOT NULL,
  user_avatar_url text NOT NULL,
  created_at timestamptz NOT NULL,
  html_url text NOT NULL,
  repository text NOT NULL,
  pull_request_number integer NOT NULL,
  FOREIGN KEY (repository, pull_request_number) 
    REFERENCES pull_requests(repository, number) 
    ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE pull_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow read access to pull_requests"
  ON pull_requests
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow read access to comments"
  ON comments
  FOR SELECT
  TO authenticated
  USING (true);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_pr_repository ON pull_requests(repository);
CREATE INDEX IF NOT EXISTS idx_pr_created_at ON pull_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_pr_state ON pull_requests(state);
CREATE INDEX IF NOT EXISTS idx_pr_user ON pull_requests(user_login);

CREATE INDEX IF NOT EXISTS idx_comments_repository ON comments(repository);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at);
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_login);
CREATE INDEX IF NOT EXISTS idx_comments_pr ON comments(repository, pull_request_number);