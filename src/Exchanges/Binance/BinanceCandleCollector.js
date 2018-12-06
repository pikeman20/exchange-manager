var request = require('request');
var jsonic = require('jsonic');
var WebSocket = require('ws');

var Exchange = require('../../Entities/Exchange');
var ChartCandles = require('../../Entities/ChartCandles');
var Event = require('../../Entities/Event');

function BinanceCandleCollector(dataCallback, eventCallback){
    var self = this;
    this.exchange = new Exchange("Binance", "BINA");

    this.getSupportedIntervals = function(){
        return self.intervals;
    };

    this.startCollecting = function(market_name, interval, readyCallback){
        if(self.intervals.indexOf(interval) == -1)
            self.eventCallback(new Event(self.exchange, "Error", "Interval Not Supported On Binance"));

        else {
            if (self._storage[market_name.full] == undefined)
                self._storage[market_name.full] = {};

            if (self._storage[market_name.full][interval] == undefined) {
                self._storage[market_name.full][interval] = {};
                self._storage[market_name.full][interval].data = [];
                self._storage[market_name.full][interval].client = null;
                self._storage[market_name.full][interval].timer = null;
                self._storage[market_name.full][interval].status = 1;
                self._storage[market_name.full][interval].completeSet = false;
            }

            self._storage[market_name.full][interval].status = 1;

            if (self._storage[market_name.full][interval].client == undefined) {
                self._storage[market_name.full][interval].client = new WebSocket("wss://stream.binance.com:9443/ws/" + market_name.quote.toLowerCase() + market_name.base.toLowerCase()  + "@kline_" + self._sec2interval(interval));

                self._storage[market_name.full][interval].client.on('open', function () {
                    self.eventCallback(new Event(self.exchange, "Status", "Binance CandleCollector Connected To Channel: " + market_name.full + " " + interval));

                    self._collectBinance(market_name, interval, readyCallback);

                    //If a disconnect order came in right after a connect order, this will be scheduled for deletion
                    if(self._storage[market_name.full][interval].status == 0 && self._storage[market_name.full][interval].client != undefined)
                        self._storage[market_name.full][interval].client.close();
                });

                self._storage[market_name.full][interval].client.on('error', function (error) {
                    self.eventCallback(new Event(self.exchange, "Status", "Error On CandleCollector Channel: " + market_name.full + " " + interval + " " + error));

                    //OnError reconnect. the reconnection code is in the .close() function
                    try { self._storage[market_name.full][interval].client.close(); }catch (error){}
                });

                self._storage[market_name.full][interval].client.on('close', function () {
                    self.eventCallback(new Event(self.exchange, "Status", "Binance CandleCollector Disconnected From Channel: " + market_name.full + " " + interval));

                    self._storage[market_name.full][interval].client = null;
                    if(self._storage[market_name.full][interval].status == 1)
                        self._retry(market_name.full + "socket", function(){self.startCollecting(market_name, interval, readyCallback)});
                });

                self._storage[market_name.full][interval].client.on('message', function (data) {
                    try {
                        data = jsonic(data);
                        if(data.e == "kline"){
                            if(self._storage[market_name.full][interval].data.length > 0) {
                                var lastbar = self._storage[market_name.full][interval].data[self._storage[market_name.full][interval].data.length - 1];
                                var newCandle = {
                                    time: data.k.t,
                                    close: parseFloat(data.k.c),
                                    open: parseFloat(data.k.o),
                                    high: parseFloat(data.k.h),
                                    low: parseFloat(data.k.l),
                                    volume: parseFloat(data.k.q)
                                };


                                //If bar exist with same timestamp
                                if (lastbar.time == newCandle.time)
                                    self._storage[market_name.full][interval].data[self._storage[market_name.full][interval].data.length - 1] = newCandle;

                                else
                                    self._storage[market_name.full][interval].data.push(newCandle);
                            }
                            /*
                            else
                                self.eventCallback(new Event(self.exchange, "Warning", "Initial Candle State not found for BinanceCandleCollector: " + market_name.full + " " + interval));
                                */
                        }
                    }
                    catch(error){
                        self.eventCallback(new Event(self.exchange, "Error", "JSON Parse Error For BinanceCandleCollector: " + market_name.full + " " + interval + " " + data));
                    }
                });
            }
            else {
                self.eventCallback(new Event(self.exchange, "Status", "Continued DataCollection For Binance Market: " + market_name.full + " - " + interval));
                if(readyCallback != undefined)
                    readyCallback();
            }
        }
    };

    this.stopCollecting = function(market_name, interval){
        if(self._storage[market_name.full] != undefined && self._storage[market_name.full][interval] != undefined && self._storage[market_name.full][interval].status == 1){
            self.eventCallback(new Event(self.exchange, "Status", "Scheduled CandleCollector Stop For Binance Market: " + market_name.full + " - " + interval));

            self._storage[market_name.full][interval].status = 0;
            self._storage[market_name.full][interval].timer = setTimeout(function() {

                if(self._storage[market_name.full][interval].status == 0){
                    try{
                        self._storage[market_name.full][interval].client.close();
                    } catch(error){}

                    self._storage[market_name.full][interval].data = [];
                    self._storage[market_name.full][interval].completeSet = false;
                }

                clearTimeout(self._storage[market_name.full][interval].timer);
                self._storage[market_name.full][interval].timer = null;
            }, 120000);
        }
    };

    this.flushStorage = function(){
        for (var market in self._storage) {
            if (self._storage.hasOwnProperty(market)) {
                for(var interval in self._storage[market]){
                    if (self._storage[market].hasOwnProperty(interval)) {
                        try {
                            self._storage[market][interval].status = 0;

                            try {
                                self._storage[market][interval].client.close();
                                self._storage[market][interval].client = null;
                            }
                            catch (error) {}
                            self._storage[market][interval].data = [];
                            self._storage[market][interval].completeSet = false;

                            //connection could be already marked for deletion from stopCollecting()
                            if(self._storage[market][interval].timer != undefined)
                                clearTimeout(self._storage[market][interval].timer);

                            self._storage[market][interval].timer = null;
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
            if(self._storage[market_name.full][interval].data.length > 0 && from < self._storage[market_name.full][interval].data[0].time && self._storage[market_name.full][interval].completeSet == false) {
                request("https://www.binance.com/api/v1/klines?limit=1000&endTime=" + self._storage[market_name.full][interval].data[0].time + "&symbol=" + market_name.quote + market_name.base + '&interval=' + self._sec2interval(interval), function (error, response, body) {
                    if (error)
                        self.eventCallback(new Event(self.exchange, "Error", "Binance CandleCollector Extra Candles Call Failed: " + market_name.full + " " + interval + " " + body));

                    else{
                        try {
                            self.eventCallback(new Event(self.exchange, "Status", "Binance CandleCollector Extra Candles Call Retrieved: " + market_name.full + " " + interval));
                            var result = jsonic(body);
                            if (result != undefined) {

                                if(result[0][0] == self._storage[market_name.full][interval].data[0].time){
                                    self._storage[market_name.full][interval].completeSet = true;
                                }
                                else {
                                    var candles = [];
                                    for (var c = 0; c < result.length; c++) {
                                        //only add earlier bars to the set
                                        if (result[c][0] < self._storage[market_name.full][interval].data[0].time) {
                                            candles.push({
                                                time: result[c][0],
                                                close: parseFloat(result[c][4]),
                                                open: parseFloat(result[c][1]),
                                                high: parseFloat(result[c][2]),
                                                low: parseFloat(result[c][3]),
                                                volume: parseFloat(result[c][7])
                                            });
                                        }
                                    }

                                    //Insert state to storage
                                    self._storage[market_name.full][interval].data = candles.concat(self._storage[market_name.full][interval].data);
                                }

                                if(self._storage[market_name.full][interval].data[0].time <= from) {
                                    var data = self._storage[market_name.full][interval].data;
                                    var bars = [];
                                    for (var i = 0; i < data.length; i++) {
                                        if (data[i].time >= from && data[i].time <= to) {
                                            bars.push(data[i]);
                                        }
                                    }

                                    callback(new ChartCandles(self.exchange, market_name, bars));
                                }
                                else
                                    self.getCandlesInRange(market_name, interval, from, to, callback);
                            }
                        }
                        catch(error){
                            self.eventCallback(new Event(self.exchange, "Error", "Error Processing REST Data For BinanceCandleCollector Extra Candles: " + market_name.full + " " + interval + " " + body));
                        }
                    }
                });
            }
            else {
                var data = self._storage[market_name.full][interval].data;
                var bars = [];
                for (var i = 0; i < data.length; i++) {
                    if (data[i].time >= from && data[i].time <= to) {
                        bars.push(data[i]);
                    }
                }

                callback(new ChartCandles(self.exchange, market_name, bars));
            }
        }
    };

    this._retry = function(id, callback){
        if(self._retryQueue[id] == undefined){
            self._retryQueue[id] = setTimeout(function(){
                clearTimeout(self._retryQueue[id]);
                self._retryQueue[id] = null;
                callback();
            }, 2000);
        }
    };

    // Private Functions
    this._sec2interval = function(interval){
        var kline = null;
        if(interval == 60)
            kline = "1m";

        else if(interval == 180)
            kline = "3m";

        else if(interval == 300)
            kline = "5m";

        else if(interval == 900)
            kline = "15m";

        else if(interval == 1800)
            kline = "30m";

        else if(interval == 3600)
            kline = "1h";

        else if(interval == 7200)
            kline = "2h";

        else if(interval == 14400)
            kline = "4h";

        else if(interval == 21600)
            kline = "6h";

        else if(interval == 28800)
            kline = "8h";

        else if(interval == 43200)
            kline = "12h";

        else if(interval == 86400)
            kline = "1d";

        else if(interval == 259200)
            kline = "3d";

        else if(interval == 604800)
            kline = "1w";

        else if(interval == 2592000)
            kline = "1M";

        return kline;
    };

    this._collectBinance = function(market_name, interval, callback){
        request("https://www.binance.com/api/v1/klines?limit=1000&symbol=" + market_name.quote + market_name.base + '&interval=' + self._sec2interval(interval), function (error, response, body) {
            if (error)
                self.eventCallback(new Event(self.exchange, "Error", "Binance CandleCollector Rest Call Failed: " + market_name.full + " " + interval + " " + body));

            else{
                try {
                    self.eventCallback(new Event(self.exchange, "Status", "Binance CandleCollector State Retrieved: " + market_name.full + " " + interval));
                    var data = jsonic(body);
                    if (data != undefined) {
                        var candles = [];
                        data.forEach(function (item) {
                            candles.push({
                                time: item[0],
                                close: parseFloat(item[4]),
                                open: parseFloat(item[1]),
                                high: parseFloat(item[2]),
                                low: parseFloat(item[3]),
                                volume: parseFloat(item[7])
                            });
                        });

                        //Insert state to storage
                        self._storage[market_name.full][interval].data = candles;

                        if(callback != undefined)
                            callback();
                    }
                }
                catch(error){
                    self.eventCallback(new Event(self.exchange, "Error", "Error Processing REST Data For BinanceCandleCollector: " + market_name.full + " " + interval));
                }
            }
        });
    };


    //Init
    if(dataCallback == undefined || eventCallback == undefined )
        throw new Event(self.exchange, "Error", "All callback functions must be set before initiating");

    this._retryQueue = {};
    this.intervals = [60, 180, 300, 900, 1800, 3600, 7200, 14400, 21600, 28800, 43200, 86400, 259200, 604800, 2592000]; //In seconds
    this.exchange = new Exchange("Binance", "BINA");
    this.dataCallback = dataCallback;
    this.eventCallback = eventCallback;
    this._storage = {};
}

module.exports = BinanceCandleCollector;