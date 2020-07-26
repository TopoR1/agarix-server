class ChatMessage {
    constructor(sender, message) {
        this.sender = sender;
        this.message = message;
    }
    build(protocol) {
        const gameServer = require('../GameServer.js');
        let text = this.message;
        if (text == null) text = "";
        let name = "Server";
        let color = {
            'r': 0x9B,
            'g': 0x9B,
            'b': 0x9B
        };

        if (this.sender != null) {
            name = this.sender._name;

            reg = /\{([\w\W]+)\}/.exec(name);
            if (reg) name = name.replace(reg[0], '').trim();

            if (name == null || name.trim().length == 0) {
                if (this.sender.cells.length > 0) name = "An unnamed cell";
                else name = "Spectator";
            }
            //mes_user = this.sender.user_auth ? "[User] " : "[Guest] ";
            mes_user = '';
            player_id = this.sender.user_auth ? `[UID: ${this.sender.user.id}] ` : `[ID: ${this.sender.pID}] `
            if (this.sender.cells.length > 0) color = this.sender.cells[0].color;
            if (this.sender.checkVIP()) {
                if (this.sender.user.vip.chatCrown) {
                    mes_user = "👑 ";
                    //color = {r: 248, g: 0, b: 0};
                }
            }
        }

        const BinaryWriter = require("./BinaryWriter");
        const writer = new BinaryWriter();
        writer.writeUInt8(0x33); // message id (decimal 99)

        // flags
        let flags = 0;
        if (this.sender == null) flags = 0x80; // server message
        //else if (this.sender.userRole == UserRoleEnum.ADMIN) flags = 0x40; // admin message
        //else if (this.sender.userRole == UserRoleEnum.MODER) flags = 0x20; // moder message

        writer.writeUInt8(flags);
        writer.writeUInt8(color.r >> 0);
        writer.writeUInt8(color.g >> 0);
        writer.writeUInt8(color.b >> 0);

        name = (this.sender == null) ? name : mes_user + player_id + name;

        if (protocol < 6) {
            writer.writeStringZeroUnicode(name);
            writer.writeStringZeroUnicode(text);
        } else {
            writer.writeStringZeroUtf8(name);
            writer.writeStringZeroUtf8(text);
        }
        return writer.toBuffer();
    }
}

module.exports = ChatMessage;
