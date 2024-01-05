import config from '../configs/MorphoBlueRunnerConfig.json';
import * as dotenv from 'dotenv';
import { GetRpcUrlForNetwork } from '../utils/Utils';
import { MorphoBlueParser } from '../parsers/morphoblue/MorphoBlueParser';
dotenv.config();

async function MorphoBlueRunner() {
  const rpcUrl = GetRpcUrlForNetwork(config.network);
  if (!rpcUrl) {
    throw new Error(`Could not find rpc url in env variable for network ${config.network}`);
  }

  const runnerName = 'MorphoBlueParser-Runner';
  const parser = new MorphoBlueParser(config, runnerName, rpcUrl, 'ethereum_morpho-blue.json', 24, 1);
  await parser.main();
}

MorphoBlueRunner();
