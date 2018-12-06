var WebSocket = require('ws');
var jsonic = require('jsonic');
var CryptoJS = require('crypto-js');
var request = require('request');
var validator = require('validator');
var Big = require('big.js');

var Message = require('../../Entities/Message');
var Event = require('../../Entities/Event');
var Exchange = require('../../Entities/Exchange');
var Market = require('../../Entities/Market');
var Wallet = require('../../Entities/Wallet');
var Order = require('../../Entities/Order');
var Orderbook = require('../../Entities/Orderbook');
var OrderbookLineItem = require('../../Entities/OrderbookLineItem');
var Fillbook = require('../../Entities/Fillbook');
var Fill = require('../../Entities/Fill');
var MarketName = require('../../Entities/MarketName');
var Trade = require('../../Entities/Trade');

function BinanceSocketClient(messageCallback, eventCallback){
    var self = this;
    this.exchange = new Exchange("Binance", "BINA");
    this.publicKey = null;
    this.privateKey = null;

    this.setKeys = function(publicKey, privateKey){
        this.publicKey = publicKey;
        this.privateKey = privateKey;
    };

    // Public Functions
    this.subscribeToExchangeMarkets = function(){
        if(self._clients["marketsummaries"] == undefined){
            self._clients["marketsummaries"] = {
                connection: undefined,
                status: 1
            };
        }

        self._clients["marketsummaries"].status = 1;

        if(self._clients["marketsummaries"].connection == undefined) {
            self._clients["marketsummaries"].connection = new WebSocket(self._baseURL + "/ws/!ticker@arr");

            self._clients["marketsummaries"].connection.on('open', function () {
                self.eventCallback(new Event(self.exchange, "Status", "Subscribed To Binance Channel: marketsummaries"));

                //If a disconnect order came in right after a connect order, this will be scheduled for deletion
                if(self._clients["marketsummaries"].status == 0)
                    self._clients["marketsummaries"].connection.close();
                else
                    self.queryExchangeMarkets();
            });

            self._clients["marketsummaries"].connection.on('error', function (error) {
                self.eventCallback(new Event(self.exchange, "Error", "Error On Binance Channel: marketsummaries " + error));

                //OnError reconnect. the reconnection code is in the .close() function
                try { self._clients["marketsummaries"].connection.close(); }catch (error){}

                //work around for incorrect wallets!
                //subscribe to user streams will close the old streams and reopen a new one and ask for the state again!
                if( self._clients["userstreams"]!= undefined &&
                    self._clients["userstreams"].status == 1 &&
                    self._clients["userstreams"].connection != undefined &&
                    self._clients["userstreams"].connection.readyState == self._clients["userstreams"].connection.OPEN) {
                        self._clients["userstreams"].connection.close();
                }
            });

            self._clients["marketsummaries"].connection.on('close', function () {
                self.eventCallback(new Event(self.exchange, "Status", "Disconnected From Binance Channel: marketsummaries"));

                self._clients["marketsummaries"].connection = null;
                if(self._clients["marketsummaries"].status == 1)
                    self._retry("marketsummariessocket", function(){self.subscribeToExchangeMarkets()});
            });

            self._clients["marketsummaries"].connection.on('message', function (data) {
                try {
                    data = jsonic(data);
                    self.messageCallback(data);
                }
                catch (error){
                    //the .on('error') will be triggered which will restart the socket
                    self.eventCallback(new Event(self.exchange, "Error", "Error JSON parsing On Binance Channel: marketsummaries " + error + " " + data));
                }
            });
        }
    };

    this.subscribeToMarketBooks = function(market_name){
        var marketname_string = market_name.quote.toLowerCase() + market_name.base.toLowerCase();

        if(self._clients[marketname_string] == undefined){
            self._clients[marketname_string] = {
                connection: undefined,
                status: 1
            };
        }

        //needed for when restarting
        self._clients[marketname_string].status = 1;

        if(self._clients[marketname_string].connection == undefined){
            self._clients[marketname_string].connection = new WebSocket(self._baseURL + "/stream?streams=" + marketname_string + "@depth/" + marketname_string + "@aggTrade");

            self._clients[marketname_string].connection.on('open', function () {
                self.eventCallback(new Event(self.exchange, "Status", "Subscribed To Binance Channel: " + marketname_string));

                //If a disconnect order came in right after a connect order, this will be scheduled for deletion
                if(self._clients[marketname_string].status == 0)
                    self._clients[marketname_string].connection.close();
                else
                    self.queryMarketBooks(market_name);
            });

            self._clients[marketname_string].connection.on('error', function (error) {
                self.eventCallback(new Event(self.exchange, "Error", "Error On Binance Channel: " + marketname_string + " " + error));

                //OnError reconnect. the reconnection code is in the .close() function
                try { self._clients[marketname_string].connection.close(); }catch (error){}
            });

            self._clients[marketname_string].connection.on('close', function () {
                self.eventCallback(new Event(self.exchange, "Status", "Disconnected From Binance Channel: " + marketname_string));

                self._clients[marketname_string].connection = null;

                if(self._clients[marketname_string].status == 1)
                    self._retry(marketname_string + "socket", function(){self.subscribeToMarketBooks(market_name)});
            });

            self._clients[marketname_string].connection.on('message', function (data) {
                try {
                    data = jsonic(data);
                    self.messageCallback(data.data);
                }
                catch (error){
                    //the .on('error') will be triggered which will restart the socket
                    self.eventCallback(new Event(self.exchange, "Error", "Error JSON parsing On Binance Channel: " + marketname_string + " " + error + " " + data));
                }
            });
        }
    };

    this.subscribeToUserStreams = function(){
        if(this.publicKey == undefined || this.privateKey == undefined)
            self.eventCallback(new Event(self.exchange, "Error", "Keys Must Be Set For SubscribeToUserStreams"));

        else {
            if(self._clients["userstreams"] == undefined){
                self._clients["userstreams"] = {
                    connection: undefined,
                    status: 1,
                    timer: null
                };
            }

            self._clients["userstreams"].status = 1;

            if(self._clients["userstreams"].connection == undefined){

                self._getListenKey(function(listenKey){

                    //Disconnect request could have come in while REST is working
                    if(self._clients["userstreams"].status == 1){

                        //Extend key lifetime
                        if(self._clients["userstreams"].timer != undefined) {
                            clearInterval(self._clients["userstreams"].timer);
                            self._clients["userstreams"].timer = null;
                        }
                        self._clients["userstreams"].timer = setInterval(function () {
                            request.put({
                                url: "https://api.binance.com/api/v1/userDataStream?listenKey=" + listenKey,
                                headers: {'X-MBX-APIKEY': self.publicKey}
                            }, function (error, response, body) {
                                if(error || response.statusCode != 200) {
                                    self.eventCallback(new Event(self.exchange, "Error", "Unable to extend lifetime of key for Binance channel: UserStreams - " + listenKey + " " + error + " " + body));
                                    try { self._clients["userstreams"].connection.close(); } catch (error){}
                                }
                                else
                                    self.eventCallback(new Event(self.exchange, "Status", "Listenkey lifetime extended for Binance channel: UserStreams - " + listenKey));
                            });
                        }, 1800000);


                        //Connect the socket
                        self._clients["userstreams"].connection = new WebSocket("wss://stream.binance.com:9443/ws/" + listenKey);

                        self._clients["userstreams"].connection.on('open', function () {
                            self.eventCallback(new Event(self.exchange, "Status", "Subscribed To Binance Channel: UserStreams - " + listenKey));

                            //If a disconnect order came in right after a connect order, this will be scheduled for deletion
                            if(self._clients["userstreams"].status == 0)
                                self._clients["userstreams"].connection.close();
                            else
                                self.queryUserStreams();
                        });

                        self._clients["userstreams"].connection.on('error', function (error) {
                            self.eventCallback(new Event(self.exchange, "Error", "Error On Binance Channel: UserStreams - " + listenKey + " " + error));

                            //OnError reconnect. the reconnection code is in the .close() function
                            try { self._clients["userstreams"].connection.close(); } catch (error){}
                        });

                        self._clients["userstreams"].connection.on('close', function () {
                            self.eventCallback(new Event(self.exchange, "Status", "Disconnected From Binance Channel: UserStreams - " + listenKey));

                            self._clients["userstreams"].connection = null;

                            if(self._clients["userstreams"].status == 1)
                                self._retry("userstreamssocket", function(){self.subscribeToUserStreams()});
                            else
                                self.unsubscribeFromUserStreams(); //to clean up the timer!

                        });

                        self._clients["userstreams"].connection.on('message', function (message) {
                            try {
                                message = jsonic(message);
                                self.messageCallback(message);
                            }
                            catch (error) {
                                //the .on('error') will be triggered which will restart the socket
                                self.eventCallback(new Event(self.exchange, "Error", "Error JSON parsing On Binance Channel: UserStreams " + error + " " + message));
                            }
                        });
                    }
                });
            }
        }
    };

    this.queryExchangeMarkets = function(){
        request("https://www.binance.com/api/v1/ticker/24hr", function (error, response, body) {
            if(error) {
                self.eventCallback(new Event(self.exchange, "Error", "Error Querying Binance Endpoint: ExchangeMarkets (Market Summaries) " + error + " " + body));

                //we retry because without this we cannot get the state
                if(!self._forceDisconnect)
                    self._retry("queryExchangeMarkets", function(){self.queryExchangeMarkets()});
            }

            else {
                var data = jsonic(body);
                if(data == undefined || data.code != undefined) {
                    self.eventCallback(new Event(self.exchange, "Error", "Error Parsing JSON For Binance Endpoint: ExchangeMarkets (Market Summaries) " + body));

                    //we retry because without this we cannot get the state
                    if(!self._forceDisconnect)
                        self._retry("queryExchangeMarkets", function(){self.queryExchangeMarkets()});
                }

                else {
                    self.eventCallback(new Event(self.exchange, "Status", "Query To Binance REST: QueryExchangeMarkets"));

                    var markets = [];
                    data.forEach(function (item){
                        var marketName = self._getMarketName(item.symbol);

                        //Binance has a market named 123456 in their api data for some reason!
                        if(item.symbol != "123456" && marketName != undefined) {
                            markets.push(new Market(self.exchange, marketName, item.openPrice, item.highPrice, item.lowPrice, item.lastPrice, item.quoteVolume, item.bidPrice, item.askPrice, "https://www.binance.com/trade.html?symbol=" + item.symbol));
                        }
                    });

                    self.messageCallback(new Message(
                        self.exchange,
                        "ExchangeMarkets",
                        0,
                        markets
                    ));
                }
            }
        });
    };

    this.queryMarketBooks = function(market_name){
        var marketname_string = market_name.quote + market_name.base;

        request('https://www.binance.com/api/v1/depth?limit=1000&symbol=' + marketname_string, function (error, response, body) {
            if(error) {
                self.eventCallback(new Event(self.exchange, "Error", "Error Querying Binance Endpoint: " + marketname_string + " - depth " + error + " " + body));

                //we retry because without this we cannot get the state
                if(!self._forceDisconnect)
                    self._retry("queryMarketBooks", function(){self.queryMarketBooks(market_name)});
            }

            else {
                var data = jsonic(body);
                if(data == undefined || data.code != undefined) {
                    self.eventCallback(new Event(self.exchange, "Error", "Error Parsing JSON For Binance Endpoint: " + marketname_string + " - depth " + body));

                    //we retry because without this we cannot get the state
                    if(!self._forceDisconnect)
                        self._retry("queryMarketBooks", function(){self.queryMarketBooks(market_name)});
                }

                else {
                    self.eventCallback(new Event(self.exchange, "Status", "Query To Binance REST: QueryMarketOrderbook - " + marketname_string));

                    var buys = [];
                    var sells = [];

                    data.bids.forEach(function(item){
                        buys.push(new OrderbookLineItem(item[0], item[1]));
                    });

                    data.asks.forEach(function(item){
                        sells.push(new OrderbookLineItem(item[0], item[1]));
                    });

                    self.messageCallback(new Message(
                        self.exchange,
                        "MarketOrderbook",
                        data.lastUpdateId,
                        new Orderbook(self.exchange, market_name, buys, sells)
                    ));
                }
            }
        });

        request('https://www.binance.com/api/v1/aggTrades?limit=1000&symbol=' + marketname_string, function (error, response, body) {
            if(error) {
                self.eventCallback(new Event(self.exchange, "Error", "Error Querying Binance Endpoint: " + marketname_string + " - aggTrades " + error + " " + body));
                if(!self._forceDisconnect)
                    self._retry("queryMarketBooks", function(){self.queryMarketBooks(market_name)});
            }

            else {
                var data = jsonic(body);
                if(data == undefined || data.code != undefined) {
                    self.eventCallback(new Event(self.exchange, "Error", "Error Parsing JSON For Binance Endpoint: " + marketname_string + " - aggTrades " + body));
                    if(!self._forceDisconnect)
                        self._retry("queryMarketBooks", function(){self.queryMarketBooks(market_name)});
                }

                else {
                    self.eventCallback(new Event(self.exchange, "Status", "Query To Binance REST: QueryMarketFillbook - " + marketname_string));

                    var fills = [];

                    data.forEach(function (item){
                        fills.push(new Fill(item.a, item.p, item.q, (new Date(item.T)).toISOString(), (item.m == true ? "SELL" : "BUY")));
                    });

                    self.messageCallback(new Message(
                        self.exchange,
                        "MarketFillbook",
                        0,
                        new Fillbook(self.exchange, market_name, fills.reverse())
                    ));
                }
            }
        });
    };

    this.queryUserStreams = function(){
        if(this.publicKey == undefined || this.privateKey == undefined)
            self.eventCallback(new Event(self.exchange, "Error", "Keys Must Be Set For QueryUserStreams"));

        else {
            self._queryOpenOrders();
            self._queryWallets();
        }
    };

    this.unsubscribeFromMarketBooks = function(market_name){
        var marketname_string = market_name.quote.toLowerCase() + market_name.base.toLowerCase();

        if(self._clients[marketname_string] != undefined && self._clients[marketname_string].connection != undefined){
            self._clients[marketname_string].status = 0;

            if(self._clients[marketname_string].connection != undefined && self._clients[marketname_string].connection.readyState == self._clients[marketname_string].connection.OPEN)
                self._clients[marketname_string].connection.close();
        }
    };

    this.unsubscribeFromAllMarketBooks = function(){
        for (var key in self._clients) {
            if (self._clients.hasOwnProperty(key) && key != "marketsummaries" && key != "userstreams") {
                self._clients[key].status = 0;

                if(self._clients[key].connection != undefined && self._clients[key].connection.readyState == self._clients[key].connection.OPEN)
                    self._clients[key].connection.close();
            }
        }
    };

    this.unsubscribeFromUserStreams = function(){
        if(self._clients["userstreams"] != undefined){
            if(self._clients["userstreams"].timer != undefined) {
                clearInterval(self._clients["userstreams"].timer);
                self._clients["userstreams"].timer = null;
            }

            self._clients["userstreams"].status = 0;
            if(self._clients["userstreams"].connection != undefined && self._clients["userstreams"].connection.readyState == self._clients["userstreams"].connection.OPEN)
                self._clients["userstreams"].connection.close();
        }
    };

    this.disconnect = function(){
        self._forceDisconnect = true;

        for (var key in self._clients) {
            //userstreams handled a few lines below
            if (self._clients.hasOwnProperty(key) && key != "userstreams") {
                self._clients[key].status = 0;

                if(self._clients[key].connection != undefined && self._clients[key].connection.readyState == self._clients[key].connection.OPEN)
                    self._clients[key].connection.close();
            }
        }

        self.unsubscribeFromUserStreams();
    };


    // Internal Functions
    this._getListenKey = function(callback){
        request.post({url: "https://api.binance.com/api/v1/userDataStream", headers: {'X-MBX-APIKEY': self.publicKey}},
            function (error, response, body) {
                if (error) {
                    self.eventCallback(new Event(self.exchange, "Error", "Error Obtaining listenKey For Binance " + error + " " + body));

                    //we retry because without this key we cant connect to the socket
                    if (!self._forceDisconnect)
                        self._retry("getListenKey", function(){self._getListenKey(callback)});
                }
                else {
                    var data = jsonic(body);
                    if (data == undefined || data.code != undefined) {
                        self.eventCallback(new Event(self.exchange, "Error", "Error Parsing listenKey For POST https://api.binance.com/api/v1/userDataStream " + body));

                        //we retry because without this key we cant connect to the socket
                        if (!self._forceDisconnect)
                            self._retry("getListenKey", function(){self._getListenKey(callback)});
                    }
                    else {
                        self.eventCallback(new Event(self.exchange, "Status", "Binance listenKey Acquired - " + data.listenKey));
                        callback(data.listenKey);
                    }
                }
            });
    };

    this._queryOpenOrders = function(){
        var params = "recvWindow=1000000&timestamp=" + self._getRequestTimestamp();
        request({
            url: "https://api.binance.com/api/v3/openOrders?" + params + "&signature=" + self._getURLSignature(params, self.privateKey),
            headers: {'X-MBX-APIKEY': self.publicKey}
        }, function (error, response, body) {
            if (error) {
                self.eventCallback(new Event(self.exchange, "Error", "Unable To QueryUserStreams - OpenOrders " + error + " " + body));

                //we retry because without this we cannot get the state
                if(!self._forceDisconnect)
                    self._retry("queryOpenOrders", function(){self._queryOpenOrders()});
            }

            else {
                var data = jsonic(body);
                if (data == undefined || data.code != undefined) {
                    self.eventCallback(new Event(self.exchange, "Error", "Unable To Parse JSON Response From https://api.binance.com/api/v3/openOrders - " + body));

                    //we retry because without this we cannot get the state
                    if(!self._forceDisconnect)
                        self._retry("queryOpenOrders", function(){self._queryOpenOrders()});
                }

                else {
                    self.eventCallback(new Event(self.exchange, "Status", "Successful Query To Binance REST: QueryUserStreams - OpenOrders"));

                    var openOrders = [];
                    data.forEach(function (item) {
                        var triggers = null;
                        if(item.stopPrice != undefined && item.stopPrice > 0)
                            triggers = {price: item.stopPrice};

                        openOrders.push(new Order(
                            self.exchange,
                            self._getMarketName(item.symbol),
                            item.orderId,
                            'OPEN',
                            item.side,
                            item.type,
                            item.price,
                            item.origQty,
                            item.executedQty,
                            [],
                            item.timeInForce,
                            new Date(item.time).toISOString(),
                            null,
                            null,
                            false,
                            triggers
                        ));
                    });

                    self.messageCallback(new Message(
                        self.exchange,
                        "AccountOrders",
                        0,
                        openOrders
                    ));
                }
            }
        });
    };

    this._queryWallets = function(){
        var params = "recvWindow=1000000&timestamp=" + self._getRequestTimestamp();
        request({
            url: "https://api.binance.com/api/v3/account?" + params + "&signature=" + self._getURLSignature(params, self.privateKey),
            headers: {'X-MBX-APIKEY': self.publicKey}
        }, function (error, response, body) {
            if (error) {
                self.eventCallback(new Event(self.exchange, "Error", "Unable To QueryUserStreams - account " + error + " " + body));

                //we retry because without this we cannot get the state
                if(!self._forceDisconnect)
                    self._retry("queryWallets", function(){self._queryWallets()});
            }

            else {
                var data = jsonic(body);
                if (data == undefined || data.code != undefined) {
                    self.eventCallback(new Event(self.exchange, "Error", "Unable To Parse JSON Response From https://api.binance.com/api/v3/account - " + body));

                    //we retry because without this we cannot get the state
                    if(!self._forceDisconnect)
                        self._retry("queryWallets", function(){self._queryWallets()});
                }

                else {
                    self.eventCallback(new Event(self.exchange, "Status", "Successful Query To Binance REST: QueryUserStreams - account (wallets)"));

                    var wallets = [];
                    data.balances.forEach(function (item) {
                        wallets.push(new Wallet(self.exchange, item.asset, Big(item.locked).plus(item.free).toFixed(8), item.free));
                    });

                    self.messageCallback(new Message(
                        self.exchange,
                        "AccountWallets",
                        data.updateTime,
                        wallets
                    ));
                }
            }
        });
    };

    this._getMarketName = function(marketname_string){
        var bases = ["BNB", "BTC", "ETH", "USDT", "PAX", "TUSD", "DAI", "USDC"];
        for(var i = 0; i < bases.length; i++){
            if(marketname_string.endsWith(bases[i])){
                var quote = marketname_string.slice(0, -1 * bases[i].length);
                return (new MarketName(bases[i], quote));
            }
        }

        return null;
    };

    this._getURLSignature = function(url, secret, raw){
        var signature = CryptoJS.HmacSHA256(url, secret).toString();
        if(raw)
            return signature;
        return validator.escape(signature);
    };

    this._doConnect = function(){
        self._forceDisconnect = false;
        self.subscribeToExchangeMarkets();
    };

    this._getRequestTimestamp = function(){
        return (new Date().getTime() - self._serverTimeDiff - 20000);
    };

    this._getServerTimeDiff = function(){
        var start = new Date().getTime();
        request("https://api.binance.com/api/v1/time", function (error, response, body) {
            var data = jsonic(body);

            if(data.serverTime != undefined) {
                var end = new Date().getTime();
                self._serverTimeDiff = Math.floor(end - data.serverTime + (end - start) / 2);
                self.eventCallback(new Event(self.exchange, "Status", "Adjusted for Binance timestamp difference -> " + self._serverTimeDiff + "ms"));
            }
        });
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


    // Init
    if(messageCallback == undefined || eventCallback == undefined )
        throw new Event(self.exchange, "Error", "All callback functions must be set before initiating");

    this.messageCallback = function(data){
        //if endpoint, id and payload are set, that means it is a query message so just pass it along without normalization
        if(data.endpoint != undefined && data.payload != undefined)
            messageCallback(data);

        else {
            if(data.e == "depthUpdate"){
                var buys = [];
                var sells = [];

                data.b.forEach(function(item){
                    buys.push(new OrderbookLineItem(item[0], item[1]));
                });

                data.a.forEach(function(item){
                    sells.push(new OrderbookLineItem(item[0], item[1]));
                });

                messageCallback(new Message(
                    self.exchange,
                    "MarketOrderbookUpdate",
                    data.U,
                    new Orderbook(self.exchange, self._getMarketName(data.s), buys, sells),
                    {
                        t1: data.U,
                        t2: data.u
                    }
                ));
            }

            else if(data.e == "aggTrade"){
                messageCallback(new Message(
                    self.exchange,
                    "MarketFillbookUpdate",
                    data.t,
                    new Fillbook(self.exchange, self._getMarketName(data.s), [new Fill(data.a, data.p, data.q, (new Date(data.T)).toISOString(), (data.m == true ? "SELL" : "BUY"))])
                ));
            }

            else if(data.e == "executionReport"){
                var closed = "";
                if(data.x == "CANCELED" || data.x == "REJECTED" || data.x == "EXPIRED")
                    closed = new Date(data.T).toISOString();

                var opened = "";
                if(data.x == "NEW")
                    opened = new Date(data.T).toISOString();

                var status = "OPEN";
                if(data.X == "PARTIALLY_FILLED" || data.X == "NEW")
                    status = "OPEN";

                else if(data.X == "CANCELED")
                    status = "CANCELED";
                else
                    status = "CLOSED";

                var triggers = null;
                if(data.P != undefined && data.P > 0)
                    triggers = {price: data.P};

                messageCallback(new Message(
                    self.exchange,
                    "AccountOrdersUpdate",
                    data.T,
                    new Order(
                        self.exchange,
                        self._getMarketName(data.s),
                        data.i,
                        status,
                        data.S,
                        data.o,
                        data.p,
                        data.q,
                        data.z,
                        [
                            new Trade(data.i, data.t, data.L, data.l, (new Date(data.T)).toISOString())
                        ],
                        data.f,
                        opened,
                        closed,
                        new Date(data.T).toISOString(),
                        false,
                        triggers
                    )));
            }

            else if(data.e == "outboundAccountInfo"){
                var wallets = [];
                data.B.forEach(function (item) {
                    wallets.push(new Wallet(self.exchange, item.a, Big(item.l).plus(item.f).toFixed(8), item.f));
                });

                messageCallback(new Message(
                    self.exchange,
                    "AccountWalletsUpdate",
                    data.u,
                    wallets
                ));
            }

            else if(Array.isArray(data) && data[0].e == "24hrTicker"){
                var markets = [];
                data.forEach(function(item){
                    markets.push(new Market(self.exchange, self._getMarketName(item.s), item.o, item.h, item.l, item.c, item.q, item.b, item.a, "https://www.binance.com/trade.html?symbol=" + item.s));
                });

                messageCallback(new Message(
                    self.exchange,
                    "ExchangeMarketsUpdate",
                    0,
                    markets
                ));
            }
        }
    };
    this.eventCallback = eventCallback;

    this._forceDisconnect = false;
    this._baseURL = "wss://stream.binance.com:9443";
    this._clients = {};
    this._serverTimeDiff = 0;
    this._retryQueue = {};

    this._doConnect();
    this._getServerTimeDiff();

    //todo use JSON.parse() instead of JSONIC
}

module.exports = BinanceSocketClient;