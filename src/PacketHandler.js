var Packet = require('./packet');
var BinaryReader = require('./packet/BinaryReader');
var Entity = require('./entity');

function PacketHandler(gameServer, socket) {
    this.gameServer = gameServer;
    this.socket = socket;
    this.protocol = 0;
    this.handshakeProtocol = null;
    this.handshakeKey = null;
    this.lastJoinTick = 0;
    this.lastChatTick = 0;
    this.lastStatTick = 0;
    this.lastQTick = 0;
    this.lastSpaceTick = 0;
    this.bufKey = 8 ^ 0x146124;
    this.decodeKey = 8 ^ (0x146124 ^ 0x12673178624);
    this.autoban = false;
    this.pressQ = false;
    this.pressW = false;
    this.pressH = false;
    this.pressSpace = false;
    this.pressSpaceCount = 1;
    this.mouseData = null;
    this.handler = {
        254: this.handshake_onProtocol.bind(this),
    };
    this.checkPacketSend = false;
}

module.exports = PacketHandler;

PacketHandler.prototype.startCheckSendPacket = async function (message) {
    for (let i = 0; i < 5; i++) {
        if (this.checkPacketSend) return;
        
        await this.gameServer.sleep(1000);
    }
    
    this.socket.close(1002, "");
};

PacketHandler.prototype.handleMessage = async function (message) {
    if (this.protocol !== 0) {
        let newAb = new Uint8Array(message);
        let dv = Buffer.from(newAb.buffer);
        for (let i = 0; i < dv.byteLength; i++) {
            dv.writeUInt8(dv.readUInt8(i) ^ (this.decodeKey >> ((i % 4) * 8)) & 255, i);
        }
        this.decodeKey = this.rotateKey(this.decodeKey);
        let opcode = dv.readUInt8(0);
	    
        if (!this.handler.hasOwnProperty(opcode)) {
            this.socket.close(1002, "");
            return;
        }
        
        this.handler[opcode](dv);
        this.socket.lastAliveTime = this.gameServer.stepDateTime;
    } else {
        if (this.handler[message[0]]) {
            this.handler[message[0]](message);
            this.socket.lastAliveTime = this.gameServer.stepDateTime;
		
        
            if (!this.checkPacketSend) {
                this.checkPacketSend = true;
                const PlayerTracker = require('./PlayerTracker');
                this.socket.playerTracker = new PlayerTracker(this.gameServer, this.socket);
                const PlayerCommand = require('./modules/PlayerCommand');
                this.socket.playerCommand = new PlayerCommand(this.gameServer, this.socket.playerTracker);
		
                this.gameServer.socketCount++;
                this.gameServer.clients.push(this.socket);
                // Check for external minions
                this.gameServer.checkMinion(this.socket);
            }
        } else {
            this.socket.close(1002, "");
            return;
        }
    }
};

PacketHandler.prototype.rotateKey = function (data) {
    data = Math.imul(data, 562342742) >> 0;
    data = (Math.imul(data >>> 24 ^ data, 562342742) >> 0) ^ data;
    data = Math.imul(data >>> 13 ^ data, 562342742) >> 0;
    data = data >>> 57 ^ data;
    data = data ^ 23 >>> data;
    data = Math.imul(data ^ data >>> data) ^ data;
    data = data ^ data[0] >>> data;
    return data;
}

PacketHandler.prototype.handshake_onProtocol = function (message) {
    if (message.length !== 5) return this.banned();
    this.handshakeProtocol = message[1] | (message[2] << 8) | (message[3] << 16) | (message[4] << 24);
    if (this.handshakeProtocol < 1 || this.handshakeProtocol > 18) {
        this.socket.close(1002, "Not supperted protocol: " + this.handshakeProtocol);
        return this.banned();
    }
    this.handler = {
        255: this.handshake_onKey.bind(this),
    };
};

PacketHandler.prototype.handshake_onKey = function (message) {
    if (message.length !== 5) return this.banned();
    this.handshakeKey = message[1] | (message[2] << 8) | (message[3] << 16) | (message[4] << 24);
    if (this.handshakeProtocol > 6 && this.handshakeKey !== 0) {
        this.socket.close(1002, "Not supperted protocol");
        return this.banned();
    }
    this.handshake_onCompleted(this.handshakeProtocol, this.handshakeKey);
};

