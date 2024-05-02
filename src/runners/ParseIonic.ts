import { CompoundParser } from '../parsers/compound/CompoundParser';
import config from '../configs/ParseIonicConfig.json';
import * as dotenv from 'dotenv';
import { GetRpcUrlForNetwork } from '../utils/Utils';
dotenv.config();

async function ParseIonicRunner() {
  const rpcUrl = GetRpcUrlForNetwork(config.network);
  if (!rpcUrl) {
    throw new Error(`Could not find rpc url in env variable for network ${config.network}`);
  }

  const runnerName = 'ParseIonic-Runner';
  const parser = new CompoundParser(config, runnerName, rpcUrl, 'mode_ionic.json', 24, 1);
  await parser.main();
}

ParseIonicRunner();
