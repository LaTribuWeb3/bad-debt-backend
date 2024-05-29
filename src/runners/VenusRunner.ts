import * as dotenv from 'dotenv';
import multiConfig from '../configs/VenusRunnerConfig.json';
import { GetRpcUrlForNetwork } from '../utils/Utils';
import { VenusParser } from '../parsers/compound/VenusParser';
import { CompoundParser } from '../parsers/compound/CompoundParser';
import { VenusMultiConfig } from '../parsers/compound/VenusConfig';
dotenv.config();

const fileNameMap = {
  CORE: 'BSC_venus_Core.json',
  GAMEFI: 'BSC_venus_GameFi.json',
  DEFI: 'BSC_venus_Defi.json',
  MEME: 'BSC_venus_Meme.json',
  'LIQUID STAKED BNB': 'BSC_venus_Liquid Staked BNB.json',
  STABLECOINS: 'BSC_venus_Stablecoins.json',
  TRON: 'BSC_venus_Tron.json'
};

async function VenusRunner() {
  const venusMultiConfig = multiConfig as unknown as VenusMultiConfig;
  const configToUse = process.argv[2];
  if (!configToUse) {
    throw new Error(
      `Cannot start venus runner without config key as first argument. Available keys: ${Object.keys(
        venusMultiConfig
      ).join(', ')}`
    );
  }

  const config = venusMultiConfig[configToUse];
  if (!config) {
    throw new Error(
      `Cannot find venus config for ${configToUse}. Available configs: ${Object.keys(venusMultiConfig).join(', ')}`
    );
  }

  const rpcUrl = GetRpcUrlForNetwork(config.network);
  if (!rpcUrl) {
    throw new Error(`Could not find rpc url in env variable for network ${config.network}`);
  }

  const runnerName = `VenusParser-${configToUse}-Runner`;
  const jsonFileName = fileNameMap[configToUse.toUpperCase() as keyof typeof fileNameMap];
  if (!jsonFileName) {
    throw new Error(`Could not find filename for ${configToUse}`);
  }

  const parser = new VenusParser(config, runnerName, rpcUrl, jsonFileName, 24, 1);
  await parser.main();
}

VenusRunner();
