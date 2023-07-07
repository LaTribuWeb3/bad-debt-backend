import { CompoundParser } from '../parsers/compound/CompoundParser';
import config from '../configs/CompoundRunnerConfig.json';
import * as dotenv from 'dotenv';
dotenv.config();

async function RunCompoundParser() {
  const rpcUrl = process.env.RPC_URL_ETH;
  if (!rpcUrl) {
    throw new Error('Could not find env variable "RPC_URL_ETH"');
  }
  const compoundParser = new CompoundParser(config, rpcUrl, 'ethereum_compound.json', 24, 1);
  await compoundParser.main();
}

RunCompoundParser();
