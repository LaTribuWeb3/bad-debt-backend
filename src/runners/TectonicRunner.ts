import * as dotenv from 'dotenv';
import config from '../configs/TectonicRunnerConfig.json';
import { GetRpcUrlForNetwork } from '../utils/Utils';
import { CompoundParser } from '../parsers/compound/CompoundParser';
dotenv.config();

async function TectonicRunner() {
  const rpcUrl = GetRpcUrlForNetwork(config.network);
  if (!rpcUrl) {
    throw new Error(`Could not find rpc url in env variable for network ${config.network}`);
  }

  const runnerName = 'TectonicParser-Runner';
  const parser = new CompoundParser(config, runnerName, rpcUrl, 'CRO_tectonic.json', 24, 1);
  await parser.main();
}

TectonicRunner();
