import { JsonRpcProvider } from 'ethers';
import { CToken__factory } from './contracts/types';
import { ExecuteMulticall, MulticallParameter } from './utils/MulticallHelper';
import { normalize } from './utils/Utils';
import { GetTokenInfos } from './utils/TokenHelper';

async function index() {
  console.log('hello world,!\nThis file does not do anything\nYou should start a runner from the runners directory');
  const web3Provider = new JsonRpcProvider(process.env.RPC_URL_ETH);
  const cToken = CToken__factory.connect('0x6C8c6b02E7b2BE14d4fA6022Dfd6d75921D90E4E', web3Provider);
  const val = await cToken.borrowBalanceCurrent.staticCall('0xBD9ED130A53CFaFcf81502e4D35329A6c4D53410');

  const tokenInfo = await GetTokenInfos('eth', '0x6C8c6b02E7b2BE14d4fA6022Dfd6d75921D90E4E');
  const value = normalize(val, tokenInfo.decimals);
  const multicallPrm: MulticallParameter = {
    targetAddress: '0x6C8c6b02E7b2BE14d4fA6022Dfd6d75921D90E4E',
    inputData: ['0xBD9ED130A53CFaFcf81502e4D35329A6c4D53410'],
    outputTypes: ['uint256'],
    targetFunction: 'borrowBalanceCurrent(address)'
  };

  const res = await ExecuteMulticall('eth', web3Provider, [multicallPrm]);
  console.log(res);
}

index();
