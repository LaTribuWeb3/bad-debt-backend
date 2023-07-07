import * as dotenv from 'dotenv';
import { SonneParser } from '../parsers/compound/SonneParser';
import config from '../configs/SonneRunnerConfig.json';
dotenv.config();

async function RunSonneParser() {
  const rpcUrl = process.env.RPC_URL_OPTIMISM;
  if (!rpcUrl) {
    throw new Error('Could not find env variable "RPC_URL_OPTIMISM"');
  }
  const compoundParser = new SonneParser(config, rpcUrl, 'optimism_sonne.json', 24, 1);
  await compoundParser.main();
}

RunSonneParser();
