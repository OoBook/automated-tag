const core = require("@actions/core");
const github = require("@actions/github");
const semver = require('semver')

async function test() {
  const owner = core.getInput("owner", { required: true });
  const repo = core.getInput("repo", { required: true });
  const pr_number = core.getInput("pr-number", { required: true });
  const token = core.getInput("token", { required: true });
  const isTest = core.getInput("test", { required: false });

  // const octokit = new github.GitHub(github.context.repo.token);
  const octokit = new github.getOctokit(token);

  const { data: changedFiles } = await octokit.rest.pulls.listFiles({
    owner,
    repo,
    pull_number: pr_number,
  });

  let diffData = {
    addition: 0,
    deletions: 0,
    changes: 0,
  };

  diffData = changedFiles.reduce((acc, file) => {
    acc.additions += file.additions;
    acc.deletions += file.deletions;
    acc.changes += file.changes;

    return acc;
  }, diffData);

  const body = `
      Pull request #${pr_number} has be updated with \n
      - ${diffData.changes} changes \n
      - ${diffData.additions} additions \n
      - ${diffData.deletions} deletions \n
  `;
  if (!isTest) {
    await octokit.rest.issues.createcomment({
      owner,
      repo,
      issue_number: pr_number,
      body,
    });

    for (const file of changedFiles) {
      const fileExtension = file.filename.split(".").pop();
      let label = "";
      switch (fileExtension) {
        case "md":
          label = "markdown";

          break;
        case "php":
          label = "laravel";

          break;
        default:
          label = "no extension";
          break;
      }

      await octokit.rest.issues.addLabel({
        owner,
        repo,
        issue_number: pr_number,
        labels: [label],
      });
    }
  } else {
    console.log(body);
  }
}

/**
 * This file is the actual logic of the action
 * @returns {Promise<void>} Resolves when the action is complete
 */
