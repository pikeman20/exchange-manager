var Big = require('big.js');

function Market(exchange, market_name, open_24h, high_24h, low_24h, last, volume_24h, bid, ask, url){
    open_24h = open_24h ? Big(open_24h).toFixed(8) : "0";
    high_24h = high_24h ? Big(high_24h).toFixed(8) : "0";
    low_24h = low_24h ? Big(low_24h).toFixed(8) : "0";
    last = last ? Big(last).toFixed(8) : "0";
    volume_24h = volume_24h ? Big(volume_24h).toFixed(8) : "0";
    bid = bid ? Big(bid).toFixed(8) : "0";
    ask = ask ? Big(ask).toFixed(8) : "0";
    url = url ? url : "";

    var percentChange24h = "0.00";
    if(!isNaN(parseInt(last)) && !Big(last).eq(0) && !isNaN(parseInt(open_24h)) && !Big(open_24h).eq(0)){
        try {
            percentChange24h = Big(last).minus(open_24h).times(100).div(open_24h).toFixed(2);
        }
        catch (error){}
    }

    return {
        exchange: exchange,
        name: market_name,
        last: last,
        open24h: open_24h,
        high24h: high_24h,
        low24h: low_24h,
        volume24h: volume_24h,
        percentChange24h: percentChange24h,
        bid: bid,
        ask: ask,
        url: url
    };
}

module.exports = Market;