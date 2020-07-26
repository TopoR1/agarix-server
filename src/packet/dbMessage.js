function dbMessage(db, message) {
    this.dbConnect = db;
    this.message = message;
}

module.exports = dbMessage;

dbMessage.prototype.build = function () {
    var BinaryWriter = require("./BinaryWriter");
    var writer = new BinaryWriter();
    writer.writeUInt8(0x70);

    writer.writeStringZeroUtf8(this.dbConnect ? "true" : "false");
    writer.writeStringZeroUtf8(this.message);
    return writer.toBuffer();
};
