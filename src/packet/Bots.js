function Bots(minions, bots, time, sender) {
    this.minions = minions;
    this.bots = bots;
    this.time = time;
    this.sender = sender;
}

module.exports = Bots;

Bots.prototype.build = function() {
    let BinaryWriter = require("./BinaryWriter");
    let writer = new BinaryWriter();
    writer.writeUInt8(0x69);

    writer.writeFloat(this.minions);
    writer.writeFloat(this.bots);
    writer.writeFloat(this.time);
    return writer.toBuffer();
};
