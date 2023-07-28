import { ProtocolParser } from "../ProtocolParser";
import { MaiConfig } from "./MaiConfig";

export class MaiParser extends ProtocolParser {
    config: MaiConfig;
    constructor(
        config: MaiConfig,
        runnerName: string,
        rpcURL: string,
        outputJsonFileName: string,
        heavyUpdateInterval?: number,
        fetchDelayInHours?: number
    ){
    super(runnerName, rpcURL, outputJsonFileName, heavyUpdateInterval, fetchDelayInHours);
    this.config = config;
    }


    initPrices(): Promise<void> {
        throw new Error("Method not implemented.");
    }
    getFallbackPrice(address: string): Promise<number> {
        throw new Error("Method not implemented.");
    }
    fetchUsersData(blockNumber: number): Promise<void> {
        throw new Error("Method not implemented.");
    }
    

}