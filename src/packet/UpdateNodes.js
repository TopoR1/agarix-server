class UpdateNodes {
    constructor(playerTracker, addNodes, updNodes, eatNodes, delNodes, skinsNodes, tagsNodes, namesNodes) {
        this.playerTracker = playerTracker;
        this.addNodes = addNodes;
        this.updNodes = updNodes;
        this.eatNodes = eatNodes;
        this.delNodes = delNodes;
        this.skinsNodes = skinsNodes;
        this.tagsNodes = tagsNodes;
        this.namesNodes = namesNodes;
    }

    build(protocol) {
        if (!protocol) return null;

        const BinaryWriter = require("./BinaryWriter");
        const writer = new BinaryWriter();
        writer.writeUInt8(0x10); // Packet ID

        this.writeEatItems(writer);
        this.writeTextItems(writer);
        this.writeUpdateItems(writer);
        this.writeRemoveItems(writer, protocol);

        return writer.toBuffer();
    }

    writeUpdateItems(writer) {
        const scrambleX = this.playerTracker.scrambleX;
        const scrambleY = this.playerTracker.scrambleY;
        const scrambleId = this.playerTracker.scrambleId;

        for (const node of this.updNodes) {
            if (node.nodeId == 0) continue;

            // Write update record
            writer.writeUInt32((node.nodeId ^ scrambleId) >>> 0); // Cell ID
            writer.writeUInt32((node.position.x + scrambleX) >> 0); // Coordinate X
            writer.writeUInt32((node.position.y + scrambleY) >> 0); // Coordinate Y
            writer.writeUInt16(node._size >>> 0); // Cell Size (not to be confused with mass, because mass = size*size/100)
            writer.writeUInt8(node.cellOtherType); // Cell Type

            let flags = 0;

            if (node.isSpiked) flags |= 0x01; // isVirus

            if (node.cellOtherType == 0) {
                let redNick = node.owner.checkVIP() && node.owner.user.vip?.redNick || false;
                
                writer.writeUInt32(node.owner.pID);
                writer.writeUInt8(node.owner.notEat.visible ? 1 : 0);
                writer.writeUInt8(redNick ? 1 : 0);

                flags |= 0x02; // isColorPresent (for players only)
            }

            writer.writeUInt8(flags >>> 0); // Flags

            if (flags & 0x02) {
                writer.writeUInt8(node.color.r >>> 0); // Color R
                writer.writeUInt8(node.color.g >>> 0); // Color G
                writer.writeUInt8(node.color.b >>> 0); // Color B
            }
        }
        for (const node of this.addNodes) {
            if (node.nodeId == 0) continue;

            // Write update record
            writer.writeUInt32((node.nodeId ^ scrambleId) >>> 0); // Cell ID
            writer.writeUInt32((node.position.x + scrambleX) >> 0); // Coordinate X
            writer.writeUInt32((node.position.y + scrambleY) >> 0); // Coordinate Y
            writer.writeUInt16(node._size >>> 0); // Cell Size (not to be confused with mass, because mass = size*size/100)
            writer.writeUInt8(node.cellOtherType); // Cell Type

            let flags = 0;

            if (node.isSpiked) flags |= 0x01; // isVirus

            if (node.cellOtherType == 0) {
                let redNick = node.owner.checkVIP() && node.owner.user.vip?.redNick || false;
                
                writer.writeUInt32(node.owner.pID);
                writer.writeUInt8(node.owner.notEat.visible ? 1 : 0);
                writer.writeUInt8(redNick ? 1 : 0);
            }

            flags |= 0x02; // isColorPresent (always for added)

            if (node.cellOtherType == 3) flags |= 0x20; // ejected
            if (node.cellOtherType == 1) flags |= 0x22; // food
            if (node.cellOtherType == 5) flags |= 0x30; // coin
            if (node.cellOtherType == 6) flags |= 0x32; // portal

            writer.writeUInt8(flags >>> 0); // Flags

            if (flags & 0x02) {
                writer.writeUInt8(node.color.r >>> 0); // Color R
                writer.writeUInt8(node.color.g >>> 0); // Color G
                writer.writeUInt8(node.color.b >>> 0); // Color B
            }
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

    writeTextItems(writer) {
        const scrambleId = this.playerTracker.scrambleId;

        writer.writeUInt16(this.skinsNodes.length >>> 0); // Count

        for (const skin of this.skinsNodes) {
            writer.writeUInt32(skin.id);
            writer.writeBytes(skin.text);
        }

        writer.writeUInt16(this.tagsNodes.length >>> 0); // Count

        for (const tag of this.tagsNodes) {
            writer.writeUInt32(tag.id);
            writer.writeStringZeroUtf8(tag.text);
        }

        writer.writeUInt16(this.namesNodes.length >>> 0); // Count

        for (const name of this.namesNodes) {
            writer.writeUInt32(name.id);
            writer.writeBytes(name.text);
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