PacketHandler.prototype.handshake_onCompleted = function (protocol, key) {
    this.handler = {
        1: this.message_onSpectate.bind(this),
        26: this.message_onKeyH.bind(this),
        27: this.message_onKeySpace.bind(this),
        28: this.message_onKeyQ.bind(this),
        29: this.message_onKeyW.bind(this),
        30: this.message_onKeyE.bind(this),
        31: this.message_onKeyR.bind(this),
        32: this.message_onKeyT.bind(this),
        33: this.message_onKeyP.bind(this),
        34: this.message_onSpawnVirus.bind(this),
        35: this.message_onIncreaseMass.bind(this),
        36: this.message_onSpeedUp.bind(this),
        37: this.message_onInstantCompound.bind(this),
        38: this.message_onFreezator.bind(this),
        39: this.message_onSpawnPortal.bind(this),
        100: this.message_onMouse.bind(this),
        112: this.message_onJoin.bind(this),
        120: this.message_onMinionsName.bind(this),
        121: this.message_onGameVersion.bind(this),
        122: this.message_onUUID.bind(this),
        123: this.message_onToken.bind(this),
        150: this.message_onAddFriend.bind(this),
        151: this.message_onInviteClan.bind(this),
        177: this.message_onBonus.bind(this),
        229: this.message_onChat.bind(this),
        230: this.message_onBotsActivity.bind(this),
        254: this.message_onStat.bind(this)
    };
    this.protocol = protocol;
    // Send handshake response
    this.sendPacket(new Packet.ClearAll());
    this.sendPacket(new Packet.SetBorder(this.socket.playerTracker, this.gameServer.border, this.gameServer.config.serverGamemode, "MultiOgar-Edited " + this.gameServer.version));
    // Send welcome message
    this.gameServer.sendChatMessage(null, this.socket.playerTracker, `Welcome to ${this.gameServer.config.serverName}!`);
    if (this.gameServer.config.serverWelcome)
        this.gameServer.sendChatMessage(null, this.socket.playerTracker, this.gameServer.config.serverWelcome);
    if (this.gameServer.config.serverChat == 0)
        this.gameServer.sendChatMessage(null, this.socket.playerTracker, "This server's chat is disabled.");
    if (this.protocol < this.gameServer.config.minProtocol)
        this.gameServer.sendChatMessage(null, this.socket.playerTracker, "WARNING: Protocol " + this.protocol + " assumed" + this.gameServer.config.minProtocol + "!");
};


PacketHandler.prototype.message_onJoin = function (message) {
    var tick = this.gameServer.tickCounter;
    var dt = tick - this.lastJoinTick;
    this.lastJoinTick = tick;
    /*if (dt < 25 || this.socket.playerTracker.cells.length !== 0) {
        return;
    }*/
    var reader = new BinaryReader(message);
    reader.skipBytes(1);
    var text = null;
    if (this.protocol < 6)
        text = reader.readStringZeroUnicode();
    else
        text = reader.readStringZeroUtf8();
	
	text = text.trim();
	const badLets = ['⠀', 'ᅠ', ' '];
	let filterText = '';

	for (let val of text) {
    	if (!badLets.find(item => item == val)) filterText += val;
	}
	
    this.setNickname(filterText);
};

PacketHandler.prototype.message_onSpectate = function (message) {
    if (message.length !== 1 || this.socket.playerTracker.cells.length !== 0) {
        return;
    }
    this.socket.playerTracker.spectate = true;
};

PacketHandler.prototype.message_onMouse = function (message) {
    if (message.length !== 13 && message.length !== 9 && message.length !== 21) {
        return;
    }
    this.mouseData = Buffer.concat([message]);
};

PacketHandler.prototype.message_onMinionsName = function (message) {
    var reader = new BinaryReader(message);
    reader.skipBytes(1);
    var text = null;
    if (this.protocol < 6)
        text = reader.readStringZeroUnicode();
    else
        text = reader.readStringZeroUtf8();
	
    var nameAndSkin = /^(?:\{([^}]*)\})?([^]*)/.exec(text);
    this.socket.playerTracker._miName = nameAndSkin[2].trim();
};

