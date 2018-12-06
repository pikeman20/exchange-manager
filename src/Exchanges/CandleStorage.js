var BittrexCandleCollector = require('./Bittrex/BittrexCandleCollector');
var BinanceCandleCollector = require('./Binance/BinanceCandleCollector');

var Event = require('../Entities/Event');

function CandleStorage(dataCallback, eventCallback){
    var self = this;

    this.startCollecting = function (exchange, market_name, interval, readyCallback){
        if(exchange.short == "BTRX")
            self._bittrexCC.startCollecting(market_name, interval, readyCallback);

        else if(exchange.short == "BINA")
            self._binanceCC.startCollecting(market_name, interval, readyCallback);
    };

    this.stopCollecting = function(exchange, market_name, interval){
        if(exchange.short == "BTRX")
            self._bittrexCC.stopCollecting(market_name, interval);

        else if(exchange.short == "BINA")
            self._binanceCC.stopCollecting(market_name, interval);
    };

    this.flushStorage = function(exchange){
        if(exchange.short == "BTRX")
            self._bittrexCC.flushStorage();

        else if(exchange.short == "BINA")
            self._binanceCC.flushStorage();
    };

    this.flushAllStorage = function(){
        self._bittrexCC.flushStorage();
        self._binanceCC.flushStorage();
    };

    this.getSupportedIntervals = function(exchange){
        if(exchange.short == "BTRX")
            return self._bittrexCC.getSupportedIntervals();

        else if(exchange.short == "BINA")
            return self._binanceCC.getSupportedIntervals();
    };

    this.getCandles = function(exchange, market_name, interval){
        if(exchange.short == "BTRX")
            return self._bittrexCC.getCandles(market_name, interval);

        else if(exchange.short == "BINA")
            return self._binanceCC.getCandles(market_name, interval);
    };

    this.getCandlesInRange = function(exchange, market_name, interval, from, to, callback){
        if(exchange.short == "BTRX")
            return self._bittrexCC.getCandlesInRange(market_name, interval, from, to, callback);

        else if(exchange.short == "BINA")
            return self._binanceCC.getCandlesInRange(market_name, interval, from, to, callback);
    };

    // Init
    if(dataCallback == undefined || eventCallback == undefined )
        throw new Event(self.constructor.name, "Error", "All callback functions must be set before initiating");

    this._bittrexCC = new BittrexCandleCollector(dataCallback, eventCallback);
    this._binanceCC = new BinanceCandleCollector(dataCallback, eventCallback);
}

module.exports = CandleStorage;