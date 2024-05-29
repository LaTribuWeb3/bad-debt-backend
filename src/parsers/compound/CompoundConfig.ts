export interface CompoundMultiConfig {
  [configKey: string]: CompoundConfig;
}

export interface CompoundConfig {
  network: string; // ETH, AVAX.. etc
  comptrollerAddress: string;
  cETHAddresses: string[];
  deployBlock: number;
  blockStepLimit?: number; // this is the block step limit when fetching events
  multicallSize: number; // the amount of accounts that will be batched in a single multicall
  multicallParallelSize: number; // the amount of parallelism for every multicalls
  rektMarket: string[];
  nonBorrowableMarkets: string[];
}
