import * as dotenv from 'dotenv';
import { TraderJoeParser } from '../parsers/compound/TraderJoeParser';
import config from '../configs/TraderJoeRunnerConfig.json';
import { GetRpcUrlForNetwork } from '../utils/Utils';
dotenv.config();

async function TraderJoeRunner() {
  const rpcUrl = GetRpcUrlForNetwork(config.network);
  if (!rpcUrl) {
    throw new Error(`Could not find rpc url in env variable for network ${config.network}`);
  }

  const parser = new TraderJoeParser(config, rpcUrl, 'avalanche_trader-joe', 24, 1);
  await parser.main();
}

TraderJoeRunner();
