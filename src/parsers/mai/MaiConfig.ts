export interface MaiConfig {
    network: string; // ETH, AVAX.. etc
    vaultAddresses: Array<string>;
    blockStepLimit?: number; // this is the block step limit when fetching events
    multicallSize: number; // the amount of accounts that will be batched in a single multicall
    multicallParallelSize: number; // the amount of parallelism for every multicalls
  }
  