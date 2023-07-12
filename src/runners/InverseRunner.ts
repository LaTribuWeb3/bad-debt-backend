import * as dotenv from 'dotenv';
import { GetRpcUrlForNetwork } from '../utils/Utils';
import { CompoundParser } from '../parsers/compound/CompoundParser';
import { InverseParser } from '../parsers/compound/InverseParser';
import config from '../configs/InverseRunnerConfig.json';
dotenv.config();

async function InverseRunner() {
  const rpcUrl = GetRpcUrlForNetwork(config.network);
  if (!rpcUrl) {
    throw new Error(`Could not find rpc url in env variable for network ${config.network}`);
  }

  const runnerName = 'InverseParser-Runner';
  const parser = new InverseParser(config, runnerName, rpcUrl, 'ethereum_inverse.json', 24 * 5, 24);
  await parser.main();
}

InverseRunner();
