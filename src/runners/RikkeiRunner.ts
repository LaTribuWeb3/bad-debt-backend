import * as dotenv from 'dotenv';
import config from '../configs/RikkeiRunnerConfig.json';
import { GetRpcUrlForNetwork } from '../utils/Utils';
import { CompoundParser } from '../parsers/compound/CompoundParser';
dotenv.config();

async function RikkeiRunner() {
  const rpcUrl = GetRpcUrlForNetwork(config.network);
  if (!rpcUrl) {
    throw new Error(`Could not find rpc url in env variable for network ${config.network}`);
  }

  const runnerName = 'RikkeiParser-Runner';
  const parser = new CompoundParser(config, runnerName, rpcUrl, 'BSC_rikki.json', 24, 1);
  await parser.main();
}

RikkeiRunner();
