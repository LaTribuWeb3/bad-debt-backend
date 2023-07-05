import { CompoundConfig } from '../parsers/compound/CompoundConfig';
import { CompoundParser } from '../parsers/compound/CompoundParser';
import * as dotenv from 'dotenv';
dotenv.config();

const config: CompoundConfig = {
  comptrollerAddress: '0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B',
  cETHAddress: '0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5',
  deployBlock: 7710671,
  defaultBlockStep: 50000,
  multicallSize: 200,
  network: 'ETH'
};

async function RunCompoundParser() {
  const rpcUrl = process.env.RPC_URL_ETH;
  if (!rpcUrl) {
    throw new Error('Could not find env variable "RPC_URL_ETH"');
  }
  const compoundParser = new CompoundParser(config, rpcUrl, 'ethereum_compound.json', 24, 1);
  await compoundParser.main();
}

RunCompoundParser();
