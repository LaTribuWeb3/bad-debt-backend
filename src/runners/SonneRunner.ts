import { CompoundConfig } from '../parsers/compound/CompoundConfig';
import * as dotenv from 'dotenv';
import { SonneParser } from '../parsers/compound/SonneParser';
dotenv.config();

const config: CompoundConfig = {
  comptrollerAddress: '0x60CF091cD3f50420d50fD7f707414d0DF4751C58',
  cETHAddress: '0xf7B5965f5C117Eb1B5450187c9DcFccc3C317e8E',
  deployBlock: 26050051,
  defaultBlockStep: 50000,
  multicallSize: 200,
  network: 'OPTIMISM',
  multicallParallelSize: 10,
  nonBorrowableMarkets: [],
  rektMarket: []
};

async function RunSonneParser() {
  const rpcUrl = process.env.RPC_URL_OPTIMISM;
  if (!rpcUrl) {
    throw new Error('Could not find env variable "RPC_URL_OPTIMISM"');
  }
  const compoundParser = new SonneParser(config, rpcUrl, 'optimism_sonne.json', 24, 1);
  await compoundParser.main();
}

RunSonneParser();
