const PlayerTracker = require('../PlayerTracker');

class MinionPlayer extends PlayerTracker {
    constructor(server, socket, owner) {
        super(server, socket);
        this.owner = owner;
        this.isMi = true;
        this.socket.isConnected = true;
        this.index = this.owner.minions.push(this) - 1;
    }
    checkConnection() {
        if (this.socket.isCloseRequest) {
            while (this.cells.length)
                this.gameServer.removeNode(this.cells[0]);
            this.isRemoved = true;
            this.owner.minions.splice(this.index, 1);
            return;
        }
        let skin = " "; //this.owner._skin
        
        if (this.owner.user_auth) {
            if (this.owner.checkVIP() && this.owner.user.vip.botsSkins) {
                this.minionSkins = true;
                skin = this.getRandomSkin();
            }
            if (this.owner.user.clan) {
                this.tag = this.owner.tag;
            }
        }
        if (this.owner.cells.length && this.owner.minionActivity) {
            let name = this.owner._miName;
            try {
                if (!name.trim()) name = `${this.owner._name} Bot`;
            } catch(err) {
                name = 'Bot';
            }
            this.joinGame(name, skin, true)
            if (!this.cells.length) this.socket.close();
        }

        // remove if owner has disconnected or has no control
        if (!this.owner.socket.isConnected || !this.owner.minionControl)
            this.socket.close();

        // frozen or not
        if (this.owner.minionFrozen) this.frozen = true;
        else this.frozen = false;

        // follow owners mouse by default
        this.mouse = this.owner.mouse;

        // pellet-collecting mode
        /*if (this.owner.collectPellets) {
            if (this.cells.length) {
                this.viewNodes = [];
                const self = this;
                this.viewBox = this.owner.viewBox;
                this.gameServer.quadTree.find(this.viewBox, check => {
                    if (check.cellType == 1) self.viewNodes.push(check);
                });
                let bestDistance = 1e999;
                for (const cell of this.viewNodes) {
                    const dx = this.cells[0].position.x - cell.position.x;
                    const dy = this.cells[0].position.y - cell.position.y;
                    if (dx * dx + dy * dy < bestDistance) {
                        bestDistance = dx * dx + dy * dy;
                        this.mouse = cell.position;
                    }
                }
            }
        }*/
    }
}

module.exports = MinionPlayer;
MinionPlayer.prototype = new PlayerTracker();
