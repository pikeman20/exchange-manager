var RestManager = require("./Exchanges/RestManager");
var SocketManager = require("./Exchanges/SocketManager");
var CandleStorage = require("./Exchanges/CandleStorage");

var MarketName = require("./Entities/MarketName");
var Exchange = require("./Entities/Exchange");

var bittrex = new Exchange("Bittrex", "BTRX");
var binance = new Exchange("Binance", "BINA");
var market_name = new MarketName("usdt", "qtum");
var market_name2 = new MarketName("usdt", "ltc");


function detailedOutput(data){
    console.log(JSON.stringify(data, null, 4));
}

function message(message){
    /*
     console.log("message", message.endpoint, message.exchange.short);
     if(message.endpoint == "MarketOrderbookUpdate" || message.endpoint == "MarketFillbookUpdate" || message.endpoint == "MarketOrderbook" || message.endpoint == "MarketFillbook")
     console.log(message.payload.market.full);

     else if(message.endpoint == "AccountOrders" || message.endpoint == "AccountWallets")
     console.log(message.payload);

    if(message.endpoint == "MarketFillbookUpdate" || message.endpoint == "MarketFillbook")
        console.log(JSON.stringify(message, null, 4));
     */

    //console.log(message);
}

function event(data){
    console.log("event ", JSON.stringify(data, null, 4));
}

function candleMessage(data){
    //console.log(JSON.stringify(data.candles.slice(-5), null, 4));
    console.log("new candle message");
}

//REST
//var restMgr = new RestManager();

//Public REST
//restMgr.getTradingRules(bittrex, detailedOutput, detailedOutput);
//restMgr.getTradingRules(binance, detailedOutput, detailedOutput);

//restMgr.getExchangeAssets(bittrex, detailedOutput, detailedOutput);
//restMgr.getExchangeAssets(binance, detailedOutput, detailedOutput);

//restMgr.getExchangeMarkets(bittrex, detailedOutput, detailedOutput);
//restMgr.getExchangeMarkets(binance, detailedOutput, detailedOutput);

//restMgr.getExchangeMarket(bittrex, market_name, detailedOutput, detailedOutput);
//restMgr.getExchangeMarket(binance, market_name, detailedOutput, detailedOutput);

//restMgr.getMarketOrderbook(bittrex, market_name, detailedOutput, detailedOutput);
//restMgr.getMarketOrderbook(binance, market_name, detailedOutput, detailedOutput);

//restMgr.getMarketFillbook(bittrex, market_name, detailedOutput, detailedOutput);
//restMgr.getMarketFillbook(binance, market_name, detailedOutput, detailedOutput);

//Private REST
//restMgr.setKeys(bittrex, "423dfb610cd542619b9aa06cdd3f9fdf", "f344907e89ae4a0584470ffc07872617");
//restMgr.setKeys(binance, "Yp839jGJvXXPFSaRnuNARGT1RI5VCeN3UjxO2i90CyxY5dzyMta0Ti6RqG6n3RzM", "6qQqoyx4pPzhP7bFngIjWkt5f2sEBsJg2QIEOug3INVkbeIbOgr1m8mUFQRnBiNH");

//restMgr.getAccountWallets(bittrex, detailedOutput, detailedOutput);
//restMgr.getAccountWallets(binance, detailedOutput, detailedOutput);

//restMgr.placeLimitOrder(bittrex, market_name, 0.10806845, 0.22809567, "buy", detailedOutput, detailedOutput);
//restMgr.placeLimitOrder(binance, market_name, 1000, 0.158, "sell", detailedOutput, detailedOutput);

//restMgr.cancelOrderByID(bittrex, market_name, 14954288, detailedOutput, detailedOutput);
//restMgr.cancelOrderByID(binance, market_name, 14954288, detailedOutput, detailedOutput);

//restMgr.getAccountOrders(bittrex, detailedOutput, detailedOutput);
//restMgr.getAccountOrders(binance, detailedOutput, detailedOutput);

