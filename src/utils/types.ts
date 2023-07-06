export interface UserData {
  debts: TokenData;
  collaterals: TokenData;
}

/**
 * Map a token address to the amount of token, normalized
 */
export interface TokenData {
  [tokenAddress: string]: number;
}

export interface ParserResult {
  total: string;
  updated: string;
  decimals: string;
  users: { user: string; badDebt: string }[];
  tvl: string;
  deposits: string;
  borrows: string;
  calculatedBorrows: string;
}
