function MarketName(base, quote){
    base = base.toUpperCase();
    quote = quote.toUpperCase();

    return {
        full: base + "-" + quote,
        base: base,
        quote: quote
    }
}

module.exports = MarketName;