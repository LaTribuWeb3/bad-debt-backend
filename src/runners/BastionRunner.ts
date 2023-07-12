import * as dotenv from 'dotenv';
import config from '../configs/BastionRunnerConfig.json';
import { GetRpcUrlForNetwork } from '../utils/Utils';
import { CompoundParser } from '../parsers/compound/CompoundParser';
dotenv.config();

async function BastionRunner() {
  const rpcUrl = GetRpcUrlForNetwork(config.network);
  if (!rpcUrl) {
    throw new Error(`Could not find rpc url in env variable for network ${config.network}`);
  }

  const runnerName = 'BastionParser-Runner';
  const parser = new CompoundParser(config, runnerName, rpcUrl, 'aurora_bastion.json', 24, 1);
  await parser.main();
}

BastionRunner();
