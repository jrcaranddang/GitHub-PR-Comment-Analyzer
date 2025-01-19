# GitHub PR Comment Analyzer

This application analyzes GitHub pull request comments and categorizes them into different types using natural language processing.

## Categories

- Questions (e.g., "why", "how", "what")
- Missed Functionality (e.g., "missing", "not implemented")
- Nice-to-Have Features (e.g., "nice to have", "could add")
- Improvements (e.g., "improve", "better", "should")
- Other (default category)

## Setup

1. Create a GitHub Personal Access Token with repo access
2. Copy the `.env` file and add your token and repository details:
   ```
   GITHUB_TOKEN=your_github_token_here
   GITHUB_OWNER=organization_name
   GITHUB_REPOS=repo1,repo2,repo3
   ```
3. Install dependencies:
   ```
   npm install
   ```
4. Run the analyzer:
   ```
   npm start
   ```
   
   Or with date filtering:
   ```
   npm run analyze -- --start-date 2024-01-01 --end-date 2024-01-31
  ```

   Filter by user:
  ```
  npm run analyze -- --user octocat
  ```

  Filter by PR label:
  ```
  npm run analyze -- --label bug
   ```
   
   You can combine filters and use short options:
   ```
   npm run analyze -- -s 2024-01-01 -e 2024-01-31 -u octocat -l bug
   ```

## Output Format

The application returns both aggregate counts and percentage distribution in JSON format:
```json
{
    "dateRange": {
        "startDate": "2024-01-01",
        "endDate": "2024-01-31"
    },
    "filters": {
        "user": "octocat",
        "label": "bug"
    },
    "counts": {
        "question": X,
        "missed_functionality": Y,
        "nice_to_have": Z,
        "improvement": W,
        "other": V
    },
    "percentages": {
        "question": "X%",
        "missed_functionality": "Y%",
        "nice_to_have": "Z%",
        "improvement": "W%",
        "other": "V%"
    }
}
```