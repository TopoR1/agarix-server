const PlayerTracker = require('../PlayerTracker');

class MinionPlayer extends PlayerTracker {
    constructor(server, socket, owner) {
        super(server, socket);
        this.owner = owner;
        this.isMi = true;
        this.socket.isConnected = true;
        this.index = this.owner.minions.push(this) - 1;
        this.tickMinions = 0;
    }
    checkConnection() {
        if (this.socket.isCloseRequest || ((!this.owner.minionActivity || !this.owner.cells.length) && !this.cells.length)) {
            while (this.cells.length)
                this.gameServer.removeNode(this.cells[0]);
            this.isRemoved = true;
            this.owner.minions.splice(this.index, 1);
            return;
        }
        
         //this.owner._skin
        
        if (this.owner.cells.length && this.owner.minionActivity && !this.cells.length) {
            let skin = '';
            
            if (this.owner.checkVIP() && this.owner?.user?.vip?.botsSkins) {
                this.minionSkins = this.owner.user.vip.botsSkins;
                skin = this.getRandomSkin();
            }
            if (this.owner.user.clan) {
                this.tag = this.owner.tag;
            }
            let name = this.owner._miName;
            
            if (!name.trim()) name = `${this.owner._name} Bot`;
            
            this.joinGame(name, skin, true);
            //if (!this.cells.length) this.socket.close();
        }

        // remove if owner has disconnected or has no control
        if (!this.owner.socket.isConnected || !this.owner.minionControl)
            this.socket.close();

        // frozen or not
        this.frozen = this.owner.minionFrozen;

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
