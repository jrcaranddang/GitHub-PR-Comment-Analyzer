import { Octokit } from '@octokit/rest';
import natural from 'natural';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import readline from 'readline';
import cliProgress from 'cli-progress';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import config from './config.js';
import db from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Promisify readline question
const question = (query) => new Promise((resolve) => rl.question(query, resolve));

// Fetch available labels for a repository
async function fetchLabels(owner, repo) {
  try {
    const { data: labels } = await octokit.rest.issues.listLabelsForRepo({
      owner,
      repo,
      per_page: 100
    });
    return labels.map(label => label.name);
  } catch (error) {
    console.error(`Error fetching labels for ${owner}/${repo}:`, error.message);
    return [];
  }
}

// Get unique labels across all repositories
async function getAllLabels() {
  const owner = config.github.owner;
  const repos = config.github.repositories;
  const allLabels = new Set();

  for (const repo of repos) {
    const labels = await fetchLabels(owner, repo);
    labels.forEach(label => allLabels.add(label));
  }

  return Array.from(allLabels).sort();
}

// Interactive filter selection
async function getFilters() {
  console.log('\nFetching available labels...');
  const labels = await getAllLabels();
  
  console.log('\nAvailable Labels:');
  labels.forEach((label, index) => {
    console.log(`${index + 1}. ${label}${label === config.filters.defaultLabel ? ' (default)' : ''}`);
  });

  const labelResponse = await question(`\nSelect a label (1-${labels.length}, or press Enter for default '${config.filters.defaultLabel}'): `);
  const selectedLabel = labelResponse ? labels[parseInt(labelResponse) - 1] || config.filters.defaultLabel : config.filters.defaultLabel;

  const userResponse = await question(`\nEnter GitHub username to filter by (press Enter for no user filter): `);
  const selectedUser = userResponse || config.filters.defaultUser;

  const startDateResponse = await question(`\nEnter start date (YYYY-MM-DD, press Enter for default '${config.filters.defaultDateRange.startDate}'): `);
  const startDate = startDateResponse || config.filters.defaultDateRange.startDate;

  const endDateResponse = await question(`\nEnter end date (YYYY-MM-DD, press Enter for default '${config.filters.defaultDateRange.endDate}'): `);
  const endDate = endDateResponse || config.filters.defaultDateRange.endDate;

  return {
    label: selectedLabel,
    user: selectedUser,
    startDate: new Date(startDate),
    endDate: new Date(endDate)
  };
}

const tokenizer = new natural.WordTokenizer();
const classifier = new natural.BayesClassifier();

// Initialize GitHub client
const octokit = new Octokit({
  auth: config.github.token,
  baseUrl: config.github.apiBaseUrl
});

// Train the classifier with example phrases
function trainClassifier() {
  // Questions
  classifier.addDocument('why did you do this', 'question');
  classifier.addDocument('how does this work', 'question');
  classifier.addDocument('what is the purpose', 'question');
  
  // Missed Functionality
  classifier.addDocument('this is missing', 'missed_functionality');
  classifier.addDocument('not implemented yet', 'missed_functionality');
  classifier.addDocument('functionality is missing', 'missed_functionality');
  
  // Nice-to-Have
  classifier.addDocument('would be nice to have', 'nice_to_have');
  classifier.addDocument('could add this feature', 'nice_to_have');
  classifier.addDocument('might be good to include', 'nice_to_have');
  
  // Improvements
  classifier.addDocument('this could be improved', 'improvement');
  classifier.addDocument('should be better', 'improvement');
  classifier.addDocument('needs enhancement', 'improvement');
  
  classifier.train();
}

// Categorize a single comment
function categorizeComment(comment) {
  if (!comment) return 'other';
  
  const tokens = tokenizer.tokenize(comment.toLowerCase());
  
  // Check for question words
  if (tokens.some(token => ['why', 'how', 'what', 'when', 'where', 'who'].includes(token))) {
    return 'question';
  }
  
  return classifier.classify(comment) || 'other';
}

