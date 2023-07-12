import * as dotenv from 'dotenv';
import config from '../configs/SonneRunnerConfig.json';
import { GetRpcUrlForNetwork } from '../utils/Utils';
import { CompoundParser } from '../parsers/compound/CompoundParser';
dotenv.config();

async function SonneRunner() {
  const rpcUrl = GetRpcUrlForNetwork(config.network);
  if (!rpcUrl) {
    throw new Error(`Could not find rpc url in env variable for network ${config.network}`);
  }

  const runnerName = 'SonneParser-Runner';
  const parser = new CompoundParser(config, runnerName, rpcUrl, 'optimism_sonne.json', 24, 1);
  await parser.main();
}

SonneRunner();