//restMgr.getAccountOpenOrders(bittrex, detailedOutput, detailedOutput);
//restMgr.getAccountOpenOrders(binance, detailedOutput, detailedOutput);

//restMgr.getAccountOpenOrdersByMarket(bittrex, market_name, detailedOutput, detailedOutput);
//restMgr.getAccountOpenOrdersByMarket(binance, market_name, detailedOutput, detailedOutput);

//restMgr.getAccountClosedOrders(bittrex, detailedOutput, detailedOutput);
//restMgr.getAccountClosedOrders(binance, detailedOutput, detailedOutput);

//restMgr.getAccountClosedOrdersByMarket(bittrex, market_name, detailedOutput, detailedOutput);
//restMgr.getAccountClosedOrdersByMarket(binance, market_name, detailedOutput, detailedOutput);

//restMgr.getAccountOrderByID(bittrex, market_name, "0b1c00d8-a14b-42b0-8b70-7e8054034727", detailedOutput, detailedOutput);
//restMgr.getAccountOrderByID(binance, market_name2, "8426147", detailedOutput, detailedOutput);

/*
var markets = [];
restMgr.getExchangeMarkets(bittrex, function(btrx_markets){
    restMgr.getExchangeMarkets(binance, function(bina_markets){
        btrx_markets.forEach(function(item){
            bina_markets.forEach(function(item2){
                if(item.name.quote == item2.name.quote && markets.indexOf(item.name.quote) == -1) {
                    markets.push(item.name.quote)
                }
            })
        });
        console.log(markets);
    }, detailedOutput);
}, detailedOutput);
*/

/*
setTimeout(function() {
    socMgr.subscribeToMarketBooks(binance, market_name);
}, 1000);
*/



//User Data Stream Test

var socMgr = new SocketManager(message, event);
socMgr.setExchangeKeys(binance, "WM0dT94wiPiykbl3j1cTE0taH5Fs8Y2ae0Kxutz4T3bOZ2mcayIPUS47MH9qx7JY", "VabMDbRmI17mgurwvPLgrGZrCJG6V0wlHZmyfKj8jKnUfpc85lkbmXcCxUKigksB");
socMgr.subscribeToUserStreams(binance);

/*
setTimeout(function() {
    socMgr.disconnectAllExchanges();
    socMgr.startExchange(bittrex);
}, 30000);
*/
//Disconnect Test: one market + market summaries
/*
var socMgr = new SocketManager(message, event, false);
//socMgr.startAllExchanges();
socMgr.startExchange(binance);
socMgr.subscribeToMarketBooks(binance, market_name);


setTimeout(function() {
    socMgr.unsubscribeFromMarketBooks(binance, market_name);
    socMgr.subscribeToMarketBooks(binance, market_name);
    socMgr.unsubscribeFromMarketBooks(binance, market_name);
    socMgr.subscribeToMarketBooks(binance, market_name);
    socMgr.subscribeToMarketBooks(binance, market_name);
    socMgr.unsubscribeFromMarketBooks(binance, market_name);
    socMgr.unsubscribeFromMarketBooks(binance, market_name);
    socMgr.subscribeToMarketBooks(binance, market_name);
}, 1000);
*/

/*
var socMgr = new SocketManager(message, event);
socMgr.subscribeToMarketBooks(binance, market_name);
*/

/*
setTimeout(function() {
    socMgr.binanceClient._clients["ethusdt@depth"].emit("error");
    //socMgr.unsubscribeFromAllMarketBooks(binance);
    //socMgr.unsubscribeFromMarketBooks(binance, market_name);
    //socMgr.binanceClient._clients["ethusdt@depth"].close();
}, 10000);
*/


