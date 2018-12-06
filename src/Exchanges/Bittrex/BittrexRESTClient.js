var CryptoJS = require('crypto-js');
var request = require('request');
var validator = require('validator');
var Big = require('big.js');
var jsonic = require('jsonic');

var Exchange = require('../../Entities/Exchange');
var Asset = require('../../Entities/Asset');
var Market = require('../../Entities/Market');
var Orderbook = require('../../Entities/Orderbook');
var OrderbookLineItem = require('../../Entities/OrderbookLineItem');
var Fillbook = require('../../Entities/Fillbook');
var Fill = require('../../Entities/Fill');
var MarketName = require('../../Entities/MarketName');
var Order = require('../../Entities/Order');
var Wallet = require('../../Entities/Wallet');
var Trade = require('../../Entities/Trade');


function BittrexRESTClient(){
    var self = this;
    this.exchange = new Exchange("Bittrex", "BTRX");
    this.publicKey = null;
    this.privateKey = null;

    this.setKeys = function(publicKey, privateKey){
        this.publicKey = publicKey;
        this.privateKey = privateKey;
    };

    // Public calls
    this.getTradingRules = function(successCallback, failureCallback){
        failureCallback("Not yet supported!");
    };

    this.getExchangeAssets = function(successCallback, failureCallback){
        request('https://bittrex.com/api/v1.1/public/getcurrencies', function (error, response, body) {
            if(error)
                failureCallback(error);

            else {
                var data = jsonic(body);
                if (data == undefined || data.success == false)
                    failureCallback(data);

                else{
                    var Assets = [];
                    data.result.forEach(function (item) {
                        Assets.push(new Asset(self.exchange, item.CurrencyLong, item.Currency));
                    });
                    successCallback(Assets);
                }
            }
        });
    };

    this.getExchangeMarkets = function(successCallback, failureCallback){
        request('https://bittrex.com/api/v1.1/public/getmarketsummaries', function (error, response, body) {
            if(error)
                failureCallback(error);

            else {
                var data = jsonic(body);
                if(data == undefined || data.success == false)
                    failureCallback(data);

                else{
                    var markets = [];
                    data.result.forEach(function (item){
                        markets.push(new Market(self.exchange, self._getMarketName(item.MarketName), item.PrevDay, item.High, item.Low, item.Last, item.BaseVolume, item.Bid, item.Ask, "https://bittrex.com/Market/Index?MarketName=" + item.MarketName));
                    });
                    successCallback(markets);
                }
            }
        });
    };

    this.getExchangeMarket = function(market_name, successCallback, failureCallback){
        if(market_name.full == undefined)
            failureCallback("market object needs to have the full market name");

        else {
            request('https://bittrex.com/api/v1.1/public/getmarketsummary?market=' + market_name.full, function (error, response, body) {
                if (error)
                    failureCallback(error);

                else {
                    var data = jsonic(body);
                    if (data == undefined || data.success == false)
                        failureCallback(data);

                    else {
                        var item = data.result[0];
                        successCallback(new Market(self.exchange, self._getMarketName(item.MarketName), item.PrevDay, item.High, item.Low, item.Last, item.BaseVolume, item.Bid, item.Ask, "https://bittrex.com/Market/Index?MarketName=" + item.MarketName));
                    }
                }
            });
        }
    };

    this.getMarketOrderbook = function(market_name, successCallback, failureCallback){
        if(market_name.full == undefined)
            failureCallback("market object needs to have the full market name");

        else {
            request('https://bittrex.com/api/v1.1/public/getorderbook?type=both&market=' + market_name.full, function (error, response, body) {
                if (error)
                    failureCallback(error);

                else {
                    var data = jsonic(body);
                    if (data == undefined || data.success == false)
                        failureCallback(data);

                    else {
                        var buys = [];
                        var sells = [];

                        data.result.buy.forEach(function (item) {
                            buys.push(new OrderbookLineItem(item.Rate, item.Quantity));
                        });

                        data.result.sell.forEach(function (item) {
                            sells.push(new OrderbookLineItem(item.Rate, item.Quantity));
                        });

                        successCallback(new Orderbook(self.exchange, self._getMarketName(market_name.full), buys, sells));
                    }
                }
            });
        }
    };

    this.getMarketFillbook = function(market_name, successCallback, failureCallback) {
        if(market_name.full == undefined)
            failureCallback("market object needs to have the full market name");

        else {
            request('https://bittrex.com/api/v1.1/public/getmarkethistory?market=' + market_name.full, function (error, response, body) {
                if (error)
                    successCallback(new Orderbook(self.exchange, self._getMarketName(market_name.full), buys, sells, fills));

                else {
                    var data = jsonic(body);
                    if (data == undefined || data.success == false)
                        successCallback(new Orderbook(self.exchange, self._getMarketName(market_name.full), buys, sells, fills));

                    else {
                        var fills = [];

                        data.result.forEach(function (item) {
                            fills.push(new Fill(item.Id, item.Price, item.Quantity, item.TimeStamp + "Z", item.OrderType));
                        });

                        successCallback(new Fillbook(self.exchange, self._getMarketName(market_name.full), fills));
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
            var url = 'https://bittrex.com/api/v1.1/account/getbalances?apikey=' + this.publicKey + '&nonce=' + this._getNonce();
            request({
                url: url,
                headers: {apisign: this._getURLSignature(url, this.privateKey)}
            }, function (error, response, body) {
                if (error)
                    failureCallback(error);

                else {
                    var data = jsonic(body);
                    if (data == undefined || data.success == false)
                        failureCallback(data);

                    else {
                        var wallets = [];
                        data.result.forEach(function (item) {
                            wallets.push(new Wallet(self.exchange, item.Currency, item.Balance, item.Available, item.Pending, item.CryptoAddress));
                        });
                        successCallback(wallets);
                    }
                }
            });
        }
    };

    this.getAccountOrders = function(successCallback, failureCallback){
        if(this.publicKey == undefined || this.privateKey == undefined)
            failureCallback("Keys must be set");

        else {
            self.getAccountOpenOrders(function (openOrders) {
                self.getAccountClosedOrders(function (closedOrders) {
                    //loop backwards to preserve the indexes
                    //If order is in both closed and open then it is closed. This can happen due to caching issues
                    for (var o = openOrders.length - 1; o >= 0; o--) {
                        for (var c = 0; c < closedOrders.length; c++) {
                            if (openOrders[o].exchangeOrderID == closedOrders[c].exchangeOrderID) {
                                //The open date exists in open orders but not closed ones, so write it over
                                closedOrders[c].opened = openOrders[o].opened;
                                openOrders.splice(o, 1);
                                break;
                            }
                        }
                    }

                    successCallback({open: openOrders, closed: closedOrders});
                }, failureCallback)
            }, failureCallback);
        }
    };

    this.getAccountOpenOrders = function(successCallback, failureCallback){
        if(this.publicKey == undefined || this.privateKey == undefined)
            failureCallback("Keys must be set");

        else {
            var url = 'https://bittrex.com/api/v1.1/market/getopenorders?apikey=' + this.publicKey + '&nonce=' + this._getNonce();
            request({
                url: url,
                headers: {apisign: this._getURLSignature(url, this.privateKey)}
            }, function (error, response, body) {
                if (error)
                    failureCallback(error);

                else {
                    var data = jsonic(body);
                    if (data == undefined || data.success == false)
                        failureCallback(data);

                    else {

                        var openOrders = [];
                        data.result.forEach(function (item) {
                            var type = item.OrderType.split("_");
                            if(item.Condition != undefined && item.Condition == "GREATER_THAN")
                                type[0] = "TAKE_PROFIT_LIMIT";

                            else if(item.Condition != undefined && item.Condition == "LESS_THAN")
                                type[0] = "STOP_LOSS_LIMIT";

                            var filled = (Big(item.Quantity).minus(Big(item.QuantityRemaining)).toString());

                            var trades = [];
                            if(item.PricePerUnit != undefined)
                                trades.push(new Trade(item.OrderUuid, 0, item.PricePerUnit, filled, item.Opened + "Z"));

                            var triggers = null;
                            if(item.ConditionTarget != undefined)
                                triggers = {price: item.ConditionTarget};

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
                                item.Opened + "Z",
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
        if(this.publicKey == undefined || this.privateKey == undefined)
            failureCallback("Keys must be set");

        else {
            var url = 'https://bittrex.com/api/v1.1/account/getorderhistory?apikey=' + self.publicKey + '&nonce=' + self._getNonce();
            request({
                url: url,
                headers: {apisign: self._getURLSignature(url, self.privateKey)}
            }, function (error, response, body) {
                if (error)
                    failureCallback(error);

                else {
                    var data = jsonic(body);
                    if (data == undefined || data.success == false)
                        failureCallback(data);

                    else {
                        var closedOrders = [];
                        data.result.forEach(function (item) {
                            var type = item.OrderType.split("_");
                            if(item.Condition != undefined && item.Condition == "GREATER_THAN")
                                type[0] = "TAKE_PROFIT_LIMIT";

                            else if(item.Condition != undefined && item.Condition == "LESS_THAN")
                                type[0] = "STOP_LOSS_LIMIT";

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

                        successCallback(closedOrders);
                    }
                }
            });
        }
    };

    this.getAccountOpenOrdersByMarket = function(market_name, successCallback, failureCallback){
        if(this.publicKey == undefined || this.privateKey == undefined)
            failureCallback("Keys must be set");

        else {
            var url = 'https://bittrex.com/api/v1.1/market/getopenorders?market=' + market_name.full + '&apikey=' + this.publicKey + '&nonce=' + this._getNonce();
            request({
                url: url,
                headers: {apisign: this._getURLSignature(url, this.privateKey)}
            }, function (error, response, body) {
                if (error)
                    failureCallback(error);

                else {
                    var data = jsonic(body);
                    if (data == undefined || data.success == false)
                        failureCallback(data);

                    else {
                        var openOrders = [];
                        data.result.forEach(function (item) {
                            var type = item.OrderType.split("_");
                            if(item.Condition != undefined && item.Condition == "GREATER_THAN")
                                type[0] = "TAKE_PROFIT_LIMIT";

                            else if(item.Condition != undefined && item.Condition == "LESS_THAN")
                                type[0] = "STOP_LOSS_LIMIT";

                            var filled = (Big(item.Quantity).minus(Big(item.QuantityRemaining)).toString());

                            var trades = [];
                            if(item.PricePerUnit != undefined)
                                trades.push(new Trade(item.OrderUuid, 0, item.PricePerUnit, filled, item.Opened + "Z"));

                            var triggers = null;
                            if(item.ConditionTarget != undefined)
                                triggers = {price: item.ConditionTarget};

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
                                item.Opened + "Z",
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

    this.getAccountClosedOrdersByMarket = function(market_name, successCallback, failureCallback){
        if(this.publicKey == undefined || this.privateKey == undefined)
            failureCallback("Keys must be set");

        else if(market_name.full == undefined)
            failureCallback ("market object needs to have the full market name");

        else {
            var url = "https://bittrex.com/api/v1.1/account/getorderhistory?market=" + market_name.full + "&apikey=" + self.publicKey + "&nonce=" + self._getNonce();
            request({
                url: url,
                headers: {apisign: self._getURLSignature(url, self.privateKey)}
            }, function (error, response, body) {
                if (error)
                    failureCallback(error);

                else {
                    var data = jsonic(body);
                    if (data == undefined || data.success == false)
                        failureCallback(data);

                    else {
                        var closedOrders = [];
                        data.result.forEach(function (item) {
                            var type = item.OrderType.split("_");
                            if(item.Condition != undefined && item.Condition == "GREATER_THAN")
                                type[0] = "TAKE_PROFIT_LIMIT";

                            else if(item.Condition != undefined && item.Condition == "LESS_THAN")
                                type[0] = "STOP_LOSS_LIMIT";

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

                        successCallback(closedOrders);
                    }
                }
            });
        }
    };

    this.getAccountOrderByID = function(market_name, orderID, successCallback, failureCallback){
        if(this.publicKey == undefined || this.privateKey == undefined)
            failureCallback("Keys must be set");

        else if(orderID == undefined)
            failureCallback("orderID not set");

        else {
            var url = 'https://bittrex.com/api/v1.1/account/getorder?apikey=' + this.publicKey + '&uuid=' + orderID + '&nonce=' + this._getNonce();
            request({
                url: url,
                headers: {apisign: this._getURLSignature(url, this.privateKey)}
            }, function (error, response, body) {
                if (error)
                    failureCallback(error);

                else {
                    var data = jsonic(body);
                    if (data == undefined || data.success == false)
                        failureCallback(data);

                    else {
                        data = data.result;

                        var type = data.Type.split("_");
                        if(data.Condition != undefined && data.Condition == "GREATER_THAN")
                            type[0] = "TAKE_PROFIT_LIMIT";

                        else if(data.Condition != undefined && data.Condition == "LESS_THAN")
                            type[0] = "STOP_LOSS_LIMIT";

                        var filled = (Big(data.Quantity).minus(Big(data.QuantityRemaining)).toString());

                        var trades = [];
                        if(data.PricePerUnit != undefined)
                            trades.push(new Trade(data.OrderUuid, 0, data.PricePerUnit, filled, (data.Closed == undefined) ? data.Opened + "Z" : data.Closed + "Z"));

                        var triggers = null;
                        if(data.ConditionTarget != undefined)
                            triggers = {price: data.ConditionTarget};

                        successCallback(new Order(
                            self.exchange,
                            self._getMarketName(data.Exchange),
                            data.OrderUuid,
                            (data.IsOpen == true) ? "OPEN" : "CLOSED",
                            type[1],
                            type[0],
                            data.Limit,
                            data.Quantity,
                            filled,
                            trades,
                            ((data.ImmediateOrCancel === true) ? "IOC" : 'GTC'),
                            data.Opened + "Z",
                            (data.Closed == undefined) ? undefined : data.Closed + "Z",
                            null,
                            false,
                            triggers
                        ));
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
            var url = "";
            if(action == "buy")
                url = 'https://bittrex.com/api/v1.1/market/buylimit?apikey=' + this.publicKey + '&market=' + market_name.full + '&quantity=' + size + '&rate=' + ppu + '&nonce=' + this._getNonce();

            else if(action == "sell")
                url = 'https://bittrex.com/api/v1.1/market/selllimit?apikey=' + this.publicKey + '&market=' + market_name.full + '&quantity=' + size + '&rate=' + ppu + '&nonce=' + this._getNonce();


            request({url: url, headers: {apisign: this._getURLSignature(url, this.privateKey)}}, function (error, response, body) {
                if (error)
                    failureCallback(error);

                else {
                    var data = jsonic(body);
                    if (data == undefined || data.success == false)
                        failureCallback(data);

                    else
                        self.getAccountOrderByID(market_name, data.result.uuid, successCallback, failureCallback);
                }
            });
        }
    };

    this.placeLimitStopOrder = function(market_name, ppu, size, action, stopPrice, successCallback, failureCallback) {
        //todo
        failureCallback("Not yet supported!");
    };

    this.placeLimitTakeProfitOrder = function(market_name, ppu, size, action, stopPrice, successCallback, failureCallback) {
        //todo
        failureCallback("Not yet supported!");
    };

    this.placeMarketOrder = function(market_name, size, action, successCallback, failureCallback){
        //todo
        failureCallback("Not yet supported!");
    };

    this.cancelOrderByID = function(market_name, orderID, successCallback, failureCallback){
        if(this.publicKey == undefined || this.privateKey == undefined)
            failureCallback("Keys must be set");

        else {
            var url = 'https://bittrex.com/api/v1.1/market/cancel?apikey=' + this.publicKey + '&uuid=' + orderID + '&nonce=' + this._getNonce();
            request({
                url: url,
                headers: {apisign: this._getURLSignature(url, this.privateKey)}
            }, function (error, response, body) {
                if (error)
                    failureCallback(error);

                else {
                    var data = jsonic(body);
                    if (data == undefined || data.success == false)
                        failureCallback(data);

                    else
                        successCallback(orderID);
                }
            });
        }
    };


    // Helpers
    this._getMarketName = function(marketname_string){
        var assets = marketname_string.split("-");
        return new MarketName(assets[0], assets[1]);
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
}

module.exports = BittrexRESTClient;