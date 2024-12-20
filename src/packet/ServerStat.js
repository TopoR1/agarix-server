function ServerStat(playerTracker) {
    this.playerTracker = playerTracker;
}

module.exports = ServerStat;

ServerStat.prototype.build = function (protocol) {
    var gameServer = this.playerTracker.gameServer;
    // Get server statistics
    var totalPlayers = 0;
    var alivePlayers = 0;
    var spectPlayers = 0;
    
    for (var i = 0, len = gameServer.clients.length; i < len; i++) {
        var socket = gameServer.clients[i];
        if (!socket || socket.playerTracker.isMi) //!socket.isConnected ||
            continue;
        totalPlayers++;
        if (socket.playerTracker.cells.length) alivePlayers++;
        if (socket.playerTracker.spectate) spectPlayers++;
    }
    var obj = {
        'name': gameServer.config.serverName,
        'mode': gameServer.gameMode.name,
        'uptime': Math.round((gameServer.stepDateTime - gameServer.startTime) / 1000),
        'update': gameServer.updateTimeAvg.toFixed(3),
        'playersTotal': totalPlayers,
        'playersAlive': alivePlayers,
        'playersSpect': spectPlayers,
        'playersLimit': gameServer.config.serverMaxConnections,
    };
    var json = JSON.stringify(obj);
    // Serialize
    var BinaryWriter = require("./BinaryWriter");
    var writer = new BinaryWriter();
    writer.writeUInt8(254);             // Message Id
    writer.writeStringZeroUtf8(json);   // JSON
    return writer.toBuffer();
};