//Mass Market Test: Many markets + unsub from a few
/*
var socMgr = new SocketManager(message, event);

socMgr.subscribeToMarketBooks(bittrex, new MarketName("BTC", "BLITZ"));
socMgr.subscribeToMarketBooks(bittrex, new MarketName("BTC", "LTC"));
socMgr.subscribeToMarketBooks(bittrex, new MarketName("BTC", "XDN"));
socMgr.subscribeToMarketBooks(bittrex, new MarketName("BTC", "RDD"));
socMgr.subscribeToMarketBooks(bittrex, new MarketName("BTC", "IOP"));
socMgr.subscribeToMarketBooks(bittrex, new MarketName("BTC", "XLM"));
socMgr.subscribeToMarketBooks(bittrex, new MarketName("BTC", "XRP"));
socMgr.subscribeToMarketBooks(bittrex, new MarketName("BTC", "BAT"));

socMgr.subscribeToMarketBooks(binance, new MarketName("BTC", "IOTA"));
socMgr.subscribeToMarketBooks(binance, new MarketName("BTC", "TRX"));
socMgr.subscribeToMarketBooks(binance, new MarketName("BTC", "LTC"));
socMgr.subscribeToMarketBooks(binance, new MarketName("BTC", "ZEC"));

setTimeout(function() {
    //Unsub from all bittrex markets except for BAT
    socMgr.unsubscribeFromMarketBooks(bittrex, new MarketName("BTC", "ETH"));
    socMgr.unsubscribeFromMarketBooks(bittrex, new MarketName("BTC", "LTC"));
    socMgr.unsubscribeFromMarketBooks(bittrex, new MarketName("BTC", "XDN"));
    socMgr.unsubscribeFromMarketBooks(bittrex, new MarketName("BTC", "RDD"));
    socMgr.unsubscribeFromMarketBooks(bittrex, new MarketName("BTC", "IOP"));
    socMgr.unsubscribeFromMarketBooks(bittrex, new MarketName("BTC", "XLM"));
    socMgr.unsubscribeFromMarketBooks(bittrex, new MarketName("BTC", "XRP"));

    //Unsub form IOTA and TRX on binance, LTC and ZEC remains
    socMgr.unsubscribeFromMarketBooks(binance, new MarketName("BTC", "IOTA"));
    socMgr.unsubscribeFromMarketBooks(binance, new MarketName("BTC", "TRX"));

    //Sub to a new bittrex market to activate the restart. After this BAT and XLM should only be connected
    socMgr.subscribeToMarketBooks(bittrex, new MarketName("BTC", "XLM"));
}, 40000);
*/


//Candle Collectors
/*
var CS = new CandleStorage(candleMessage, detailedOutput);
CS.startCollecting(binance, market_name, 3600, function(){
    var initial = CS.getCandles(binance, market_name, 3600).candles;
    console.log(initial.length);

    CS.getCandlesInRange(binance, market_name, 3600, 1521072000000, 1526925600000, function(candles){
        console.log(candles.candles.length);

        CS.getCandlesInRange(binance, market_name, 3600, 1521072000000, 1526925600000, function(candlez){
            console.log(candlez.candles.length);

            CS.getCandlesInRange(binance, market_name, 3600, 1521072000000, 1526925600000, function(candlezs){
                console.log(candlezs.candles.length);
            });
            CS.getCandlesInRange(binance, market_name, 3600, 1521072000000, 1526925600000, function(candlezs){
                console.log(candlezs.candles.length);
            });
            CS.getCandlesInRange(binance, market_name, 3600, 1521072000000, 1526925600000, function(candlezs){
                console.log(candlezs.candles.length);
            });
            CS.getCandlesInRange(binance, market_name, 3600, 1521072000000, 1526925600000, function(candlezs){
                console.log(candlezs.candles.length);
            });
            CS.getCandlesInRange(binance, market_name, 3600, 1521072000000, 1526925600000, function(candlezs){
                console.log(candlezs.candles.length);
            });
            CS.getCandlesInRange(binance, market_name, 3600, 1521072000000, 1526925600000, function(candlezs){
                console.log(candlezs.candles.length);
            });
        });
    });
});

*/