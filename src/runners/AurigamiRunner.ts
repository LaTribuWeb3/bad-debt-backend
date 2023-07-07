import * as dotenv from 'dotenv';
import config from '../configs/AurigamiRunnerConfig.json';
import { AurigamiParser } from '../parsers/compound/AurigamiParser';
import { GetRpcUrlForNetwork } from '../utils/Utils';
dotenv.config();

async function AurigamiRunner() {
  const rpcUrl = GetRpcUrlForNetwork(config.network);
  if (!rpcUrl) {
    throw new Error(`Could not find rpc url in env variable for network ${config.network}`);
  }
  const parser = new AurigamiParser(config, rpcUrl, 'aurora_aurigami.json', 24, 1);
  await parser.main();
}

AurigamiRunner();
