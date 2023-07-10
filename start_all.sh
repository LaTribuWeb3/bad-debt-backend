echo "Restarting all bad debt runners"
pm2 reset all -s
echo "bdts-opt-sonne"
pm2 restart bad-debt-backend.pm2.config.js --only bdts-opt-sonne -s
sleep 300
echo "bdts-aurora-aurigami"
pm2 restart bad-debt-backend.pm2.config.js --only bdts-aurora-aurigami -s
sleep 300
echo "bdts-eth-rari"
pm2 restart bad-debt-backend.pm2.config.js --only bdts-eth-rari -s
sleep 300
echo "bdts-eth-compound"
pm2 restart bad-debt-backend.pm2.config.js --only bdts-eth-compound -s
sleep 300
echo "bdts-bsc-rikkei"
pm2 restart bad-debt-backend.pm2.config.js --only bdts-bsc-rikkei -s
sleep 300
echo "bdts-avax-traderjoe"
pm2 restart bad-debt-backend.pm2.config.js --only bdts-avax-traderjoe -s
sleep 300
echo "bdts-aurora-bastion"
pm2 restart bad-debt-backend.pm2.config.js --only bdts-aurora-bastion -s
sleep 300
echo "bdts-matic-0vix"
pm2 restart bad-debt-backend.pm2.config.js --only bdts-matic-0vix -s
