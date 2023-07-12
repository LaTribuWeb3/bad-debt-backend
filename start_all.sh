# this script should only be used with correctly configured pm2 config file
# this is not used to testing (named bad-debt-backend.pm2.config.js)

echo "Restarting all bad debt runners"
pm2 restart bad-debt-backend.pm2.config.js --only bdts-opt-sonne -s
echo "started bdts-opt-sonne. Waiting before starting next"
sleep 120
pm2 restart bad-debt-backend.pm2.config.js --only bdts-aurora-aurigami -s
echo "started bdts-aurora-aurigami. Waiting before starting next"
sleep 120
pm2 restart bad-debt-backend.pm2.config.js --only bdts-aurora-bastion -s
echo "started bdts-aurora-bastion. Waiting before starting next"
sleep 120
pm2 restart bad-debt-backend.pm2.config.js --only bdts-eth-rari -s
echo "started bdts-eth-rari. Waiting before starting next"
sleep 120
pm2 restart bad-debt-backend.pm2.config.js --only bdts-eth-compound -s
echo "started bdts-eth-compound. Waiting before starting next"
sleep 120
pm2 restart bad-debt-backend.pm2.config.js --only bdts-eth-inverse -s
echo "started bdts-eth-inverse. Waiting before starting next"
sleep 120
pm2 restart bad-debt-backend.pm2.config.js --only bdts-eth-ironbank -s
echo "started bdts-eth-ironbank. Waiting before starting next"
sleep 120
pm2 restart bad-debt-backend.pm2.config.js --only bdts-bsc-rikkei -s
echo "started bdts-bsc-rikkei. Waiting before starting next"
sleep 120
pm2 restart bad-debt-backend.pm2.config.js --only bdts-bsc-apeswap -s
echo "started bdts-bsc-apeswap. Waiting before starting next"
sleep 120
pm2 restart bad-debt-backend.pm2.config.js --only bdts-avax-traderjoe -s
echo "started bdts-avax-traderjoe. Waiting before starting next"
sleep 120
pm2 restart bad-debt-backend.pm2.config.js --only bdts-matic-0vix -s
echo "started bdts-matic-0vix. Waiting before starting next"
sleep 120
pm2 restart bad-debt-backend.pm2.config.js --only bdts-moonbeam-moonwell -s
echo "started bdts-moonbeam-moonwell. Waiting before starting next"


pm2 reset all
