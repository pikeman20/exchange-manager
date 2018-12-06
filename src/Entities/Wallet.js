var Big = require('big.js');

function Wallet(exchange, currency, balance, available, pending, address) {
    balance = balance ? Big(balance).toFixed(8) : 0;
    available = available ? Big(available).toFixed(8) : 0;
    pending = pending ? Big(pending).toFixed(8) : 0;
    address = address ? address : "";

    return {
        exchange: exchange,
        currency: currency.toUpperCase(),
        balance: balance,
        available: available,
        pending: pending,
        address: address
    }
}

module.exports = Wallet;