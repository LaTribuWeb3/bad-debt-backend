import * as dotenv from 'dotenv';
import { GetRpcUrlForNetwork } from '../utils/Utils';
import { IronBankParser } from '../parsers/compound/IronBankParser';
import config from '../configs/IronBankRunnerConfig.json';
dotenv.config();

async function IronBankRunner() {
  const rpcUrl = GetRpcUrlForNetwork(config.network);
  if (!rpcUrl) {
    throw new Error(`Could not find rpc url in env variable for network ${config.network}`);
  }

  const runnerName = 'IronBank-Runner';
  const parser = new IronBankParser(config, runnerName, rpcUrl, 'ethereum_iron-bank.json', 24 * 5, 24);
  await parser.main();
}

IronBankRunner();
