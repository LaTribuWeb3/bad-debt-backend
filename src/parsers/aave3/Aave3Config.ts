export interface Aave3MultiNetworkConfig {
  [network: string]: { config: Aave3Config };
}

export interface Aave3Config {
  network: string; // ETH, AVAX.. etc
  poolAddressesProviderAddress: string;
  deployBlock: number;
  blockStepLimit?: number; // this is the block step limit when fetching events
  multicallSize: number; // the amount of accounts that will be batched in a single multicall
  multicallParallelSize: number; // the amount of parallelism for every multicalls
}
