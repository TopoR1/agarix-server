// Library imports
const http = require('http');
const https = require('https');
const MongoClient = require('mongodb').MongoClient;
const QuadNode = require('./modules/QuadNode.js');
const fs = require('fs');

// Project imports
const Entity = require('./entity');
const Vec2 = require('./modules/Vec2');
const Logger = require('./modules/Logger');
const request = require('request');

class GameServer {
    constructor() {
        // Location of source files - For renaming or moving source files!
        this.srcFiles = '../src';

        // Startup
        this.run = true;
        this.version = '1.1.0';
        this.httpServer = null;
        this.lastNodeId = 1;
        this.lastPlayerId = 1;
        this.clients = [];
        this.playersMute = [];
        this.socketCount = 0;
        this.largestClient = null; // Required for spectators
        this.nodes = []; // Total nodes
        this.nodesVirus = []; // Virus nodes
        this.nodesFood = []; // Food nodes
        this.nodesCoin = []; // Food nodes
        this.nodesPortals = []; // Food nodes
        this.nodesEjected = []; // Ejected nodes
        this.nodesPlayer = []; // Player nodes

        this.movingNodes = []; // For move engine
        this.leaderboard = []; // For leaderboard
        this.leaderboardType = -1; // No type
        this.restart = {
            time: null
        };

        const BotLoader = require('./ai/BotLoader');
        this.bots = new BotLoader(this);

        // Main loop tick
        this.startTime = Date.now();
        this.stepDateTime = 0;
        this.timeStamp = 0;
        this.updateTime = 0;
        this.updateTimeAvg = 0;
        this.timerLoopBind = null;
        this.mainLoopBind = null;
        this.tickCounter = 0;
        this.disableSpawn = false;
        this.db = null;
        this.dbAuth = {
            host: 'main.agarix.ru',
            port: 53333,
            user: 'TopoR',
            password: 'Egoregor12',
            name: 'agarix-db'
        }
        this.validDB = false;

        // Config
        this.config = {};

        this.ipBanList = []; ///**
        //this.ipTokens = {};
        this.userList = [];
        this.badWords = [];
        this.skins = [];
    }

    request(options) {
        return new Promise((resolve, reject) => {
            request(options, (error, response, body) => {
                if (response) {
                    return resolve(response);
                }
                if (error) {
                    return reject(error);
                }
            });
        });
    }

