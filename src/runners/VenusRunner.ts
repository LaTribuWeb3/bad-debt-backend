import * as dotenv from 'dotenv';
import config from '../configs/VenusRunnerConfig.json';
import { GetRpcUrlForNetwork } from '../utils/Utils';
import { CompoundParser } from '../parsers/compound/CompoundParser';
dotenv.config();

async function VenusRunner() {
  const rpcUrl = GetRpcUrlForNetwork(config.network);
  if (!rpcUrl) {
    throw new Error(`Could not find rpc url in env variable for network ${config.network}`);
  }

  const runnerName = 'VenusParser-Runner';
  const parser = new CompoundParser(config, runnerName, rpcUrl, 'BSC_venus.json', 24, 1);
  await parser.main();
}

VenusRunner();
