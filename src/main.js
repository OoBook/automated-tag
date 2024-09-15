const core = require("@actions/core");
const github = require("@actions/github");
const exec = require("@actions/exec");

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
    const { context } = github;
    const { payload } = context;

    const owner = context.repo.owner;
    const repo = context.repo.repo;
    const isTest = core.getInput("test", { required: false });
    // const pr_number = core.getInput("pr-number", { required: false });
    const token = core.getInput("gh-token", { required: true });
    const commitSha = core.getInput("commit-sha") || context.sha;

    const octokit = github.getOctokit(token);

    let commits = [];

    if (context.eventName !== "push" && !isTest) {
      core.setFailed(`Unsupported event: ${context.eventName}`);
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
    } else {
      core.setFailed(`Unsupported event: ${context.eventName}`);
      return;
    }

    // console.log("Commits:", commits);

    const major_pattern = /BREAKING CHANGE:/;
    const minor_pattern = /^feat(\(\w+\))?:/;

    // const string = "feat: add variations";

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
      // console.log(
      //   commit.sha,
      //   commit.commit.message,
      //   commit.author.type, // User
      //   commit.author.login, // OoBook
      //   commit.author.html_url, //
      // );
    }
    // Fetch all tags
    const { data: tags } = await octokit.rest.repos.listTags({
      owner,
      repo,
      per_page: 1, // Adjust as needed
    });

    const last_tag = tags[0].name;

    const tag_pattern = /^(v)([0-9]+\.[0-9]+\.[0-9]+)(-[\w]+)?$/;
    let matches = null;

    let tag = "";
    if ((matches = last_tag.match(tag_pattern))) {
      const versions = matches[2].split(".").map((v) => parseInt(v));

      if (isMajor) versions[0] += 1;
      else if (isMinor) versions[1] += 1;
      else versions[2] += 1;

      tag = `v${versions.join(".")}`;
    }

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

    core.setOutput("tag", tag);

    core.setOutput("ref", refResponse.data.ref);

    // Fetch all tags and history
    // await exec.exec("git", ["fetch", "--tags", "--unshallow", "--prune"], {
    //   listeners: {
    //     stdout: (data) => {
    //       console.log("fetch out", data.toString());
    //     },
    //     stderr: (data) => {
    //       console.log("fetch error", data.toString());
    //     },
    //   },
    // });
    // // Check if we're on the main branch, if not, create it
    // let currentBranch = "";
    // await exec.exec("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
    //   listeners: {
    //     stdout: (data) => {
    //       currentBranch += data.toString();
    //     },
    //   },
    // });
    // currentBranch = currentBranch.trim();
    // core.debug(currentBranch);
    // if (currentBranch !== "main") {
    //   await exec.exec("git", ["branch", "--track", "main", "origin/main"]);
    // }

    // await octokit.rest.repos.createTag({
    //   tag: nextTag,
    //   owner,
    //   repo,
    //   message: "Auto-generated tag by workflow",
    // });
    // await octokit.rest.repos.pushTag({
    //   tag: nextTag,
    //   owner: github.context.repo.owner,
    //   repo: github.context.repo.repo,
    //   sha: github.contxt.sha,
    // });
  } catch (error) {
    core.setFailed(error.message);
  }
}

module.exports = {
  run,
};