// Fetch pull requests for a repository
async function fetchPullRequests(owner, repo, label) {
  const pullRequests = [];
  let page = 1;
  
  while (true) {
    const { data: batch } = await octokit.rest.pulls.list({
      owner,
      repo,
      state: 'all',
      per_page: config.github.perPage,
      page: page
    });

    if (batch.length === 0) break;

    // Filter PRs by label if specified
    const filteredBatch = label 
      ? batch.filter(pr => pr.labels.some(l => l.name === label))
      : batch;

    pullRequests.push(...filteredBatch);
    page++;

    // Basic rate limit handling
    await new Promise(resolve => setTimeout(resolve, config.analysis.rateLimitDelay));
  }

  return pullRequests;
}

// Display pull requests and get confirmation
async function displayAndConfirmPRs(owner, repos, label) {
  console.log('\nFetching pull requests...');
  
  let totalPRs = 0;
  const prsByRepo = {};

  for (const repo of repos) {
    const prs = await fetchPullRequests(owner, repo, label);
    prsByRepo[repo] = prs;
    totalPRs += prs.length;
  }

  console.log('\nPull Requests to be analyzed:');
  console.log('=============================');
  
  for (const [repo, prs] of Object.entries(prsByRepo)) {
    console.log(`\n${repo} (${prs.length} PRs):`);
    prs.forEach(pr => {
      console.log(`  #${pr.number}: ${pr.title.substring(0, 60)}${pr.title.length > 60 ? '...' : ''}`);
    });
  }

  console.log(`\nTotal PRs to analyze: ${totalPRs}`);
  
  const answer = await question('\nDo you want to proceed with the analysis? (y/N): ');
  return answer.toLowerCase() === 'y';
}