PacketHandler.prototype.message_onBotsActivity = function(message) {
    let reader = new BinaryReader(message);
    reader.skipBytes(1);
    let text = null;
    if (this.protocol < 6)
        text = reader.readStringZeroUnicode();
    else
        text = reader.readStringZeroUtf8();
	
    this.socket.playerTracker.minionActivity = Math.floor(text) ? true : false;
};

PacketHandler.prototype.message_onBonus = function (message) {
    var self = this;
    this.SCInterval = setInterval(function () {
        var rSkin = self.socket.playerTracker.socket.packetHandler.getRandomSkin();
        self.socket.playerTracker.setSkin(rSkin);
    }, 1000); // Every 5 seconds

    minions = 5; //add minions
    self.socket.playerTracker.miNum += minions;
    for (var i = 0; i < minions; i++) {
        this.gameServer.bots.addMinion(self.socket.playerTracker);
        self.socket.playerTracker.minionControl = true;
    }
    self.socket.playerTracker._bonus = true;
    self.socket.playerTracker.color_bonus = {
        'r': 255,
        'g': 0,
        'b': 0
    };
};

PacketHandler.prototype.message_onKeySpace = function (message) {
    if (this.socket.playerTracker.miQ) {
        this.socket.playerTracker.minionSplit = true;
    } else {
        if (!this.pressSpace) this.pressSpaceCount = 1;
        else this.pressSpaceCount++;
        this.pressSpace = true;
    }
};

PacketHandler.prototype.message_onUUID = function (message) {
    var reader = new BinaryReader(message);
    reader.skipBytes(1);
    var text = null;
    if (this.protocol < 6)
        text = reader.readStringZeroUnicode();
    else
        text = reader.readStringZeroUtf8();
    this.socket.playerTracker._uuid = text;
};

PacketHandler.prototype.message_onGameVersion = function (message) {
    var reader = new BinaryReader(message);
    reader.skipBytes(1);
    var text = null;
    if (this.protocol < 6)
        text = reader.readStringZeroUnicode();
    else
        text = reader.readStringZeroUtf8();
    this.socket.playerTracker.clientV = text;
};

PacketHandler.prototype.message_onToken = function (message) {
    var reader = new BinaryReader(message);
    reader.skipBytes(1);
    var text = null;
    if (this.protocol < 6)
        text = reader.readStringZeroUnicode();
    else
        text = reader.readStringZeroUtf8();
    this.socket.playerTracker._token = text;
};

PacketHandler.prototype.message_onKeyQ = function (message) {
    if (message.length !== 1) return;
    var tick = this.gameServer.tickCoutner;
    var dt = tick - this.lastQTick;
    if (dt < this.gameServer.config.ejectCooldown) {
        return;
    }
    this.lastQTick = tick;
    if (this.socket.playerTracker.minionControl && !this.gameServer.config.disableQ) {
        this.socket.playerTracker.miQ = !this.socket.playerTracker.miQ;
    } else {
        this.pressQ = true;
    }
};

PacketHandler.prototype.message_onKeyH = function (message) {
  //if (message.length !== 1) return;
  //this.pressH = true;
};

/* Teleport (don't WORK with db)
PacketHandler.prototype.message_onKeyH = function (message) {
  //if (message.length !== 1) return;
  //this.pressH = true;
  var client = this.socket.playerTracker;
  if (!client.cells.length || !this.socket.playerTracker.db || !this.socket.playerTracker._token) return;
    for (var i in client.cells) {
        client.cells[i].position.x = client.mouse.x;
        client.cells[i].position.y = client.mouse.y;
        this.gameServer.updateNodeQuad(client.cells[i]);
    }
};*/

PacketHandler.prototype.message_onSpawnVirus = async function (message) {
    if (message.length !== 1) return;
    var client = this.socket.playerTracker;
    if (!client.user_auth) return;

    if (client.user.virus_spawn > 0 && !client.virus_spawn) {
        client.virus_spawn = true;
        client.user.virus_spawn--;
        var virus = new Entity.Virus(this.gameServer, null, client.mouse, this.gameServer.config.virusMinSize);
        this.gameServer.addNode(virus);

        await client.gameServer.db.db('agarix-db').collection('users').updateOne({access_token: client.user.access_token}, {$inc: {virus_spawn: -1}});
        client.virus_spawn = false;
    }
};

