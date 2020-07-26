var BinaryWriter = require("./BinaryWriter");

function AddNode(playerTracker, item) {
    this.playerTracker = playerTracker;
    this.item = item;
}

module.exports = AddNode;

AddNode.prototype.build = function (protocol) {
    var writer = new BinaryWriter();
    writer.writeUInt8(0x16);                      // Packet ID
    writer.writeUInt32((this.item.nodeId ^ this.playerTracker.scrambleId) >>> 0);
    return writer.toBuffer();
};
