function Asset(exchange, name, short){
    return {
        exchange: exchange,
        name: name,
        short: short
    };
}

module.exports = Asset;