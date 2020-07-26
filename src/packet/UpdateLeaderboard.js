// Import
var BinaryWriter = require("./BinaryWriter");

function UpdateLeaderboard(playerTracker, leaderboard, leaderboardType) {
    this.playerTracker = playerTracker;
    this.leaderboard = leaderboard;
    this.leaderboardType = leaderboardType;
    this.leaderboardCount = Math.min(leaderboard.length, playerTracker.gameServer.config.serverMaxLB);
}
module.exports = UpdateLeaderboard;
UpdateLeaderboard.prototype.build = function (protocol) {
    switch (this.leaderboardType) {
        case 48:
            // UserText
            if (protocol < 11) return this.buildUserText(protocol);
            else return this.buildUserText14();
        case 49:
            // FFA
            if (protocol < 6) return this.buildFfa5();
            else if (protocol < 11) return this.buildFfa6();
            else return this.buildFfa(protocol); // 13/14
        case 50:
            // Team
            return this.buildTeam();
        default:
            return null;
    }
}

// User text all other protocols
UpdateLeaderboard.prototype.buildUserText = function (protocol) {
    var writer = new BinaryWriter();
    writeCount(writer, 0x31, this.leaderboard.length);
    for (var i = 0; i < this.leaderboard.length; i++) {
        var item = this.leaderboard[i] || "";
        if (protocol < 11) writer.writeUInt32(0);
        if (protocol < 6) writer.writeStringZeroUnicode(item);
        else writer.writeStringZeroUtf8(item);
    }
    return writer.toBuffer();
};
// User text 14
UpdateLeaderboard.prototype.buildUserText14 = function () {
    var writer = new BinaryWriter();
    writer.writeUInt8(0x35);
    for (var i = 0; i < this.leaderboard.length; i++) {
        var item = this.leaderboard[i] || "";
        writer.writeUInt8(0x02);
        writer.writeStringZeroUtf8(item);
    }
    return writer.toBuffer();
};
// FFA protocol 5
UpdateLeaderboard.prototype.buildFfa5 = function () {
    var writer = new BinaryWriter();
    writeCount(writer, 0x31, this.leaderboardCount);
    for (var i = 0; i < this.leaderboardCount; i++) {
        var item = this.leaderboard[i];
        if (item == null) return null; // bad leaderboardm just don't send it
        var name = item._nameUnicode;
        var id = 0;
        if (item == this.playerTracker && item.cells.length) id = item.cells[0].nodeId ^ this.playerTracker.scrambleId;
        writer.writeUInt32(id >>> 0); // Player cell Id
        if (name) writer.writeBytes(name);
        else writer.writeUInt16(0);
    }
    return writer.toBuffer();
};
// FFA protocol 6
UpdateLeaderboard.prototype.buildFfa6 = function () {
    var player = this.playerTracker;
    if (player.spectate && player.spectateTarget != null) player = player.spectateTarget;

    var writer = new BinaryWriter();
    writer.writeUInt8(0x31); // Packet ID
    writer.writeUInt32(this.leaderboardCount + 1 >>> 0);
    for (var i = 0; i < this.leaderboardCount; i++) {
        var item = this.leaderboard[i];
        if (item == null) return null; // bad leaderboard just don't send it
        var name = item.getFriendlyName();
        var minions = item.getMiNum();
        var num = i + 1;
        var id = item == this.playerTracker ? 1 : 0;
        writer.writeUInt32(id >>> 0); // isMe flag
        if (item.checkVIP()) {
			if (item.user.vip.chatCrown) writer.writeUInt32(1);
			else writer.writeUInt32(0);
		}
        else writer.writeUInt32(0);
        
        reg = /\{([\w\W]+)\}/.exec(name);
        if (reg) name = name.replace(reg[0], '').trim();
        
        mass = item.getMass();
        miInfo = " (m: " + minions + ")";
        if (mass >= this.playerTracker.gameServer.config.massRestart) {
            name = "Win " + name + "! Restart " + this.playerTracker.gameServer.config.timeRestart + "sec.";
        }
        mass = mass / 1000;
        roundMass = parseFloat(mass.toFixed(1));
        mass = roundMass + "k";
        if (name.replace(/^\s+|\s+$/g, '').lentgh = 0) name = "An unnamed cell";
        if (minions == 0) miInfo = "";
        
        if (name) writer.writeStringZeroUtf8(num + ". " + name + " (" + mass + ")" + miInfo);
        else if (!name) writer.writeStringZeroUtf8(num + ". An unnamed cell" + " (" + mass + ")" + miInfo);
        else writer.writeUInt8(0);
    }
    writer.writeUInt32(1 >>> 0);
    var pos = this.leaderboard.indexOf(this.playerTracker) + 1 == 0 ? "" : this.leaderboard.indexOf(this.playerTracker) + 1;
    var name = this.playerTracker._name;

    reg = /\{([\w\W]+)\}/.exec(name);
    if (reg) name = name.replace(reg[0], '').trim();

    minions = this.playerTracker.getMiNum();
    mass = this.playerTracker.getMass() / 1000;
    roundMass = parseFloat(mass.toFixed(1));
    mass = roundMass + "k";
    //miInfo = " (m: " + minions + ")";
    //if (minions == 0) 
	miInfo = "";
    if (name.replace(/^\s+|\s+$/g, '').lentgh = 0) name = "An unnamed cell";
    leader = pos + ". " + name + " (" + mass + ")" + miInfo;

    if (pos > 10) {
        if (item.checkVIP()) {
			if (item.user.vip.chatCrown) writer.writeUInt32(1);
			else writer.writeUInt32(0);
		}
        else writer.writeUInt32(0);
        if (name) writer.writeStringZeroUtf8(leader);
        else if (!name) writer.writeStringZeroUtf8(leader);
    } else {
        writer.writeUInt32(0);
        writer.writeStringZeroUtf8(" ");
    }
    return writer.toBuffer();
};

