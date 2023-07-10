import * as dotenv from 'dotenv';
import { BastionParser } from '../parsers/compound/BastionParser';
import config from '../configs/BastionRunnerConfig.json';
import { GetRpcUrlForNetwork } from '../utils/Utils';
dotenv.config();

async function BastionRunner() {
  const rpcUrl = GetRpcUrlForNetwork(config.network);
  if (!rpcUrl) {
    throw new Error(`Could not find rpc url in env variable for network ${config.network}`);
  }

  const parser = new BastionParser(config, rpcUrl, 'aurora_bastion', 24, 1);
  await parser.main();
}

BastionRunner();
