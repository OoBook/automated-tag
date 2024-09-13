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
    const owner = github.context.repo.owner;
    const repo = github.context.repo.repo;
    const isTest = core.getInput("test", { required: false });
    const token = core.getInput("gh-token", { required: true });

    // await exec.exec(`set -e`);
    // const { stdout, stderr } = await exec.exec(
    //   `curl -sL https://git.io/autotag-install | sh -s -- -b /usr/local/bin`,
    // );
    const { stdout, stderr } = await exec.exec(
      `curl -sL https://git.io/autotag-install | sh --`,
    );

    if (stderr) {
      throw new Error(`Error installing Autotag: ${stderr}`);
    }
    core.debug("autotag installed", stdout);

    // Fetch all tags and history
    await exec.exec("git", ["fetch", "--tags", "--unshallow", "--prune"]);

    // Check if we're on the main branch, if not, create it
    let currentBranch = "";
    await exec.exec("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      listeners: {
        stdout: (data) => {
          currentBranch += data.toString();
        },
      },
    });
    currentBranch = currentBranch.trim();
    core.debug(currentBranch);
    if (currentBranch !== "main") {
      await exec.exec("git", ["branch", "--track", "main", "origin/main"]);
    }

    const { stdout: nextTagOutput, stderr: nextTagStderr } =
      await exec.exec("./bin/autotag");

    if (nextTagStderr) {
      throw new Error(`Error running Autotag: ${nextTagStderr}`);
    }

    const nextTag = nextTagOutput.trim();
    core.debug(nextTag);
    // const octokit = new github.GitHub(github.context.repo.token);
    // const octokit = new github.getOctokit(token);
    // console.log(octokit.rest);

    // const installed = await installAutoTag();

    // if (installed) {
    //   const nextTag = getNewTag();

    //   core.debug(nextTag);
    //   // Set the next tag as ;an output
    //   core.setOutput("next_tag", `v${nextTag}`);

    //   // // Create and push the tag
    //   // const octokit = new github.GitHub(github.context.repo.token);
    //   // await octokit.rest.repos.createTag({
    //   //   tag: nextTag,
    //   //   owner: github.context.repo.owner,
    //   //   repo: github.context.repo.repo,
    //   //   message: "Auto-generated tag by workflow",
    //   // });
    //   // await octokit.rest.repos.pushTag({
    //   //   tag: nextTag,
    //   //   owner: github.context.repo.owner,
    //   //   repo: github.context.repo.repo,
    //   //   sha: github.context.sha,
    //   // });
    // }
  } catch (error) {
    core.setFailed(error.message);
  }
}

module.exports = {
  run,
};
