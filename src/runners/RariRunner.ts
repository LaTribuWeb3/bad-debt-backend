import * as dotenv from 'dotenv';
import config from '../configs/RariRunnerConfig.json';
import { GetRpcUrlForNetwork } from '../utils/Utils';
import { CompoundParser } from '../parsers/compound/CompoundParser';
dotenv.config();

async function RariRunner() {
  const rpcUrl = GetRpcUrlForNetwork(config.network);
  if (!rpcUrl) {
    throw new Error(`Could not find rpc url in env variable for network ${config.network}`);
  }

  const runnerName = 'RariParser-Runner';
  const parser = new CompoundParser(config, runnerName, rpcUrl, 'ethereum_rari-capital.json', 24 * 5, 1);
  await parser.main();
}

RariRunner();
