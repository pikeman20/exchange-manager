function Fillbook(exchange, market_name, fills){
    return {
        exchange: exchange,
        market: market_name,
        fills: fills
    }
}

module.exports = Fillbook;