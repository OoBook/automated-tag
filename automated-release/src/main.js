const Core = require('@actions/core')
const Github = require('@actions/github')
const semver = require('semver');
const {parser, toConventionalChangelogFormat} = require('@conventional-commits/parser')

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
async function run() {
  try {
    const isTest = isTestStatus() // test input on the action.yml
    const tag = Core.getInput('tag') // test input on the action.yml
    const draft = Core.getInput('draft') === 'true';
    const prerelease = Core.getInput('prerelease') === 'true';

    // some needs
    const Context = getGhContext()
    const Payload = getGhPayload()
    const Token = getGhToken()
    const Octokit = getOctokit()

    const owner = getRepoOwner()
    const repo = getRepoName()
    
    const { data: tags } = await Octokit.rest.repos.listTags({
      owner,
      repo,
      per_page: 100
    })

    // Sort tags by semantic version
    // const sortedTags = tags
    const sortedTags = [{name:'v0.11.2'}, {name:'v0.10.8'}, {name:'v0.11.1'},{name:'v0.11.0'}, {name:'v0.10.7'}]
      .map(tag => tag.name)
      .filter(tag => semver.valid(tag))
      .sort((a, b) => semver.rcompare(a, b));
    
    const currentTagIndex = sortedTags.indexOf(tag);
    if (currentTagIndex === -1) {
      throw new Error(`Current tag ${tag} not found in the list of tags`);
    }

    const previousTag = sortedTags[currentTagIndex + 1];

    if (!previousTag) {
      console.log('No previous tag found. This is likely the first release.');
    }

    const { data: commits } = await Octokit.rest.repos.compareCommits({
      owner,
      repo,
      base: previousTag || '',
      head: tag,
    });


    // Parse and categorize commits
    const categories = {
      feat: [],
      fix: [],
      perf: [],
      refactor: [],
      docs: [],
      style: [],
      test: [],
      build: [],
      ci: [],
      chore: [],
    };
    const categoryTitles = {
      feat: ':rocket: Features',
      fix: ':wrench: Bug Fixes',
      perf: ':zap: Performance',
      refactor: ':recycle: Refactors',
      docs: ':memo: Documentation',
      style: 'Styling',
      test: ':white_check_mark: Testing',
      build: ':package: Build',
      ci: ':green_heart: Workflow',
      chore: ':beers: Other Stuff',
    };

    // console.log(commits.commits[0])
    commits.commits.forEach((commit) => {
      try {
        const parsedCommit = toConventionalChangelogFormat(parser(commit.commit.message))
  
        const type = parsedCommit.type
        const line = `${parsedCommit.subject} by @${commit.committer.login} in ${commit.html_url}`
        categories[type].push(line)
      } catch (error) {
        categories.chore.push(commit.commit.message);
      }

      // const match = commit.commit.message.match(/^(\w+)(\(.+\))?:(.*)$/);
      // if (match) {
      //   const type = match[1];
      //   if (categories.hasOwnProperty(type)) {
      //     categories[type].push(commit.commit.message);
      //   } else {
      //     categories.chore.push(commit.commit.message);
      //   }
      // } else {
      //   categories.chore.push(commit.commit.message);
      // }
    });

    // Generate release description
    // let releaseNotes = `## :bookmark: What's Changed\n\n`;
    let releaseNotes = ``;

    for (const [category, messages] of Object.entries(categories)) {
      if (messages.length > 0) {
        // releaseNotes += `### ${category.charAt(0).toUpperCase() + category.slice(1)}\n`;
        releaseNotes += `### ${categoryTitles[category]}\n`;
        messages.forEach((message) => {
          releaseNotes += `- ${message}\n`;
        });
        releaseNotes += '\n';
      }
    }
    if (isTest) {
      //code for testing locally or on prod
      Core.info('on testing')
      
      return
    }
    const release = await Octokit.rest.repos.createRelease({
      owner,
      repo,
      tag_name: tag,
      name: tag,
      body: releaseNotes,
      draft,
      prerelease,
    });

    Core.setOutput('release-id', release.data.id);
    Core.setOutput('release-url', release.data.html_url);

    Core.info('on production')

    // Put an output variable
    // Core.setOutput('response', 'some result')
  } catch (error) {
    // Fail the workflow run if an error occurs
    Core.setFailed(error.message)
  }
}

function isTestStatus() {
  return Core.getInput('test', { required: false }) === 'true'
}

function getRepoOwner() {
  return Github.context.repo.owner
}

function getRepoName() {
  return Github.context.repo.repo
}
function getGhContext() {
  return Github.context
}
function getGhPayload() {
  return Github.context.payload
}
function getCommitSha() {
  return Github.context.sha
}
function getGhToken() {
  return Core.getInput('gh_token')
}
function getOctokit() {
  return Github.getOctokit(getGhToken())
}

module.exports = {
  run
}
