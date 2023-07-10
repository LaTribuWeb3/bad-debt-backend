import * as dotenv from 'dotenv';
import { _0vixParser } from '../parsers/compound/0vixParser';
import config from '../configs/0vixRunnerConfig.json';
import { GetRpcUrlForNetwork } from '../utils/Utils';
dotenv.config();

async function _0vixRunner() {
  const rpcUrl = GetRpcUrlForNetwork(config.network);
  if (!rpcUrl) {
    throw new Error(`Could not find rpc url in env variable for network ${config.network}`);
  }

  const parser = new _0vixParser(config, rpcUrl, 'polygon_0vix.json', 24, 1);
  await parser.main();
}

_0vixRunner();
