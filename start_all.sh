# this script should only be used with correctly configured pm2 config file (named bad-debt-backend.pm2.config.js)
# this is not used for testing or local dev

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
pm2 restart bad-debt-backend.pm2.config.js --only bdts-bsc-venus -s
echo "started bdts-bsc-venus. Waiting before starting next"
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
sleep 120
pm2 restart bad-debt-backend.pm2.config.js --only bdts-avax-benqi -s
echo "started bdts-avax-benqi. Waiting before starting next"
sleep 120
pm2 restart bad-debt-backend.pm2.config.js --only bdts-cro-tectonic -s
echo "started bdts-cro-tectonic. Waiting before starting next"
sleep 120
pm2 restart bad-debt-backend.pm2.config.js --only bdts-eth-aave -s
echo "started bdts-eth-aave. Waiting before starting next"
sleep 120
# pm2 restart bad-debt-backend.pm2.config.js --only bdts-gnosis-agave -s
# echo "started bdts-gnosis-agave. Waiting before starting next"
# sleep 120
pm2 restart bad-debt-backend.pm2.config.js --only bdts-ftm-granary -s
echo "started bdts-ftm-granary. Waiting before starting next"
sleep 120
pm2 restart bad-debt-backend.pm2.config.js --only bdts-opt-granary -s
echo "started bdts-opt-granary. Waiting before starting next"


pm2 reset all
