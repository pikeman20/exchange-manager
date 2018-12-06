function MarketOrderRules(exchange, market_name, rules){

    return {
        exchange: exchange,
        market: market_name,
        rules: rules
    }
}

module.exports = MarketOrderRules;