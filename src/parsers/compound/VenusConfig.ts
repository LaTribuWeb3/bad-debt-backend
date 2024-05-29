import { CompoundConfig } from './CompoundConfig';

export interface VenusMultiConfig {
  [configKey: string]: VenusConfig;
}

export interface VenusConfig extends CompoundConfig {
  diamondProxyFirstBlock: number; // this is the first block where we have a MarketEntered event with both indexed fields (new ABI from venus)
  checkVai: boolean;
}
