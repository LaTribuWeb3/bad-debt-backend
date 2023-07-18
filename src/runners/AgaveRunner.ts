import * as dotenv from 'dotenv';
import multiNetworkConfig from '../configs/AgaveRunnerConfig.json';
import { GetRpcUrlForNetwork } from '../utils/Utils';
import { AaveParser } from '../parsers/aave/AaveParser';
dotenv.config();

async function AgaveRunner() {
  const config = multiNetworkConfig['GNOSIS'];
  const rpcUrl = GetRpcUrlForNetwork(config.network);
  if (!rpcUrl) {
    throw new Error(`Could not find rpc url in env variable for network ${config.network}`);
  }

  const runnerName = 'AgaveParser-Runner';
  const parser = new AaveParser(config, runnerName, rpcUrl, 'gnosis_agave.json', 24, 1);
  await parser.main();
}

AgaveRunner();
