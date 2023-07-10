# Bad Debt Backend

This is the backend of the RiskDAO's [Bad Debt Dashboard](https://bad-debt.riskdao.org/)

## Install
```
npm install
npm run build
```

## Required environment variables

Always needed:
- WEB3_API_URL
- RPC_URL_{{NETWORK}} (for the network of the runner you want to start)

Needed only if network = ETHEREUM
- ZAPPER_KEY

### WEB3_API_URL:
The url of the instance of the Web3 API you're running.
If you run it locally: http://localhost:8080

### RPC_URL_{{NETWORK}}

Examples:
- RPC_URL_ETH
- RPC_URL_BSC
- RPC_URL_CRONOS
- RPC_URL_MATIC
- RPC_URL_AVAX
- RPC_URL_GNOSIS
- RPC_URL_NEAR
- RPC_URL_OPTIMISM



## Run a parser

In the `src/runners` directory, you can find many .ts files. This files are each responsible for running a protocol parser.

## Add a parser for a Compound fork

Adding a new parser for a protocol that is a fork of compound is quite simple.

Let's say the new protocol you're adding is named "Proto"

- Create a new config file here: `src/configs/ProtoConfig.json`. This file should contains all required infos.
- Create a new parser here: `src/parsers/compound/ProtoParser.ts`. If not specificities, just a class that inherit the CompoundParser class is enough
- Create a new runner here: `src/runners/ProtoRunner.ts` which will import the config file, initialize an instance of the ProtoParser class and start the main() function

Examples of Compound forks: Sonne Finance, Rari-Capital, Aurigami