async function run() {
  try {
    // Get the event payload
    let { context } = github;
    let { payload } = context;

    const owner = context.repo.owner;
    const repo = context.repo.repo;
    const isTest = core.getInput("test", { required: false }) === "true";
    const pr_number = core.getInput("pr_number");
    const token = core.getInput("gh_token", { required: true });
    const commitSha = core.getInput("commit_sha") || context.sha;
    let tag = core.getInput("tag") || ''
    // let prerelease = core.getInput("prerelease") || false
    let initialVersion = semver.valid(core.getInput("initial_tag")) || '0.0.0'
    let prerelease = typeof core.getInput("prerelease") === 'string' 
      ? (core.getInput("prerelease") === 'true' 
        ? 'alpha' 
        : core.getInput('prerelease') == 'false' ? false : core.getInput("prerelease"))
      : (core.getInput("prerelease") ? 'alpha' : false)

    const octokit = github.getOctokit(token);

    if(isTest){
      context = {
        ...context,
        ...pushContext({
          // ref: 'refs/heads/v1.2.0',
          // ref: 'refs/heads/release/v1.2.0',
          // ref: 'refs/heads/release/v1.2.0',
          sha: commitSha
        })
      }

      payload = {
        ...payload,
        ...context.payload
      }

    }

    let commits = [];

    if (context.eventName !== "push" && context.eventName !== "workflow_dispatch" && !isTest) {
      core.setFailed(`Unsupported event: ${context.eventName}`);
    }

    if(context.eventName === "workflow_dispatch"){
      console.log('context', context)
    }

    if (context.eventName === "push") {
      // For push events, commits are directly available in the payload
      commits = payload.commits;
    } else if (context.eventName === "pull_request") {
      // For pull request events, we need to fetch the commits
      const { data: pullRequestCommits } = await octokit.rest.pulls.listCommits(
        {
          ...context.repo,
          pull_number: pr_number ?? payload.pull_request.number,
        },
      );
      commits = pullRequestCommits;
    } else if(context.eventName !== "workflow_dispatch") {
      core.setFailed(`Unsupported event: ${context.eventName}`);
      return;
    }

    // Check if we're on a version branch 
    const versionBranchMatches = context.ref.match(/refs\/heads\/(v.*)/)?.filter(tag => semver.valid(tag))
    // Check if we're on a release branch
    const releaseMatches = context.ref.match(/refs\/heads\/release\/(v.*)/)?.filter(tag => semver.valid(tag))
    
    // Fetch all tags
    const { data: tags } = await octokit.rest.repos.listTags({
      owner,
      repo,
      per_page: 100, // Adjust as needed
    });

    const validTags = tags
      .map(t => t.name)
      .filter(name => semver.valid(name));

    const lastPrereleaseVersion = semver.valid(validTags.length > 0 ? validTags.sort(semver.rcompare)[0] : null);
    const lastVersion = semver.valid(semver.maxSatisfying(validTags, '*') || null)
    
    // If we're on a release branch, use the tag from the release branch
    if(releaseMatches && releaseMatches.length > 0){
      tag = releaseMatches[0]

    } else if(tag === ''){

      const major_pattern = /BREAKING CHANGE:/;
      const minor_pattern = /^feat(\(\w+\))?:/;
  
      let isMajor = false;
      let isMinor = false;
  
      for (const commit of commits) {
        const message =
          context.eventName === "push" ? commit.message : commit.commit.message;
        if (message.match(major_pattern)) {
          isMajor = true;
          return;
        } else if (message.match(minor_pattern)) {
          isMinor = true;
        }
      }
  
      // core.info(`Owner: ${owner}`);
      // core.info(`Repo: ${repo}`);
  
      let releaseType = isMajor ? 'major' : isMinor ? 'minor' : 'patch';
      let prereleaseType = null

      if(prerelease){
        releaseType = 'prerelease',
        prereleaseType = prerelease
      }

      let currentVersion = versionBranchMatches 
        && versionBranchMatches.length > 0 
        && semver.valid(versionBranchMatches[0]) // 1.0.0 or null
      
      // let currentVersion = null
      let newVersion = null

      if(!currentVersion && github.context.ref === 'refs/heads/main'){
  
        // Try to find existing tags pointing to the current commit
        const { data: matchingRefs } = await octokit.rest.git.listMatchingRefs({
          owner,
          repo,
          ref: 'tags/'
        });
  
        const currentTags = matchingRefs
          .filter(ref => ref.object.sha === commitSha && semver.valid(ref.ref.replace('refs/tags/', '')))
          .map(ref => ref.ref.replace('refs/tags/', ''));
  
        if (currentTags.length > 0) {
          // Use the highest semver if multiple tags exist
          currentVersion = semver.valid(currentTags.sort(semver.rcompare)[0]);
        } else {
          // Fallback to most recent tag if no tag exists for current commit
          currentVersion = prerelease ? lastPrereleaseVersion : lastVersion;
        }        
      }

      if(currentVersion){
        const prereleaseParts = semver.prerelease(currentVersion)
  
        if(prereleaseParts){
          prereleaseType = prereleaseParts[0]
          if(releaseType === 'major'){
            if(prereleaseType === 'alpha'){
              prereleaseType = 'beta'
              releaseType = 'prerelease'
            }else if(prereleaseType === 'beta'){
              prereleaseType = 'rc'
              releaseType = 'prerelease'
            }else if(prereleaseType === 'rc'){
              prereleaseType = null
              releaseType = 'patch'
            }
          }else{
            releaseType = 'prerelease'
          }
        }
        // Determine version bump based on commit messages
        newVersion = semver.inc(currentVersion, releaseType, prereleaseType);
      } else {

        if(prerelease){
          newVersion = semver.inc(initialVersion, releaseType, prereleaseType)
        } else {
          newVersion = initialVersion
        }
      }

      newVersion = semver.valid(newVersion)
      tag = `v${newVersion}`

    } else {
      tag = `v${semver.valid(tag)}`
    }

    core.info(`Automated Tag: ${tag}`);
    
    if( tags.map((t) => t.name).includes(tag) ){
      core.error(`${tag} already exists!`)
      return;
    }

    if (isTest) {
      core.setOutput('prerelease', prerelease)
      core.setOutput("last_version", lastVersion);
      core.setOutput("last_prerelease_version", lastPrereleaseVersion);

      core.setOutput("tag", tag);

      return;
    }

    core.info(`Commit Sha: ${commitSha}`);
    
    const tagResponse = await octokit.rest.git.createTag({
      owner,
      repo,
      tag,
      message: "Auto-generated tag by workflow",
      type: "commit",
      object: commitSha,
      tagger: {
        name: github.context.actor,
        email: `${github.context.actor}@users.noreply.github.com`,
      },
    });

    console.log(`Created tag`, tagResponse);

    // Create a reference to the tag
    const refResponse = await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/tags/${tag}`,
      sha: tagResponse.data.sha,
    });

    console.log(`Created reference: `, refResponse);

    core.info(`Generated Tag's Ref is: ${refResponse.data.ref}`);

    core.setOutput("tag", tag);
    core.setOutput("ref", refResponse.data.ref);
  } catch (error) {
    core.setFailed(error.message);
  }
}

const pushContext = (context = {}) => {
  return {
    eventName: context.eventName || 'push',
    ref: context.ref || 'refs/heads/main',
    sha: context.sha || 'ad0f54ef7ac40e4ffa521d7808ad129028754155',
    repo: {
      owner: context?.repo?.owner || 'oobook',
      repo: context?.repo?.repo || 'automated'
    },
    actor: context?.actor || 'testuser',
    payload: {
      commits: [
        {
          message: 'feat: add new feature',
          id: 'ad0f54ef7ac40e4ffa521d7808ad129028754155',
          author: {
            name: 'Test User',
            email: 'test@example.com'
          }
        }
      ]
    }
  }
}

module.exports = {
  run,
};
