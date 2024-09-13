import * as core from '@actions/core';
import * as github from '@actions/github';

async function run() {
  try {
    const { GITHUB_SHA, GITHUB_TOKEN } = process.env;
    const tagName = core.getInput('tag_name');
    const tagRef = core.getInput('tag_ref');

    if (!GITHUB_SHA) {
      core.setFailed('Missing GITHUB_SHA');
      return;
    }

    if (!GITHUB_TOKEN) {
      core.setFailed('Missing GITHUB_TOKEN');
      return;
    }

    if (!tagName) {
      core.setFailed('Missing tag_name');
      return;
    }

    const octokit = github.getOctokit(GITHUB_TOKEN);

    let sha = '';
    if (!tagRef) {
      console.log(`No tag_ref provided; Using ${GITHUB_SHA}`);
      sha = GITHUB_SHA;
    }

    for (const prefix of ['', 'heads/', 'tags/']) {
      if (sha !== '') {
        break;
      }
      const requestRef = prefix + tagRef;
      console.log(`Checking if we are ref ${requestRef}`);
      try {
        const response = prefix
          ? await octokit.rest.git.getRef({
              ...github.context.repo,
              ref: requestRef,
            })
          : await octokit.rest.git.getCommit({
              ...github.context.repo,
              commit_sha: tagRef,
            });
        sha = response.data?.object?.sha;
      } catch (e) {
        if (e.status != 404) {
          throw e;
        }
      }
    }

    if (sha === undefined) {
      core.setFailed(`ref ${tagRef} could not be detected as a sha, branch, or tag!`);
      return;
    }

    console.log(`Found ref ${tagRef || GITHUB_SHA} as commit ${sha}`);

    try {
      await octokit.rest.git.getRef({
        ...github.context.repo,
        ref: `tags/${tagName}`,
      });
      await octokit.rest.git.updateRef({
        ...github.context.repo,
        ref: `tags/${tagName}`,
        sha: GITHUB_SHA,
      });
    } catch (e) {
      if (e.status === 404) {
        // tag does not exist
        await octokit.rest.git.createRef({
          ...github.context.repo,
          ref: `refs/tags/${tagName}`,
          sha: GITHUB_SHA,
        });
      } else {
        throw e;
      }
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
