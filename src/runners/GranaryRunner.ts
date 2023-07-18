import * as dotenv from 'dotenv';
import multiNetworkConfig from '../configs/GranaryRunnerConfig.json';
import { GetRpcUrlForNetwork } from '../utils/Utils';
import { GranaryParser } from '../parsers/aave/GranaryParser';
dotenv.config();

async function GranaryRunner() {
  const networkToUse = process.argv[2];
  if (!networkToUse) {
    throw new Error(
      `Cannot start granary runner without network as first argument. Available networks: ${Object.keys(
        multiNetworkConfig
      ).join(', ')}`
    );
  }
  const config = multiNetworkConfig[networkToUse as keyof typeof multiNetworkConfig];
  const rpcUrl = GetRpcUrlForNetwork(config.network);
  if (!rpcUrl) {
    throw new Error(`Could not find rpc url in env variable for network ${config.network}`);
  }

  const runnerName = `GranaryParser-${config.network}-Runner`;
  const parser = new GranaryParser(config, runnerName, rpcUrl, `${networkToUse.toLowerCase()}_granary.json`, 24, 1);
  await parser.main();
}

GranaryRunner();
