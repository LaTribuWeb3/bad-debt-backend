import * as dotenv from 'dotenv';
import { GetRpcUrlForNetwork } from '../utils/Utils';
import config from '../configs/InverseRunnerConfig.json';
import { CompoundParser } from '../parsers/compound/CompoundParser';
dotenv.config();

async function InverseRunner() {
  const rpcUrl = GetRpcUrlForNetwork(config.network);
  if (!rpcUrl) {
    throw new Error(`Could not find rpc url in env variable for network ${config.network}`);
  }

  const runnerName = 'InverseParser-Runner';
  const parser = new CompoundParser(config, runnerName, rpcUrl, 'ethereum_inverse.json', 24 * 5, 24);
  await parser.main();
}

InverseRunner();
