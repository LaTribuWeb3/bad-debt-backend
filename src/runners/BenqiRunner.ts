import * as dotenv from 'dotenv';
import config from '../configs/BenqiRunnerConfig.json';
import { GetRpcUrlForNetwork } from '../utils/Utils';
import { CompoundParser } from '../parsers/compound/CompoundParser';
dotenv.config();

async function BenqiRunner() {
  const rpcUrl = GetRpcUrlForNetwork(config.network);
  if (!rpcUrl) {
    throw new Error(`Could not find rpc url in env variable for network ${config.network}`);
  }

  const runnerName = 'BenqiParser-Runner';
  const parser = new CompoundParser(config, runnerName, rpcUrl, 'avalanche_benqi.json', 24, 1);
  await parser.main();
}

BenqiRunner();
