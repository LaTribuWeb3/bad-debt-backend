# Bad Debt Backend

This is the backend of the RiskDAO's [Bad Debt Dashboard](https://bad-debt.riskdao.org/)

## Install
```
npm install
npm run build
```

## Add a parser for a Compound fork

Adding a new parser for a protocol that is a fork of compound is quite simple.

Let's say the new protocol you're adding is named "Proto"

- Create a new config file here: `src/configs/ProtoConfig.json`. This file should contains all required infos.
- Create a new parser here: `src/parsers/compound/ProtoParser.ts`. If not specificities, just a class that inherit the CompoundParser class is enough
- Create a new runner here: `src/runners/ProtoRunner.ts` which will import the config file, initialize an instance of the ProtoParser class and start the main() function

Examples of Compound forks: Sonne Finance, Rari-Capital, Aurigami

