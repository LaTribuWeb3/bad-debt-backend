# Bad Debt Backend

This is the backend of the RiskDAO's [Bad Debt Dashboard](https://bad-debt.riskdao.org/)

## Install
```
npm install
npm run build
```

## Required environment variables

Always needed:
- RPC_URL_{{NETWORK}} (for the network of the runner you want to start)

Needed only if network = ETHEREUM
- ZAPPER_KEY

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
- RPC_URL_MOONBEAM



## Run a parser

In the `src/runners` directory, you can find many .ts files. This files are each responsible for running a protocol parser.

## Add a parser for a Compound fork

Adding a new parser for a protocol that is a fork of compound is quite simple.

Let's say the new protocol you're adding is named "Proto"

- Create a new config file here: `src/configs/ProtoConfig.json`. This file should contains all required infos.
- Create a new runner here: `src/runners/ProtoRunner.ts`, then two cases: 
    - if the new protocol does not have any specificities w.r.t Compound: just create an instance of the CompoundParser class
    - if there are any specificities, create a new Parser here: `src/parsers/compound/ProtoParser.ts` and overrite the functions that need to be in order to add the specificities



Examples of Compound forks without specificities: 
- Sonne Finance, 
- Rari-Capital

Examples of Compound forks with specificities: 
- Aurigami
- Moonwell

