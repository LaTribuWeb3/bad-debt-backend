import config from '../configs/IonicRunnerConfig.json';
import * as dotenv from 'dotenv';
import { GetRpcUrlForNetwork } from '../utils/Utils';
import { IonicParser } from '../parsers/compound/IonicParser';
dotenv.config();

async function IonicRunner() {
  const rpcUrl = GetRpcUrlForNetwork(config.network);
  if (!rpcUrl) {
    throw new Error(`Could not find rpc url in env variable for network ${config.network}`);
  }

  const runnerName = 'IonicParser-Runner';
  const parser = new IonicParser(config, runnerName, rpcUrl, 'mode_ionic.json', 24, 1);
  await parser.main();
}

IonicRunner();
