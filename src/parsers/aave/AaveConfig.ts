export interface AaveMultiNetworkConfig {
  [network: string]: { config: AaveConfig };
}

export interface AaveConfig {
  network: string; // ETH, AVAX.. etc
  lendingPoolAddressesProviderAddress: string;
  deployBlock: number;
  blockStepLimit?: number; // this is the block step limit when fetching events
  multicallSize: number; // the amount of accounts that will be batched in a single multicall
  multicallParallelSize: number; // the amount of parallelism for every multicalls
}
