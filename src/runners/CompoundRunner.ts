import { CompoundParser } from '../parsers/compound/CompoundParser';
import config from '../configs/CompoundRunnerConfig.json';
import * as dotenv from 'dotenv';
import { GetRpcUrlForNetwork } from '../utils/Utils';
dotenv.config();

async function RunCompoundParser() {
  const rpcUrl = GetRpcUrlForNetwork(config.network);
  if (!rpcUrl) {
    throw new Error(`Could not find rpc url in env variable for network ${config.network}`);
  }
  const compoundParser = new CompoundParser(config, rpcUrl, 'ethereum_compound.json', 24, 1);
  await compoundParser.main();
}

RunCompoundParser();
