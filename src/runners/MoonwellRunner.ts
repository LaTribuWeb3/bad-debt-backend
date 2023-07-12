import * as dotenv from 'dotenv';
import config from '../configs/MoonwellRunnerConfig.json';
import { GetRpcUrlForNetwork } from '../utils/Utils';
import { MoonwellParser } from '../parsers/compound/MoonwellParser';
dotenv.config();

async function MoonwellRunner() {
  const rpcUrl = GetRpcUrlForNetwork(config.network);
  if (!rpcUrl) {
    throw new Error(`Could not find rpc url in env variable for network ${config.network}`);
  }

  const runnerName = 'MoonwellParser-Runner';
  const parser = new MoonwellParser(config, runnerName, rpcUrl, 'MOONBEAM_Moonwell.json', 24, 1);
  await parser.main();
}

MoonwellRunner();
