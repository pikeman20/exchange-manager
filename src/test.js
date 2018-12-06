function message(message){
    console.log(JSON.stringify(message, null, 4));
}
/*

var brc = require("./Exchanges/Binance/BinanceRESTClient");
var MarketName = require("./Entities/MarketName");


var market_name = new MarketName("usdt", "eth");

var client = new brc();
client.setKeys("Yp839jGJvXXPFSaRnuNARGT1RI5VCeN3UjxO2i90CyxY5dzyMta0Ti6RqG6n3RzM", "6qQqoyx4pPzhP7bFngIjWkt5f2sEBsJg2QIEOug3INVkbeIbOgr1m8mUFQRnBiNH");

//client.placeLimitStopOrder(market_name, 480, 0.16, "buy", 485, message, message);
//client.placeMarketOrder(market_name, 0.16, "buy", message, message);
*/


var bsc = require("./Exchanges/Bittrex/BittrexSocketClient");
var MarketName = require("./Entities/MarketName");

var client = new bsc(function(){}, message);
client.setKeys("423dfb610cd542619b9aa06cdd3f9fdf", "f344907e89ae4a0584470ffc07872617");

client.subscribeToUserStreams();
client.subscribeToMarketBooks(new MarketName("usdt", "eth"));

/*
setTimeout(function() {
    client.unsubscribeFromUserStreams();
}, 20000);
*/

/*
setTimeout(function() {
    client.disconnect();
}, 10000);
*/
/*
var brc = require("./Exchanges/Bittrex/BittrexRESTClient");
var client = new brc();

client.setKeys("423dfb610cd542619b9aa06cdd3f9fdf", "f344907e89ae4a0584470ffc07872617");
client.getAccountClosedOrders(message, message);
    */
