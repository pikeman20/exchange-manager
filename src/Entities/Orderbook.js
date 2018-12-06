function Orderbook(exchange, market_name, buys, sells){
    return {
        exchange: exchange,
        market: market_name,
        buys: buys,
        sells: sells
    }
}

module.exports = Orderbook;