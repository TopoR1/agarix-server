class UpdateNodes {
    constructor(playerTracker, addNodes, updNodes, eatNodes, delNodes) {
        this.playerTracker = playerTracker;
        this.addNodes = addNodes;
        this.updNodes = updNodes;
        this.eatNodes = eatNodes;
        this.delNodes = delNodes;
    }

    build(protocol) {
        if (!protocol) return null;

        const BinaryWriter = require("./BinaryWriter");
        const writer = new BinaryWriter();
        writer.writeUInt8(0x10); // Packet ID
        this.writeEatItems(writer);

        this.writeUpdateItems(writer);

        this.writeRemoveItems(writer, protocol);
        return writer.toBuffer();
    }

    writeUpdateItems(writer) {
        const scrambleX = this.playerTracker.scrambleX;
        const scrambleY = this.playerTracker.scrambleY;
        const scrambleId = this.playerTracker.scrambleId;

        for (const node of this.updNodes) {
            if (node.nodeId == 0 || node.name == 'pellet' || node.name == 'coin') continue;
            
            let skinName = null;
            let cellName = null;
            let pid = -1;
            let notEat = false;
            let redNick = false;
            let tag = "";

            if (node.owner) {
                skinName = node.owner._skinUtf8;
                cellName = node.owner._nameUtf8;
                pid = node.owner.pID;
                notEat = node.owner.notEat.visible;
                tag = node.owner.tag;
                if (node.owner.user_auth) {
                    if (node.owner.checkVIP() && node.owner.user.vip.hasOwnProperty('redNick'))
                        redNick = node.owner.user.vip.redNick;
                }
            }

            const cellX = node.position.x + scrambleX;
            const cellY = node.position.y + scrambleY;

            // Write update record
            writer.writeUInt32((node.nodeId ^ scrambleId) >>> 0); // Cell ID
            writer.writeUInt32(cellX >> 0); // Coordinate X
            writer.writeUInt32(cellY >> 0); // Coordinate Y
            writer.writeUInt16(node._size >>> 0); // Cell Size (not to be confused with mass, because mass = size*size/100)

            writer.writeStringZeroUtf8(tag);
            writer.writeStringZeroUtf8(pid.toString()); // id
            writer.writeStringZeroUtf8(node.name); // type
            writer.writeUInt8(notEat ? 1 : 0);
            writer.writeUInt8(redNick ? 1 : 0);

            let flags = 0;
            if (node.isSpiked)
                flags |= 0x01; // isVirus
            if (node.cellType == 0)
                flags |= 0x02; // isColorPresent (for players only)
            if (skinName != null)
                flags |= 0x04; // isSkinPresent
            if (cellName != null)
                flags |= 0x08; // isNamePresent
            if (node.isAgitated)
                flags |= 0x10; // isAgitated
            writer.writeUInt8(flags >>> 0); // Flags

            if (flags & 0x02) {
                const color = node.color;
                writer.writeUInt8(color.r >>> 0); // Color R
                writer.writeUInt8(color.g >>> 0); // Color G
                writer.writeUInt8(color.b >>> 0); // Color B
            }

            if (flags & 0x04)
                writer.writeBytes(skinName); // Skin Name in UTF8
            if (flags & 0x08)
                writer.writeBytes(cellName); // Cell Name in UTF8
        }
        for (const node of this.addNodes) {
            if (node.nodeId == 0) continue;

            const cellX = node.position.x + scrambleX;
            const cellY = node.position.y + scrambleY;
            let skinName = null;
            let cellName = null;
            let pid = -1;
            let notEat = false;
            let redNick = false;
            let tag = "";
            if (node.owner) {
                skinName = node.owner._skinUtf8;
                cellName = node.owner._nameUtf8;
                pid = node.owner.pID;
                notEat = node.owner.notEat.visible;
                tag = node.owner.tag;
                if (node.owner.user_auth) {
                    if (node.owner.checkVIP() && node.owner.user.vip.hasOwnProperty('redNick'))
                        redNick = node.owner.user.vip.redNick;
                }
            }

            // Write update record
            writer.writeUInt32((node.nodeId ^ scrambleId) >>> 0); // Cell ID
            writer.writeUInt32(cellX >> 0); // Coordinate X
            writer.writeUInt32(cellY >> 0); // Coordinate Y
            writer.writeUInt16(node._size >>> 0); // Cell Size (not to be confused with mass, because mass = size*size/100)

            writer.writeStringZeroUtf8(tag);
            writer.writeStringZeroUtf8(pid.toString()); // id
            writer.writeStringZeroUtf8(node.name); // type
            writer.writeUInt8(notEat ? 1 : 0);
            writer.writeUInt8(redNick ? 1 : 0);

            let flags = 0;
            if (node.isSpiked)
                flags |= 0x01; // isVirus
            if (true)
                flags |= 0x02; // isColorPresent (always for added)
            if (skinName != null)
                flags |= 0x04; // isSkinPresent
            if (cellName != null)
                flags |= 0x08; // isNamePresent
            if (node.isAgitated)
                flags |= 0x10; // isAgitated
            if (node.cellType == 3 || node.name == 'ejectMass')
                flags |= 0x20; // isEjected
            if (node.name == 'pellet')
                flags |= 0x22;
            if (node.name == 'coin')
                flags |= 0x30; // isCoin
            if (node.name == 'portal')
                flags |= 0x40;
            writer.writeUInt8(flags >>> 0); // Flags

            if (flags & 0x02) {
                const color = node.color;
                writer.writeUInt8(color.r >>> 0); // Color R
                writer.writeUInt8(color.g >>> 0); // Color G
                writer.writeUInt8(color.b >>> 0); // Color B
            }
            if (flags & 0x04)
                writer.writeBytes(skinName); // Skin Name in UTF8
            if (flags & 0x08)
                writer.writeBytes(cellName); // Cell Name in UTF8
        }
        writer.writeUInt32(0); // Cell Update record terminator
    }

    writeEatItems(writer) {
        const scrambleId = this.playerTracker.scrambleId;

        writer.writeUInt16(this.eatNodes.length >>> 0); // EatRecordCount

        for (const node of this.eatNodes) {
            let hunterId = 0;
            if (node.killedBy) {
                hunterId = node.killedBy.nodeId;
            }
            writer.writeUInt32((hunterId ^ scrambleId) >>> 0); // Hunter ID
            writer.writeUInt32((node.nodeId ^ scrambleId) >>> 0); // Prey ID
        }
    }

    writeRemoveItems(writer, protocol) {
        const scrambleId = this.playerTracker.scrambleId;
        const length = this.eatNodes.length + this.delNodes.length;
        writer.writeUInt16(length >>> 0); // RemoveRecordCount

        for (const node of this.eatNodes) {
            writer.writeUInt32((node.nodeId ^ scrambleId) >>> 0); // Cell ID
        }
        for (const node of this.delNodes) {
            writer.writeUInt32((node.nodeId ^ scrambleId) >>> 0); // Cell ID
        }
    }
}

module.exports = UpdateNodes;
