const Cell = require('./Cell');
const Vec2 = require('../modules/Vec2');
const Entity = require('../entity');
const Food = require('./Food');

function Portal() {
    Cell.apply(this, Array.prototype.slice.call(arguments));
    
    this.cellType = 1;
    this.cellOtherType = 6;
    this.color = {r: 104, g: 24, b: 195};
    this.isMotherCell = true;
    this.minSize = 130;
	this.checkSize = false;
    this.isSpiked = true;
}

module.exports = Portal;
Portal.prototype = new Cell();

// Main Functions

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

Portal.prototype.onEaten = async function(cell) {
    if (!cell.owner) return;

    const client = cell.owner;

    if (client.portal) return;

    client.portal = true;
    client.notEat.val = true;
    const pos = this.gameServer.randomPos();
    const sizes = new Array();

    for (const i in client.cells)
        sizes[i] = client.cells[i]._size;

    while (true) {
        let mass = 0;
        if (client.frozen) {
            await sleep(100);
            continue;
        }
        for (const cell of client.cells) {
            if (this.position) {
                cell.position = new Vec2(this.position.x, this.position.y);
            }
            //cell.
            const size = cell._size - (1 * client.gameServer.config.playerSpeed);
            if (size > 40) {
                cell.setSize(size);
                mass += cell._size;
            }
        }
        if (mass <= 150) break;
        await sleep(4);
    }

    for (const i in client.cells) {
        if (i < sizes.length) client.cells[i].setSize(sizes[i]);
        client.cells[i].position = new Vec2(pos.x, pos.y);
    }

    client.portal = false;
    client.notEat.val = false;
};

Portal.prototype.canEat = function (cell) {
    if (this._mass >= 1000) return false;
    return cell.cellType == 3;    // can eat ejected mass
};

Portal.prototype.onEat = function (prey) {
    if (prey.cellType != 3) return;
    this.setSize(Math.sqrt(this.radius + prey.radius));
};

Portal.prototype.onUpdate = function () {
    if (this._size <= this.minSize) {
        return;
    }
    var maxFood = this.gameServer.config.foodMaxAmount;
    if (this.gameServer.nodesFood.length >= maxFood) {
        return;
    }
    var size1 = this._size;
    var size2 = 32;
    for (var i = 0; i < 2; i++) {
        size1 = Math.sqrt(size1 * size1 - size2 * size2);
        size1 = Math.max(size1, this.minSize);
        this.setSize(this.minSize);
        
        // Spawn food with size2
        var angle = Math.random() * 2 * Math.PI;
        var pos = {
            x: this.position.x + size1 * Math.sin(angle),
            y: this.position.y + size1 * Math.cos(angle)
        };
        
        // Spawn food
        var food = new Food(this.gameServer, null, pos, size2);
        food.color = {r: 76, g: 4, b: 158};
        this.gameServer.addNode(food);
        
        // Eject to random distance
        food.setBoost(32 + 42 * Math.random(), angle);
        
        if (this.gameServer.nodesFood.length >= maxFood || size1 <= this.minSize) {
            break;
        }
    }
    this.gameServer.updateNodeQuad(this);
};

Portal.prototype.onAdd = function (gameServer) {
    gameServer.nodesPortals.push(this);
};

Portal.prototype.onRemove = function (gameServer) {
    // Remove from list of foods
    var index = gameServer.nodesPortals.indexOf(this);
    if (index != -1) {
        gameServer.nodesPortals.splice(index, 1);
    }
};
