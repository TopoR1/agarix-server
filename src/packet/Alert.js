function Alert(type, mes) {
    this.type = type;
    this.mes = mes;
}

module.exports = Alert;

Alert.prototype.build = function() {
    let BinaryWriter = require("./BinaryWriter");
    let writer = new BinaryWriter();
    writer.writeUInt8(0x71);
	
    writer.writeStringZeroUtf8(this.type);
    writer.writeStringZeroUtf8(this.mes);
    return writer.toBuffer();
};
