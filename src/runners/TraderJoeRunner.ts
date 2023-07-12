import * as dotenv from 'dotenv';
import config from '../configs/TraderJoeRunnerConfig.json';
import { GetRpcUrlForNetwork } from '../utils/Utils';
import { CompoundParser } from '../parsers/compound/CompoundParser';
dotenv.config();

async function TraderJoeRunner() {
  const rpcUrl = GetRpcUrlForNetwork(config.network);
  if (!rpcUrl) {
    throw new Error(`Could not find rpc url in env variable for network ${config.network}`);
  }

  const runnerName = 'TraderJoeParser-Runner';
  const parser = new CompoundParser(config, runnerName, rpcUrl, 'avalanche_trader-joe.json', 24, 1);
  await parser.main();
}

TraderJoeRunner();
