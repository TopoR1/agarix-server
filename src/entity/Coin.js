var Cell = require('./Cell');

function Coin() {
	Cell.apply(this, Array.prototype.slice.call(arguments));
	
	this.cellType = 1;
	this.cellOtherType = 5;
	this.color = {
		r: 255,
		g: 215,
		b: 0
	};
}

module.exports = Coin;
Coin.prototype = new Cell();

// Main Functions

Coin.prototype.onEaten = async function(cell) {
	if (cell.owner) {
		if (!cell.owner.user_auth) return;
		if (cell.owner._token && cell.owner.gameServer.db) {
			if (cell.owner.incVirus) {
				await cell.owner.gameServer.db.db('agarix-db').collection('users').updateOne({
					access_token: cell.owner._token
				}, {
					$inc: {
						coins_eaten: 1
					}
				});
			}
			cell.owner.gameServer.db.db('agarix-db').collection('users').updateOne({
				access_token: cell.owner._token
			}, {
				$inc: {
					coins: cell.owner.gameServer.config.coinApp,
					exp: cell.owner.gameServer.config.coinExp
				}
			});
		}
	}
};

Coin.prototype.cantEat = function(cell) {
	if (!cell.owner) return true;
	if (cell.owner.user_auth) return false;
	else return true;
};

Coin.prototype.onAdd = function(gameServer) {
	gameServer.nodesCoin.push(this);
};

Coin.prototype.onRemove = function(gameServer) {
	// Remove from list of foods
	var index = gameServer.nodesCoin.indexOf(this);
	if (index != -1) {
		gameServer.nodesCoin.splice(index, 1);
	}
};
