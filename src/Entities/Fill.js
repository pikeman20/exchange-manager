function Fill(id, price, quantity, time, type){
    if(type == undefined)
        type = "";
    else
        type = type.toUpperCase();

    if(type != "BUY" && type != "SELL")
        type = "UNKNOWN";

    return {
        id: id,
        price: price,
        quantity: quantity,
        iso_time: time,
        type: type
    }
}

module.exports = Fill;