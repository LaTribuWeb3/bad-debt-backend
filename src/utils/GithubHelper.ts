import * as dotenv from 'dotenv';
dotenv.config();
import { Octokit } from 'octokit';

let appEnv = process.env.APP_ENV;
if (!appEnv) {
  // Default to staging
  appEnv = 'staging';
}

const githubToken = process.env.GH_TOKEN;

let uploadFilesToGithub = false;
if (process.env.UPLOAD_FILES && process.env.UPLOAD_FILES == 'true') {
  uploadFilesToGithub = true;
}

let REPO_PATH = '';
if (appEnv.toLowerCase() == 'staging') {
  REPO_PATH = 'bad-debt-staging';
} else if (appEnv.toLowerCase() == 'prod') {
  REPO_PATH = 'bad-debt';
} else {
  throw new Error('Unrecognized appEnv: should be prod or staging');
}
const octokit = new Octokit({
  auth: githubToken
});

async function getFileSha(fileName: string, day?: string) {
  try {
    const res = await octokit.request(`Get /repos/{owner}/{repo}/contents/${REPO_PATH}/${day || 'latest'}/{path}`, {
      owner: 'Risk-DAO',
      repo: 'simulation-results',
      path: `${fileName}`
    });
    return res.data.sha;
  } catch (err) {
    return null;
  }
}

function getDay() {
  const dateObj = new Date();
  const month = dateObj.getUTCMonth() + 1; //months from 1-12
  const day = dateObj.getUTCDate();
  const year = dateObj.getUTCFullYear();
  return day + '.' + month + '.' + year;
}

export async function UploadJsonFile(jsonString: string, fileName: string, day?: string) {
  if (!uploadFilesToGithub) {
    return;
  }

  if (!githubToken) {
    throw new Error('Could not find env variable GH_TOKEN');
  }
  try {
    const sha = await getFileSha(fileName, day);
    if (!day) {
      await UploadJsonFile(jsonString, fileName, getDay());
    }
    return octokit.request(`PUT /repos/{owner}/{repo}/contents/${REPO_PATH}/${day || 'latest'}/{path}`, {
      owner: 'Risk-DAO',
      repo: 'simulation-results',
      path: `${fileName}`,
      message: `bad-debt push ${new Date().toString()}`,
      sha,
      committer: {
        name: 'bad-debt-backend',
        email: 'octocat@github.com'
      },
      content: Buffer.from(jsonString).toString('base64')
    });
  } catch (err) {
    console.error('failed to upload to github');
    console.error(err);
  }
}
