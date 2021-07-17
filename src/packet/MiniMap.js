const BinaryWriter = require("./BinaryWriter");

class UpdateNodes {
    constructor(Nodes) {
        this.nodes = Nodes;
    }
    build(protocol) {
        const writer = new BinaryWriter();
        writer.writeUInt8(104);
        this.writeUpdateItems(writer);

        return writer.toBuffer();
    }
    writeUpdateItems(writer) {
        for (const node of this.nodes) {
            if (!node || !node.nodeId) continue;

            writer.writeUInt32(node.nodeId >>> 0);
            writer.writeUInt32(node.position.x >> 0);
            writer.writeUInt32(node.position.y >> 0);
            writer.writeUInt16(node._size >>> 0);
            writer.writeUInt8(node.color.r >>> 0);
            writer.writeUInt8(node.color.g >>> 0);
            writer.writeUInt8(node.color.b >>> 0);

            let flags = 0;
            if (node.isSpiked)
                flags |= 0x01;
            if (node.isAgitated)
                flags |= 0x10;
            if (node.cellType == 3)
                flags |= 0x20;

            writer.writeUInt8(flags >>> 0);
            writer.writeUInt16(0);
        }
        
        writer.writeUInt32(0 >> 0);
    }
}

module.exports = UpdateNodes;