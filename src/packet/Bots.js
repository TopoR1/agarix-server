function Bots(bots, time, sender) {
    this.bots = bots;
    this.time = time;
    this.sender = sender;
}

module.exports = Bots;

Bots.prototype.build = function() {
    let BinaryWriter = require("./BinaryWriter");
    let writer = new BinaryWriter();
    writer.writeUInt8(0x69);
	let sec = "";
	
    if (this.sender.botsUserActive) sec = this.time - Math.floor(Date.now() / 1000);

    writer.writeFloat(this.bots);
    writer.writeFloat(sec);
    return writer.toBuffer();
};