// FFA protocol 11
/* It was switched off anyway, however not removing yet
UpdateLeaderboard.prototype.buildFfa11 = function() {
    var pos = require('./LeaderboardPosition');
    this.playerTracker.socket.packetHandler.sendPacket(new pos(this.leaderboard.indexOf(this.playerTracker) + 1));
    var writer = new BinaryWriter();
    writeCount(writer, 0x31, this.leaderboardCount);
    for (var i = 0; i < this.leaderboardCount; i++) {
        var item = this.leaderboard[i];
        if (item == null) return null; // bad leaderboard just don't send it
        var name = item._nameUtf8;
        if (name) writer.writeBytes(name);
        else writer.writeUInt8(0);
    }
    return writer.toBuffer();
};
*/
// FFA protocol 13/14
UpdateLeaderboard.prototype.buildFfa = function (protocol) {
    var writer = new BinaryWriter();
    if (protocol < 14) writer.writeUInt8(0x33); // 13
    else writer.writeUInt8(0x35); // 14
    for (var i = 0; i < this.leaderboardCount; i++) {
        var item = this.leaderboard[i];
        if (item == null) return null; // bad leaderboard just don't send it
        if (item === this.playerTracker) {
            writer.writeUInt8(0x09);
            writer.writeUInt16(1);
        } else {
            var name = item._name;
            writer.writeUInt8(0x02);
            if (name != null && name.length) writer.writeStringZeroUtf8(name);
            else writer.writeUInt8(0);
        }
    }
    var thing = this.leaderboard.indexOf(this.playerTracker) + 1;
    var place = (thing <= 10) ? null : thing;
    if (this.playerTracker.cells.length && place != null) {
        writer.writeUInt8(0x09);
        writer.writeUInt16(place);
    }
    return writer.toBuffer();
};
// Party
// TODO: Implement the "minimap"
UpdateLeaderboard.prototype.buildParty = function () {
    var protocol13s = 0;
    for (var i in this.playerTracker.gameServer.clients) {
        var client = this.playerTracker.gameServer.clients[i].packetHandler;
        if (client.protocol >= 13) protocol13s++;
    }
    var writer = new BinaryWriter();
    writer.writeUInt8(0x34); // Packet ID
    writer.writeUInt16(protocol13s); // How many friends are in-game
    for (var i = 0; i < this.leaderboardCount; i++) {
        var item = this.leaderboard[i];
        if (item == null) return null; // bad leaderboard just don't send it
        if (item === this.playerTracker) {
            writer.writeUInt8(0x09);
            writer.writeUInt16(1);
        } else {
            var name = item._name;
            writer.writeUInt8(0x02);
            if (name != null && name.length) writer.writeStringZeroUtf8(name);
            else writer.writeUInt8(0);
        }
    }
    var thing = this.leaderboard.indexOf(this.playerTracker) + 1;
    var place = (thing <= 10) ? null : thing;
    if (this.playerTracker.cells.length && place != null) {
        writer.writeUInt16(place);
    }
    return writer.toBuffer();
};

function writeCount(writer, flag1, flag2) {
    writer.writeUInt8(flag1); // Packet ID
    writer.writeUInt32(flag2 >>> 0); // Number of elements
}
// Team
UpdateLeaderboard.prototype.buildTeam = function () {
    var writer = new BinaryWriter();
    writeCount(writer, 0x32, this.leaderboard.length);
    for (var i = 0; i < this.leaderboard.length; i++) {
        var value = this.leaderboard[i];
        if (value == null) return null; // bad leaderboardm just don't send it
        if (isNaN(value)) value = 0;
        value = value < 0 ? 0 : value;
        value = value > 1 ? 1 : value;
        writer.writeFloat(value); // isMe flag (previously cell ID)
    }
    return writer.toBuffer();
};
