function Message(exchange, endpoint, id, payload, meta){
    if(meta == undefined)
        meta = [];

    return {
        exchange: exchange,
        endpoint: endpoint,
        issued: new Date().toISOString(),
        id: id,
        meta: meta,
        payload: payload
    }
}

module.exports = Message;