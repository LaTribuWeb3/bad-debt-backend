import { ProtocolParser } from '../ProtocolParser';
import { CompoundConfig } from './CompoundConfig';

export abstract class CompoundParser extends ProtocolParser {
  config: CompoundConfig;

  constructor(config: CompoundConfig, rpcURL: string, heavyUpdateInterval = 24, fetchDelayInHours = 1) {
    super(rpcURL, heavyUpdateInterval, fetchDelayInHours);
    this.config = config;
  }
}
