import * as dotenv from 'dotenv';
import config from '../configs/RariRunnerConfig.json';
import { GetRpcUrlForNetwork } from '../utils/Utils';
import { RariParser } from '../parsers/compound/RariParser';
dotenv.config();

async function RariRunner() {
  const rpcUrl = GetRpcUrlForNetwork(config.network);
  if (!rpcUrl) {
    throw new Error(`Could not find rpc url in env variable for network ${config.network}`);
  }
  const parser = new RariParser(config, rpcUrl, 'ethereum_rari-capital.json', 24 * 5, 1);
  await parser.main();
}

RariRunner();
