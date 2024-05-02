import { JsonRpcProvider, Result, ethers, isError } from 'ethers';
import { Multicall__factory } from '../contracts/types';
import { Multicall2 } from '../contracts/types/Multicall';

import * as dotenv from 'dotenv';
dotenv.config();

const multicallAddressMapping = {
  eth: '0x5ba1e12693dc8f9c48aad8770482f4739beed696',
  bsc: '0xcb6e2f66df0493b4dd23ac7727d1677d1208b697',
  avax: '0xcb6e2f66df0493b4dd23ac7727d1677d1208b697',
  matic: '0xe539b93620570a92ef90ef7e60c79d9faee91186',
  near: '0xcb6e2f66df0493b4dd23ac7727d1677d1208b697',
  ftm: '0xab35d115974ac0a3c4bd16a70df77003c9f4c011',
  arbitrum: '0x0c05e6968aed7ca120464a78731144e75052ceb1',
  cro: '0x5e954f5972ec6bfc7decd75779f10d848230345f',
  moonbeam: '0x6477204e12a7236b9619385ea453f370ad897bb2',
  optimism: '0xca11bde05977b3631167028862be2a173976ca11',
  gnosis: '0xb6e7bd43cd3832ddfb02fc03035a6471eac757cc',
  goerli: '0x5ba1e12693dc8f9c48aad8770482f4739beed696',
  mode: '0xcA11bde05977b3631167028862bE2a173976CA11'
};

export type MulticallParameter = {
  // defines the contract to call
  targetAddress: string;
  // defines the function to call, the format: 'name()' or 'balanceOf(address)' must be respected
  targetFunction: string;
  // input data, as string array. Empty array when not input data
  inputData: string[];
  // output types as the exact return type of the contract, example: ['uint256', 'address']
  // for a call that return an uint256 and an address
  outputTypes: string[];
};

function getTypesFromFunctionDeclaration(functionDeclaration: string): string[] {
  const indexOfOpenPar = functionDeclaration.indexOf('(');
  const indexOfClosePar = functionDeclaration.indexOf(')');

  // if no param, return empty array
  if (indexOfClosePar + 1 == indexOfClosePar) {
    return [];
  } else {
    const extractedInputType = functionDeclaration.substring(indexOfOpenPar + 1, indexOfClosePar);
    return extractedInputType.split(',');
  }
}

/**
 * @notice This function use the multicall contract to get multiple results in only one RPC call
 * @param callParams array of call params, see type definition
 * @returns
 */
export async function ExecuteMulticall(
  network: string,
  web3Provider: JsonRpcProvider,
  callParams: MulticallParameter[]
): Promise<Result[]> {
  // console.log(`ExecuteMulticall: will multicall for ${callParams.length} calls`);
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const calls: Multicall2.CallStruct[] = [];

  for (let i = 0; i < callParams.length; i++) {
    const callParam = callParams[i];
    const inputTypes = getTypesFromFunctionDeclaration(callParam.targetFunction);
    let encodedArgs = ethers.id(callParam.targetFunction).substring(0, 10);
    if (callParam.inputData.length != 0) {
      encodedArgs += abiCoder.encode(inputTypes, callParam.inputData).substring(2);
    }

    const call: Multicall2.CallStruct = {
      target: callParam.targetAddress,
      callData: encodedArgs
    };
    calls.push(call);
  }

  const multicallAddress = multicallAddressMapping[network.toLowerCase() as keyof typeof multicallAddressMapping];
  if (!multicallAddress) {
    throw new Error(`MULTICALL_ADDRESS UNDEFINED FOR NETWORK ${network}`);
  }
  const multicallContract = Multicall__factory.connect(multicallAddress, web3Provider);
  const results = await multicallContract.tryAggregate.staticCall(true, calls);

  if (results.length != callParams.length) {
    throw new Error('Count mismatch between multicall results and call count');
  }

  const decodedResult = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const callParam = callParams[i];

    // const decoded = JSON.parse(JSON.stringify(abiCoder.decode(callParam.outputTypes, result.returnData)));
    const decoded = abiCoder.decode(callParam.outputTypes, result.returnData);

    // console.log(decoded.toString());
    decodedResult.push(decoded);
  }

  return decodedResult;
}
