// Simple utility to access environment variables in the browser
// These are injected by Vite during build time

interface Env {
  GITHUB_TOKEN: string | undefined
  GITHUB_OWNER: string | undefined
  GITHUB_REPOS: string | undefined
  [key: string]: string | undefined
}

const env: Env = {
  GITHUB_TOKEN: import.meta.env.VITE_GITHUB_TOKEN,
  GITHUB_OWNER: import.meta.env.VITE_GITHUB_OWNER,
  GITHUB_REPOS: import.meta.env.VITE_GITHUB_REPOS,
}

export default env