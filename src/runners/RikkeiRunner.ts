import * as dotenv from 'dotenv';
import { RikkeiParser } from '../parsers/compound/RikkeiParser';
import config from '../configs/RikkeiRunnerConfig.json';
import { GetRpcUrlForNetwork } from '../utils/Utils';
dotenv.config();

async function RikkeiRunner() {
  const rpcUrl = GetRpcUrlForNetwork(config.network);
  if (!rpcUrl) {
    throw new Error(`Could not find rpc url in env variable for network ${config.network}`);
  }

  const parser = new RikkeiParser(config, rpcUrl, 'bsc_rikki.json', 24, 1);
  await parser.main();
}

RikkeiRunner();
