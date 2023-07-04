export interface UserData {
  debts: TokenData;
  collaterals: TokenData;
}

/**
 * Map a token address to the amount of token
 */
export interface TokenData {
  [tokenAddress: string]: number;
}

export interface ParserResult {
  total: string;
  updated: number;
  decimals: number;
  users: { user: string; badDebt: string }[];
  tvl: string;
  deposits: string;
  borrows: string;
}
