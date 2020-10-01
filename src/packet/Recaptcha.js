function Recaptcha(type) {
    this.type = type;
}

module.exports = Recaptcha;

Recaptcha.prototype.build = function() {
    let BinaryWriter = require("./BinaryWriter");
    let writer = new BinaryWriter();
    writer.writeUInt8(0x72);
	
    writer.writeStringZeroUtf8(this.type);
    return writer.toBuffer();
};
