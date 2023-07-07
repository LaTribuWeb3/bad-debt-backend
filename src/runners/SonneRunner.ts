import * as dotenv from 'dotenv';
import { SonneParser } from '../parsers/compound/SonneParser';
import config from '../configs/SonneRunnerConfig.json';
import { GetRpcUrlForNetwork } from '../utils/Utils';
dotenv.config();

async function RunSonneParser() {
  const rpcUrl = GetRpcUrlForNetwork(config.network);
  if (!rpcUrl) {
    throw new Error(`Could not find rpc url in env variable for network ${config.network}`);
  }
  const compoundParser = new SonneParser(config, rpcUrl, 'optimism_sonne.json', 24, 1);
  await compoundParser.main();
}

RunSonneParser();
