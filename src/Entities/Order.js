var Big = require('big.js');

function Order(exchange, market, e_order_id, status, action, type, limit, quantity, filled, trades, duration, openDate, closeDate, updateDate, margin, triggers){
    status = status.toUpperCase();
    type = type.toUpperCase();
    action = action.toUpperCase();
    duration = duration.toUpperCase();

    if(openDate == undefined)
        openDate = "";

    if(closeDate == undefined)
        closeDate = "";

    if(updateDate == undefined)
        updateDate = "";

    if(trades == undefined)
        trades = [];

    if(triggers == undefined)
        triggers = false;

    if(margin == undefined)
        margin = false;

    var state = "NEW";
    if(filled == quantity) {
        state = "FILLED";

        if(closeDate == "" && updateDate != "")
            closeDate = updateDate;
    }

    else if(filled > 0 && filled < quantity)
        state = "PARTIAL_FILL";

    var highest_ppu = 0;
    var lowest_ppu = 0;
    var average_ppu = 0;

    var estimated_total = 0;

    if(trades != undefined && trades.length > 0){
        var tradesQty = 0;
        trades.forEach(function(trade){
            if(trade.ppu > highest_ppu)
                highest_ppu = trade.ppu;

            if(lowest_ppu == 0 || trade.ppu < lowest_ppu)
                lowest_ppu = trade.ppu;

            tradesQty = Big(tradesQty).plus(trade.quantity);
            estimated_total = Big(estimated_total).plus(Big(trade.ppu).times(trade.quantity));
        });

        highest_ppu = parseFloat(highest_ppu);
        lowest_ppu = parseFloat(lowest_ppu);

        if(tradesQty != 0)
            average_ppu = parseFloat(Big(estimated_total).div(tradesQty).toFixed(8));
    }


    if(estimated_total == 0)
        estimated_total = parseFloat(Big(limit).times(filled).toFixed(8));
    else
        estimated_total = parseFloat(estimated_total);

    var maximum_total = parseFloat(Big(limit).times(quantity).toFixed(8));
    var fill_percent = parseFloat(Big(filled).times(100).div(quantity).toFixed(2));
    var remaining = parseFloat(Big(quantity).minus(filled).toFixed(8));
    var remaining_percent = parseFloat(Big(remaining).times(100).div(quantity).toFixed(8));
    limit = parseFloat(Big(limit).toFixed(8));
    quantity = parseFloat(quantity);
    filled = parseFloat(filled);



    return {
        exchange: exchange,                                     //exchange Name
        market: market,                                         //name of Market
        exchangeOrderID: e_order_id,                            //orderID on the exchange
        status: status,                                         //open/closed/cancel
        state: state,                                           //new/filled/partial_fill
        action: action,                                         //buy/sell
        type: type,                                             //LIMIT, MARKET, STOP_LOSS, TAKE_PROFIT, STOP_LOSS_LIMIT, TAKE_PROFIT_LIMIT, LIMIT_MAKER
        limit: limit,                                           //initial order price
        highestPPU: highest_ppu,
        lowestPPU: lowest_ppu,
        averagePPU: average_ppu,
        quantity: quantity,                                     //size
        estimated_total: estimated_total,                       //limit * filled (or avgppu * filled if avg exists)
        maximum_total: maximum_total,                           //limit * quantity
        filled: filled,                                         //filled size
        filled_percent: fill_percent,                           //filled % out of quantity
        remaining: remaining,                                   //remaining size
        remaining_percent: remaining_percent,                   //remaining % out of quantity
        trades: trades,                                         //list of trades that are inside this order
        duration: duration,                                     //IOC/FOK/GTD/GTC
        opened: openDate,                                       //ISO open date
        closed: closeDate,                                      //ISO close date
        lastUpdate: updateDate,                                 //ISO last update date
        triggers: triggers,                                     //not used atm
        margin: margin                                          //not used atm
    };
}

module.exports = Order;