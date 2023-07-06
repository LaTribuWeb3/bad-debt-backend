export interface CompoundConfig {
  network: string; // ETH, AVAX.. etc
  comptrollerAddress: string;
  cETHAddress: string;
  deployBlock: number;
  defaultBlockStep: number; // this is the default block step used to fetch events
  multicallSize: number; // the amount of accounts that will be batched in a single multicall
  multicallParallelSize: number; // the amount of parallelism for every multicalls
  rektMarket: string[];
  nonBorrowableMarkets: string[];
}