PacketHandler.prototype.message_onSpawnPortal = async function (message) {
    if (message.length !== 1) return;
    var client = this.socket.playerTracker;
    if (!client.user_auth) return;

    if (client.user.spawn_portal > 0 && !client.spawn_portal) {
        client.spawn_portal = true;
        client.user.spawn_portal--;
        const portal = new Entity.Portal(this.gameServer, null, client.mouse, 130, 3E5);
        this.gameServer.addNode(portal);

        await client.gameServer.db.db('agarix-db').collection('users').updateOne({access_token: client.user.access_token}, {$inc: {spawn_portal: -1}});
        client.spawn_portal = false;
    }
};
/* Random color (don't WORK with db)
PacketHandler.prototype.message_onKeyH = function (message) {
  //if (message.length !== 1) return;
  //this.pressH = true;
  var client = this.socket.playerTracker;
  if (!client.cells.length || !this.socket.playerTracker.db || !this.socket.playerTracker._token) return;
    client.color = this.gameServer.randomColor();
    client.cells.forEach(function(cell) {
        cell.color = client.color;
    });
}; */

PacketHandler.prototype.message_onIncreaseMass = async function (message) {
    if (message.length !== 1) return;
    let client = this.socket.playerTracker;
    if (!client.user_auth || !client.cells.length) return;

    if (client.user.mass_1000 > 0 && !client.mass_1000) {
        client.mass_1000 = true;
        client.user.mass_1000--;
        ran_cell = Math.floor(Math.random() * (client.cells.length));
        size = client.cells[ran_cell]._size;
        size = size * size / 100;
        size += 1000;
        size = Math.sqrt(size * 100)
        client.cells[ran_cell].setSize(size);

        await client.gameServer.db.db('agarix-db').collection('users').updateOne({access_token: client.user.access_token}, {$inc: {mass_1000: -1}});
        client.mass_1000 = false;
    }
};

PacketHandler.prototype.message_onInviteClan = async function (message) {
    if (message.length !== 5) return;
    const client = this.socket.playerTracker;
    const reader = new BinaryReader(Buffer.concat([message]));
    reader.skipBytes(1);
    const playerID = reader.readInt32();

    if (!client.user_auth) return this.sendPacket(new Packet.Alert('warning', 'You cannot invite to the clan because they are not authorized.'));
    if (!client.user.clan) return this.sendPacket(new Packet.Alert('error', 'You are not a member of the clan!'));

    let player = null;

    if (playerID == -1) return this.sendPacket(new Packet.Alert('error', 'You cannot invite a bot or minion to the clan!'));

    for (const item of client.gameServer.clients) {
        if (item.playerTracker.pID == playerID) {
            player = item.playerTracker;
            break;
        }
    }

    if (!player) return this.sendPacket(new Packet.Alert('error', 'Player not found!'));
    if (!player.user_auth) return this.sendPacket(new Packet.Alert('error', 'The player is not authorized in the game.'));
    if (player.user.username == client.user.username) return this.sendPacket(new Packet.Alert('warning', 'You cannot invite yourself to the clan!'));
    if (player.user.clan) return this.sendPacket(new Packet.Alert('warning', 'The player is already in the clan.'));

    const clan = await client.gameServer.db.db('agarix-db').collection('clans').findOne({id: client.user.clan});

    if (!clan) return this.sendPacket(new Packet.Alert('error', 'The clan does not exist!'));

    for (const item of clan.team) {
        if (item.id == client.user.id) {
            if (item.right == 1) return this.sendPacket(new Packet.Alert('error', 'You do not have the right to invite a player to the clan. Only Chief and Deputies can do this.'));
            break;
        }
    }

    if (clan.team.length >= clan.places) return this.sendPacket(new Packet.Alert('warning', 'There is no place for entry in the clan.'));
    if (clan.min_level > player.user.level) return this.sendPacket(new Packet.Alert('warning', `${player.user.username} player level is small for joining a clan! Change the 'Min Entry Level' parameter in the clan settings. Player Level: ${player.user.level}`));
    if (!player.user.invite_clans) player.user.invite_clans = [];

    for (const item of player.user.invite_clans) {
        if (item.id == clan.id) {
            return this.sendPacket(new Packet.Alert('warning', 'The player is already invited to the clan!'));
        }
    }

    player.user.invite_clans.push({
        id: clan.id,
        name: client.user.username
    });

    await client.gameServer.db.db('agarix-db').collection('users').updateOne({access_token: player.user.access_token}, {$set: {invite_clans: player.user.invite_clans}});

    this.sendPacket(new Packet.Alert('success', `Clan invitation sent to player ${player.user.username}`));
};

