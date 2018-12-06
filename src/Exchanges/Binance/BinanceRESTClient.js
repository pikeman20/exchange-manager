var CryptoJS = require('crypto-js');
var request = require('request');
var validator = require('validator');
var Big = require('big.js');
var jsonic = require('jsonic');

var Exchange = require('../../Entities/Exchange');
var Asset = require('../../Entities/Asset');
var Market = require('../../Entities/Market');
var MarketOrderRules = require('../../Entities/MarketOrderRules');
var Orderbook = require('../../Entities/Orderbook');
var OrderbookLineItem = require('../../Entities/OrderbookLineItem');
var Fillbook = require('../../Entities/Fillbook');
var Fill = require('../../Entities/Fill');
var MarketName = require('../../Entities/MarketName');
var Order = require('../../Entities/Order');
var Wallet = require('../../Entities/Wallet');
var Trade = require('../../Entities/Trade');


function BinanceRESTClient(){
    var self = this;
    this.exchange = new Exchange("Binance", "BINA");
    this.publicKey = null;
    this.privateKey = null;
    this._serverTimeDiff = 0;

    this.setKeys = function(publicKey, privateKey){
        this.publicKey = publicKey;
        this.privateKey = privateKey;
    };

    // Public calls
    this.getTradingRules = function(successCallback, failureCallback){
        request('https://api.binance.com/api/v1/exchangeInfo', function (error, response, body) {
            if(error)
                failureCallback(error);

            else {
                var data = jsonic(body);
                if (data == undefined || data.symbols == undefined)
                    failureCallback(data);

                else {
                    var rules = [];

                    data.symbols.forEach(function(item){
                        //Binance has a market named 123456 in their api data for some reason!
                        if(item.symbol != "123456") {
                            rules.push(new MarketOrderRules(
                                self.exchange,
                                self._getMarketName(item.symbol),
                                {
                                    status: item.status,
                                    orderTypes: item.orderTypes,
                                    filters: item.filters
                                }
                            ));
                        }
                    });

                    successCallback(rules);
                }
            }
        });
    };

    this.getExchangeAssets = function(successCallback, failureCallback){
        request('https://www.binance.com/exchange/public/product', function (error, response, body) {
            if(error)
                failureCallback(error);

            else {
                var data = jsonic(body);
                if (data == undefined || data.code != undefined)
                    failureCallback(data);

                else {
                    var temp = [];
                    var Assets = [];
                    data.data.forEach(function (item) {
                        if(temp.indexOf(item.baseAsset) == -1) {
                            temp.push(item.baseAsset);
                            Assets.push(new Asset(self.exchange, item.baseAssetName, item.baseAsset));
                        }
                    });
                    successCallback(Assets);
                }
            }
        });
    };

    this.getExchangeMarkets = function(successCallback, failureCallback){
        request('https://api.binance.com/api/v1/ticker/24hr', function (error, response, body) {
            if(error)
                failureCallback(error);

            else {
                var data = jsonic(body);
                if (data == undefined || data.code != undefined)
                    failureCallback(data);

                else {
                    var markets = [];
                    data.forEach(function (item){
                        var marketName = self._getMarketName(item.symbol);

                        //Binance has a market named 123456 in their api data for some reason!
                        if(item.symbol != "123456" && marketName != undefined) {
                            markets.push(new Market(self.exchange, marketName, item.openPrice, item.highPrice, item.lowPrice, item.lastPrice, item.quoteVolume, item.bidPrice, item.askPrice, "https://www.binance.com/trade.html?symbol=" + item.symbol));
                        }
                    });
                    successCallback(markets);
                }
            }
        });
    };

    this.getExchangeMarket = function(market_name, successCallback, failureCallback){
        if(market_name.quote == undefined || market_name.base == undefined)
            failureCallback("market object needs to have the quote and base asset names");

        else {
            var marketname_string = market_name.quote + market_name.base;
            request('https://api.binance.com/api/v1/ticker/24hr?symbol=' + marketname_string, function (error, response, body) {
                if (error)
                    failureCallback(error);

                else {
                    var data = jsonic(body);
                    if (data == undefined || data.code != undefined)
                        failureCallback(data);

                    else {
                        var marketName = self._getMarketName(data.symbol);
                        successCallback(new Market(self.exchange, self._getMarketName(marketname_string), data.openPrice, data.highPrice, data.lowPrice, data.lastPrice, data.quoteVolume, data.bidPrice, data.askPrice, "https://www.binance.com/trade.html?symbol=" + data.symbol));
                    }
                }
            });
        }
    };

    this.getMarketOrderbook = function(market_name, successCallback, failureCallback){
        if(market_name.quote == undefined || market_name.base == undefined)
            failureCallback("market object needs to have the quote and base asset names");

        else {
            var marketname_string = market_name.quote + market_name.base;
            request('https://api.binance.com/api/v1/depth?limit=1000&symbol=' + marketname_string, function (error, response, body) {
                if (error)
                    failureCallback(error);

                else {
                    var data = jsonic(body);
                    if (data == undefined || data.code != undefined)
                        failureCallback(data);

                    else {
                        var buys = [];
                        var sells = [];

                        data.bids.forEach(function (item) {
                            buys.push(new OrderbookLineItem(item[0], item[1]));
                        });

                        data.asks.forEach(function (item) {
                            sells.push(new OrderbookLineItem(item[0], item[1]));
                        });

                        successCallback(new Orderbook(self.exchange, self._getMarketName(marketname_string), buys, sells));
                    }
                }
            });
        }
    };

    this.getMarketFillbook = function(market_name, successCallback, failureCallback){
        if(market_name.quote == undefined || market_name.base == undefined)
            failureCallback("market object needs to have the quote and base asset names");

        else {
            var marketname_string = market_name.quote + market_name.base;
            request('https://api.binance.com/api/v1/trades?limit=1000&symbol=' + marketname_string, function (error, response, body) {
                if (error)
                    failureCallback(error);

                else {
                    var data = jsonic(body);
                    if (data == undefined || data.code != undefined)
                        failureCallback(data);

                    else {
                        var fills = [];
                        data.forEach(function (item) {
                            fills.push(new Fill(item.id, item.price, item.qty, (new Date(item.time)).toISOString(), (item.isBuyerMaker == true ? "BUY" : "SELL")));
                        });

                        successCallback(new Fillbook(self.exchange, self._getMarketName(marketname_string), fills.reverse()));
                    }
                }
            });
        }
    };

    // Signed Calls
    this.getAccountWallets = function(successCallback, failureCallback){
        if(this.publicKey == undefined || this.privateKey == undefined)
            failureCallback("Keys must be set");

        else {
            var params = "recvWindow=1000000&timestamp=" + self._getRequestTimestamp();
            request({
                url: "https://api.binance.com/api/v3/account?" + params + "&signature=" + self._getURLSignature(params, self.privateKey),
                headers: {'X-MBX-APIKEY': self.publicKey}
            }, function (error, response, body) {
                if (error)
                    failureCallback(error);

                else {
                    var data = jsonic(body);
                    if (data == undefined || data.code != undefined)
                        failureCallback(data);

                    else {
                        var wallets = [];
                        data.balances.forEach(function (item) {
                            wallets.push(new Wallet(self.exchange, item.asset, Big(item.locked).plus(item.free).toFixed(8), item.free));
                        });
                        successCallback(wallets);
                    }
                }
            });
        }
    };

    this.getAccountOrders = function(successCallback, failureCallback){
        failureCallback("Call not Supported on Binance");
        return false;
    };

    this.getAccountOpenOrders = function(successCallback, failureCallback){
        if(this.publicKey == undefined || this.privateKey == undefined)
            failureCallback("Keys must be set");

        else {
            var params = "recvWindow=1000000&timestamp=" + self._getRequestTimestamp();
            request({
                url: "https://api.binance.com/api/v3/openOrders?" + params + "&signature=" + self._getURLSignature(params, self.privateKey),
                headers: {'X-MBX-APIKEY': self.publicKey}
            }, function (error, response, body) {
                if (error)
                    failureCallback(error);

                else {
                    var data = jsonic(body);
                    if (data == undefined || data.code != undefined)
                        failureCallback(data);

                    else {
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

                        successCallback(openOrders);
                    }
                }
            });
        }
    };

    this.getAccountClosedOrders = function(successCallback, failureCallback){
        failureCallback("Call not Supported on Binance");
        return false;
    };

    this.getAccountOpenOrdersByMarket = function(market_name, successCallback, failureCallback){
        if(this.publicKey == undefined || this.privateKey == undefined)
            failureCallback("Keys must be set");

        else if(market_name.base == undefined || market_name.quote == undefined)
            failureCallback ("market object needs to have the full market name");

        else {
            var params = "recvWindow=1000000&symbol=" + market_name.quote + market_name.base + "&timestamp=" + self._getRequestTimestamp();
            request({
                url: "https://api.binance.com/api/v3/openOrders?" + params + "&signature=" + self._getURLSignature(params, self.privateKey),
                headers: {'X-MBX-APIKEY': self.publicKey}
            }, function (error, response, body) {
                if (error)
                    failureCallback(error);

                else {
                    var data = jsonic(body);
                    if (data == undefined || data.code != undefined)
                        failureCallback(data);

                    else {
                        if(data.length == 0)
                            successCallback([]);
                        else {
                            self._getTradesByMarket(market_name, function (trades) {
                                var openOrders = [];
                                data.forEach(function (order) {
                                    var orderTrades = [];
                                    trades.forEach(function (trade) {
                                        if (trade.order_id == order.orderId)
                                            orderTrades.push(trade);
                                    });

                                    var triggers = null;
                                    if(order.stopPrice != undefined && order.stopPrice > 0)
                                        triggers = {price: order.stopPrice};

                                    openOrders.push(new Order(
                                        self.exchange,
                                        self._getMarketName(order.symbol),
                                        order.orderId,
                                        'OPEN',
                                        order.side,
                                        order.type,
                                        order.price,
                                        order.origQty,
                                        order.executedQty,
                                        orderTrades,
                                        order.timeInForce,
                                        new Date(order.time).toISOString(),
                                        null,
                                        null,
                                        false,
                                        triggers
                                    ));
                                });

                                successCallback(openOrders);
                            }, failureCallback);
                        }
                    }
                }
            });
        }
    };

    this.getAccountClosedOrdersByMarket = function(market_name, successCallback, failureCallback){
        if(this.publicKey == undefined || this.privateKey == undefined)
            failureCallback("Keys must be set");

        else if(market_name.base == undefined || market_name.quote == undefined)
            failureCallback ("market object needs to have the full market name");

        else {
            var params = "recvWindow=1000000&symbol=" + market_name.quote + market_name.base + "&timestamp=" + self._getRequestTimestamp();
            request({
                url: "https://api.binance.com/api/v3/allOrders?" + params + "&signature=" + self._getURLSignature(params, self.privateKey),
                headers: {'X-MBX-APIKEY': self.publicKey}
            }, function (error, response, body) {
                if (error)
                    failureCallback(error);

                else {
                    var data = jsonic(body);
                    if (data == undefined || data.code != undefined)
                        failureCallback(data);

                    else {
                        if(data.length == 0)
                            successCallback([]);
                        else {
                            self._getTradesByMarket(market_name, function (trades) {
                                var closedOrders = [];
                                data.forEach(function (order) {
                                    var orderTrades = [];
                                    var latestTrade = null;

                                    trades.forEach(function (trade) {
                                        if (trade.order_id == order.orderId) {
                                            orderTrades.push(trade);

                                            if(latestTrade == undefined)
                                                latestTrade = trade.time;

                                            else if(new Date(trade.time) > new Date(latestTrade))
                                                latestTrade = trade.time;
                                        }
                                    });

                                    var triggers = null;
                                    if(order.stopPrice != undefined && order.stopPrice > 0)
                                        triggers = {price: order.stopPrice};

                                    if (order.status != "NEW" && order.status != "PARTIALLY_FILLED") {
                                        closedOrders.push(new Order(
                                            self.exchange,
                                            self._getMarketName(order.symbol),
                                            order.orderId,
                                            (order.status == "CANCELED") ? "CANCELED" : "CLOSED",
                                            order.side,
                                            order.type,
                                            order.price,
                                            order.origQty,
                                            order.executedQty,
                                            orderTrades,
                                            order.timeInForce,
                                            new Date(order.time).toISOString(),
                                            (latestTrade == undefined) ? '' : latestTrade,
                                            null,
                                            false,
                                            triggers
                                        ));
                                    }
                                });

                                successCallback(closedOrders);
                            }, failureCallback);
                        }
                    }
                }
            });
        }
    };

    this.getAccountOrderByID = function(market_name, orderID, successCallback, failureCallback){
        if(this.publicKey == undefined || this.privateKey == undefined)
            failureCallback("Keys must be set");

        else if(market_name.base == undefined || market_name.quote == undefined)
            failureCallback ("market object needs to have the full market name");

        else if(orderID == undefined)
            failureCallback("orderID not set");

        else {
            var params = "recvWindow=1000000&orderId=" + orderID + "&symbol=" + market_name.quote + market_name.base + "&timestamp=" + self._getRequestTimestamp();
            request({
                url: "https://api.binance.com/api/v3/order?" + params + "&signature=" + self._getURLSignature(params, self.privateKey),
                headers: {'X-MBX-APIKEY': self.publicKey}
            }, function (error, response, body) {
                if (error)
                    failureCallback(error);

                else {
                    var data = jsonic(body);
                    if (data == undefined || data.code != undefined)
                        failureCallback(data);

                    else {
                        self._getTradesByMarket(market_name, function(trades){

                            var orderTrades = [];
                            trades.forEach(function(trade){
                                if(trade.order_id == data.orderId)
                                    orderTrades.push(trade);
                            });

                            var status = "OPEN";
                            if(data.status == "PARTIALLY_FILLED" || data.status == "NEW")
                                status = "OPEN";
                            else if(data.status == "CANCELED")
                                status = "CANCELED";
                            else
                                status = "CLOSED";

                            var triggers = null;
                            if(data.stopPrice != undefined && data.stopPrice > 0)
                                triggers = {price: data.stopPrice};

                            successCallback(new Order(
                                self.exchange,
                                self._getMarketName(data.symbol),
                                data.orderId,
                                status,
                                data.side,
                                data.type,
                                data.price,
                                data.origQty,
                                data.executedQty,
                                orderTrades,
                                data.timeInForce,
                                new Date(data.time).toISOString(),
                                null,
                                null,
                                false,
                                triggers
                            ));
                        }, failureCallback);
                    }
                }
            });
        }
    };

    this.placeLimitOrder = function(market_name, ppu, size, action, successCallback, failureCallback){
        if(this.publicKey == undefined || this.privateKey == undefined)
            failureCallback("Keys must be set");

        else if(market_name.full == undefined)
            failureCallback ("market object needs to have the full market name");

        else if(action != "buy" && action != "sell")
            failureCallback("action must be buy or sell");

        else {
            var marketname_string = market_name.quote + market_name.base;
            var params = "recvWindow=1000000&side=" + action.toUpperCase() + "&type=LIMIT&timeInForce=GTC&symbol=" + marketname_string + "&price=" + ppu + "&quantity=" + size + "&timestamp=" + self._getRequestTimestamp();
            request.post({
                url: "https://api.binance.com/api/v3/order?" + params + "&signature=" + self._getURLSignature(params, self.privateKey),
                headers: {'X-MBX-APIKEY': self.publicKey}
            }, function (error, response, body) {
                if (error)
                    failureCallback(error);

                else {
                    var data = jsonic(body);
                    if (data == undefined || data.code != undefined)
                        failureCallback(data);

                    else {
                        var status = "OPEN";
                        if(data.status == "PARTIALLY_FILLED" || data.status == "NEW")
                            status = "OPEN";
                        else if(data.status == "CANCELED")
                            status = "CANCELED";
                        else
                            status = "CLOSED";

                        successCallback(new Order(
                            self.exchange,
                            self._getMarketName(data.symbol),
                            data.orderId,
                            status,
                            data.side,
                            data.type,
                            data.price,
                            data.origQty,
                            data.executedQty,
                            [],
                            data.timeInForce,
                            new Date(data.transactTime).toISOString()
                        ));
                    }
                }
            });
        }
    };

    //Stop Loss
    this.placeLimitStopOrder = function(market_name, ppu, size, action, stopPrice, successCallback, failureCallback){
        if(this.publicKey == undefined || this.privateKey == undefined)
            failureCallback("Keys must be set");

        else if(market_name.full == undefined)
            failureCallback ("market object needs to have the full market name");

        else if(action != "buy" && action != "sell")
            failureCallback("action must be buy or sell");

        else {
            var marketname_string = market_name.quote + market_name.base;
            var params = "recvWindow=1000000&side=" + action.toUpperCase() + "&type=STOP_LOSS_LIMIT&timeInForce=GTC&symbol=" + marketname_string + "&price=" + ppu + "&stopPrice=" + stopPrice + "&quantity=" + size + "&timestamp=" + self._getRequestTimestamp();
            request.post({
                url: "https://api.binance.com/api/v3/order?" + params + "&signature=" + self._getURLSignature(params, self.privateKey),
                headers: {'X-MBX-APIKEY': self.publicKey}
            }, function (error, response, body) {
                if (error)
                    failureCallback(error);

                else {
                    var data = jsonic(body);
                    if (data == undefined || data.code != undefined)
                        failureCallback(data);

                    else {
                        self.getAccountOrderByID(market_name, data.orderId, successCallback, failureCallback);

                        /*
                        var status = "OPEN";
                        if(data.status == "PARTIALLY_FILLED" || data.status == "NEW")
                            status = "OPEN";
                        else if(data.status == "CANCELED")
                            status = "CANCELED";
                        else
                            status = "CLOSED";

                        successCallback(new Order(
                            self.exchange,
                            self._getMarketName(data.symbol),
                            data.orderId,
                            status,
                            data.side,
                            data.type,
                            data.price,
                            data.origQty,
                            data.executedQty,
                            [],
                            data.timeInForce,
                            new Date(data.transactTime).toISOString(),
                            null,
                            null,
                            false,
                            {
                                price : data.stopPrice
                            }
                        ));
                        */
                    }
                }
            });
        }
    };

    //Take profit
    this.placeLimitTakeProfitOrder = function(market_name, ppu, size, action, stopPrice, successCallback, failureCallback){
        if(this.publicKey == undefined || this.privateKey == undefined)
            failureCallback("Keys must be set");

        else if(market_name.full == undefined)
            failureCallback ("market object needs to have the full market name");

        else if(action != "buy" && action != "sell")
            failureCallback("action must be buy or sell");

        else {
            var marketname_string = market_name.quote + market_name.base;
            var params = "recvWindow=1000000&side=" + action.toUpperCase() + "&type=TAKE_PROFIT_LIMIT&timeInForce=GTC&symbol=" + marketname_string + "&price=" + ppu + "&stopPrice=" + stopPrice + "&quantity=" + size + "&timestamp=" + self._getRequestTimestamp();
            request.post({
                url: "https://api.binance.com/api/v3/order?" + params + "&signature=" + self._getURLSignature(params, self.privateKey),
                headers: {'X-MBX-APIKEY': self.publicKey}
            }, function (error, response, body) {
                if (error)
                    failureCallback(error);

                else {
                    var data = jsonic(body);

                    if (data == undefined || data.code != undefined)
                        failureCallback(data);

                    else {

                        self.getAccountOrderByID(market_name, data.orderId, successCallback, failureCallback);
                        /*
                        var status = "OPEN";
                        if(data.status == "PARTIALLY_FILLED" || data.status == "NEW")
                            status = "OPEN";
                        else if(data.status == "CANCELED")
                            status = "CANCELED";
                        else
                            status = "CLOSED";

                        successCallback(new Order(
                            self.exchange,
                            self._getMarketName(data.symbol),
                            data.orderId,
                            status,
                            data.side,
                            data.type,
                            data.price,
                            data.origQty,
                            data.executedQty,
                            [],
                            data.timeInForce,
                            new Date(data.transactTime).toISOString(),
                            null,
                            null,
                            false,
                            {
                                price : data.stopPrice
                            }
                        ));
                        */
                    }
                }
            });
        }
    };

    this.placeMarketOrder = function(market_name, size, action, successCallback, failureCallback){
        if(this.publicKey == undefined || this.privateKey == undefined)
            failureCallback("Keys must be set");

        else if(market_name.full == undefined)
            failureCallback ("market object needs to have the full market name");

        else if(action != "buy" && action != "sell")
            failureCallback("action must be buy or sell");

        else {
            var marketname_string = market_name.quote + market_name.base;
            var params = "recvWindow=1000000&side=" + action.toUpperCase() + "&type=MARKET&symbol=" + marketname_string + "&quantity=" + size + "&timestamp=" + self._getRequestTimestamp();
            request.post({
                url: "https://api.binance.com/api/v3/order?" + params + "&signature=" + self._getURLSignature(params, self.privateKey),
                headers: {'X-MBX-APIKEY': self.publicKey}
            }, function (error, response, body) {
                if (error)
                    failureCallback(error);

                else {
                    var data = jsonic(body);
                    if (data == undefined || data.code != undefined)
                        failureCallback(data);

                    else {
                        var status = "OPEN";
                        if(data.status == "PARTIALLY_FILLED" || data.status == "NEW")
                            status = "OPEN";
                        else if(data.status == "CANCELED")
                            status = "CANCELED";
                        else
                            status = "CLOSED";

                        successCallback(new Order(
                            self.exchange,
                            self._getMarketName(data.symbol),
                            data.orderId,
                            status,
                            data.side,
                            data.type,
                            data.price,
                            data.origQty,
                            data.executedQty,
                            [],
                            data.timeInForce,
                            new Date(data.transactTime).toISOString()
                        ));
                    }
                }
            });
        }
    };

    this.cancelOrderByID = function(market_name, orderID, successCallback, failureCallback){
        if(this.publicKey == undefined || this.privateKey == undefined)
            failureCallback("Keys must be set");

        else if(market_name.base == undefined || market_name.quote == undefined)
            failureCallback ("market object needs to have the full market name");

        else if(orderID == undefined)
            failureCallback("orderID not set");

        else {
            var params = "recvWindow=1000000&orderId=" + orderID + "&symbol=" + market_name.quote + market_name.base + "&timestamp=" + self._getRequestTimestamp();
            request.delete({
                url: "https://api.binance.com/api/v3/order?" + params + "&signature=" + self._getURLSignature(params, self.privateKey),
                headers: {'X-MBX-APIKEY': self.publicKey}
            }, function (error, response, body) {
                if (error)
                    failureCallback(error);

                else {
                    var data = jsonic(body);
                    if (data == undefined || data.code != undefined)
                        failureCallback(data);

                    else {
                        successCallback(orderID);
                    }
                }
            });
        }
    };

    // Helpers
    this._getTradesByMarket = function(market_name, successCallback, failureCallback){
        var params = "recvWindow=1000000&symbol=" + market_name.quote + market_name.base + "&timestamp=" + self._getRequestTimestamp();

        request({
            url: "https://api.binance.com/api/v3/myTrades?" + params + "&signature=" + self._getURLSignature(params, self.privateKey),
            headers: {'X-MBX-APIKEY': self.publicKey}
        }, function (error, response, body) {
            if (error)
                failureCallback(error);

            else {
                var data = jsonic(body);
                if (data == undefined || data.code != undefined)
                    failureCallback(data);

                else {
                    var trades = [];
                    data.forEach(function (item) {
                        trades.push(new Trade(
                            item.orderId,
                            item.id,
                            item.price,
                            item.qty,
                            (new Date(item.time)).toISOString()
                        ));
                    });

                    successCallback(trades);
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
            }
        });
    };


    //Initiate server time diff lookup
    this._getServerTimeDiff();
}

module.exports = BinanceRESTClient;