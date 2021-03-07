class ChatMessage {
    constructor(sender, message) {
        this.sender = sender;
        this.message = message;
    }
    build(protocol) {
        const gameServer = require('../GameServer.js');
        let text = this.message;
        let mes_user = '';
        let tag = '';
        
        if (!text) text = '';
        else text = text.trim()
        
        let name = 'Server';
        let color = {
            'r': 0x9B,
            'g': 0x9B,
            'b': 0x9B
        };

        if (this.sender) {
            name = this.sender._name;
            
            if (name) name = name.trim();

            if (!name || !name.length) {
                if (this.sender.cells.length) name = 'An unnamed cell';
                else name = 'Spectator';
            }
            
            //player_id = this.sender.user_auth ? `[UID: ${this.sender.user.id}] ` : `[ID: ${this.sender.pID}] `
            tag = this.sender.tag ? `[${this.sender.tag}] ` : '';
            if (this.sender.cells.length) color = this.sender.cells[0].color;
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

        name = (this.sender == null) ? name : mes_user + tag + name;

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
