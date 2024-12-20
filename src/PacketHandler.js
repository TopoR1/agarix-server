const Packet = require('./packet');
const BinaryReader = require('./packet/BinaryReader');
const Entity = require('./entity');

class PacketHandler {
    constructor(gameServer, socket) {
        this.gameServer = gameServer;
        this.socket = socket;
        this.protocol = 0;
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
        this.handler = {};
    }
    // encode
    handleMessage(message) {
        if (!this.protocol) {
            this.protocol = 6;
            this.handshake_onCompleted();
        }
        if (this.protocol !== 0) {
            const newAb = new Uint8Array(message);
            const dv = Buffer.from(newAb.buffer);
            for (let i = 0; i < dv.byteLength; i++) {
                dv.writeUInt8(dv.readUInt8(i) ^ (this.decodeKey >> ((i % 4) * 8)) & 255, i);
            }
            this.decodeKey = this.rotateKey(this.decodeKey);
            const opcode = dv.readUInt8(0);
            
            if (!this.handler.hasOwnProperty(opcode)) {
                this.socket.close(1002, "1b");
                return;
            }
            
            this.handler[opcode](dv);
            this.socket.lastAliveTime = this.gameServer.stepDateTime;
        }
    }
    rotateKey(data) {
        data = Math.imul(data, 562342742) >> 0;
        data = (Math.imul(data >>> 24 ^ data, 562342742) >> 0) ^ data;
        data = Math.imul(data >>> 13 ^ data, 562342742) >> 0;
        data = data >>> 57 ^ data;
        data = data ^ 23 >>> data;
        data = Math.imul(data ^ data >>> data) ^ data;
        data = data ^ data[0] >>> data;
        return data;
    }
    /*
    handleMessage(message) {
        if (!this.handler.hasOwnProperty(message[0]))
            return;
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
    }*/
    handshake_onCompleted() {
        this.handler = {
            1: this.spectate.bind(this),
            2: this.playerData.bind(this),
            3: this.playerToken.bind(this),
            26: this.keyH.bind(this),
            27: this.keySpace.bind(this),
            28: this.keyQ.bind(this),
            29: this.keyW.bind(this),
            30: this.keyE.bind(this),
            31: this.keyR.bind(this),
            32: this.keyT.bind(this),
            33: this.keyP.bind(this),
            34: this.spawnVirus.bind(this),
            35: this.increaseMass.bind(this),
            36: this.speedUp.bind(this),
            37: this.instantCompound.bind(this),
            38: this.freezator.bind(this),
            39: this.spawnPortal.bind(this),
            40: this.notEat.bind(this),
            41: this.killYourself.bind(this),
            99: this.playerActivity.bind(this),
            100: this.mouse.bind(this),
            112: this.join.bind(this),
            //113: this.recaptchaTokenV3.bind(this),
            //114: this.recaptchaTokenV2.bind(this),
            120: this.minionsName.bind(this),
            150: this.addFriend.bind(this),
            151: this.inviteClan.bind(this),
            177: this.bonus.bind(this),
            229: this.chat.bind(this),
            230: this.botsActivity.bind(this),
            254: this.stat.bind(this)
        };
        // Send handshake response
        this.sendPacket(new Packet.ClearAll());
        this.sendPacket(
            new Packet.SetBorder(this.socket.playerTracker, this.gameServer.border, this.gameServer.config.serverGamemode, `MultiOgar-Edited ${this.gameServer.version}`)
        );
        // Send welcome message
        this.gameServer.sendChatMessage(
            null,
            this.socket.playerTracker,
            `Welcome to ${this.gameServer.config.serverName}!`
        );
        if (this.gameServer.config.serverWelcome)
            this.gameServer.sendChatMessage(null, this.socket.playerTracker, this.gameServer.config.serverWelcome);
        if (this.gameServer.config.serverChat == 0)
            this.gameServer.sendChatMessage(null, this.socket.playerTracker, "This server's chat is disabled.");
    }
    join(message) {
        //if (!this.socket.playerTracker._accessPlay) return;
        
        const tick = this.gameServer.tickCounter;
        const dt = tick - this.lastJoinTick;
        this.lastJoinTick = tick;
        /*if (dt < 25 || this.socket.playerTracker.cells.length !== 0) {
            return;
        }*/
        
        const reader = new BinaryReader(message);
        reader.skipBytes(1);
        
        let text = reader.readStringZeroUtf8().trim();
        
        this.setNickname(text);
    }/*
    joinGame(name) {
        if (!this.socket.playerTracker._accessPlay) return;
        
        const tick = this.gameServer.tickCounter;
        const dt = tick - this.lastJoinTick;
        this.lastJoinTick = tick;
        
        this.setNickname(name);
    }
    async recaptchaTokenV3(message) {
        const reader = new BinaryReader(message);
        reader.skipBytes(1);
        
        const token = reader.readStringZeroUtf8().trim();
        const name = reader.readStringZeroUtf8().trim();
        const type = reader.readStringZeroUtf8().trim();
        
        if (this.socket.playerTracker.cells.length) return this.toRecaptcha(type, name);
        if (this.gameServer.clients.find(item => item.playerTracker.recaptcha.token == token)) return;
        
        this.socket.playerTracker.recaptcha.token = token;
        await this.gameServer.request({
            method: 'POST',
            uri: 'https://www.google.com/recaptcha/api/siteverify',
            form: {
                secret: '6Lcdt3wUAAAAAOdLPXkFWMEhja4k4FHryzWXTOVQ',
                response: token,
            },
            json: true
        }).then((res) => {
            if (res.body) {
                if (res.body.success && res.body.score >= .5) {
                    if (!this.socket.playerTracker.recaptcha.verify) this.socket.playerTracker.recaptcha.verify = true;
                    this.socket.playerTracker.recaptcha.active = true;
                    this.socket.playerTracker.recaptcha.score = res.body.score;
                    
                    return this.toRecaptcha(type, name);
                }
            }
            
            this.sendPacket(new Packet.Recaptcha(`recaptchav2^${type}`));
        }).catch(err => {
            console.log(err);
            this.sendPacket(new Packet.Recaptcha('error'));
        });
    }
    async recaptchaTokenV2(message) {
        const reader = new BinaryReader(message);
        reader.skipBytes(1);
        
        const token = reader.readStringZeroUtf8().trim();
        const name = reader.readStringZeroUtf8().trim();
        const type = reader.readStringZeroUtf8().trim();
        
        if (this.socket.playerTracker.cells.length) return this.toRecaptcha(type, name);
        if (this.gameServer.clients.find(item => item.playerTracker.recaptcha.token == token)) return;
        
        this.socket.playerTracker.recaptcha.token = token;
        await this.gameServer.request({
            method: 'POST',
            uri: 'https://www.google.com/recaptcha/api/siteverify',
            form: {
                secret: '6LdfUU0UAAAAAPFP9k7HKhM_cUzpnFsupf78A6kq',
                response: token,
            },
            json: true
        }).then((res) => {
            if (res.body) {
                if (res.body.success) {
                    if (!this.socket.playerTracker.recaptcha.verify) this.socket.playerTracker.recaptcha.verify = true;
                    this.socket.playerTracker.recaptcha.active = true;
                    this.socket.playerTracker.recaptcha.score = 0;
                    
                    return this.toRecaptcha(type, name);
                }
            }
            
            this.sendPacket(new Packet.Recaptcha(`error-recaptchav2^${type}`));
        }).catch(err => {
            console.log(err);
            this.sendPacket(new Packet.Recaptcha('error'));
        });
    }
    toRecaptcha(type, name) {
        if (type == 'play') this.joinGame(name);
        else if (type == 'spectate') this.spectate([1]);
        else return this.sendPacket(new Packet.Alert('error', 'Uvasya, there is no such type.')), this.sendPacket(new Packet.Recaptcha('error-lol'));
        
        this.sendPacket(new Packet.Recaptcha('start'));
    }*/
    spectate(message) {
        if (message.length !== 1 || this.socket.playerTracker.cells.length !== 0) return; // || !this.socket.playerTracker.recaptcha.active
        
        //this.socket.playerTracker.recaptcha.active = false;
        this.socket.playerTracker.spectate = true;
    }
    mouse(message) {
        if (message.length !== 13) return;
        
        this.mouseData = message;
    }
    minionsName(message) {
        const reader = new BinaryReader(message);
        reader.skipBytes(1);
        
        let text = reader.readStringZeroUtf8().trim();
        
        this.socket.playerTracker.setNameMinions(text);
    }
    killYourself(message) {
        if (!this.socket.playerTracker.cells.length) return;
        
        while (this.socket.playerTracker.cells.length) {
            this.gameServer.removeNode(this.socket.playerTracker.cells[0]);
        }
    }
    botsActivity(message) {
        const reader = new BinaryReader(message);
        reader.skipBytes(1);
        
        this.socket.playerTracker.minionActivity = !!reader.readInt8();
    }
    bonus(message) {
        const self = this;
        this.SCInterval = setInterval(() => {
            const rSkin = self.socket.playerTracker.getRandomSkin();
            self.socket.playerTracker.setSkin(rSkin);
        }, 1000); // Every 5 seconds
    }
    keySpace(message) {
        if (this.socket.playerTracker.miQ) {
            this.socket.playerTracker.minionSplit = true;
        } else {
            if (!this.pressSpace) this.pressSpaceCount = 1;
            else this.pressSpaceCount++;
            this.pressSpace = true;
        }
    }
    playerData(message) {
        const reader = new BinaryReader(message);
        reader.skipBytes(1);
        const client = this.socket.playerTracker;
        const token = reader.readStringZeroUtf8();
        const uuid = reader.readStringZeroUtf8();
        const clientV = reader.readStringZeroUtf8();
        
        if (client.gameServer.clients.find(item => item._uuid == uuid)) return this.socket.close(1002, '1d');
        
        if (client.gameServer.playersMute.find(item => item.uuid == uuid || item.ip == this.socket._socket.remoteAddress)) {
            client.mute = true;
            this.gameServer.sendChatMessage(null, client, 'You are muted in chat');
        }
        
        client._accessPlay = true;
        client._uuid = uuid;
        
        if (client.gameServer.clients.find(item => item._token == token)) return this.socket.close(1002, "1e");
        
        client._token = token;
        client.clientV = clientV;
    }
    playerToken(message) {
        const reader = new BinaryReader(message);
        reader.skipBytes(1);
        const token = reader.readStringZeroUtf8().trim();
        const client = this.socket.playerTracker;
        
        if (!client._accessPlay) return this.socket.close(1002, "1o");
        
        if (client.gameServer.clients.find(item => item._token == token && item.pID != client.pID)) return this.socket.close(1002, "1e");
        
        client._token = token;
    }
    keyQ(message) {
        if (message.length !== 1) return;
        const tick = this.gameServer.tickCoutner;
        const dt = tick - this.lastQTick;
        if (dt < this.gameServer.config.ejectCooldown) {
            return;
        }
        this.lastQTick = tick;
        if (this.socket.playerTracker.minionControl && !this.gameServer.config.disableQ) {
            this.socket.playerTracker.miQ = !this.socket.playerTracker.miQ;
        } else {
            this.pressQ = true;
        }
    }
    keyH(message) {
        if (message.length !== 1) return;
        this.pressH = true;
    }
    async spawnVirus(message) {
        if (message.length !== 1) return;
        const client = this.socket.playerTracker;
        if (!client.user_auth || client.disablePowers) return;
        
        if (client.user.virus_spawn > 0 && !client.virus_spawn) {
            client.virus_spawn = true;
            client.user.virus_spawn--;
            const virus = new Entity.Virus(this.gameServer, null, client.mouse, this.gameServer.config.virusMinSize);
            this.gameServer.addNode(virus);
            
            await client.gameServer.db.db('agarix-db').collection('users').updateOne({
                access_token: client.user.access_token
            }, {
                $inc: {
                    virus_spawn: -1
                }
            });
            client.virus_spawn = false;
        }
    }
    async spawnPortal(message) {
        if (message.length !== 1) return;
        const client = this.socket.playerTracker;
        if (!client.user_auth || client.disablePowers) return;
        
        if (client.user.spawn_portal > 0 && !client.spawn_portal) {
            client.spawn_portal = true;
            client.user.spawn_portal--;
            const portal = new Entity.Portal(this.gameServer, null, client.mouse, 130, 3E5);
            this.gameServer.addNode(portal);
            
            await client.gameServer.db.db('agarix-db').collection('users').updateOne({
                access_token: client.user.access_token
            }, {
                $inc: {
                    spawn_portal: -1
                }
            });
            client.spawn_portal = false;
        }
    }
    async notEat(message) {
        if (message.length !== 1) return;
        const client = this.socket.playerTracker;
        if (!client.user_auth) return;
        
        client.setEat();
    }
    async increaseMass(message) {
        if (message.length !== 1) return;
        const client = this.socket.playerTracker;
        if (!client.user_auth || !client.cells.length || client.disablePowers) return;
        
        if (client.user.mass_1000 > 0 && !client.mass_1000) {
            client.mass_1000 = true;
            client.user.mass_1000--;
            const ran_cell = Math.floor(Math.random() * (client.cells.length));
            let size = client.cells[ran_cell]._size;
            size = size * size / 100;
            size += 1000;
            size = Math.sqrt(size * 100)
            client.cells[ran_cell].setSize(size);
            
            await client.gameServer.db.db('agarix-db').collection('users').updateOne({
                access_token: client.user.access_token
            }, {
                $inc: {
                    mass_1000: -1
                }
            });
            client.mass_1000 = false;
        }
    }
    async inviteClan(message) {
        if (message.length !== 5) return;
        const client = this.socket.playerTracker;
        const reader = new BinaryReader(message);
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
        
        const clan = await client.gameServer.db.db('agarix-db').collection('clans').findOne({
            id: client.user.clan
        });
        
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
        
        await client.gameServer.db.db('agarix-db').collection('users').updateOne({
            access_token: player.user.access_token
        }, {
            $set: {
                invite_clans: player.user.invite_clans
            }
        });
        
        this.sendPacket(
            new Packet.Alert('success', `Clan invitation sent to player ${player.user.username}`)
        );
    }
    async addFriend(message) {
        if (message.length !== 5) return;
        const client = this.socket.playerTracker;
        const reader = new BinaryReader(message);
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
        
        this.sendPacket(
            new Packet.Alert('success', `Friend request sent to player '${player.user.username}'!`)
        );
    }
    async playerActivity(message) {
        if (message.length !== 5) return;
        const client = this.socket.playerTracker;
        const reader = new BinaryReader(message);
        reader.skipBytes(1);
        
        client.activity = !!reader.readInt8();

        if (client.activity) this.sendPacket(new Packet.ClearAll());
    }
    async speedUp(message) {
        if (message.length !== 1) return;
        
        const client = this.socket.playerTracker;
        
        if (!client.user_auth || !client.cells.length || client.disablePowers) return;
        
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
            
            await client.gameServer.db.db('agarix-db').collection('users').updateOne({
                access_token: client.user.access_token
            }, {
                $inc: {
                    speed_up: -1
                }
            });
            
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
    }
    async instantCompound(message) {
        if (message.length !== 1) return;
        const client = this.socket.playerTracker;
        if (!client.user_auth || !client.cells.length || client.disablePowers) return;
        
        if (client.user.instant_compound <= 0) return;
        if (client.cells.length == 1 || client.mergeOverride || client.instant_compound) return;
        client.instant_compound = true;
        client.user.instant_compound--;
        // Set client's merge override
        client.notEat.val = true;
        client.mergeOverride = true;
        
        await client.gameServer.db.db('agarix-db').collection('users').updateOne({
            access_token: client.user.access_token
        }, {
            $inc: {
                instant_compound: -1
            }
        });
        
        await client.gameServer.sleep(1000);
        
        client.mergeOverride = false;
        if (!client.notEat.visible) client.notEat.val = false;
        client.instant_compound = false;
    }
    freezator(message) {
        if (message.length !== 1) return;
        const client = this.socket.playerTracker;
        if (!client.user_auth || !client.cells.length || client.disablePowers) return;
        
        if (client.user.freezator || client.checkVIP()) {
            let val = 'off';
            if (client.user.freezator >= parseInt(Date.now() / 1000) || client.checkVIP()) client.frozen = !client.frozen;
            else client.frozen = false;
            if (client.frozen) val = 'on';
            this.sendPacket(new Packet.Alert('freezator', val));
        }
    }
    keyW(message) {
        if (message.length !== 1) return;
        if (this.socket.playerTracker.miQ) {
            this.socket.playerTracker.minionEject = true;
        } else {
            this.pressW = true;
        }
    }
    keyE(message) {
        if (this.gameServer.config.disableERTP) return;
        
        for (const item of this.socket.playerTracker.minions)
            item.socket.packetHandler.pressSpace = true;
    }
    keyR(message) {
        if (this.gameServer.config.disableERTP) return;
        
        for (const item of this.socket.playerTracker.minions)
            item.socket.packetHandler.pressW = true;
    }
    keyT(message) {
        if (this.gameServer.config.disableERTP) return;
        this.socket.playerTracker.minionFrozen = !this.socket.playerTracker.minionFrozen;
    }
    keyP(message) {
        if (this.gameServer.config.disableERTP) return;
        if (this.gameServer.config.collectPellets) {
            this.socket.playerTracker.collectPellets = !this.socket.playerTracker.collectPellets;
        }
    }
    chat(message) {
        if (message.length < 3 || !this.socket.playerTracker.user_auth || this.socket.playerTracker.mute) return; // || !this.socket.playerTracker._accessPlay || !this.socket.playerTracker.recaptcha.verify
        
        const tick = this.gameServer.tickCounter;
        const dt = tick - this.lastChatTick;
        this.lastChatTick = tick;
        if (dt < 25 * 2 && this.socket.playerTracker.user?.role != 4) return;
        
        const flags = message[1]; // flags
        const rvLength = (flags & 2 ? 4 : 0) + (flags & 4 ? 8 : 0) + (flags & 8 ? 16 : 0);
        if (message.length < 3 + rvLength) // second validation
            return;
        
        const reader = new BinaryReader(message);
        reader.skipBytes(2 + rvLength); // reserved
        let text = reader.readStringZeroUtf8().trim();
        
        //if (text.length > 4)
            //text = text.substr(text.length - 4)[0] == text[0] ? text.substr(0, text.length - 4) : text;
        
        this.gameServer.onChatMessage(this.socket.playerTracker, null, text);
    }
    stat(message) {
        if (message.length !== 1) return;
        const tick = this.gameServer.tickCounter;
        const dt = tick - this.lastStatTick;
        if (dt < 20) return;
        
        this.lastStatTick = tick;
        
        this.sendPacket(new Packet.ServerStat(this.socket.playerTracker));
    }
    processMouse() {
        if (!this.mouseData) return;
        const client = this.socket.playerTracker;
        const reader = new BinaryReader(this.mouseData);
        reader.skipBytes(1);
        if (this.mouseData.length === 13) {
            // protocol late 5, 6, 7
            client.mouse.x = reader.readInt32() - client.scrambleX;
            client.mouse.y = reader.readInt32() - client.scrambleY;
        }
        this.mouseData = null;
    }
    process() {
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
        this.processMouse();
    }
    banned() {
        if (this.autoban) this.gameServer.ipBanList.push(this.socket.remoteAddress);
        this.socket.close(1000, "1f");
        if (this.autoban) {
            const fs = require("fs");
            try {
                const blFile = fs.createWriteStream('../src/ipbanlist.txt');
                // Sort the blacklist and write.
                this.gameServer.ipBanList.sort().forEach(v => {
                    blFile.write(`${v}`);
                });
                blFile.end();
            } catch (err) {
                Logger.error(err.stack);
                Logger.error(`Failed to save ../src/ipbanlist.txt: ${err.message}`);
            }
        }
    }
    setNickname(name) {
        //if (!this.socket.playerTracker.recaptcha.active && !this.socket.playerTracker.isBot) return;
        
        //this.socket.playerTracker.recaptcha.active = false;
        
        name = name.trim();
        
        if (name.length > this.gameServer.config.playerMaxNickLength)
            name = name.substring(0, this.gameServer.config.playerMaxNickLength);
        
        name = this.gameServer.checkBadWord(name);
        name = this.gameServer.checkBadSymbols(name);
        
        this.socket.playerTracker.joinGame(name);
    }
    sendPacket(packet) {
        const socket = this.socket;
        if (!packet || socket.isConnected == null || !socket.playerTracker || socket.playerTracker.isMi)
            return;
        if (socket.readyState == this.gameServer.WebSocket.OPEN) {
            const buffer = packet.build(this.protocol);
            if (buffer) {
                const ab = new Uint8Array(buffer);
                const dv = new DataView(ab.buffer);
                for (let i = 0; i < dv.byteLength; i++) {
                    dv.setUint8(i, dv.getUint8(i) ^ (this.bufKey >> ((i % 4) * 8)) & 255);
                }
                this.bufKey = this.rotateKey(this.bufKey);
                socket.send(dv, {
                    binary: true
                });
            }
        } else {
            socket.close(1002, '1g');
            socket.readyState = this.gameServer.WebSocket.CLOSED;
            socket.emit('close');
        }
    }/*
    sendPacket(packet) {
        const socket = this.socket;
        if (!packet || !socket.isConnected || socket.playerTracker.isMi ||
            socket.playerTracker.isBot) return;
        if (socket.readyState == this.gameServer.WebSocket.OPEN) {
            const buffer = packet.build(this.protocol);
            if (buffer)
                socket.send(buffer, { binary: true });
        } else {
            socket.close(1002, '1g');
            socket.readyState = this.gameServer.WebSocket.CLOSED;
            socket.emit('close');
        }
    }*/
}

module.exports = PacketHandler;
