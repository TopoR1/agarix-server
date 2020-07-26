var Cell = require('./Cell');

function Coin() {
    Cell.apply(this, Array.prototype.slice.call(arguments));
    
    this.cellType = 1;
	this.name = 'coin';
    this.color = {r: 255, g: 215, b: 0};
    this.isSpiked = false;  // If true, then this cell has spikes around it
    this.isAgitated = false;// If true, then this cell has waves on it's outline
    this.killedBy = null;   // Cell that ate this cell
    this.isMoving = false;  // Indicate that cell is in boosted mode
}

module.exports = Coin;
Coin.prototype = new Cell();

// Main Functions

Coin.prototype.onEaten = function(cell) {
	if (cell.owner) {
		if (!cell.owner.user_auth) return;
		if (cell.owner._token && cell.owner.gameServer.db) {
			cell.owner.gameServer.db.db('agarix-db').collection('users').updateOne({access_token: cell.owner._token}, {$inc: {coins: cell.owner.gameServer.config.coinApp, exp: cell.owner.gameServer.config.coinExp}});
		}
	}
};

Coin.prototype.cantEat = function (cell) {
    if (!cell.owner) return true;
    if (cell.owner.user_auth) return false;
    else return true;
};

Coin.prototype.onAdd = function (gameServer) {
    gameServer.nodesCoin.push(this);
};

Coin.prototype.onRemove = function (gameServer) {
    // Remove from list of foods
    var index = gameServer.nodesCoin.indexOf(this);
    if (index != -1) {
        gameServer.nodesCoin.splice(index, 1);
    }
};