PacketHandler.prototype.message_onAddFriend = async function (message) {
    if (message.length !== 5) return;
    const client = this.socket.playerTracker;
    const reader = new BinaryReader(Buffer.concat([message]));
    reader.skipBytes(1);

    const playerID = reader.readInt32();

    if (!client.user_auth) return this.sendPacket(new Packet.Alert('warning', 'You cannot add a player as a friend because you are not authorized.'));
    
    let player = null;

    if (playerID == -1) return this.sendPacket(new Packet.Alert('error', 'You cannot add a bot or minion to your friends!'));

    for (const item of client.gameServer.clients) {
        if (item.playerTracker.pID == playerID) {
            player = item.playerTracker;
            break;
        }
    }

    if (!player) return this.sendPacket(new Packet.Alert('error', 'Player not found!'));
    if (!player.user_auth) return this.sendPacket(new Packet.Alert('error', 'The player is not authorized in the game.'));
    if (player.user.username == client.user.username) return this.sendPacket(new Packet.Alert('warning', 'You can not add yourself!'));

    if (client.user.friends.requests.find(item => item.id == player.user.id)) {
        return this.sendPacket(new Packet.Alert('warning', 'You have already submitted a friend request to the user.'));
    }

    if (client.user.friends.friends.find(item => item.id == player.user.id)) {
        return this.sendPacket(new Packet.Alert('warning', 'You are already friends!'));
    }

    client.user.friends.requests.push({
        "name": player.user.username,
        "id": player.user.id,
        "type": "outbox"
    });

    await client.gameServer.db.db('agarix-db').collection('users').updateOne({
        access_token: client.user.access_token
    }, {
        $set: {
            friends: client.user.friends
        }
    });

    player.user.friends.requests.push({
        "name": client.user.username,
        "id": client.user.id,
        "type": "inbox"
    });

    await client.gameServer.db.db('agarix-db').collection('users').updateOne({
        username: player.user.username
    }, {
        $set: {
            friends: player.user.friends
        }
    });

    this.sendPacket(new Packet.Alert('success', `Friend request sent to player '${player.user.username}'!`));
}

PacketHandler.prototype.message_onSpeedUp = async function (message) {
    if (message.length !== 1) return;

    let client = this.socket.playerTracker;

    if (!client.user_auth || !client.cells.length) return;

    if (client.user.speed_up > 0 && !client.speed_up) {
        client.speed_up = true;
        client.user.speed_up--;
        client.customspeed = client.gameServer.config.playerSpeed * 2;
        // override getSpeed function from PlayerCell
        Entity.PlayerCell.prototype.getSpeed = function (dist) {
            let speed = 2.2 * Math.pow(this._size, -0.439);
            speed = this.owner.customspeed ?
                speed * 40 * this.owner.customspeed : // Set by command
                speed * 40 * this.gameServer.config.playerSpeed;
            return Math.min(dist, speed) / dist;
        };

        this.sendPacket(new Packet.Alert('speed_up', 'on'));

        await client.gameServer.db.db('agarix-db').collection('users').updateOne({access_token: client.user.access_token}, {$inc: {speed_up: -1}});

        await this.gameServer.sleep(1E4);

        client.speed_up = false;
        this.sendPacket(new Packet.Alert('speed_up', 'off'));

        client.customspeed = client.gameServer.config.playerSpeed;
        // override getSpeed function from PlayerCell
        Entity.PlayerCell.prototype.getSpeed = function (dist) {
            let speed = 2.2 * Math.pow(this._size, -0.439);
            speed = this.owner.customspeed ?
                speed * 40 * this.owner.customspeed : // Set by command
                speed * 40 * this.gameServer.config.playerSpeed;
            return Math.min(dist, speed) / dist;
        };
    }
};

