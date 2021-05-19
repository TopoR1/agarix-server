const Packet = require('./packet');
const Vec2 = require('./modules/Vec2');
const BinaryWriter = require("./packet/BinaryWriter");
const GameServer = require("./GameServer");
const Entity = require('./entity');
const fs = require('fs');

class PlayerTracker {
    constructor(gameServer, socket) {
        this.gameServer = gameServer;
        this.socket = socket;
        this.pID = -1;
        this.isRemoved = false;
        this.isCloseRequested = false;
        this.tag = '';
        this._name = "";
        this._miName = "";
        this._skin = "";
        this.color_bonus = "";
        this._uuid = "";
        this._token = "";
        this._accessPlay = false;
        this._bonus = false;
        this._nameUtf8 = null;
        this._skinUtf8protocol11 = null;
        this._nameUnicode = null;
        this._skinUtf8 = null;
        this.recaptcha = {
            token: null,
            active: false,
            score: 0,
            verify: false
        };
        this.color = {
            r: 0,
            g: 0,
            b: 0
        };
        this.viewNodes = [];
        this.clientNodes = [];
        this.cells = [];
        this.mergeOverride = false; // Triggered by console command
        this._score = 0; // Needed for leaderboard
        this._scale = 1;
        this.borderCounter = 0;
        this.connectedTime = new Date();
        this.accountusername = this.pID;
        this.accountpassword = "";
        this.mute = false;

        this.clientV = '2.01.4';

        this.user = {};
        this.user_auth = false;
        this.notEat = {
            val: false,
            visible: false
        };
        this.collectPoints = 0;
        this.allowCollectPoints = true;
        this.tickNodes = 0;
        this.tickLeaderboard = 0;
        this.tickSecond = 0;
        this.team = 0;
        this.spectate = false;
        this.freeRoam = false; // Free-roam mode enables player to move in spectate mode
        this.spectateTarget = null; // Spectate target, null for largest player
        this.lastKeypressTick = 0;
        this.MiniMap = true;
        this.num_call = 0;

        this.centerPos = new Vec2(0, 0);
        this.mouse = new Vec2(0, 0);
        this.viewBox = {
            minx: 0,
            miny: 0,
            maxx: 0,
            maxy: 0
        };

        // Scramble the coordinate system for anti-raga
        this.scrambleX = 0;
        this.scrambleY = 0;
        this.scrambleId = 0;
        this.isMinion = false;
        this.isMuted = false;

        // Custom commands
        this.spawnmass = 0;
        this.frozen = false;
        this.customspeed = 0;
        this.rec = false;
        this.portal = false;
        this.speed_up = false;
        this.virus_spawn = false;
        this.mass_1000 = false;
        this.instant_compound = false;
        this.spawn_portal = false;
        this.used_not_eat = false;

        // Minions
        this.miQ = 0;
        this.minionsAmount = 0;
        this.isMi = false;
        this.minionFrozen = false;
        this.minionControl = false;
        this.minionActivity = true;
        this.collectPellets = false;
        this.minions = [];

        this.botsUserActive = false;
        this.minionMass = false;
        this.minionSkins = false;

        this.isBot = false;
        // Gamemode function
        if (gameServer) {
            // Player id
            this.pID = gameServer.lastPlayerId++ >> 0;
            // Gamemode function
            gameServer.gameMode.onPlayerInit(this);
            // Only scramble if enabled in config
            this.scramble();
            /*this.intervalDbConnect = setInterval(() => {
                if (this.isBot || this.isMinion || this.isMi) return clearInterval(this.intervalDbConnect);
                if (this.socket.packetHandler) {
                    clearInterval(this.intervalDbConnect);
                    this.dbConnect();
                }
            }, 100);*/
            let calls = 0;
            if (this.socket.packetHandler && !this.isBot && !this.isMinion && !this.isMi) {
                this.intervalDbConnect = setInterval(() => {
                    this.socket.packetHandler.sendPacket(new Packet.dbMessage(false, "loading"));
                    calls++;
                    if (this.gameServer.db) {
                        clearInterval(this.intervalDbConnect);
                        this.startSession();
                        setTimeout(() => {
                            this.socket.packetHandler.sendPacket(new Packet.dbMessage(true, "success"));
                        }, 1000);
                    } else if (calls >= 15) {
                        clearInterval(this.intervalDbConnect);
                        this.socket.packetHandler.sendPacket(new Packet.dbMessage(false, "error"));
                    }
                }, 333);
            }
        }
    }
    checkVIP() {
        if (!this.user_auth) return false;
        if (this.user.vip.time >= Date.now() / 1000) return true;
        return false;
    }
    async startSession() {
        if (this.isRemoved) return;
        if (this._token && this.gameServer.db) {
            let user = await this.gameServer.db.db('agarix-db').collection('users').findOne({
                access_token: this._token
            });

            if (!user || !user.online) {
                this.user_auth = false;
                this.user = {};
                this.tag = '';
                this.setSkin();
            } else if (this.user.updateTime != user.updateTime && user.online) {
                this.user = user;
                if ((user.clan && this.num_call > 20) || !this.user_auth) {
                    this.num_call = 0;
                    const clan = await this.gameServer.db.db('agarix-db').collection('clans').findOne({
                        id: user.clan
                    });

                    if (clan) {
                        this.tag = clan.tag;
                    }
                }
                this.user_auth = true;
                await this.updatePointsCollect();
                this.checkSkin();
                if (user.server_name != this.gameServer.config.serverName || user.server_id != this.pID || user.nickPlayer != this._name)
                    await this.gameServer.db.db('agarix-db').collection('users').updateOne({
                        access_token: this._token
                    }, {
                        $set: {
                            server_name: this.gameServer.config.serverName,
                            server_id: this.pID,
                            nickPlayer: this._name
                        }
                    });
                this.num_call++;
            }
        } else if (!this._token) {
            this.user_auth = false;
            this.user = {};
            this.tag = '';
            this.setSkin();
        }

        setTimeout(async () => {
            await this.startSession();
        }, this.cells.length ? 1000 : 2000);
    }
    checkSkin() {
        const skin = this.user?.skin_used?.url.split('/')[1] ?? '';

        if (this._skin != skin) this.setSkin(skin);
    }
    async updatePointsCollect() {
        if (this.collectPoints > 5 && this.allowCollectPoints) {
            if (this.collectPoints > 50) {
                return this.collectPoints = 0;
            }
            this.allowCollectPoints = false;

            if (this.user.clan) {
                const clan = await this.gameServer.db.db('agarix-db').collection('clans').findOne({
                    id: this.user.clan
                });

                if (clan) {
                    await this.gameServer.db.db('agarix-db').collection('clans').updateOne({
                        id: this.user.clan,
                        'team.id': this.user.id
                    }, {
                        $inc: {
                            'team.$.xp': this.collectPoints
                        }
                    });
                }
            }

            for (let i in this.user.boost) {
                if (this.user.boost[i].boost == 'xp' && this.user.boost[i].activate) {
                    this.collectPoints *= this.user.boost[i].x;
                    break;
                }
            }

            await this.gameServer.db.db('agarix-db').collection('users').updateOne({
                access_token: this.user.access_token
            }, {
                $inc: {
                    exp: this.collectPoints
                },
                $set: {
                    updateTime: Date.now()
                }
            });

            this.collectPoints = 0;
            this.allowCollectPoints = true;
        }
    }
    checkMinions() {
        if (this.isMi || this.isBot || this.isMinion) return;
	
        const seconds = parseInt(Date.now() / 1000);
        const minions = this?.user?.bots;
        let minionMass = this.minionMass;
        let time = 0;

        if (!minions || seconds >= minions?.time) { //this.minionsAmount
            if (this.minionsAmount != this.gameServer.config.serverMinions && this.minionsAmount != this.gameServer.config.serverMinions * 2) {
                this.botsUserActive = false;
                this.minionControl = this.gameServer.config.serverMinions == 0 ? false : true;
                //this.miQ = 0;
                this.minionsAmount = 0;
                this.minionMass = 0;

                const date = new Date();
                const hours = date.getHours();

                if (0 <= hours && 6 >= hours) {
                    this.minionsAmount = this.gameServer.config.serverMinions * 2;
                    this.gameServer.sendChatMessage(null, this, `You get a night bonus - ${this.minionsAmount} minions! We issue them from 0:00 to 7:00!`);
                } else this.minionsAmount = this.config.serverMinions;

                this.minionMass = this.config.minionStartSize;
            }
        } else {
            if (!this.botsUserActive || this.minionsAmount != minions.bots || this.minionMass != minions.mass) {
                this.botsUserActive = true;
                this.minionControl = true;
                //this.miQ = 0;
                this.minionsAmount = minions.bots;
                this.minionMass = minions.mass || 10;
            }
		
            time = minions.time - seconds;
        }

        this.socket.packetHandler.sendPacket(new Packet.Bots(this.minions.length, this.minionsAmount, time, this));

        if (this.minionMass != minionMass && this.cells.length) {
            for (const minion of this.minions) {
                minion.spawnmass = Math.sqrt(this.minionMass * 100);
            }
        }

        if (this.minionsAmount < this.minions.length && this.cells.length) {
            const minionsDeath = this.minions.length - this.minionsAmount;
            let i = 0;

            for (const minion of this.minions) {
                if (i >= minionsDeath) break;

                minion.death = true;
                i++;
            }
        } else if (this.cells.length && this.minionActivity) {
            const minionsAdd = this.minionsAmount - this.minions.length;

            for (let i = 0; i < minionsAdd; i++) {
                this.gameServer.bots.addMinion(this, this.minionMass);
            }
        }
    }
    scramble() {
        if (!this.gameServer.config.serverScrambleLevel) {
            this.scrambleId = 0;
            this.scrambleX = 0;
            this.scrambleY = 0;
        } else {
            this.scrambleId = (Math.random() * 0xFFFFFFFF) >>> 0;
            // avoid mouse packet limitations
            const maxx = Math.max(0, 31767 - this.gameServer.border.width);
            const maxy = Math.max(0, 31767 - this.gameServer.border.height);
            let x = maxx * Math.random();
            let y = maxy * Math.random();
            if (Math.random() >= 0.5) x = -x;
            if (Math.random() >= 0.5) y = -y;
            this.scrambleX = x;
            this.scrambleY = y;
        }
        this.borderCounter = 0;
    }
    getFriendlyName() {
        if (!this._name) this._name = "";
        this._name = this._name.trim();
        if (!this._name.length) this._name = "An unnamed cell";
        return this._name;
    }
    getMiNum() {
        if (!this.miNum) this.miNum = 0;
        return this.miNum;
    }
    getMass() {
        if (!this._score) this._score = .4;
        return this._score;
    }
    getRandomSkin() {
        // Picks a random skin
        if (this.gameServer.skins.length > 0) {
            const index = (this.gameServer.skins.length * Math.random()) >>> 0;

            return this.gameServer.skins[index];
        }
    }
    setName(name) {
        this._name = name.trim();
        let writer = new BinaryWriter();
        writer.writeStringZeroUnicode(this._name);
        this._nameUnicode = writer.toBuffer();
        writer = new BinaryWriter();
        writer.writeStringZeroUtf8(this._name);
        this._nameUtf8 = writer.toBuffer();
    }
    setSkin(skin = '') {
        this._skin = '';
        if (((!this.isBot && !this.isMi && this.user_auth) || this.isMi && this.minionSkins) && typeof(skin) == 'string') {
            this._skin = skin;
        }
        const writer = new BinaryWriter();
        writer.writeStringZeroUtf8(this._skin);
        this._skinUtf8 = writer.toBuffer();
        const writer1 = new BinaryWriter();
        writer1.writeStringZeroUtf8(`%${this._skin}`);
        this._skinUtf8protocol11 = writer1.toBuffer();
    }
    setNameMinions(name) {
        if (!name) return;

        if (name.length > 15) name = 'An unnamed Bot';
        this._miName = this.gameServer.checkBadSymbols(name);

        return true;
    }
    getScale(player_send) {
        const player = player_send || this;
        player._score = 0; // reset to not cause bugs with leaderboard
        let scale = 0; // reset to not cause bugs with viewbox
        for (let i = 0; i < player.cells.length; i++) {
            scale += player.cells[i]._size;
            player._score += player.cells[i]._mass;
        }
        if (player.isBot && player._score > 20000) player.gameServer.removeNode(player.cells[0]);
        if (player._score >= player.gameServer.config.massRestart) {
            setTimeout(() => {
                process.exit(3);
            }, player.gameServer.config.timeRestart * 1000)
            if (player._score >= player.gameServer.config.maxMassRestart) {
                console.log(`scale: ${scale}`)
                console.log(`pl.scale: ${player._score}`)
                console.log(`cells: ${player.cells.length}`)
                process.exit(3);
            }
        }
        if (!scale) return scale = player._score = .2; // reset
        else return player._scale = Math.pow(Math.min(64 / scale, 1), 0.4);
    }
    setEat(spawn = false) {
        if (!this.user_auth || this.used_not_eat) return;

        if (this.user.hasOwnProperty('not_eat')) {
            if (this.user.not_eat.hasOwnProperty('time')) {
                if (!this.user.not_eat.hasOwnProperty('spawn')) this.user.not_eat.spawn = true;
                if ((spawn && !this.user.not_eat.spawn) || (!spawn && !this.user.not_eat.press)) return;

                this.notEat.val = true;
                this.notEat.visible = true;
                this.used_not_eat = true;

                this.socket.packetHandler.sendPacket(new Packet.Alert('not_eat', 'on'));

                setTimeout(() => {
                    this.notEat.val = false;
                    this.notEat.visible = false;
                    this.socket.packetHandler.sendPacket(new Packet.Alert('not_eat', 'off'));
                }, this.user.not_eat.time * 1000);
            }
        }
    }
    joinGame(name, skin, isMi) {
        if (!isMi) this.setSkin(skin);
        if (!name.trim()) name = "An unnamed cell";
        this.setName(name);

        if (this.cells.length) return;

        this.spectate = false;
        this.freeRoam = false;
        this.spectateTarget = null;
        const packetHandler = this.socket.packetHandler;

        if (isMi) this.setSkin(skin);
        if (!this.isMi && this.socket.isConnected != null) {
            // some old clients don't understand ClearAll message
            // so we will send update for them
            this.used_not_eat = false;
            this.setEat(true);

            if (packetHandler.protocol < 6)
                packetHandler.sendPacket(new Packet.UpdateNodes(this, [], [], [], this.clientNodes));

            packetHandler.sendPacket(new Packet.ClearAll());
            this.clientNodes = [];
            this.scramble();
            if (this.gameServer.config.serverScrambleLevel < 2) {
                // no scramble / lightweight scramble
                packetHandler.sendPacket(new Packet.SetBorder(this, this.gameServer.border));
            } else if (this.gameServer.config.serverScrambleLevel == 3) {
                const ran = 10065536 * Math.random();
                // Ruins most known minimaps (no border)
                const border = {
                    minx: this.gameServer.border.minx - ran,
                    miny: this.gameServer.border.miny - ran,
                    maxx: this.gameServer.border.maxx + ran,
                    maxy: this.gameServer.border.maxy + ran
                };
                packetHandler.sendPacket(new Packet.SetBorder(this, border));
            }
        }
        if (!this.isMi || isMi) this.gameServer.gameMode.onPlayerSpawn(this.gameServer, this);
    }
    checkConnection() {
        // Handle disconnection
        if (!this.socket.isConnected) {
            // Wait for playerDisconnectTime
            const pt = this.gameServer.config.playerDisconnectTime;
            let dt = (this.gameServer.stepDateTime - this.socket.closeTime) / 1e3;
            if (pt && (!this.cells.length || dt >= pt)) {
                // Remove all client cells
                while (this.cells.length) this.gameServer.removeNode(this.cells[0]);
            }
            this.cells = [];
            this.isRemoved = true;
            this.mouse = null;
            this.socket.packetHandler.pressSpace = false;
            this.socket.packetHandler.pressQ = false;
            this.socket.packetHandler.pressW = false;
            this.socket.packetHandler.pressH = false;
            return;
        }

        // Check timeout
        if ((!this.isCloseRequested && this.gameServer.config.serverTimeout) && !this.cells.length) {
            dt = (this.gameServer.stepDateTime - this.socket.lastAliveTime) / 1000;
            if (dt >= this.gameServer.config.serverTimeout) {
                console.log(`connect close for ${this.socket.remoteAddress}`)
                this.socket.close(1000, "Connection timeout");
                this.isCloseRequested = true;
            }
        }
    }
    updateTick() {
        if (this.isRemoved) return; // do not update
        this.socket.packetHandler.process();
        if (this.isMi && this.gameServer.config.minionsOnLeaderboard) return;

        // update viewbox
        this.updateSpecView(this.cells.length);
        const scale = Math.max(this.getScale(), this.gameServer.config.serverMinScale);
        const halfWidth = (this.gameServer.config.serverViewBaseX * 1.35) / scale / 2; //+ 100
        const halfHeight = (this.gameServer.config.serverViewBaseY * 1.35) / scale / 2; //+ 100
        this.viewBox = {
            minx: this.centerPos.x - halfWidth,
            miny: this.centerPos.y - halfHeight,
            maxx: this.centerPos.x + halfWidth,
            maxy: this.centerPos.y + halfHeight
        };

        // update visible nodes
        this.viewNodes = [];
        const self = this;
        this.gameServer.quadTree.find(this.viewBox, check => {
            self.viewNodes.push(check);
        });
        this.viewNodes.sort((a, b) => {
            return a.nodeId - b.nodeId;
        });
    }
    sendUpdate() {
        if (this.isRemoved || !this.socket.packetHandler.protocol ||
            !this.socket.isConnected || this.isMi || this.isMinion ||
            (this.socket._socket.writable != null && !this.socket._socket.writable) ||
            this.socket.readyState != this.socket.OPEN) {
            // do not send update for disconnected clients
            // also do not send if initialization is not complete yet
            return;
        }

        const packetHandler = this.socket.packetHandler;
        if (this.gameServer.config.serverScrambleLevel == 2) {
            // scramble (moving border)
            if (!this.borderCounter) {
                const b = this.gameServer.border,
                    v = this.viewBox;
                const bound = {
                    minx: Math.max(b.minx, v.minx - v.halfWidth),
                    miny: Math.max(b.miny, v.miny - v.halfHeight),
                    maxx: Math.min(b.maxx, v.maxx + v.halfWidth),
                    maxy: Math.min(b.maxy, v.maxy + v.halfHeight)
                };
                packetHandler.sendPacket(new Packet.SetBorder(this, bound));
            }
            if (++this.borderCounter >= 20) this.borderCounter = 0;
        }

        const delNodes = [];
        const eatNodes = [];
        const addNodes = [];
        const updNodes = [];
        let oldIndex = 0;
        let newIndex = 0;
        for (; newIndex < this.viewNodes.length && oldIndex < this.clientNodes.length;) {
            if (this.viewNodes[newIndex].nodeId < this.clientNodes[oldIndex].nodeId) {
                if (this.viewNodes[newIndex].isRemoved) continue;
                addNodes.push(this.viewNodes[newIndex]);
                newIndex++;
                continue;
            }
            if (this.viewNodes[newIndex].nodeId > this.clientNodes[oldIndex].nodeId) {
                const node = this.clientNodes[oldIndex];
                if (node.isRemoved) eatNodes.push(node);
                else delNodes.push(node);
                oldIndex++;
                continue;
            }
            const node = this.viewNodes[newIndex];
            if (node.isRemoved) continue;
            // only send update for moving or player nodes
            if (node.isMoving || node.cellType == 0 || node.cellType == 2 || this.gameServer.config.serverGamemode == 3 && node.cellType == 1) updNodes.push(node);
            newIndex++;
            oldIndex++;
        }
        for (; newIndex < this.viewNodes.length; newIndex++) {
            addNodes.push(this.viewNodes[newIndex]);
        }
        for (; oldIndex < this.clientNodes.length; oldIndex++) {
            const node = this.clientNodes[oldIndex];
            if (node.isRemoved) eatNodes.push(node);
            else delNodes.push(node);
        }
        this.clientNodes = this.viewNodes;

        // Send update packet
        packetHandler.sendPacket(new Packet.UpdateNodes(this, addNodes, updNodes, eatNodes, delNodes));

        // Update leaderboard
        if (++this.tickLeaderboard >= 4) {
            // 1 / 0.040 = 25 (once per second)
            this.tickLeaderboard = 0;
            this.checkMinions();
            if (this.gameServer.leaderboardType >= 0) packetHandler.sendPacket(new Packet.UpdateLeaderboard(this, this.gameServer.leaderboard, this.gameServer.leaderboardType));
        }

        if (++this.tickSecond >= 25) {
            if (this.cells.length && this.user_auth) this.gameServer.db.db('agarix-db').collection('users').updateOne({
                access_token: this.user.access_token
            }, {
                $inc: {
                    game_time: 1
                },
                $set: {
                    updateTime: Date.now()
                }
            });
        }
    }
    updateSpecView(len) {
        let scale = 0;

        if (!this.spectate || len) {
            // in game
            let cx = 0,
                cy = 0;
            for (let i = 0; i < len; i++) {
                cx += this.cells[i].position.x / len;
                cy += this.cells[i].position.y / len;
                this.centerPos = new Vec2(cx, cy);
            }
        } else {
            if (this.freeRoam || this.getSpecTarget() == null) {
                // free roam
                const mouseVec = this.mouse.clone().sub(this.centerPos);
                const mouseDist = mouseVec.sqDist();
                if (mouseDist != 0) this.setCenterPos(this.centerPos.add(mouseVec, 32 / mouseDist));
                scale = this.gameServer.config.serverSpectatorScale;
            } else {
                // spectate target
                const player = this.getSpecTarget();
                if (player) {
                    this.setCenterPos(player.centerPos);
                    scale = player.getScale(player);
                    this.place = player.place;
                    this.viewBox = player.viewBox;
                    this.viewNodes = player.viewNodes;
                }
            }
            // sends camera packet
            this.socket.packetHandler.sendPacket(new Packet.UpdatePosition(
                this, this.centerPos.x, this.centerPos.y, scale
            ));
        }
    }
    pressSpace() {
        if (this.spectate) {
            // Check for spam first (to prevent too many add/del updates)
            if (this.gameServer.tickCounter - this.lastKeypressTick < 40) return;
            this.lastKeypressTick = this.gameServer.tickCounter;

            // Space doesn't work for freeRoam mode
            if (this.freeRoam || this.gameServer.largestClient == null) return;
        } else if (this.gameServer.run) {
            // Disable mergeOverride on the last merging cell
            if (this.cells.length <= 2) this.mergeOverride = false;
            // Cant split if merging or frozen
            if (this.mergeOverride || this.frozen || this.portal) return;
            this.gameServer.splitCells(this);
        }
    }
    pressW() {
        if (this.spectate || !this.gameServer.run) return;
        this.gameServer.ejectMass(this);
    }
    pressH() {
        if (this.spectate || !this.gameServer.run) return;
        //this.gameServer.testMass(this);
        /*for (var i = 0; i < 100; i++) {
          this.gameServer.splitCells(this);
        }*/
        for (let i = 0; i < this.cells.length; i++) {
            const cell = this.cells[i];
            while (cell._size > this.gameServer.config.playerMinSize + 23) {
                // remove mass from parent cell
                const d = this.mouse.clone().sub(cell.position);
                const sq = d.sqDist();
                d.x = sq > 1 ? d.x / sq : 1;
                d.y = sq > 1 ? d.y / sq : 0;
                const angle = d.angle() + (Math.random() * .6) - .3;

                const loss = this.gameServer.config.ejectSizeLoss;
                const size = cell.radius - loss * loss;
                cell.setSize(Math.sqrt(size));
                // explode the cell
                const pos = {
                    x: cell.position.x + d.x * cell._size,
                    y: cell.position.y + d.y * cell._size
                };
                const ejected = new Entity.EjectedMass(this.gameServer, null, pos, this.gameServer.config.ejectSize);
                ejected.color = cell.color;
                ejected.setBoost(80, angle);
                this.gameServer.addNode(ejected);
            }
        }
    }
    pressQ() {
        if (this.spectate) {
            // Check for spam first (to prevent too many add/del updates)
            if (this.gameServer.tickCounter - this.lastKeypressTick < 40) return;

            this.lastKeypressTick = this.gameServer.tickCounter;
            if (!this.spectateTarget) this.freeRoam = !this.freeRoam;
            this.spectateTarget = null;
        }
    }
    getSpecTarget() {
        if (!this.spectateTarget || this.spectateTarget.isRemoved || !this.spectateTarget.cells.length) return this.gameServer.largestClient;

        return this.spectateTarget;
    }
    setCenterPos(p) {
        if (isNaN(p.x) || isNaN(p.y)) return;
        p.x = Math.max(p.x, this.gameServer.border.minx);
        p.y = Math.max(p.y, this.gameServer.border.miny);
        p.x = Math.min(p.x, this.gameServer.border.maxx);
        p.y = Math.min(p.y, this.gameServer.border.maxy);
        this.centerPos = p;
    }
}

module.exports = PlayerTracker;
