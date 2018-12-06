function Event(issuer, type, message){
    return {
        issuer: issuer,
        type: type,
        message: message,
        issued: new Date().toISOString()
    };
}

module.exports = Event;