PacketHandler.prototype.message_onInstantCompound = async function (message) {
    if (message.length !== 1) return;
    var client = this.socket.playerTracker;
    if (!client.user_auth || !client.cells.length) return;

    if (client.user.instant_compound <= 0) return;
    if (client.cells.length == 1 || client.mergeOverride || client.instant_compound) return;
    client.instant_compound = true;
    client.user.instant_compound--;
    // Set client's merge override
    client.notEat.val = true;
    client.mergeOverride = true;

    await client.gameServer.db.db('agarix-db').collection('users').updateOne({access_token: client.user.access_token}, {$inc: {instant_compound: -1}});
    
    await client.gameServer.sleep(1000);

    client.mergeOverride = false;
    client.notEat.val = false;
    client.instant_compound = false;
};

PacketHandler.prototype.message_onFreezator = function (message) {
    if (message.length !== 1) return;
    var client = this.socket.playerTracker;
    if (!client.user_auth || !client.cells.length) return;

    if (client.user.freezator || client.checkVIP()) {
        let val = 'off';
        if (client.user.freezator >= parseInt(Date.now() / 1000) || client.checkVIP()) client.frozen = !client.frozen;
        else client.frozen = false;
        if (client.frozen) val = 'on';
        this.sendPacket(new Packet.Alert('freezator', val));
    }
};

PacketHandler.prototype.message_onKeyW = function (message) {
    if (message.length !== 1) return;
    if (this.socket.playerTracker.miQ) {
        this.socket.playerTracker.minionEject = true;
    } else {
        this.pressW = true;
    }
};

PacketHandler.prototype.message_onKeyE = function (message) {
    if (this.gameServer.config.disableERTP) return;
    this.socket.playerTracker.minionSplit = true;
};

PacketHandler.prototype.message_onKeyR = function (message) {
    if (this.gameServer.config.disableERTP) return;
    this.socket.playerTracker.minionEject = true;
};

PacketHandler.prototype.message_onKeyT = function (message) {
    if (this.gameServer.config.disableERTP) return;
    this.socket.playerTracker.minionFrozen = !this.socket.playerTracker.minionFrozen;
};

PacketHandler.prototype.message_onKeyP = function (message) {
    if (this.gameServer.config.disableERTP) return;
    if (this.gameServer.config.collectPellets) {
        this.socket.playerTracker.collectPellets = !this.socket.playerTracker.collectPellets;
    }
};

PacketHandler.prototype.message_onChat = function (message) {
    if (message.length < 3) return;
    var tick = this.gameServer.tickCounter;
    var dt = tick - this.lastChatTick;
    this.lastChatTick = tick;
    if (dt < 25 * 2) {
        return;
    }

    var flags = message[1]; // flags
    var rvLength = (flags & 2 ? 4 : 0) + (flags & 4 ? 8 : 0) + (flags & 8 ? 16 : 0);
    if (message.length < 3 + rvLength) // second validation
        return;

    var reader = new BinaryReader(message);
    reader.skipBytes(2 + rvLength); // reserved
    var text = null;
    if (this.protocol < 6)
        text = reader.readStringZeroUnicode();
    else
        text = reader.readStringZeroUtf8();
    this.gameServer.onChatMessage(this.socket.playerTracker, null, text.trim().split('ᅠ').join(''));
};

PacketHandler.prototype.message_onStat = function (message) {
    if (message.length !== 1) return;
    var tick = this.gameServer.tickCounter;
    var dt = tick - this.lastStatTick;
    this.lastStatTick = tick;
    if (dt < 25) {
        return;
    }
    this.sendPacket(new Packet.ServerStat(this.socket.playerTracker));
};

PacketHandler.prototype.processMouse = function () {
    if (this.mouseData == null) return;
    var client = this.socket.playerTracker;
    var reader = new BinaryReader(this.mouseData);
    reader.skipBytes(1);
    if (this.mouseData.length === 13) {
        // protocol late 5, 6, 7
        client.mouse.x = reader.readInt32() - client.scrambleX;
        client.mouse.y = reader.readInt32() - client.scrambleY;
    }
    // correct im
    else if (this.mouseData.length === 9) {
        // early protocol 5
        client.mouse.x = reader.readInt16() - client.scrambleX;
        client.mouse.y = reader.readInt16() - client.scrambleY;
    } else if (this.mouseData.length === 21) {
        // protocol 4
        var x = reader.readDouble() - client.scrambleX;
        var y = reader.readDouble() - client.scrambleY;
        if (!isNaN(x) && !isNaN(y)) {
            client.mouse.x = x;
            client.mouse.y = y;
        }
    }
    this.mouseData = null;
};

