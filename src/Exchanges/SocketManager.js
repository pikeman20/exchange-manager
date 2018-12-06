var BittrexSocketClient = require("./Bittrex/BittrexSocketClient");
var BinanceSocketClient = require("./Binance/BinanceSocketClient");

function SocketManager(messageCallback, eventCallback, autoConnect) {
    var self = this;

    this.setExchangeKeys = function(exchange, publicKey, privateKey){
        if(exchange.short == "BTRX")
            self.bittrexClient.setKeys(publicKey, privateKey);

        else if(exchange.short == "BINA")
            self.binanceClient.setKeys(publicKey, privateKey);
    };

    this.subscribeToMarketBooks = function(exchange, market_name){
        if(exchange.short == "BTRX")
            self.bittrexClient.subscribeToMarketBooks(market_name);

        else if(exchange.short == "BINA")
            self.binanceClient.subscribeToMarketBooks(market_name);
    };

    this.subscribeToUserStreams = function(exchange){
        if(exchange.short == "BTRX")
            self.bittrexClient.subscribeToUserStreams();

        else if(exchange.short == "BINA")
            self.binanceClient.subscribeToUserStreams();
    };

    this.queryExchangeMarkets = function(exchange){
        if(exchange.short == "BTRX")
            self.bittrexClient.queryExchangeMarkets();

        else if(exchange.short == "BINA")
            self.binanceClient.queryExchangeMarkets();
    };

    this.queryMarketBooks = function(exchange, market_name){
        if(exchange.short == "BTRX")
            self.bittrexClient.queryMarketBooks(market_name);

        else if(exchange.short == "BINA")
            self.binanceClient.queryMarketBooks(market_name);
    };

    this.queryUserStreams = function(exchange){
        if(exchange.short == "BTRX")
            self.bittrexClient.queryUserStreams();

        else if(exchange.short == "BINA")
            self.binanceClient.queryUserStreams();
    };

    this.unsubscribeFromMarketBooks = function(exchange, market_name){
        if(exchange.short == "BTRX")
            self.bittrexClient.unsubscribeFromMarketBooks(market_name);

        else if(exchange.short == "BINA")
            self.binanceClient.unsubscribeFromMarketBooks(market_name);
    };

    this.unsubscribeFromAllMarketBooks = function(exchange){
        if(exchange.short == "BTRX")
            self.bittrexClient.unsubscribeFromAllMarketBooks();

        else if(exchange.short == "BINA")
            self.binanceClient.unsubscribeFromAllMarketBooks();
    };

    this.unsubscribeFromUserStreams = function(exchange){
        if(exchange.short == "BTRX")
            self.bittrexClient.unsubscribeFromUserStreams();

        else if(exchange.short == "BINA")
            self.binanceClient.unsubscribeFromUserStreams();
    };

    this.startAllExchanges = function(){
        if(self.bittrexClient == undefined)
            self.bittrexClient = new BittrexSocketClient(self.messageCallback, self.eventCallback);
        else
            self.bittrexClient._doConnect();

        if(self.binanceClient == undefined)
            self.binanceClient = new BinanceSocketClient(self.messageCallback, self.eventCallback);
        else
            self.binanceClient._doConnect();
    };

    this.startExchange = function(exchange){
        if(exchange.short == "BTRX") {
            if(self.bittrexClient == undefined)
                self.bittrexClient = new BittrexSocketClient(self.messageCallback, self.eventCallback);
            else
                self.bittrexClient._doConnect();
        }

        else if(exchange.short == "BINA"){
            if(self.binanceClient == undefined)
                self.binanceClient = new BinanceSocketClient(self.messageCallback, self.eventCallback);
            else
                self.binanceClient._doConnect();
        }
    };

    this.disconnectAllExchanges = function(){
        self.bittrexClient.disconnect();
        self.binanceClient.disconnect();
    };

    this.disconnectExchange = function(exchange){
        if(exchange.short == "BTRX")
            self.bittrexClient.disconnect();

        else if(exchange.short == "BINA")
            self.binanceClient.disconnect();
    };

    // Init
    if(messageCallback == undefined || eventCallback == undefined )
        throw new Event(self.constructor.name, "Error", "All callback functions must be set before initiating");

    this.messageCallback = messageCallback;
    this.eventCallback = eventCallback;
    this.bittrexClient = null;
    this.binanceClient = null;

    if(autoConnect != false) {
        this.bittrexClient = new BittrexSocketClient(messageCallback, eventCallback);
        this.binanceClient = new BinanceSocketClient(messageCallback, eventCallback);
    }

    /*
     var messageTypes = [
     "MarketOrderbook",
     "MarketOrderbookUpdate",
     "MarketFillbook",
     "MarketFillbookUpdate",
     "ExchangeMarkets",
     "ExchangeMarketsUpdate",
     "AccountOrders",
     "AccountOrdersUpdate",
     "AccountWallets",
     "AccountWalletsUpdate",
     "MarketCandles"
     ];
     */
}

module.exports = SocketManager;