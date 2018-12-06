function ChartCandles(exchange, market_name, candles){
    return {
        exchange: exchange,
        market: market_name,
        candles: candles
    };
}

module.exports = ChartCandles;