var BittrexRestClient = require("./Bittrex/BittrexRESTClient");
var BinanceRestClient = require("./Binance/BinanceRESTClient");

function RestManager(){
    var self = this;

    this.bittrexClient = new BittrexRestClient();
    this.binanceClient = new BinanceRestClient();

    this.setKeys = function(exchange, publicKey, privateKey){
        if(exchange.short == "BTRX")
            self.bittrexClient.setKeys(publicKey, privateKey);

        else if(exchange.short == "BINA")
            self.binanceClient.setKeys(publicKey, privateKey);
    };

    // Public calls
    this.getTradingRules = function(exchange, successCallback, failureCallback){
        if(exchange.short == "BTRX")
            self.bittrexClient.getTradingRules(successCallback, failureCallback);

        else if(exchange.short == "BINA")
            self.binanceClient.getTradingRules(successCallback, failureCallback);
    };

    this.getExchangeAssets = function(exchange, successCallback, failureCallback){
        if(exchange.short == "BTRX")
            self.bittrexClient.getExchangeAssets(successCallback, failureCallback);

        else if(exchange.short == "BINA")
            self.binanceClient.getExchangeAssets(successCallback, failureCallback);
    };

    this.getExchangeMarkets = function(exchange, successCallback, failureCallback){
        if(exchange.short == "BTRX")
            self.bittrexClient.getExchangeMarkets(successCallback, failureCallback);

        else if(exchange.short == "BINA")
            self.binanceClient.getExchangeMarkets(successCallback, failureCallback);
    };

    this.getExchangeMarket = function(exchange, market_name, successCallback, failureCallback){
        if(exchange.short == "BTRX")
            self.bittrexClient.getExchangeMarket(market_name, successCallback, failureCallback);

        else if(exchange.short == "BINA")
            self.binanceClient.getExchangeMarket(market_name, successCallback, failureCallback);
    };

    this.getMarketOrderbook = function(exchange, market_name, successCallback, failureCallback){
        if(exchange.short == "BTRX")
            self.bittrexClient.getMarketOrderbook(market_name, successCallback, failureCallback);

        else if(exchange.short == "BINA")
            self.binanceClient.getMarketOrderbook(market_name, successCallback, failureCallback);
    };

    this.getMarketFillbook = function(exchange, market_name, successCallback, failureCallback){
        if(exchange.short == "BTRX")
            self.bittrexClient.getMarketFillbook(market_name, successCallback, failureCallback);

        else if(exchange.short == "BINA")
            self.binanceClient.getMarketFillbook(market_name, successCallback, failureCallback);
    };

    //  Signed calls
    this.getAccountWallets = function(exchange, successCallback, failureCallback){
        if(exchange.short == "BTRX")
            self.bittrexClient.getAccountWallets(successCallback, failureCallback);

        else if(exchange.short == "BINA")
            self.binanceClient.getAccountWallets(successCallback, failureCallback);
    };

    this.getAccountOrders = function(exchange, successCallback, failureCallback){
        if(exchange.short == "BTRX")
            self.bittrexClient.getAccountOrders(successCallback, failureCallback);

        else if(exchange.short == "BINA")
            self.binanceClient.getAccountOrders(successCallback, failureCallback);
    };

    this.getAccountOpenOrders = function(exchange, successCallback, failureCallback){
        if(exchange.short == "BTRX")
            self.bittrexClient.getAccountOpenOrders(successCallback, failureCallback);

        else if(exchange.short == "BINA")
            self.binanceClient.getAccountOpenOrders(successCallback, failureCallback);
    };

    this.getAccountClosedOrders = function(exchange, successCallback, failureCallback){
        if(exchange.short == "BTRX")
            self.bittrexClient.getAccountClosedOrders(successCallback, failureCallback);

        else if(exchange.short == "BINA")
            self.binanceClient.getAccountClosedOrders(successCallback, failureCallback);
    };

    this.getAccountOpenOrdersByMarket = function(exchange, market_name, successCallback, failureCallback){
        if(exchange.short == "BTRX")
            self.bittrexClient.getAccountOpenOrdersByMarket(market_name, successCallback, failureCallback);

        else if(exchange.short == "BINA")
            self.binanceClient.getAccountOpenOrdersByMarket(market_name, successCallback, failureCallback);
    };

    this.getAccountClosedOrdersByMarket = function(exchange, market_name, successCallback, failureCallback){
        if(exchange.short == "BTRX")
            self.bittrexClient.getAccountClosedOrdersByMarket(market_name, successCallback, failureCallback);

        else if(exchange.short == "BINA")
            self.binanceClient.getAccountClosedOrdersByMarket(market_name, successCallback, failureCallback);
    };

    this.getAccountOrderByID = function(exchange, market_name, orderID, successCallback, failureCallback){
        if(exchange.short == "BTRX")
            self.bittrexClient.getAccountOrderByID(market_name, orderID, successCallback, failureCallback);

        else if(exchange.short == "BINA")
            self.binanceClient.getAccountOrderByID(market_name, orderID, successCallback, failureCallback);
    };

    this.placeLimitOrder = function(exchange, market_name, ppu, size, action, successCallback, failureCallback){
        if(exchange.short == "BTRX")
            self.bittrexClient.placeLimitOrder(market_name, ppu, size, action, successCallback, failureCallback);

        else if(exchange.short == "BINA")
            self.binanceClient.placeLimitOrder(market_name, ppu, size, action, successCallback, failureCallback);
    };

    this.placeLimitStopOrder = function(exchange, market_name, ppu, size, action, stopPrice, successCallback, failureCallback) {
        if(exchange.short == "BTRX")
            self.bittrexClient.placeLimitStopOrder(market_name, ppu, size, action, stopPrice, successCallback, failureCallback);

        else if(exchange.short == "BINA")
            self.binanceClient.placeLimitStopOrder(market_name, ppu, size, action, stopPrice, successCallback, failureCallback);
    };

    this.placeLimitTakeProfitOrder = function(exchange, market_name, ppu, size, action, stopPrice, successCallback, failureCallback) {
        if(exchange.short == "BTRX")
            self.bittrexClient.placeLimitTakeProfitOrder(market_name, ppu, size, action, stopPrice, successCallback, failureCallback);

        else if(exchange.short == "BINA")
            self.binanceClient.placeLimitTakeProfitOrder(market_name, ppu, size, action, stopPrice, successCallback, failureCallback);
    };

    this.placeMarketOrder = function(exchange, market_name, size, action, successCallback, failureCallback){
        if(exchange.short == "BTRX")
            self.bittrexClient.placeMarketOrder(market_name, size, action, successCallback, failureCallback);

        else if(exchange.short == "BINA")
            self.binanceClient.placeMarketOrder(market_name, size, action, successCallback, failureCallback);
    };

    this.cancelOrderByID = function(exchange, market_name, orderID, successCallback, failureCallback){
        if(exchange.short == "BTRX")
            self.bittrexClient.cancelOrderByID(market_name, orderID, successCallback, failureCallback);

        else if(exchange.short == "BINA")
            self.binanceClient.cancelOrderByID(market_name, orderID, successCallback, failureCallback);
    };
}

module.exports = RestManager;