PacketHandler.prototype.process = function () {
    if (this.pressSpace) { // Split cell
        for (let i = 0; i < this.pressSpaceCount; i++) {
            this.socket.playerTracker.pressSpace();
        }
        this.pressSpace = false;
        this.pressSpaceCount = 1;
    }
    if (this.pressW) { // Eject mass
        this.socket.playerTracker.pressW();
        this.pressW = false;
    }
    if (this.pressH) { // Eject mass
        this.socket.playerTracker.pressH();
        this.pressH = false;
    }
    if (this.pressQ) { // Q Press
        this.socket.playerTracker.pressQ();
        this.pressQ = false;
    }
    if (this.socket.playerTracker.minionSplit) {
        this.socket.playerTracker.minionSplit = false;
    }
    if (this.socket.playerTracker.minionEject) {
        this.socket.playerTracker.minionEject = false;
    }
    this.processMouse();
};

PacketHandler.prototype.getRandomSkin = function () {
    var randomSkins = [];
    var fs = require("fs");
    if (fs.existsSync("../src/randomskins.txt")) {
        // Read and parse the Skins - filter out whitespace-only Skins
        randomSkins = fs.readFileSync("../src/randomskins.txt", "utf8").split(/[\r\n]+/).filter(function (x) {
            return x != ''; // filter empty Skins
        });
    }
    // Picks a random skin
    if (randomSkins.length > 0) {
        var index = (randomSkins.length * Math.random()) >>> 0;
        var rSkin = randomSkins[index];
    }
    return rSkin;
};

PacketHandler.prototype.banned = function () {
    if (this.autoban) this.gameServer.ipBanList.push(this.socket.remoteAddress);
    this.socket.close(1000, "xz");
    if (this.autoban) {
        var fs = require("fs");
        try {
            var blFile = fs.createWriteStream('../src/ipbanlist.txt');
            // Sort the blacklist and write.
            this.gameServer.ipBanList.sort().forEach(function (v) {
                blFile.write(v + '\n');
            });
            blFile.end();
        } catch (err) {
            Logger.error(err.stack);
            Logger.error("Failed to save " + '../src/ipbanlist.txt' + ": " + err.message);
        }
    }
};

PacketHandler.prototype.setNickname = function (text) {
    var name = "",
        skin = null;
    if (text != null && text.length > 0) {
        var skinName = null,
            userName = text,
            n = -1;
        if (text[0] == '<' && (n = text.indexOf('>', 1)) >= 1) {
            var inner = text.slice(1, n);
            if (n > 1)
                skinName = (inner == "r") ? this.getRandomSkin() : inner;
            else
                skinName = "";
            userName = text.slice(n + 1);
        }
        skin = skinName;
        name = userName;
    }

    if (name.length > this.gameServer.config.playerMaxNickLength)
        name = name.substring(0, this.gameServer.config.playerMaxNickLength);

    /*if (this.gameServer.checkBadWord(name)) {
        skin = null;
        name = "Hi there!";
    }*/

    this.socket.playerTracker.joinGame(name, skin);
};

PacketHandler.prototype.sendPacket = function (packet) {
    var socket = this.socket;
    if (!packet || socket.isConnected == null || !socket.playerTracker || socket.playerTracker.isMi)
        return;
    if (socket.readyState == this.gameServer.WebSocket.OPEN) {
        var buffer = packet.build(this.protocol);
        if (buffer) {
            let ab = new Uint8Array(buffer);
            let dv = new DataView(ab.buffer);
            for (let i = 0; i < dv.byteLength; i++) {
                dv.setUint8(i, dv.getUint8(i) ^ (this.bufKey >> ((i % 4) * 8)) & 255);
            }
            this.bufKey = this.rotateKey(this.bufKey);
            socket.send(dv, {
                binary: true
            });
        }
    } else {
        socket.readyState = this.gameServer.WebSocket.CLOSED;
        socket.emit('close');
    }
};
