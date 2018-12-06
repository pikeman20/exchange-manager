var signalR = require('signalr-client');
var zlib = require('zlib');
var CryptoJS = require('crypto-js');
var Big = require('big.js');
var validator = require('validator');
var jsonic = require('jsonic');
var cloudscraper = require('cloudscraper');
var request = require('request');

var Message = require('../../Entities/Message');
var Event = require('../../Entities/Event');
var Exchange = require('../../Entities/Exchange');
var Market = require('../../Entities/Market');
var Orderbook = require('../../Entities/Orderbook');
var OrderbookLineItem = require('../../Entities/OrderbookLineItem');
var Fillbook = require('../../Entities/Fillbook');
var Fill = require('../../Entities/Fill');
var MarketName = require('../../Entities/MarketName');
var Wallet = require('../../Entities/Wallet');
var Order = require('../../Entities/Order');
var Trade = require('../../Entities/Trade');


function BittrexSocketClient(messageCallback, eventCallback){
    var self = this;
    this.exchange = new Exchange("Bittrex", "BTRX");
    this.publicKey = null;
    this.privateKey = null;

    this.setKeys = function(publicKey, privateKey){
        this.publicKey = publicKey;
        this.privateKey = privateKey;
    };

    // Public Functions

    //todo trading rules for bittrex
    //https://bittrex.com/api/v1.1/public/getmarkets list active and inactive markets

    this.subscribeToExchangeMarkets = function(){
        self._subscribe("SubscribeToSummaryDeltas", undefined, function(){
            self.queryExchangeMarkets();
        });
    };

    this.subscribeToMarketBooks = function(market_name){
        //If we try to sub to a market but the unsub list is too large we restart the socket first then subscribe
        if(self._unsubscribedMarkets.length > 5)
            self._disconnect();

        self._subscribe("subscribeToExchangeDeltas", market_name.full, function(){
            self.queryMarketBooks(market_name);
        });
    };

    this.subscribeToUserStreams = function(){
        if(this.publicKey == undefined || this.privateKey == undefined)
            self.eventCallback(new Event(self.exchange, "Error", "Keys Must Be Set For SubscribeToUserStreams"));

        else
            self._subscribe("GetAuthContext", self.publicKey, function(){
                self.queryUserStreams();
            });
    };

    this.queryExchangeMarkets = function(){
        self._subscribe("QuerySummaryState");
    };

    this.queryMarketBooks = function(market_name){
        self._subscribe("queryExchangeState", market_name.full);
    };

    this.queryUserStreams = function(){
        if(this.publicKey == undefined || this.privateKey == undefined)
            self.eventCallback(new Event(self.exchange, "Error", "Keys Must Be Set For QueryUserStreams"));

        else {
            self._queryWallets();
            self._queryClosedOrders();
            self._queryOpenOrders();
        }
    };

    this.unsubscribeFromMarketBooks = function(market_name){
        var index = self._subscribedMarkets.indexOf(market_name.full);
        if (index !== -1) {
            self._subscribedMarkets.splice(index, 1);
            self._unsubscribedMarkets.push(market_name.full);

            self.eventCallback(new Event(self.exchange, "Status", "Unsubscribed From Bittrex market: " + market_name.full));
        }
    };

    this.unsubscribeFromAllMarketBooks = function(){
        self._subscribedMarkets = [];
        self._disconnect();
    };

    this.unsubscribeFromUserStreams = function(){

        //remove it from subqueue if it is there
        var index = self._subscriptionQueue.indexOf("GetAuthContext");
        if (index !== -1) {
            self._subscriptionQueue.splice(index, 1);
        }

        //restart the socket by disconnecting it. this will get rid of user info
        self._disconnect();
    };

    this.disconnect = function(){
        self._forceDisconnect = true;
        self._subscribedMarkets = [];
        self._subscriptionQueue = [];
        self._disconnect();
    };

    // Internal Functions
    this._subscribe = function(channel, param, callback){
        if(self._client != undefined && (self._client.state.code == 2 || self._client.state.code == 3)) {
            if (param !== undefined) {
                if(channel == "subscribeToExchangeDeltas") {
                    if(self._isUnsubbedFrom(param)){
                        var index = self._unsubscribedMarkets.indexOf(param);
                        if (index !== -1) {
                            self._unsubscribedMarkets.splice(index, 1);
                            self._subscribedMarkets.push(param);

                            if(callback != undefined)
                                callback();

                            return;
                        }
                    }
                }

                self._client.call('c2', channel, param).done(function(err, result){
                    if (err) {
                        if (channel != "GetAuthContext")
                            self.eventCallback(new Event(self.exchange, "Error", "Error Subscribing to Bittrex Channel: " + channel + " - " + param + " " + err));
                        else
                            self.eventCallback(new Event(self.exchange, "Error", "Error Subscribing to Bittrex Channel: " + channel + " " + err));
                    }
                    else {
                        if(channel != "GetAuthContext")
                            self.eventCallback(new Event(self.exchange, "Status", "Subscribed To Bittrex Channel: " + channel + " - " + param));
                        else
                            self.eventCallback(new Event(self.exchange, "Status", "Subscribed To Bittrex Channel: " + channel));

                        //add the market to subscribed list
                        if(channel == "subscribeToExchangeDeltas")
                            self._subscribedMarkets.push(param);

                        if(result != undefined) {
                            //market books state lacks the market name so we embed it here
                            if(channel == "queryExchangeState") {
                                zlib.inflateRaw(Buffer.from(result, 'base64'), function(err, results){
                                    if(!err && results != undefined) {
                                        results = JSON.parse(results);
                                        if(results != undefined) {
                                            results.M = param;
                                            results.tempEP = "queryExchangeState";
                                            self.messageCallback(results);
                                        }
                                    }
                                });
                            }
                            //authenticate the socket connection
                            else if(channel == "GetAuthContext"){
                                self._authenticate(result, callback);
                            }
                        }

                        if(callback != undefined && channel != "GetAuthContext")
                            callback();
                    }
                });
            }
            else {
                self._client.call('c2', channel).done(function(err, result) {
                    if (err)
                        self.eventCallback(new Event(self.exchange, "Error", "Error Subscribing to Bittrex Channel: " + channel));

                    else {
                        self.eventCallback(new Event(self.exchange, "Status", "Subscribed To Bittrex Channel: " + channel));

                        if(callback != undefined)
                            callback();
                    }
                });
            }
        }
        //if _client is not ready we push the request to queue
        else
            self._subscriptionQueue.push(arguments);
    };

    this._isSubbedTo = function (marketname_string){
        var index = self._subscribedMarkets.indexOf(marketname_string);
        if(index !== -1)
            return true;
        return false;
    };

    this._isUnsubbedFrom = function (marketname_string){
        var index = self._unsubscribedMarkets.indexOf(marketname_string);
        if(index !== -1)
            return true;
        return false;
    };

    this._queryOpenOrders = function(){
        var url = 'https://bittrex.com/api/v1.1/market/getopenorders?apikey=' + self.publicKey + '&nonce=' + self._getNonce();
        request({
            url: url,
            headers: {apisign: self._getURLSignature(url, self.privateKey)}
        }, function (error, response, body) {
            if (error) {
                self.eventCallback(new Event(self.exchange, "Error", "Unable To QueryUserStreams - OpenOrders " + error + " " + body));

                //we retry because without this we cannot get the state
                if(!self._forceDisconnect)
                    self._retry("queryOpenOrders", function(){self._queryOpenOrders()});
            }

            else {
                var data = jsonic(body);
                if (data == undefined || data.success == false) {
                    self.eventCallback(new Event(self.exchange, "Error", "Unable To Parse JSON Response From https://bittrex.com/api/v1.1/market/getopenorders - " + body));

                    //we retry because without this we cannot get the state
                    if(!self._forceDisconnect)
                        self._retry("queryOpenOrders", function(){self._queryOpenOrders()});
                }

                else {
                    self.eventCallback(new Event(self.exchange, "Status", "Successful Query To Bittrex REST: QueryUserStreams - OpenOrders"));

                    var openOrders = [];
                    data.result.forEach(function (item) {
                        var type = item.OrderType.split("_");
                        var filled = (Big(item.Quantity).minus(Big(item.QuantityRemaining)).toString());

                        var trades = [];
                        if(item.PricePerUnit != undefined)
                            trades.push(new Trade(item.OrderUuid, 0, item.PricePerUnit, filled, item.Opened + "Z"));

                        openOrders.push(new Order(
                            self.exchange,
                            self._getMarketName(item.Exchange),
                            item.OrderUuid,
                            'OPEN',
                            type[1],
                            type[0],
                            item.Limit,
                            item.Quantity,
                            filled,
                            trades,
                            ((item.ImmediateOrCancel === true) ? "IOC" : 'GTC'),
                            item.Opened + "Z"
                        ));
                    });

                    messageCallback(new Message(
                        self.exchange,
                        "AccountOrders",
                        0,
                        openOrders
                    ));
                }
            }
        });
    };

    this._queryClosedOrders = function(){
        var url = 'https://bittrex.com/api/v1.1/account/getorderhistory?apikey=' + self.publicKey + '&nonce=' + self._getNonce();
        request({
            url: url,
            headers: {apisign: self._getURLSignature(url, self.privateKey)}
        }, function (error, response, body) {
            if (error) {
                self.eventCallback(new Event(self.exchange, "Error", "Unable To QueryUserStreams - ClosedOrders " + error + " " + body));

                //we retry because without this we cannot get the state
                if(!self._forceDisconnect)
                    self._retry("queryClosedOrders", function(){self._queryClosedOrders()});
            }

            else {
                var data = jsonic(body);
                if (data == undefined || data.success == false) {
                    self.eventCallback(new Event(self.exchange, "Error", "Unable To Parse JSON Response From https://bittrex.com/api/v1.1/market/getorderhistory - " + body));

                    //we retry because without this we cannot get the state
                    if(!self._forceDisconnect)
                        self._retry("queryClosedOrders", function(){self._queryClosedOrders()});
                }

                else {
                    self.eventCallback(new Event(self.exchange, "Status", "Successful Query To Bittrex REST: QueryUserStreams - ClosedOrders"));

                    var closedOrders = [];
                    data.result.forEach(function (item) {
                        var type = item.OrderType.split("_");
                        var filled = (Big(item.Quantity).minus(Big(item.QuantityRemaining)).toString());

                        var trades = [];
                        if(item.PricePerUnit != undefined)
                            trades.push(new Trade(item.OrderUuid, 0, item.PricePerUnit, filled, (item.Closed == undefined) ? item.TimeStamp + "Z" : item.Closed + "Z"));

                        var triggers = null;
                        if(item.ConditionTarget != undefined)
                            triggers = {price: item.ConditionTarget};

                        closedOrders.push(new Order(
                            self.exchange,
                            self._getMarketName(item.Exchange),
                            item.OrderUuid,
                            'CLOSED',
                            type[1],
                            type[0],
                            item.Limit,
                            item.Quantity,
                            filled,
                            trades,
                            ((item.ImmediateOrCancel === true) ? "IOC" : 'GTC'),
                            item.TimeStamp + "Z",
                            (item.Closed == undefined) ? undefined : item.Closed + "Z",
                            null,
                            false,
                            triggers
                        ));
                    });

                    messageCallback(new Message(
                        self.exchange,
                        "AccountOrders",
                        1,
                        closedOrders
                    ));
                }
            }
        });
    };

    this._queryWallets = function(){
        var url = 'https://bittrex.com/api/v1.1/account/getbalances?apikey=' + self.publicKey + '&nonce=' + self._getNonce();
        request({
            url: url,
            headers: {apisign: this._getURLSignature(url, self.privateKey)}
        }, function (error, response, body) {
            if (error) {
                self.eventCallback(new Event(self.exchange, "Error", "Unable To QueryUserStreams - Wallets " + error + " " + body));

                //we retry because without this we cannot get the state
                if(!self._forceDisconnect)
                    self._retry("queryWallets", function(){self._queryWallets()});
            }

            else {
                var data = jsonic(body);
                if (data == undefined || data.success == false) {
                    self.eventCallback(new Event(self.exchange, "Error", "Unable To Parse JSON Response From https://bittrex.com/api/v1.1/account/getbalances - " + body));

                    //we retry because without this we cannot get the state
                    if(!self._forceDisconnect)
                        self._retry("queryWallets", function(){self._queryWallets()});
                }

                else {
                    self.eventCallback(new Event(self.exchange, "Status", "Successful Query To Binance REST: QueryUserStreams - Wallets"));

                    var wallets = [];
                    data.result.forEach(function (item) {
                        wallets.push(new Wallet(self.exchange, item.Currency, item.Balance, item.Available, item.Pending, item.CryptoAddress));
                    });

                    messageCallback(new Message(
                        self.exchange,
                        "AccountWallets",
                        0,
                        wallets
                    ));
                }
            }
        });
    };

    this._getNonce = function(){
        return Math.floor(new Date().getTime() / 1000);
    };

    this._getURLSignature = function(url, secret, raw){
        var signature = CryptoJS.HmacSHA512(url, secret).toString();
        if(raw)
            return signature;
        return validator.escape(signature);
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

    this._doConnect = function(){
        self._forceDisconnect = false;
        self._client.start();
    };

    this._doConnectCF = function(){
        if(this.CFtoken != undefined && this.CFagent != undefined) {
            self._client.headers['User-Agent'] = self.CFagent;
            self._client.headers['cookie'] = self.CFtoken;
            self._client.start();
        }
        else {
            cloudscraper.get('https://bittrex.com/', function (error, response, body) {
                if(error)
                    self.eventCallback(new Event(self.exchange, "Error", "Bittrex Socket Cloudflare Error: " + error));

                else {
                    self.eventCallback(new Event(self.exchange, "Status", "Bittrex Socket New CF Token Acquired"));

                    self.CFagent = response.request.headers["User-Agent"];
                    self.CFtoken = ((response.request.headers["cookie"] !== undefined) ? response.request.headers["cookie"] : 'CF not needed');

                    self._client.headers['User-Agent'] = self.CFagent;
                    self._client.headers['cookie'] = self.CFtoken;
                    self._client.start();
                }
            });
        }
    };

    this._disconnect = function(){
        self._client.end();
    };

    this._getMarketName = function(marketname_string){
        var assets = marketname_string.split("-");
        return new MarketName(assets[0], assets[1]);
    };

    this._authenticate = function(challenge, callback){
        //sign the challenge
        var signature = CryptoJS.HmacSHA512(challenge, self.privateKey).toString();
        self._client.call('c2', "Authenticate", self.publicKey, signature).done(function(err, result){
            if (err)
                self.eventCallback(new Event(self.exchange, "Error", "Error Authenticating To Bittrex Channel: Authenticate"));
            else {
                self.eventCallback(new Event(self.exchange, "Status", "Authenticated Bittrex Socket Using Channel: Authenticate"));

                if(callback != undefined)
                    callback();
            }
        });
    };

    // Init
    if(messageCallback == undefined || eventCallback == undefined)
        throw new Event(self.exchange, "Error", "All callback functions must be set before initiating");

    this.messageCallback = function(data){
        if(data.utf8Data != undefined)
            data = JSON.parse(data.utf8Data);

        //market summary state
        if(data.R != undefined && data.R != true && data.R != false) {
            zlib.inflateRaw(Buffer.from(data.R, 'base64'), function(err, results){
                if(!err) {
                    results = JSON.parse(results);

                    if (results != undefined && results.s != undefined) {
                        var markets = [];
                        results.s.forEach(function (item) {
                            markets.push(new Market(self.exchange, self._getMarketName(item.M), item.PD, item.H, item.L, item.l, item.m, item.B, item.A, "https://bittrex.com/Market/Index?MarketName=" + item.M));
                        });

                        messageCallback(new Message(
                            self.exchange,
                            "ExchangeMarkets",
                            results.N,
                            markets
                        ));
                    }
                }
            });
        }

        if(data.M != undefined){
            //Market books state
            if(data.tempEP != undefined && data.tempEP == "queryExchangeState"){
                var buys = [];
                var sells = [];

                data.Z.forEach(function (item) {
                    buys.push(new OrderbookLineItem(item.R, item.Q));
                });

                data.S.forEach(function (item) {
                    sells.push(new OrderbookLineItem(item.R, item.Q));
                });

                messageCallback(new Message(
                    self.exchange,
                    "MarketOrderbook",
                    data.N,
                    new Orderbook(self.exchange, self._getMarketName(data.M), buys, sells)
                ));

                var fills = [];
                data.f.forEach(function (item) {
                    fills.push(new Fill(item.I, item.P, item.Q, (new Date(item.T)).toISOString(), item.OT));
                });

                messageCallback(new Message(
                    self.exchange,
                    "MarketFillbook",
                    data.N,
                    new Fillbook(self.exchange, self._getMarketName(data.M), fills)
                ));
            }
            else {
                data.M.forEach(function (item) {
                    //market summary deltas
                    if (item.M == 'uS') {
                        item.A.forEach(function (market) {
                            zlib.inflateRaw(Buffer.from(market, 'base64'), function (err, results) {
                                if(!err) {
                                    results = JSON.parse(results);

                                    var markets = [];
                                    results.D.forEach(function (entry) {
                                        markets.push(new Market(self.exchange, self._getMarketName(entry.M), entry.PD, entry.H, entry.L, entry.l, entry.m, entry.B, entry.A, "https://bittrex.com/Market/Index?MarketName=" + entry.M));
                                    });

                                    messageCallback(new Message(
                                        self.exchange,
                                        "ExchangeMarketsUpdate",
                                        results.N,
                                        markets
                                    ));
                                }
                            });
                        });
                    }

                    //market book deltas
                    else if (item.M == "uE") {
                        item.A.forEach(function (market) {
                            zlib.inflateRaw(Buffer.from(market, 'base64'), function (err, results) {
                                if(!err) {
                                    results = JSON.parse(results);
                                    if (self._isSubbedTo(results.M) == true) {
                                        var buys = [];
                                        var sells = [];

                                        results.Z.forEach(function (entry) {
                                            buys.push(new OrderbookLineItem(entry.R, entry.Q));
                                        });

                                        results.S.forEach(function (entry) {
                                            sells.push(new OrderbookLineItem(entry.R, entry.Q));
                                        });

                                        messageCallback(new Message(
                                            self.exchange,
                                            "MarketOrderbookUpdate",
                                            results.N,
                                            new Orderbook(self.exchange, self._getMarketName(results.M), buys, sells)
                                        ));

                                        var fills = [];
                                        results.f.forEach(function (entry) {
                                            //ID is auto generated
                                            fills.push(new Fill((Math.floor(Math.random() * 1000000) + 1) + "" + Math.floor(entry.R * entry.Q), entry.R, entry.Q, (new Date(entry.T)).toISOString(), entry.OT));
                                        });

                                        //Sometimes there are no fills so no reason to send an update
                                        if (fills.length > 0) {
                                            messageCallback(new Message(
                                                self.exchange,
                                                "MarketFillbookUpdate",
                                                results.N,
                                                new Fillbook(self.exchange, self._getMarketName(results.M), fills)
                                            ));
                                        }
                                    }
                                }
                            });
                        });
                    }

                    //User balance
                    else if (item.M == "uB"){
                        item.A.forEach(function (market) {
                            zlib.inflateRaw(Buffer.from(market, 'base64'), function (err, results) {
                                if(!err) {
                                    results = JSON.parse(results);

                                    messageCallback(new Message(
                                        self.exchange,
                                        "AccountWalletsUpdate",
                                        results.N,
                                        [new Wallet(self.exchange, results.d.c, results.d.b, results.d.a, results.d.z, results.d.p)]
                                    ));
                                }
                            });
                        });
                    }

                    //Order deltas
                    else if(item.M == "uO"){
                        item.A.forEach(function (market) {
                            zlib.inflateRaw(Buffer.from(market, 'base64'), function (err, results) {
                                if(!err) {
                                    results = JSON.parse(results);

                                    var closeDate = null;
                                    var status = "OPEN";
                                    if(results.o.C != undefined){
                                        closeDate = new Date(results.o.C).toISOString();

                                        if(results.o.q > 0)
                                            status = "CANCELED";
                                        else
                                            status = "CLOSED";
                                    }

                                    var type = results.o.OT.split("_");
                                    if(results.o.J != undefined && results.o.J == "GREATER_THAN")
                                        type[0] = "TAKE_PROFIT_LIMIT";

                                    else if(results.o.J != undefined && results.o.J == "LESS_THAN")
                                        type[0] = "STOP_LOSS_LIMIT";

                                    var filled = (Big(results.o.Q).minus(Big(results.o.q)).toString());

                                    var tradeTime = results.o.Y;
                                    if(results.o.u != undefined)
                                        tradeTime = results.o.u;

                                    var trades = [];
                                    if(filled > 0)
                                        trades.push(new Trade(results.o.OU, results.o.OU, results.o.PU, filled, (new Date(tradeTime)).toISOString()));

                                    var triggers = null;
                                    if(results.o.j != undefined){
                                        triggers = {price : results.o.j}
                                    }

                                    messageCallback(new Message(
                                        self.exchange,
                                        "AccountOrdersUpdate",
                                        results.N,
                                        new Order(
                                            self.exchange,
                                            self._getMarketName(results.o.E),
                                            results.o.OU,
                                            status,
                                            type[1],
                                            type[0],
                                            results.o.X,
                                            results.o.Q,
                                            filled,
                                            trades,
                                            (results.o.K == true) ? "IOC" : "GTC",
                                            (new Date(results.o.Y)).toISOString(),
                                            closeDate,
                                            null,
                                            false,
                                            triggers
                                        )
                                    ));
                                }
                            });
                        });
                    }
                });
            }
        }
    };
    this.eventCallback = eventCallback;
    this.CFagent = null;
    this.CFtoken = null;

    this._retryQueue = {};
    this._forceDisconnect = false;
    this._subscribedMarkets = [];
    this._unsubscribedMarkets = [];
    this._subscriptionQueue = [];
    this._client = new signalR.client("wss://socket.bittrex.com/signalr", ['c2'], undefined, true);
    this._client.serviceHandlers = {
        bound: function(){
            self.eventCallback(new Event(self.exchange, "Status", "Bittrex Socket Bound"));
        },
        connected: function(connection){
            self.eventCallback(new Event(self.exchange, "Status", "Bittrex Socket Connected"));

            //Always start each socket connection by having the market summaries subscription
            self.subscribeToExchangeMarkets();

            //Upon connection, subscribe to all calls that are waiting in the queue
            if(self._subscriptionQueue.length > 0){
                self._subscriptionQueue.forEach(function(item){
                    self._subscribe.apply(null, item);
                });

                //Clean up the queue when done
                self._subscriptionQueue = [];
            }

            //upon connection we also subscribe to all the old markets that were active before we restarted the socket
            if(self._subscribedMarkets.length > 0){
                self._subscribedMarkets.forEach(function(item){
                    self.subscribeToMarketBooks(self._getMarketName(item))
                });
            }
        },
        reconnecting: function(retry){
            self.eventCallback(new Event(self.exchange, "Status", "Bittrex Socket Reconnecting - " + retry));
        },
        connectFailed: function(error){
            self.eventCallback(new Event(self.exchange, "Error", "Bittrex Socket Connection Failed - " + error));

            if(self._forceDisconnect == false)
                self._retry("connectionFailed", function(){self._doConnect()});
        },
        disconnected: function(){
            self.eventCallback(new Event(self.exchange, "Status", "Bittrex Socket Disconnected"));

            //Rest all of the subscription arrays considering that we want to clear the state
            self._unsubscribedMarkets = [];

            //upon disconnect we do reconnect as socket should be always on unless required by user
            if(self._forceDisconnect == false)
                self._retry("disconnection", function(){self._doConnect()});
        },
        onerror: function(errorMsg, error, code){
            if(self._forceDisconnect == false) {
                self.eventCallback(new Event(self.exchange, "Error", "Bittrex Socket Error - " + errorMsg + " - " + code));

                if(errorMsg == "Negotiate Unknown"){
                    self.CFagent = null;
                    self.CFtoken = null;
                    self.eventCallback(new Event(self.exchange, "Status", "Bittrex Negotiate Unknown - Reconnecting With New CF Token"));
                    self._retry("connectionCFError", function () {self._doConnectCF()});
                }
                else {
                    self._retry("connectionError", function () {self._doConnect()});
                }
            }
            else
                self.eventCallback(new Event(self.exchange, "Error", "Bittrex Socket Error - " + errorMsg + " - " + code + " - Forced Stop!"));
        },
        bindingError: function(error){
            self.eventCallback(new Event(self.exchange, "Error", "Bittrex Socket Binding Error - " + error));

            if(self._forceDisconnect == false)
                self._retry("bindingError", function(){self._doConnect()});
        },
        connectionLost: function(error){
            self.eventCallback(new Event(self.exchange, "Error", "Bittrex Socket Connection Lost - " + error));

            if(self._forceDisconnect == false)
                self._retry("connectionLost", function(){self._doConnect()});
        },
        onUnauthorized: function(error){
            self.eventCallback(new Event(self.exchange, "Error", "Bittrex Socket Connection Unauthorized - " + error));

            if(self._forceDisconnect == false)
                self._retry("unauthorized", function(){self._doConnect()});
        },
        messageReceived:  self.messageCallback
    };

    this._doConnect();
}

module.exports = BittrexSocketClient;
