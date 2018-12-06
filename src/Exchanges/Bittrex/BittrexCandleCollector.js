var request = require('request');
var jsonic = require('jsonic');

var Exchange = require('../../Entities/Exchange');
var ChartCandles = require('../../Entities/ChartCandles');
var Event = require('../../Entities/Event');

function BittrexCandleCollector(dataCallback, eventCallback){
    var self = this;
    this.exchange = new Exchange("Bittrex", "BTRX");

    this.getSupportedIntervals = function(){
        return self.intervals;
    };

    this.startCollecting = function(market_name, interval, readyCallback){
        if(self.intervals.indexOf(interval) == -1)
           self.eventCallback(new Event(self.exchange, "Error", "Interval Not Supported On Bittrex"));

        else {

            if (self._storage[market_name.full] == undefined)
                self._storage[market_name.full] = {};

            if (self._storage[market_name.full][interval] == undefined) {
                self._storage[market_name.full][interval] = {};
                self._storage[market_name.full][interval].data = [];
                self._storage[market_name.full][interval].timer = null;
                self._storage[market_name.full][interval].garbage = false;
            }

            if (self._storage[market_name.full][interval].timer == undefined) {
                self._doCollect(market_name, interval, readyCallback);
                self._storage[market_name.full][interval].timer = setInterval(function(){
                    self._doCollect(market_name, interval, readyCallback)
                }, 60 * 1000);
            }
            else if(self._storage[market_name.full][interval].garbage != false) {
                self.eventCallback(new Event(self.exchange, "Status", "Continue Collection For Bittrex " + market_name.full + " - " + interval));
                clearTimeout(self._storage[market_name.full][interval].garbage);
                self._storage[market_name.full][interval].garbage = false;
                if (readyCallback != undefined)
                    readyCallback();
            }
        }
    };

    this.stopCollecting = function(market_name, interval){
        if(self._storage[market_name.full] != undefined && self._storage[market_name.full][interval] != undefined && self._storage[market_name.full][interval].timer != undefined){
            self.eventCallback(new Event(self.exchange, "Status", "Scheduled Collection Stop For Bittrex " + market_name.full + " - " + interval));
            self._storage[market_name.full][interval].garbage = setTimeout(function() {
                clearInterval(self._storage[market_name.full][interval].timer);
                self._storage[market_name.full][interval].timer = null;
                self._storage[market_name.full][interval].data = [];
                self._storage[market_name.full][interval].garbage = false;
                self.eventCallback(new Event(self.exchange, "Status", "Stopped Collection For Bittrex " + market_name.full + " - " + interval));
            }, 60000);
        }
    };

    this.flushStorage = function(){
        for (var market in self._storage) {
            if (self._storage.hasOwnProperty(market)) {
                for(var interval in self._storage[market]){
                    if (self._storage[market].hasOwnProperty(interval) && self._storage[market][interval].timer != undefined) {
                        try {
                            clearInterval(self._storage[market][interval].timer);
                            self._storage[market][interval].timer = null;
                            self._storage[market][interval].data = [];
                            self._storage[market][interval].garbage = false;
                            self.eventCallback(new Event(self.exchange, "Status", "Stopped Collection For Bittrex " + market + " - " + interval));
                        }
                        catch(error){}
                    }
                }
            }
        }
    };

    this.getCandles = function(market_name, interval){
        if(self._storage[market_name.full] != undefined && self._storage[market_name.full][interval] != undefined)
            return new ChartCandles(self.exchange, market_name, self._storage[market_name.full][interval].data)
    };

    this.getCandlesInRange = function(market_name, interval, from, to, callback){
        if(self._storage[market_name.full] != undefined && self._storage[market_name.full][interval] != undefined) {
            var data = self._storage[market_name.full][interval].data;
            var bars = [];
            for (var i = 0; i < data.length; i++) {
                if (data[i].time >= from && data[i].time <= to) {
                    bars.push(data[i]);
                }
            }

            callback(new ChartCandles(self.exchange, market_name, bars));
        }
    };

    // Private Functions
    this._collectBittrex = function(market_name, interval, callback){
        var temp = interval;
        if(interval == 60)
            interval = 'oneMin';

        else if(interval == 300)
            interval = 'fiveMin';

        else if(interval == 1800)
            interval = 'thirtyMin';

        else if(interval == 3600)
            interval = 'hour';

        else if(interval == 86400)
            interval = 'day';

        request("https://bittrex.com/api/v2.0/pub/market/GetTicks?marketName=" + market_name.full + '&tickInterval=' + interval, function (error, response, body) {
            if (error)
                self.eventCallback(new Event(self.exchange, "Error", "Bittrex Data collection call Failed " + market_name.full + " " + temp + " " + error + " " + body));

            else {
                try {
                    self.eventCallback(new Event(self.exchange, "Status", "Bittrex Data collection call " + market_name.full + " " + temp));
                    var data = jsonic(body);
                    if (data != undefined && data.success == true) {
                        var candles = [];
                        if (data.result != undefined) {
                            data.result.forEach(function (item) {
                                var datetime = new Date(item.T + '+0000');
                                var millisec = datetime.getTime();
                                candles.push({
                                    time: millisec,
                                    close: item.C,
                                    open: item.O,
                                    high: item.H,
                                    low: item.L,
                                    volume: item.BV
                                });
                            });
                        }
                        callback(candles);
                    }
                }
                catch(error){
                    self.eventCallback(new Event(self.exchange, "Error", "JSON Parse Error For BittrexCandleCollector: " + market_name.full + " " + temp + " " + error + " " + body));
                }
            }
        });
    };

    this._doCollect = function(market_name, interval, readyCallback){
        self._collectBittrex(market_name, interval, function (newCandles) {
            var oldCandles = self._storage[market_name.full][interval].data;

            var lastOldCandleTime = 0;
            if (oldCandles.length > 0)
                lastOldCandleTime = oldCandles[oldCandles.length - 1].time;

            var updatedCandles = [];

            for (var nc = 0; nc < newCandles.length; nc++) {
                if (newCandles[nc].time == lastOldCandleTime) {
                    oldCandles[oldCandles.length - 1] = newCandles[nc];
                    updatedCandles.push(newCandles[nc]);
                }
                else if (newCandles[nc].time > lastOldCandleTime) {
                    oldCandles.push(newCandles[nc]);
                    updatedCandles.push(newCandles[nc]);
                }
            }

            self._storage[market_name.full][interval].data = oldCandles;

            //self.dataCallback(new ChartCandles(self.exchange, market_name, updatedCandles));

            if (lastOldCandleTime == 0 && readyCallback != undefined)
                readyCallback();
        });
    };

    //Init
    if(dataCallback == undefined || eventCallback == undefined )
        throw new Event(self.exchange, "Error", "All callback functions must be set before initiating");

    this.intervals = [60, 300, 1800, 3600, 86400]; //In seconds
    this.exchange = new Exchange("Bittrex", "BTRX");
    this.dataCallback = dataCallback;
    this.eventCallback = eventCallback;
    this._storage = {};
}

module.exports = BittrexCandleCollector;