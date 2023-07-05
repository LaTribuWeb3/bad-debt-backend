import * as dotenv from 'dotenv';
dotenv.config();
import { Octokit } from 'octokit';

// IS_STAGING is default
const IS_STAGING = process.env.STAGING_ENV && process.env.STAGING_ENV.toLowerCase() == 'false';
const REPO_PATH = IS_STAGING ? 'bad-debt-staging' : 'bad-debt';

const octokit = new Octokit({
  auth: process.env.GH_TOKEN
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
        name: process.env.GH_HANDLE,
        email: 'octocat@github.com'
      },
      content: Buffer.from(jsonString).toString('base64')
    });
  } catch (err) {
    console.error('failed to upload to github');
    console.error(err);
  }
}
