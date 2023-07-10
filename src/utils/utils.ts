import BigNumber from 'bignumber.js';

export function GetRpcUrlForNetwork(network: string) {
  switch (network.toUpperCase()) {
    case 'ETH':
      return process.env.RPC_URL_ETH;
    case 'BSC':
      return process.env.RPC_URL_BSC;
    case 'CRONOS':
      return process.env.RPC_URL_CRONOS;
    case 'MATIC':
      return process.env.RPC_URL_MATIC;
    case 'GNOSIS':
      return process.env.RPC_URL_GNOSIS;
    case 'NEAR':
      return process.env.RPC_URL_NEAR;
    case 'OPTIMISM':
      return process.env.RPC_URL_OPTIMISM;
  }
}

/**
 * Retries a function n number of times before giving up
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function retry<T extends (...arg0: any[]) => any>(
  fn: T,
  args: Parameters<T>,
  maxTry = 10,
  incrSleepDelay = 1000,
  retryCount = 1
): Promise<Awaited<ReturnType<T>>> {
  const currRetry = typeof retryCount === 'number' ? retryCount : 1;
  try {
    const result = await fn(...args);
    return result;
  } catch (e) {
    if (currRetry >= maxTry) {
      console.log(`Retry ${currRetry} failed. All ${maxTry} retry attempts exhausted`);
      throw e;
    }
    console.log(`Retry ${currRetry} failed.`);
    console.log(e);
    console.log(`Waiting ${retryCount} second(s)`);
    await sleep(incrSleepDelay * retryCount);
    return retry(fn, args, maxTry, currRetry + 1);
  }
}

export async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalize(amount: string | bigint, decimals: number): number {
  const bn = new BigNumber(amount.toString());
  const factor = new BigNumber(10).pow(decimals);
  return bn.div(factor).toNumber();
}

export function roundTo(num: number, dec = 2): number {
  const pow = Math.pow(10, dec);
  return Math.round((num + Number.EPSILON) * pow) / pow;
}
