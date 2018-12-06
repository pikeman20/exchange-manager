function Trade(order_id, trade_id, ppu, quantity, time) {
    return {
        order_id: order_id,
        trade_id: trade_id,
        ppu: ppu,
        quantity: quantity,
        time : time
    }
}

module.exports = Trade;