    async start() {
        const reqIP = await this.request({
            url: "http://agarix.ru/getipaddress.php",
            method: "POST",
            json: true,
            body: {}
        });
        const ip = reqIP.body;

        if (ip.split('.').length < 4) {
            Logger.error('Error get IP!');
            return setTimeout(this.start(), 10000);
        }

        await this.dbConnect();

        const server = await this.db.db('agarix-db').collection('servers').findOne({
            ip: ip
        });

        if (!server) {
            Logger.error(`Server not found!`);
            process.exit(1);
        }

        this.config = server.config;
        this.badWords = server.badwords;

        // Set border, quad-tree
        if (fs.existsSync("../src/skins.txt")) {
            // Read and parse the Skins - filter out whitespace-only Skins
            this.skins = fs.readFileSync("../src/skins.txt", "utf8").split(/[\r\n]+/).filter(x => {
                return x != ''; // filter empty Skins
            });
        }
        
        this.setBorder(this.config.borderWidth, this.config.borderHeight);
        this.quadTree = new QuadNode(this.border);

        this.timerLoopBind = this.timerLoop.bind(this);
        this.mainLoopBind = this.mainLoop.bind(this);

        // Set up gamemode(s)
        const Gamemode = require('./gamemodes');

        this.gameMode = Gamemode.get(this.config.serverGamemode);
        this.gameMode.onServerInit(this);

        // Client Binding
        const bind = String(this.config.clientBind);

        this.clientBind = bind.split(' - ');

        // Start the server
        //Logger.info('Using HTTP');
        //this.httpServer = http.createServer();
        Logger.info('Using HTTPS, use the wss:// protocol prefix when connecting');
        this.httpServer = https.createServer({key: fs.readFileSync('../keys/key.pem', 'utf8'), cert: fs.readFileSync('../keys/cert.pem', 'utf8')});

        const wsOptions = {
            server: this.httpServer,
            perMessageDeflate: false,
            maxPayload: 4096
        };

        Logger.info(`WebSocket: ${this.config.serverWsModule}`);
        this.WebSocket = require(this.config.serverWsModule);
        this.wsServer = new this.WebSocket.Server(wsOptions);
        this.wsServer.on('error', this.onServerSocketError.bind(this));
        this.wsServer.on('connection', this.onClientSocketOpen.bind(this));
        this.httpServer.listen(
            this.config.serverPort,
            this.config.serverBind,
            this.onHttpServerOpen.bind(this)
        );

        // Start stats port (if needed)
        if (this.config.serverStatsPort > 0)
            this.startStatsServer(this.config.serverStatsPort);
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async dbConnect() {
        const client = await MongoClient.connect(`mongodb://${this.dbAuth.host}:${this.dbAuth.port}`, {
            useNewUrlParser: true,
            //auth: {
            //    username: this.dbAuth.user,
            //    password: this.dbAuth.password
            //},
            //authSource: this.dbAuth.name,
            //reconnectTries: Number.MAX_VALUE,
            //reconnectInterval: 1000,
            autoReconnect: false,
            //bufferMaxEntries: -1
        }).catch(err => {
            Logger.error('MongoDb: access error, data is incorrect or server is unavailable!');
        });

        if (client) {
            this.db = client;
            this.validDB = false;
            Logger.info('MongoDb: server is connected!');
        } else {
            Logger.error('MongoDb: server is not connected!');
            await this.dbConnect();
        }
    }

    checkDBConnect() {
        return !!this.db && !!this.db.topology && this.db.topology.isConnected();
    }

    onHttpServerOpen() {
        // Start Main Loop
        setTimeout(this.timerLoopBind, 1);

        // Done
        Logger.info(`Listening on port ${this.config.serverPort}`);
        Logger.info(`Current game mode is ${this.gameMode.name}`);

        // Player bots
        if (this.config.serverBots) {
            for (let i = 0; i < this.config.serverBots; i++)
                this.bots.addBot();
            Logger.info(`Added ${this.config.serverBots} player bots`);
        }
    }

    addNode(node) {
        // Add to quad-tree & node list
        let x = node.position.x;
        let y = node.position.y;
        const s = node._size;

        node.quadItem = {
            cell: node, // update viewbox for players
            bound: {
                minx: x - s,
                miny: y - s,
                maxx: x + s,
                maxy: y + s
            }
        };
        this.quadTree.insert(node.quadItem);
        this.nodes.push(node);

        // Special on-add actions
        node.onAdd(this);
    }

    onServerSocketError(error) {
        Logger.error(`WebSocket: ${error.code} - ${error.message}`);
        switch (error.code) {
            case 'EADDRINUSE':
                Logger.error(`Server could not bind to port ${this.config.serverPort}!`);
                Logger.error(
                    'Please close out of Skype or change  in gameserver.ini to a different number.'
                );
                break;
            case 'EACCES':
                Logger.error('Please make sure you are running MultiOgar-Edited with root privileges.');
                break;
        }
        process.exit(1); // Exits the program
    }

    onClientSocketOpen(ws) {
        /*if (this.ipTokens[ws._socket.remoteAddress] != ws.upgradeReq.url.substr(1)) {
            ws.close();
            return;
        };*/
        const logip = `${ws._socket.remoteAddress}:${ws._socket.remotePort}`;
        ws.on('error', (err) => {
            Logger.writeError(`[${logip}] ${err.stack}`);
        });
        if (this.config.serverMaxConnections && this.socketCount >= this.config.serverMaxConnections)
            return ws.close(1000, 'No slots');

        if (this.checkIpBan(ws._socket.remoteAddress))
            return ws.close(1000, 'IP banned');

        if (this.config.serverIpLimit) {
            let ipConnections = 0;

            for (const socket of this.clients) {
                if (!socket.isConnected || socket.remoteAddress != ws._socket.remoteAddress)
                    continue;
                ipConnections++;
            }

            if (ipConnections >= this.config.serverIpLimit)
                return ws.close(1000, 'IP limit reached');
        }
        let allowedClient = 0;
        for (const item of this.clientBind) {
            //if (req.headers.origin.indexOf(this.clientBind[cnt]) >= 0) {
            allowedClient = 1;
            break;
            //}
        }
        if (this.config.clientBind.length && !allowedClient)
            return ws.close(1000, 'Client not allowed');
        
        /*if (ws.upgradeReq.headers.origin != 'http://agarix.ru') {
            console.log(ws.upgradeReq.headers.origin);
            return ws.close(1002, '1b');
        }*/

        ws.isConnected = true;
        ws.remoteAddress = ws._socket.remoteAddress;
        ws.remotePort = ws._socket.remotePort;
        ws.lastAliveTime = Date.now();
        Logger.write(
            `CONNECTED ${ws.remoteAddress}:${ws.remotePort}, origin: "${ws.upgradeReq.headers.origin}"`
        );

        const PacketHandler = require('./PacketHandler');
        ws.packetHandler = new PacketHandler(this, ws);
        const PlayerTracker = require('./PlayerTracker');
        ws.playerTracker = new PlayerTracker(this, ws);
        const PlayerCommand = require('./modules/PlayerCommand');
        ws.playerCommand = new PlayerCommand(this, ws.playerTracker);
                    
        this.socketCount++;
        this.clients.push(ws);
        // Check for external minions
        this.checkMinion(ws);

        const self = this;
        ws.on('message', (message) => {
            if (self.config.serverWsModule === 'uws')
                // uws gives ArrayBuffer - convert it to Buffer
                message = parseInt(process.version[1]) < 6 ? new Buffer(message) : Buffer.from(message);

            if (!message.length) return;

            if (message.length > 712)
                return ws.close(1009, 'Spam');

            ws.packetHandler.handleMessage(message);
        });
        ws.on('error', (error) => {
            ws.packetHandler.sendPacket = (data) => {};
        });
        ws.on('close', (reason) => {
            if (ws._socket.destroy && typeof ws._socket.destroy == 'function') {
                ws._socket.destroy();
            }
            self.socketCount--;
            ws.isConnected = false;
            ws.packetHandler.sendPacket = (data) => {};
            ws.closeReason = {
                reason: ws._closeCode,
                message: ws._closeMessage
            };
            ws.closeTime = Date.now();
            let name = '';
            try {
                name = ws.playerTracker._name
            } catch (err) {};
            Logger.write(
                `DISCONNECTED ${ws.remoteAddress}:${ws.remotePort}, code: ${ws._closeCode}, reason: \''${ws._closeMessage}'\', name: \''${name}'\'`
            );
        });
    }

    checkMinion(ws) {
        // Check headers (maybe have a config for this?)
        if (!ws.upgradeReq.headers['user-agent'] || !ws.upgradeReq.headers['cache-control'] || ws.upgradeReq.headers['user-agent'].length < 50)
            ws.playerTracker.isMinion = true;
    }

    randomColor() {
        let RGB;
        switch (this.config.serverColorType) {
            default:
            case 0: // MultiOgar's original random color system
            {
                let h = 360 * Math.random(),
                    s = 248 / 255;
                RGB = {
                    r: 1,
                    g: 1,
                    b: 1
                };
                if (s > 0) {
                    h /= 60;
                    const i = ~~(h) >> 0, f = h - i, p = 1 * (1 - s), q = 1 * (1 - s * f), t = 1 * (1 - s * (1 - f));
                    switch (i) {
                        case 0:
                            RGB = {
                                r: 1,
                                g: t,
                                b: p
                            };
                            break;
                        case 1:
                            RGB = {
                                r: q,
                                g: 1,
                                b: p
                            };
                            break;
                        case 2:
                            RGB = {
                                r: p,
                                g: 1,
                                b: t
                            };
                            break;
                        case 3:
                            RGB = {
                                r: p,
                                g: q,
                                b: 1
                            };
                            break;
                        case 4:
                            RGB = {
                                r: t,
                                g: p,
                                b: 1
                            };
                            break;
                        default:
                            RGB = {
                                r: 1,
                                g: p,
                                b: q
                            };
                    }
                }
                RGB.r = Math.max(RGB.r, 0);
                RGB.g = Math.max(RGB.g, 0);
                RGB.b = Math.max(RGB.b, 0);
                RGB.r = Math.min(RGB.r, 1);
                RGB.g = Math.min(RGB.g, 1);
                RGB.b = Math.min(RGB.b, 1);
                return {
                    r: (RGB.r * 255) >> 0,
                    g: (RGB.g * 255) >> 0,
                    b: (RGB.b * 255) >> 0
                };
            }
            case 1: // Ogar-Unlimited's random color system
            {
                RGB = [255, 7, (Math.random() * 255) >> 0];
                RGB.sort(() => {
                    return .5 - Math.random();
                });
                return {
                    r: RGB[0],
                    b: RGB[1],
                    g: RGB[2]
                };
            }
            case 2: // Old Ogar's random color system
            {
                const oldColors = [{
                        r: 235,
                        g: 75,
                        b: 0
                    },
                    {
                        r: 225,
                        g: 125,
                        b: 255
                    },
                    {
                        r: 180,
                        g: 7,
                        b: 20
                    },
                    {
                        r: 80,
                        g: 170,
                        b: 240
                    },
                    {
                        r: 180,
                        g: 90,
                        b: 135
                    },
                    {
                        r: 195,
                        g: 240,
                        b: 0
                    },
                    {
                        r: 150,
                        g: 18,
                        b: 255
                    },
                    {
                        r: 80,
                        g: 245,
                        b: 0
                    },
                    {
                        r: 165,
                        g: 25,
                        b: 0
                    },
                    {
                        r: 80,
                        g: 145,
                        b: 0
                    },
                    {
                        r: 80,
                        g: 170,
                        b: 240
                    },
                    {
                        r: 55,
                        g: 92,
                        b: 255
                    },
                ];
                RGB = oldColors[Math.floor(Math.random() * oldColors.length)];
                return {
                    r: RGB.r,
                    g: RGB.g,
                    b: RGB.b
                };
            }
            case 3: // Truely randomized color system
            {
                return {
                    r: Math.floor(255 * Math.random()),
                    g: Math.floor(255 * Math.random()),
                    b: Math.floor(255 * Math.random())
                };
            }
        }
    }

    checkIpBan(ipAddress) {
        if (!this.ipBanList || !this.ipBanList.length || ipAddress == "127.0.0.1") return false;

        if (this.ipBanList.indexOf(ipAddress) >= 0) return true;

        const ipBin = ipAddress.split('.');

        if (ipBin.length != 4) return false;

        if (this.ipBanList.indexOf(`${ipBin[0]}.${ipBin[1]}.*.*`) >= 0) return true;

        if (this.ipBanList.indexOf(`${ipBin[0]}.${ipBin[1]}.${ipBin[2]}.*`) >= 0) return true;

        return false;
    }

    setBorder(width, height) {
        const hw = width / 2;
        const hh = height / 2;
        this.border = {
            minx: -hw,
            miny: -hh,
            maxx: hw,
            maxy: hh,
            width: width,
            height: height
        };
    }

    getRandomColor() {
        // get random
        const colorRGB = [0xFF, 0x07, (Math.random() * 256) >> 0];
        colorRGB.sort(() => {
            return 0.5 - Math.random();
        });
        // return random
        return {
            r: colorRGB[0],
            b: colorRGB[1],
            g: colorRGB[2]
        };
    }

    removeNode(node) {
        try {
            // Remove from quad-tree
            node.isRemoved = true;
            this.quadTree.remove(node.quadItem);
            node.quadItem = null;
        } catch (err) {}

        // Remove from node lists
        let i = this.nodes.indexOf(node);
        if (i > -1) this.nodes.splice(i, 1);
        i = this.movingNodes.indexOf(node);
        if (i > -1) this.movingNodes.splice(i, 1);

        // Special on-remove actions
        node.onRemove(this);
    }

    updateClients() {
        // check dead clients
        /*const len = this.clients.length;
        for (let i = 0; i < len;) {
            if (!this.clients[i] || !this.clients[i].playerTracker) {
                i++;
                continue;
            }
            this.clients[i].playerTracker.checkConnection();
            if (this.clients[i].playerTracker.isRemoved)
                // remove dead client
                this.clients.splice(i, 1);
            else i++;
        }
        // update
        for (let i = 0; i < len; i++) {
            if (!this.clients[i] || !this.clients[i].playerTracker) continue;
            this.clients[i].playerTracker.updateTick();
        }
        for (let i = 0; i < len; i++) {
            if (!this.clients[i] || !this.clients[i].playerTracker) continue;
            this.clients[i].playerTracker.sendUpdate();
        }*/
        
        for (const i in this.clients) {
            if (!this.clients[i] || !this.clients[i].playerTracker) continue;
            
            this.clients[i].playerTracker.checkConnection();
            if (this.clients[i].playerTracker.isRemoved) {
                // remove dead client
                this.clients.splice(i, 1);
                continue;
            }
            
            this.clients[i].playerTracker.updateTick();
            this.clients[i].playerTracker.sendUpdate();
        }
    }

    updateLeaderboard() {
        // Update leaderboard with the gamemode's method
        this.leaderboard = [];
        this.leaderboardType = -1;
        this.gameMode.updateLB(this, this.leaderboard);

        if (!this.gameMode.specByLeaderboard) {
            // Get client with largest score if gamemode doesn't have a leaderboard
            const clients = this.clients.valueOf();

            // Use sort function
            clients.sort((a, b) => {
                return b.playerTracker._score - a.playerTracker._score;
            });
            this.largestClient = null;
            if (clients[0]) this.largestClient = clients[0].playerTracker;
        } else {
            this.largestClient = this.gameMode.rankOne;
        }
    }

    onChatMessage(from, to, message) {
        if (!message || !this.config.serverChat || (from && from.isMuted)) return;
        
        message = message.trim();
        if (!message) return;
        
        if (from && message.length && message[0] == '/')
            return from.socket.playerCommand.executeCommandLine(message.slice(1, message.length)); // player command
        
        if (message.length > 64) message = message.slice(0, 64);
            
        if (this.config.serverChatAscii && from) {
            for (let i = 0; i < message.length; i++) {
                if ((message.charCodeAt(i) < 0x20 || message.charCodeAt(i) > 0x7F))
                    return this.sendChatMessage(null, from, "Message failed - You can use ASCII text only!");
            }
        }
        
        message = this.checkBadSymbols(message);
        //check bad words send in chat
        if (this.config.badWordFilter === 1) message = this.checkBadWord(message);
        
        if (!message) return;
        
        this.sendChatMessage(from, to, message);
    }

    setCharAt(str, index, chr) {
        if(index > str.length - 1) return str;
        
        return str.substring(0, index) + chr + str.substring(index + 1);
    }

    checkBadSymbols(text) {
        for (let i = 0; i < text.length; i++) {
            if ((text.charCodeAt(i) >= 0x600 && text.charCodeAt(i) <= 0x6FF) || (text.charCodeAt(i) >= 0x750 && text.charCodeAt(i) <= 0x77F) || (text.charCodeAt(i) >= 0x8A0 && text.charCodeAt(i) <= 0x8FF) || (text.charCodeAt(i) >= 0xFB50 && text.charCodeAt(i) <= 0xFDFF) || (text.charCodeAt(i) >= 0xFE70 && text.charCodeAt(i) <= 0xFEFF) || (text.charCodeAt(i) >= 0x10E60 && text.charCodeAt(i) <= 0x10E7F) || (text.charCodeAt(i) >= 0x1EE00 && text.charCodeAt(i) <= 0x1EEFF)) {
                text = this.setCharAt(text, i, ' ');
            }
        }
        
        return text.replace(/\s+/g, ' ').trim();
    }

    checkBadWord(value) {
        if (!value) return value;

        const value_check = value.toLowerCase().replace(/\s/g, '').replace(/[^a-zA-ZА-Яа-яЁё]/gi, '').replace(/\s+/gi, ', ');

        for (const word in this.badWords) {
            if (value_check.search(word) != -1) value.replace(word, '*'.repeat(word.length));
        }

        return value;
    }

    sendChatMessage(from, to, message) {
        const Packet = require('./packet');
        
        for (const client of this.clients) {
            if (!client) continue;
            const player = to?.pID == client.playerTracker.pID;
            if (!to || player) {
                client.packetHandler.sendPacket(new Packet.ChatMessage(from, message));
                if (player) return;
            }
        }
    }

    timerLoop() {
        const timeStep = 40; // vanilla: 40
        const ts = Date.now();
        const dt = ts - this.timeStamp;
        if (dt < timeStep - 5) {
            setTimeout(this.timerLoopBind, timeStep - 5);
            return;
        }
        if (dt > 120) this.timeStamp = ts - timeStep;
        // update average, calculate next
        this.updateTimeAvg += 0.5 * (this.updateTime - this.updateTimeAvg);
        this.timeStamp += timeStep;
        setTimeout(this.mainLoopBind, 0);
        setTimeout(this.timerLoopBind, 0);
    }

    mainLoop() {
        this.stepDateTime = Date.now();
        const tStart = process.hrtime();
        const self = this;

        const date = new Date;
        const dateFormatted = `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;

        //Restart times
        const restarts = String(this.config.serverRestartTimes);
        this.serverRestartTimes = restarts.split(' - ');

        // Restart
        //if (this.config.serverRestart && this.tickCounter > 30) {
        this.serverRestartTimes.forEach((time) => {
            if (dateFormatted == time) {
                this.sendChatMessage(null, "", "AutoRestart in 1 minute!");
                setTimeout(() => {
                    process.exit(1);
                }, 60 * 1000);
            }
        });

        //};

        // Check DB connection
        if (!this.checkDBConnect() && !this.validDB) {
            Logger.error('Database connection lost!');
            this.validDB = true;
            this.dbConnect();
        }

        // Loop main functions
        if (this.run) {
            // Move moving nodes first
            this.movingNodes.forEach((cell) => {
                if (cell.isRemoved) return;
                // Scan and check for ejected mass / virus collisions
                this.boostCell(cell);
                this.quadTree.find(cell.quadItem.bound, check => {
                    const m = self.checkCellCollision(cell, check);
                    if (cell.cellType == 3 && check.cellType == 3 && !self.config.mobilePhysics)
                        self.resolveRigidCollision(m);
                    else
                        self.resolveCollision(m);
                });
                if (!cell.isMoving)
                    this.movingNodes = null;
            });
            // Update players and scan for collisions
            const eatCollisions = [];
            this.nodesPlayer.forEach((cell) => {
                if (cell.isRemoved) return;
                // Scan for eat/rigid collisions and resolve them
                this.quadTree.find(cell.quadItem.bound, check => {
                    const m = self.checkCellCollision(cell, check);
                    if (self.checkRigidCollision(m))
                        self.resolveRigidCollision(m);
                    else if (check != cell)
                        eatCollisions.unshift(m);
                });
                this.movePlayer(cell, cell.owner);
                this.boostCell(cell);
                this.autoSplit(cell, cell.owner);
                // Decay player cells once per second
                if (((this.tickCounter + 3) % 25) === 0)
                    this.updateSizeDecay(cell);
                // Remove external minions if necessary
                if (cell.owner.isMinion) {
                    cell.owner.socket.close(1000, "Minion");
                    this.removeNode(cell);
                }
            });
            eatCollisions.forEach((m) => {
                this.resolveCollision(m);
            });
            if ((this.tickCounter % this.config.spawnInterval) === 0) {
                // Spawn food & viruses
                this.spawnCells();
            }
            if ((this.tickCounter % this.config.coinSpawnInterval) === 0) {
                // Spawn coins
                this.spawnCoins();
            }
            if ((this.tickCounter % this.config.portalSpawnInterval) === 0) {
                // Spawn coins
                this.spawnPortals();
            }
            this.gameMode.onTick(this);
            this.tickCounter++;
        }
        if (!this.run && this.gameMode.IsTournament)
            this.tickCounter++;
        this.updateClients();

        if (this.tickCounter % 4 == 0) {
            // once per second
            this.updateLeaderboard();
        }
        //if (((this.tickCounter + 3) % 20) === 0) {
        //    this.SendMiniMap();
        //}

        // update-update time
        const tEnd = process.hrtime(tStart);
        this.updateTime = tEnd[0] * 1e3 + tEnd[1] / 1e6;
    }

    movePlayer(cell, client) {
        if (client.socket.isConnected == false || client.frozen || !client.mouse || client.portal)
            return; // Do not move

        // get movement from vector
        const d = client.mouse.clone().sub(cell.position);
        const move = cell.getSpeed(d.sqDist()); // movement speed
        if (!move) return; // avoid jittering
        cell.position.add(d, move);

        // update remerge
        const time = this.config.playerRecombineTime, base = Math.max(time, cell._size * 0.2) * 25;
        // instant merging conditions
        if (!time || client.rec || client.mergeOverride) {
            cell._canRemerge = cell.boostDistance < 100;
            if (client.cells.length > 1 && client.mergeOverride) {
                for (const j in client.cells) {
                    client.cells[j].position.x = client.centerPos.x;
                    client.cells[j].position.y = client.centerPos.y;
                }
            }
            return; // instant merge
        }
        // regular remerge time
        cell._canRemerge = cell.getAge() >= base;
    }

    updateSizeDecay(cell) {
        let rate = this.config.playerDecayRate, cap = this.config.playerDecayCap;

        if (!rate || cell._size <= this.config.playerMinSize)
            return;

        // remove size from cell at decay rate
        if (cap && cell._mass > cap) rate *= 10;
        const decay = 1 - rate * this.gameMode.decayMod;
        cell.setSize(Math.sqrt(cell.radius * decay));
    }

    boostCell(cell) {
        if (cell.isMoving && !cell.boostDistance || cell.isRemoved) {
            cell.boostDistance = 0;
            cell.isMoving = false;
            return;
        }
        // decay boost-speed from distance
        const speed = cell.boostDistance / 9; // val: 87
        cell.boostDistance -= speed; // decays from speed
        cell.position.add(cell.boostDirection, speed)

        // update boundries
        cell.checkBorder(this.border);
        this.updateNodeQuad(cell);
    }

    autoSplit(cell, client) {
        //if (client.frozen) return;
        // get size limit based off of rec mode
        let maxSize = this.config.playerMaxSize;

        if (client.rec) maxSize = 1e9; // increase limit for rec (1 bil)

        // check size limit
        if (cell._size < maxSize) return; //client.mergeOverride ||
        if ((client.cells.length >= this.config.playerMaxCells || this.config.mobilePhysics) || !this.config.playerAutoSplit) {
            // cannot split => just limit
            cell.setSize(maxSize);
        } else {
            // split in random direction
            let angle = Math.random() * 2 * Math.PI; //Math.atan2(client.mouse.x - cell.position.x, client.mouse.y - cell.position.y);
            this.splitPlayerCell(client, cell, angle, cell._mass * .5);
        }
    }

    updateNodeQuad(node) {
        // update quad tree
        const item = node.quadItem.bound;
        item.minx = node.position.x - node._size;
        item.miny = node.position.y - node._size;
        item.maxx = node.position.x + node._size;
        item.maxy = node.position.y + node._size;
        this.quadTree.remove(node.quadItem);
        this.quadTree.insert(node.quadItem);
    }

    checkCellCollision(cell, check) {
        const p = check.position.clone().sub(cell.position);

        // create collision manifold
        return {
            cell: cell,
            check: check,
            d: p.sqDist(), // distance from cell to check
            p: p // check - cell position
        };
    }

    checkRigidCollision(m) {
        if (!m.cell.owner || !m.check.owner)
            return false;

        if (m.cell.owner != m.check.owner) {
            // Minions don't collide with their team when the config value is 0
            if (this.gameMode.haveTeams && m.check.owner.isMi || m.cell.owner.isMi && this.config.minionCollideTeam === 0) {
                return false;
            } else {
                // Different owners => same team
                return this.gameMode.haveTeams &&
                    m.cell.owner.team == m.check.owner.team;
            }
        }
        const r = this.config.mobilePhysics ? 1 : 13;
        if (m.cell.getAge() < r || m.check.getAge() < r) {
            return false; // just splited => ignore
        }
        return !m.cell._canRemerge || !m.check._canRemerge;
    }

    resolveRigidCollision(m) {
        const push = (m.cell._size + m.check._size - m.d) / m.d;
        if (push <= 0 || m.d == 0) return; // do not extrude
        if (m.cell.owner) {
            if (m.cell.owner.frozen) return;
        }

        // body impulse
        const rt = m.cell.radius + m.check.radius;
        const r1 = push * m.cell.radius / rt;
        const r2 = push * m.check.radius / rt;

        // apply extrusion force
        m.cell.position.sub2(m.p, r2);
        m.check.position.add(m.p, r1);
    }

    resolveCollision(m) {
        let cell = m.cell;
        let check = m.check;
        const same = false;

        /*if (cell.owner && check.owner) {
            if (cell.owner.pID == cell.owner.pID) same = true;
        }*/
        if (check.cantEat(cell)) return; //check.name == 'coin' && 

        if (cell._size > check._size) {
            cell = m.check;
            check = m.cell;
        }
        // Do not resolve removed
        if (cell.isRemoved || check.isRemoved)
            return;

        // check eating distance

        check.div = this.config.mobilePhysics ? 20 : 3;
        if (m.d >= check._size - cell._size / check.div)
            return; // too far => can't eat
        // gravitational pushsplits
        if (this.config.gravitationalPushsplits && check.canEat(cell) && cell.getAge() < 1 && check.cellType === 0) return;
        //if (this.config.gravitationalPushsplits && (check.canEat(cell) && !same) && cell.getAge() < 1 && check.cellType === 0) return;

        // collision owned => ignore, resolve, or remerge
        if (check.owner && check.owner.portal) return;
        if (cell.owner && cell.owner == check.owner) {
            if (cell.getAge() < 13 || check.getAge() < 13)
                return; // just split => ignore
        } else {
            if (check._size < cell._size * 1.07 && cell.checkSize)
                return; // size check
            if (!check.canEat(cell))
                return; // cell refuses to be eaten
        }

        // Consume effect
        if (cell.cellOtherType == 6) {
            cell.onEat(check);
            cell.onEaten(check);
            return;
        } else check.onEat(cell);

        cell.onEaten(check);

        cell.killedBy = check;

        // Remove cell
        this.removeNode(cell);
        /* double life
        if (cell.cellOtherType == 0 && !cell.owner.isMi && !cell.owner.isBot && cell.owner.cells.length == 0 && check.owner.isMi) {
            if (check.owner.owner.pID == cell.owner.pID) {
                cell.owner.color = check.owner.color;
                
                for (const item of check.owner.cells) {
                    const cellCopy = new Entity.PlayerCell(this, cell.owner, item.position, item._size);
                    
                    this.addNode(cellCopy);
                }

                
                try {while (check.owner.cells) this.removeNode(check.owner.cells[0]);} catch(e) {}
            }
        }*/
    }

    splitPlayerCell(client, parent, angle, mass) {
        const size = Math.sqrt(mass * 100);
        const size1 = Math.sqrt(parent.radius - size * size);

        // Too small to split or the client has reached the maximum amount of cells
        if (!size1 || size1 < this.config.playerMinSize || client.cells.length >= this.config.playerMaxCells)
            return;

        // Remove size from parent cell
        parent.setSize(size1);

        // Create cell and add it to node list
        const newCell = new Entity.PlayerCell(this, client, parent.position, size);
        newCell.setBoost(this.config.splitVelocity * Math.pow(size, 0.0122), angle, parent);
        this.addNode(newCell);
    }

    randomPos() {
        return new Vec2(
            this.border.minx + this.border.width * Math.random(),
            this.border.miny + this.border.height * Math.random()
        );
    }

    spawnCells() {
        // spawn food at random size
        const maxCount = this.config.foodMinAmount - this.nodesFood.length;
        const spawnCount = Math.min(maxCount, this.config.foodSpawnAmount);
        for (let i = 0; i < spawnCount; i++) {
            const cell = new Entity.Food(this, null, this.randomPos(), this.config.foodMinSize);
            if (this.config.foodMassGrow) {
                const maxGrow = this.config.foodMaxSize - cell._size;
                cell.setSize(cell._size += maxGrow * Math.random());
            }
            cell.color = this.getRandomColor();
            this.addNode(cell);
        }

        // spawn viruses (safely)
        if (this.nodesVirus.length < this.config.virusMinAmount) {
            const virus = new Entity.Virus(this, null, this.randomPos(), this.config.virusMinSize);
            if (!this.willCollide(virus)) this.addNode(virus);
        }
    }

    spawnCoins() {
        const maxCount = this.config.coinSpawnAmount - this.nodesCoin.length;
        const spawnCount = Math.min(maxCount, this.config.coinSpawnAmount);
        for (let i = 0; i < spawnCount; i++) {
            const cell = new Entity.Coin(this, null, this.randomPos(), this.config.coinSpawnMass);
            //cell.color = this.getRandomColor();
            this.addNode(cell);
        }
    }

    spawnPortals() {
        const maxCount = this.config.portalSpawnAmount - this.nodesPortals.length;
        const spawnCount = Math.min(maxCount, this.config.portalSpawnAmount);
        for (let i = 0; i < spawnCount; i++) {
            const cell = new Entity.Portal(this, null, this.randomPos(), 130);
            //cell.color = this.getRandomColor();
            this.addNode(cell);
        }
    }

    spawnPlayer(player, pos) {
        if (this.disableSpawn) return; // Not allowed to spawn!

        // Check for special starting size
        let size = this.config.playerStartSize;
        let boost_mass = false;
        if (player.spawnmass) size = player.spawnmass;

        if (player.user_auth) {
            for (const item of player.user.boost) {
                if (item.boost == "mass" && item.activate) {
                    size = size * size / 100;
                    size *= item.x;
                    size = Math.sqrt(size * 100);
                    boost_mass = true;
                    break;
                }
            }
            if (!boost_mass && player.user.vip.time >= Math.floor(Date.now() / 1000)) {
                size = size * size / 100;
                size *= 2;
                size = Math.sqrt(size * 100);
            }
        }
        // Check if can spawn from ejected mass
        const index = ~~(this.nodesEjected.length * Math.random());
        const eject = this.nodesEjected[index]; // Randomly selected
        if (Math.random() <= this.config.ejectSpawnPercent &&
            eject && eject.boostDistance < 1) {
            // Spawn from ejected mass
            pos = eject.position.clone();
            player.color = eject.color;
            size = Math.max(size, eject._size * 1.15)
        }
        // Spawn player safely (do not check minions)
        const cell = new Entity.PlayerCell(this, player, pos, size);
        if (this.willCollide(cell) && !player.isMi)
            pos = this.randomPos(); // Not safe => retry
        this.addNode(cell);

        // Set initial mouse coords
        player.mouse = new Vec2(pos.x, pos.y);
    }

    willCollide(cell) {
        let notSafe = false; // Safe by default
        const sqSize = cell.radius;
        const pos = this.randomPos();
        const d = cell.position.clone().sub(pos);
        if (d.dist() + sqSize <= sqSize * 2) {
            notSafe = true;
        }
        this.quadTree.find({
            minx: cell.position.x - cell._size,
            miny: cell.position.y - cell._size,
            maxx: cell.position.x + cell._size,
            maxy: cell.position.y + cell._size
        }, n => {
            if (n.cellType == 0) notSafe = true;
        });
        return notSafe;
    }

    splitCells(client) {
        // Split cell order decided by cell age
        const cellToSplit = [];
        for (let i = 0; i < client.cells.length; i++)
            cellToSplit.push(client.cells[i]);

        // Split split-able cells
        cellToSplit.forEach((cell) => {
            const d = client.mouse.clone().sub(cell.position);
            if (d.dist() < 1) {
                d.x = 1, d.y = 0;
            }

            if (cell._size < this.config.playerMinSplitSize)
                return; // cannot split

            // Get maximum cells for rec mode
            let max = this.config.playerMaxCells;
            if (client.rec) max = 200; // rec limit
            if (client.cells.length >= max) return;

            // Now split player cells
            this.splitPlayerCell(client, cell, d.angle(), cell._mass * .5);
        });
    }

    canEjectMass(client) {
        if (client.lastEject === null) {
            // first eject
            client.lastEject = this.tickCounter;
            return true;
        }
        const dt = this.tickCounter - client.lastEject;
        if (dt < this.config.ejectCooldown) {
            // reject (cooldown)
            return false;
        }
        client.lastEject = this.tickCounter;
        return true;
    }

    ejectMass(client) {
        if (!this.canEjectMass(client) || client.mouse == null || client.portal) // || client.frozen
            return;
        for (let i = 0; i < client.cells.length; i++) {
            const cell = client.cells[i];

            if (cell._size < this.config.playerMinEjectSize)
                continue; // Too small to eject

            const d = client.mouse.clone().sub(cell.position);
            const sq = d.sqDist();
            d.x = sq > 1 ? d.x / sq : 1;
            d.y = sq > 1 ? d.y / sq : 0;

            // Remove mass from parent cell first
            let loss = this.config.ejectSizeLoss;
            loss = cell.radius - loss * loss;
            cell.setSize(Math.sqrt(loss));

            // Get starting position
            const pos = new Vec2(
                cell.position.x + d.x * cell._size,
                cell.position.y + d.y * cell._size
            );
            const angle = d.angle() + (Math.random() * .6) - .3;

            // Create cell and add it to node list
            let ejected = null;

            if (!this.config.ejectVirus) {
                ejected = new Entity.EjectedMass(this, null, pos, this.config.ejectSize);
            } else {
                ejected = new Entity.Virus(this, null, pos, this.config.ejectSize);
            }
            ejected.color = cell.color;
            ejected.setBoost(this.config.ejectVelocity, angle);
            this.addNode(ejected);
        }
    }

    shootVirus(parent, angle) {
        // Create virus and add it to node list
        const pos = parent.position.clone();
        const newVirus = new Entity.Virus(this, null, pos, this.config.virusMinSize);
        newVirus.setBoost(this.config.virusVelocity, angle);
        this.addNode(newVirus);
    }

    SendMiniMap() {
        const Packet = require('./packet');

        let cells = this.nodesPlayer.map(player => {
            if (!player.owner.isMi) return player.owner.cells;
        });
        cells = cells.concat.apply([], cells);

        for (const client of this.clients) {
            if (!client) continue;

            client.packetHandler.sendPacket(new Packet.MiniMap(cells));
        }
    }

    startStatsServer(port) {
        // Create stats
        this.getStats();

        // Show stats
        this.httpServer = http.createServer(function(req, res) {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.writeHead(200);
            res.end(this.stats);
        }.bind(this)); //{key: fs.readFileSync('../keys/key.pem', 'utf8'), cert: fs.readFileSync('../keys/cert.pem', 'utf8')}
        this.httpServer.on('error', err => {
            Logger.error(`Stats Server: ${err.message}`);
        });

        const getStatsBind = this.getStats.bind(this);
        this.httpServer.listen(port, function() {
            // Stats server
            Logger.info(`Started stats server on port ${port}`);
            setInterval(getStatsBind, this.config.serverStatsUpdate * 1000);
        }.bind(this));
    }

    getStats() {
        // Get server statistics
        let totalPlayers = 0;
        let alivePlayers = 0;
        let spectatePlayers = 0;
        for (let i = 0, len = this.clients.length; i < len; i++) {
            const socket = this.clients[i];
            if (!socket || !socket.isConnected || socket.playerTracker.isMi)
                continue;
            totalPlayers++;
            if (socket.playerTracker.cells.length) alivePlayers++;
            else spectatePlayers++;
        }
        const s = {
            'server_name': this.config.serverName,
            'server_chat': this.config.serverChat ? "true" : "false",
            'border_width': this.border.width,
            'border_height': this.border.height,
            'gamemode': this.gameMode.name,
            'max_players': this.config.serverMaxConnections,
            'current_players': totalPlayers,
            'alive': alivePlayers,
            'spectators': spectatePlayers,
            'update_time': this.updateTimeAvg.toFixed(3),
            'uptime': Math.round((this.stepDateTime - this.startTime) / 1000 / 60),
            'start_time': this.startTime
        };
        this.stats = JSON.stringify(s);
    }
    getDate(seconds, days = true) {
        let h = seconds / 3600 ^ 0;
        let m = (seconds - h * 3600) / 60 ^ 0;
        let s = seconds - h * 3600 - m * 60;
        let d = 0;

        if (days) {
            d = parseInt(h / 24);
            h -= d * 24;
        }

        let time = '';
        if (d != 0 && days) time += d + 'd ';
        if (h != 0) time += h + 'h ';
        if (m != 0) time += m + 'm ';
        else if (h != 0) time += m + 'm ';
        if (s != 0) time += s + 's';
        else if (h != 0 || m != 0) time += s + 's';

        return time;
    }
}

module.exports = GameServer;