// Fetch and analyze PR comments
async function analyzePRComments(owner, repo, startDate, endDate, user, label) {
  // Check cache first
  const cachedComments = await db.getCachedComments(repo, startDate, endDate, user, label);
  
  if (cachedComments.length > 0) {
    console.log(`Found ${cachedComments.length} cached comments for ${repo}`);
    
    // Aggregate cached results
    const results = {
      question: 0,
      missed_functionality: 0,
      nice_to_have: 0,
      improvement: 0,
      other: 0
    };
    
    cachedComments.forEach(comment => {
      results[comment.category]++;
    });
    
    return results;
  }

  const progressBar = new cliProgress.SingleBar({
    ...config.progress,
    format: config.progress.format.replace('Progress', `Analyzing ${repo}`)
  });

  const results = {
    question: 0,
    missed_functionality: 0,
    nice_to_have: 0,
    improvement: 0,
    other: 0
  };
  
  try {
    const pullRequests = await fetchPullRequests(owner, repo, label);
    const totalPRs = pullRequests.length;
    let processedPRs = 0;
    
    // Initialize progress bar
    progressBar.start(totalPRs, 0);

    // Process each PR
    for (const pr of pullRequests) {
      // Get comments for this PR
      const { data: comments } = await octokit.rest.issues.listComments({
        owner,
        repo,
        issue_number: pr.number,
        per_page: 100
      });

      // Process comments
      comments.forEach(comment => {
        // Skip if user filter is set and doesn't match
        if ((user && comment.user.login !== user) || 
            config.filters.excludedUsers.includes(comment.user.login)) return;

        // Skip comments that are too short or too long
        if (comment.body.length < config.analysis.minCommentLength ||
            comment.body.length > config.analysis.maxCommentLength) return;

        const commentDate = new Date(comment.created_at);
        // Skip comments outside date range
        if (startDate && commentDate < startDate) return;
        if (endDate && commentDate > endDate) return;

        const category = categorizeComment(comment.body);
        // Cache the categorized comment
        db.cacheComment(repo, pr, comment, category);
        results[category]++;
      });

      processedPRs++;
      progressBar.update(processedPRs);

      // Basic rate limit handling
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    progressBar.stop();
    console.log(`\nProcessed ${processedPRs} PRs in ${owner}/${repo}`);
    console.log(`Analysis Results for ${owner}/${repo}:`, results);
    return results;

  } catch (error) {
    progressBar.stop();
    console.error(`Error analyzing PRs for ${owner}/${repo}:`, error.message);
    throw error;
  }
}

// Analyze multiple repositories
async function analyzeMultipleRepos(startDate, endDate, user, label) {
  const owner = config.github.owner;
  const repos = config.github.repositories;
  
  // Display PRs and get confirmation
  const shouldProceed = await displayAndConfirmPRs(owner, repos, label);
  
  if (!shouldProceed) {
    console.log('\nAnalysis cancelled by user.');
    rl.close();
    return null;
  }
  
  // Save analysis run
  const runId = await db.saveAnalysisRun({ startDate, endDate, user, label });
  
  const aggregateResults = {
    question: 0,
    missed_functionality: 0,
    nice_to_have: 0,
    improvement: 0,
    other: 0
  };

  try {
    // Initialize the classifier once
    trainClassifier();
    
    const totalRepos = repos.length;
    let completedRepos = 0;

    console.log(`\nStarting analysis of ${totalRepos} repositories for ${owner}...`);
    console.log('Date range:', startDate ? startDate.toISOString().split('T')[0] : 'All time', 
                'to', endDate ? endDate.toISOString().split('T')[0] : 'Present');
    if (user) console.log('Filtering by user:', user);
    if (label) console.log('Filtering by label:', label);
    console.log('-------------------------------------------');
    
    for (const repo of repos) {
      try {
        const repoResults = await analyzePRComments(owner, repo, startDate, endDate, user, label);
        completedRepos++;
        
        // Save repository results
        await db.saveResults(runId, repo, repoResults);
        
        console.log(`\nProgress: ${completedRepos}/${totalRepos} repositories completed (${Math.round(completedRepos/totalRepos * 100)}%)`);
        console.log('-------------------------------------------');
        
        // Aggregate results
        Object.keys(repoResults).forEach(category => {
          aggregateResults[category] += repoResults[category];
        });
        
      } catch (error) {
        console.error(`Failed to analyze ${repo}:`, error.message);
        // Continue with next repo even if one fails
        continue;
      }
    }
    
    console.log('\nAggregate Results:', aggregateResults);
    
    // Calculate percentages safely
    let percentages = {};
    const total = Object.values(aggregateResults).reduce((sum, count) => sum + count, 0);
    if (total > 0) {
      Object.entries(aggregateResults).forEach(([category, count]) => {
        percentages[category] = `${((count / total) * 100).toFixed(1)}%`;
      });
    } else {
      Object.keys(aggregateResults).forEach(category => {
        percentages[category] = '0.0%';
      });
    }
    
    console.log('\nCategory Distribution:', percentages);
    
    console.log('\nAnalysis Summary:');
    console.log('- Total repositories processed:', completedRepos);
    console.log('- Total comments analyzed:', Object.values(aggregateResults).reduce((a, b) => a + b, 0));
    const dateInfo = {};
    dateInfo.startDate = startDate ? startDate.toISOString().split('T')[0] : 'All time';
    dateInfo.endDate = endDate ? endDate.toISOString().split('T')[0] : 'Present';
    console.log('- Time period:', dateInfo.startDate, 'to', dateInfo.endDate);
    if (user) console.log('- Filtered by user:', user);
    if (label) console.log('- Filtered by label:', label);
    
    // Show recent analysis history
    console.log('\nRecent Analysis History:');
    const history = await db.getAnalysisHistory(5);
    history.forEach(run => {
      console.log(`- ${new Date(run.timestamp).toLocaleString()}`);
      console.log(`  Filters: ${run.label || 'no label'}, ${run.user || 'no user'}`);
      console.log(`  Period: ${run.start_date.split('T')[0]} to ${run.end_date.split('T')[0]}`);
      console.log(`  Total Comments: ${run.total_comments}`);
    });
    
    return {
      dateRange: dateInfo,
      counts: aggregateResults,
      percentages,
      filters: {
        user: user || null,
        label: label || null
      }
    };
    
  } catch (error) {
    console.error('Analysis failed:', error);
    throw error;
  }
}

// Run the analysis
async function main() {
  try {
    const { startDate, endDate, user, label } = await getFilters();
    
    // Validate dates
    if (isNaN(startDate.getTime())) {
      throw new Error('Invalid start date. Please use YYYY-MM-DD format.');
    }
    if (isNaN(endDate.getTime())) {
      throw new Error('Invalid end date. Please use YYYY-MM-DD format.');
    }
    if (startDate > endDate) {
      throw new Error('Start date must be before end date.');
    }

    const results = await analyzeMultipleRepos(startDate, endDate, user, label);
    if (results) {
      console.log('\nAnalysis Complete!');
    }
    rl.close();
  } catch (error) {
    console.error('Analysis failed:', error);
    db.close();
    process.exit(1);
  }
}

// Wrap the execution in an async IIFE
(async () => {
  try {
    await main();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
})();