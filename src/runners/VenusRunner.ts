import * as dotenv from 'dotenv';
import config from '../configs/VenusRunnerConfig.json';
import { GetRpcUrlForNetwork } from '../utils/Utils';
import { CompoundParser } from '../parsers/compound/CompoundParser';
import { Comptroller__factory, VenusDiamond__factory, VenusMarketFacet__factory } from '../contracts/types';
dotenv.config();

async function VenusRunner() {
  const rpcUrl = GetRpcUrlForNetwork(config.network);
  if (!rpcUrl) {
    throw new Error(`Could not find rpc url in env variable for network ${config.network}`);
  }

  const runnerName = 'VenusParser-Runner';
  const parser = new CompoundParser(config, runnerName, rpcUrl, 'BSC_venus.json', 24, 1);

  const comptroller = Comptroller__factory.connect('0xfD36E2c2a6789Db23113685031d7F16329158384', parser.web3Provider);
  const marketFacet = VenusMarketFacet__factory.connect('0xfD36E2c2a6789Db23113685031d7F16329158384', parser.web3Provider);

  const logs = await comptroller.queryFilter(comptroller.filters.MarketEntered(), 32139323, 32139323 + 10000);
  const logsNew = await marketFacet.queryFilter(marketFacet.filters.MarketEntered(), 32139323, 32139323 + 10000);
  const logsOld = await marketFacet.queryFilter(marketFacet.filters.MarketEntered(), 32139323 - 10000, 32139323);

  console.log(logsNew[0].args['account']);
  
    // const logs = await this.comptroller.queryFilter(this.comptroller.filters.MarketEntered(), 32139323, 32139323);
    // console.log(await this.comptroller.filters.MarketEntered().getTopicFilter());

  // const diamond = VenusDiamond__factory.connect('0xfD36E2c2a6789Db23113685031d7F16329158384', parser.web3Provider);
  // const facets = await diamond.facetAddresses();
  // console.log(facets);

  // await parser.main();
}

VenusRunner();
