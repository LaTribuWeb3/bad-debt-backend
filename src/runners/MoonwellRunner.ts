import * as dotenv from 'dotenv';
import { MoonwellParser } from '../parsers/compound/MoonwellParser';
import config from '../configs/MoonwellRunnerConfig.json';
import { GetRpcUrlForNetwork } from '../utils/Utils';
dotenv.config();

async function MoonwellRunner() {
  const rpcUrl = GetRpcUrlForNetwork(config.network);
  if (!rpcUrl) {
    throw new Error(`Could not find rpc url in env variable for network ${config.network}`);
  }

  const parser = new MoonwellParser(config, rpcUrl, 'MOONBEAM_Moonwell.json', 24, 1);
  await parser.main();
}

MoonwellRunner();
