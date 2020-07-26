// Library imports
const http = require('http');
const MongoClient = require('mongodb').MongoClient;

// Project imports
const Entity = require('./entity');
const Vec2 = require('./modules/Vec2');
const Logger = require('./modules/Logger');

// GameServer implementation
function GameServer() {
    // Location of source files - For renaming or moving source files!
    this.srcFiles = '../src';

    // Startup
    this.run = true;
    this.version = '1.1.0';
    this.httpServer = null;
    this.lastNodeId = 1;
    this.lastPlayerId = 1;
    this.clients = [];
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

    var BotLoader = require('./ai/BotLoader');
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

    // Config
    this.config = {
        /** LOGGING **/
        logVerbosity: 4, // Console log level (0=NONE; 1=FATAL; 2=ERROR; 3=WARN; 4=INFO; 5=DEBUG)
        logFileVerbosity: 5, // File log level

        /** SERVER **/
        serverTimeout: 300, // Seconds to keep connection alive for non-responding client
        serverWsModule: 'ws', // WebSocket module: 'ws' or 'uws' (install npm package before using uws)
        serverMaxConnections: 500, // Maximum number of connections to the server. (0 for no limit)
        serverPort: 443, // Server port which will be used to listen for incoming connections
        serverBind: '0.0.0.0', // Server network interface which will be used to listen for incoming connections (0.0.0.0 for all IPv4 interfaces)
        serverTracker: 0, // Set to 1 if you want to show your server on the tracker http://ogar.mivabe.nl/master (check that your server port is opened for external connections first!)
        serverGamemode: 0, // Gamemodes: 0 = FFA, 1 = Teams, 2 = Experimental, 3 = Rainbow
        serverBots: 0, // Number of player bots to spawn (Experimental)
        serverViewBaseX: 1920, // Base view distance of players. Warning: high values may cause lag! Min value is 1920x1080
        serverViewBaseY: 1080, // min value is 1920x1080
        serverMinScale: 0.15, // Minimum viewbox scale for player (low value leads to lags due to large visible area for big cell)
        serverSpectatorScale: 0.4, // Scale (field of view) used for free roam spectators (low value leads to lags, vanilla = 0.4, old vanilla = 0.25)
        serverStatsPort: 88, // Port for stats server. Having a negative number will disable the stats server.
        serverStatsUpdate: 60, // Update interval of server stats in seconds
        mobilePhysics: 0, // Whether or not the server uses mobile agar.io physics
        badWordFilter: 1, // Toggle whether you want the bad word filter on (0 to disable, 1 to enable)
        serverRestart: 0, // Toggle whether you want your server to auto restart in minutes. (0 to disable)
        serverRestartTimes: '00:00:00 - 06:00:00 - 12:00:00 - 18:00:00', //Restart the server at a certain time of the day (eg: 00:00:00 - 06:00:00 - 12:00:00 - 18:00:00) [Use ' - ' to seperate more restarts by time]

        /** DB-MONGODB **/
        db_name: 'agarix_db',
        db_host: 'localhost',
        db_port: 27017,
        db_username: 'user',
        db_pass: 'pass',

        /** AUTO-RESTART WITH MASS **/
        massRestart: 100000,
        maxMassRestart: 200000,
        timeRestart: 30,


        /** CLIENT **/
        serverMaxLB: 10, // Controls the maximum players displayed on the leaderboard.
        serverChat: 1, // Allows the usage of server chat. 0 = no chat, 1 = use chat.
        serverChatAscii: 1, // Set to 1 to disable non-ANSI letters in the chat (english only)
        separateChatForTeams: 0, // Set to 1 to separate chat for game modes with teams like 'Teams'
        serverName: 'MultiOgar-Edited #1', // Server name
        serverWelcome1: 'Welcome to MultiOgar-Edited!', // First server welcome message
        serverWelcome2: '', // Second server welcome message (optional, for info, etc)
        clientBind: '', // Only allow connections to the server from specified client (eg: http://agar.io - http://mywebsite.com - http://more.com) [Use ' - ' to seperate different websites]
        minProtocol: 1,
        maxProtocol: 15,

        /** ANTI-BOT **/
        serverIpLimit: 4, // Controls the maximum number of connections from the same IP (0 for no limit)
        serverScrambleLevel: 1, // Toggles scrambling of coordinates. 0 = No scrambling, 1 = lightweight scrambling. 2 = full scrambling (also known as scramble minimap); 3 - high scrambling (no border)
        playerBotGrow: 0, // Cells greater than 625 mass cannot grow from cells under 17 mass (set to 1 to disable)

        /** BORDER **/
        borderWidth: 14142.135623730952, // Map border size (Vanilla value: 14142)
        borderHeight: 14142.135623730952, // Map border size (Vanilla value: 14142)

        /** FOOD **/
        foodMinSize: 10, // Minimum food size (vanilla 10)
        foodMaxSize: 20, // Maximum food size (vanilla 20)
        foodMinAmount: 1000, // Minimum food cells on the map
        foodMaxAmount: 2000, // Maximum food cells on the map
        foodSpawnAmount: 30, // The number of food to spawn per interval
        foodMassGrow: 1, // Enable food mass grow ?
        spawnInterval: 20, // The interval between each food cell spawn in ticks (1 tick = 40 ms)
		
        /** COIN **/
        coinSpawnAmount: 20, // The number of food to spawn per interval
        coinMassGrow: 0, // Enable food mass grow ?
        coinSpawnInterval: 3000, // The interval between each food cell spawn in ticks (1 tick = 40 ms)
        coinApp: 10,
        coinExp: 5,

        /** PORTAL **/
        portalSpawnAmount: 30, // The number of food to spawn per interval
        portalMassGrow: 1, // Enable food mass grow ?
        portalSpawnInterval: 20, // The interval between each food cell spawn in ticks (1 tick = 40 ms)

        /** VIRUSES **/
        virusMinSize: 100, // Minimum virus size. (vanilla: mass = val*val/100 = 100 mass)
        virusMaxSize: 141.421356237, // Maximum virus size (vanilla: mass = val*val/100 = 200 mass)
        virusMaxPoppedSize: 60, // Maximum size a popped cell can have
        virusEqualPopSize: 0, // Whether popped cells have equal size or not (1 to enable)
        virusMinAmount: 50, // Minimum number of viruses on the map.
        virusMaxAmount: 100, // Maximum number of viruses on the map. If this number is reached, then ejected cells will pass through viruses.
        motherCellMaxMass: 0, // Maximum amount of mass a mothercell is allowed to have (0 for no limit)
        virusVelocity: 780, // Velocity of moving viruses (speed and distance)
        virusMaxCells: 16, // Maximum cells a player can have from viruses.

        /** EJECTED MASS **/
        ejectSize: 36.06, // vanilla: mass = val*val/100 = 13 mass?
        ejectSizeLoss: 42.43, // Eject size which will be substracted from player cell (vanilla: mass = val*val/100 = 18 mass?)
        ejectCooldown: 3, // Tick count until a player can eject mass again in ticks (1 tick = 40 ms)
        ejectSpawnPercent: 0.5, // Chance for a player to spawn from ejected mass. 0.5 = 50% (set to 0 to disable)
        ejectVirus: 0, // Whether or not players can eject viruses instead of mass
        ejectVelocity: 780, // Velocity of ejecting cells (speed and distance)

        /** PLAYERS **/
        playerMinSize: 31.6227766017, // Minimum size a player cell can decay too. (vanilla: val*val/100 = 10 mass)
        playerMaxSize: 1500, // Maximum size a player cell can achive before auto-splitting. (vanilla: mass = val*val/100 = 22500 mass)
        playerMinSplitSize: 59.16079783, // Mimimum size a player cell has to be to split. (vanilla: mass = val*val/100 = 35 mass)
        playerMinEjectSize: 59.16079783, // Minimum size a player cell has to be to eject mass. (vanilla: mass = val*val/100 = 35 mass)
        playerAutoSplit: 1, 
		playerStartSize: 31.6227766017, // Start size of the player cell. (vanilla: mass = val*val/100 = 10 mass)
        playerMaxCells: 16, // Maximum cells a player is allowed to have.
        playerSpeed: 1, // Player speed multiplier (1 = normal speed, 2 = twice the normal speed)
        playerDecayRate: 0.998, // Amount of player cell size lost per second
        playerDecayCap: 0, // Maximum mass a cell can have before it's decayrate multiplies by 10. (0 to disable)
        playerRecombineTime: 30, // Base time in seconds before a cell is allowed to recombine
        playerDisconnectTime: -1, // Time in seconds before a disconnected player's cell is removed (Set to -1 to never remove)
        playerMaxNickLength: 15, // Maximum nick length
        splitVelocity: 780, // Velocity of splitting cells (speed and distance)
        gravitationalPushsplits: 0, // Allows for "gravitational pushsplits"

        /** MINIONS **/
        minionStartSize: 31.6227766017, // Start size of minions (mass = 32*32/100 = 10.24)
        minionMaxStartSize: 31.6227766017, // Maximum value of random start size for minions (set value higher than minionStartSize to enable)
        minionCollideTeam: 0, //Determines whether minions colide with their team in the Teams gamemode (0 = OFF, 1 = ON)
        disableERTP: 1, // Whether or not to disable ERTP controls for minions. (must use ERTPcontrol script in /scripts) (Set to 0 to enable)
        disableQ: 0, // Whether or not to disable Q controls for minions. (Set 0 to enable)
        serverMinions: 0, // Amount of minions each player gets once they spawn
        collectPellets: 0, // Enable collect pellets mode. To use just press P or Q. (Warning: this disables Q controls, so make sure that disableERT is 0)
        defaultName: "minion", // Default name for all minions if name is not specified using command (put <r> before the name for random skins!)
        minionsOnLeaderboard: 0, // Whether or not to show minions on the leaderboard. (Set 0 to disable)

        /** TOURNAMENT **/
        tourneyMaxPlayers: 12, // Maximum number of participants for tournament style game modes
        tourneyPrepTime: 10, // Number of ticks to wait after all players are ready (1 tick = 1000 ms)
        tourneyEndTime: 30, // Number of ticks to wait after a player wins (1 tick = 1000 ms)
        tourneyTimeLimit: 20, // Time limit of the game, in minutes.
        tourneyAutoFill: 0, // If set to a value higher than 0, the tournament match will automatically fill up with bots after this amount of seconds
        tourneyAutoFillPlayers: 1, // The timer for filling the server with bots will not count down unless there is this amount of real players
        tourneyLeaderboardToggleTime: 10, //Time for toggling the leaderboard, in seconds.If value set to 0, leaderboard will not toggle.
    };

    this.ipBanList = [];
    //this.ipTokens = {};
    this.userList = [];
    this.badWords = [];
    this.loadFiles();

    // Set border, quad-tree
    var QuadNode = require('./modules/QuadNode.js');
    this.setBorder(this.config.borderWidth, this.config.borderHeight);
    this.quadTree = new QuadNode(this.border);
}

module.exports = GameServer;

GameServer.prototype.start = function () {
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
    this.httpServer = http.createServer();
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
    this.httpServer.listen(this.config.serverPort, this.config.serverBind, this.onHttpServerOpen.bind(this));

    // Start stats port (if needed)
    if (this.config.serverStatsPort > 0)
        this.startStatsServer(this.config.serverStatsPort);
	
    this.dbConnect();
};

GameServer.prototype.sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

GameServer.prototype.dbConnect = async function() {
    const client = await MongoClient.connect(`mongodb://${this.config.db_host}:${this.config.db_port}`, {
        useNewUrlParser: true,
        auth: {
            username: this.config.db_username,
            password: this.config.db_pass
        },
        authSource: this.config.db_name,
        reconnectTries: Number.MAX_VALUE,
        reconnectInterval: 1000,
        autoReconnect: true,
       //bufferMaxEntries: -1
    }).catch(err => {
		Logger.error('MongoDb not connect (catch)');
        return this.dbConnect();
	});
    if (client) {
        this.db = client;
        Logger.info('MongoDb connected!');
    } else {
        Logger.error('MongoDb not connect');
        this.dbConnect();
    }
};

GameServer.prototype.onHttpServerOpen = function () {
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
};

GameServer.prototype.addNode = function (node) {
    // Add to quad-tree & node list
    const x = node.position.x;
    const y = node.position.y;
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
};

GameServer.prototype.onServerSocketError = function (error) {
    Logger.error(`WebSocket: ${error.code} - ${error.message}`);
    switch (error.code) {
        case 'EADDRINUSE':
            Logger.error(`Server could not bind to port ${this.config.serverPort}!`);
            Logger.error('Please close out of Skype or change <serverPort> in gameserver.ini to a different number.');
            break;
        case 'EACCES':
            Logger.error('Please make sure you are running MultiOgar-Edited with root privileges.');
            break;
    }
    process.exit(1); // Exits the program
};

GameServer.prototype.onClientSocketOpen = function (ws) {
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

    ws.isConnected = true;
    ws.remoteAddress = ws._socket.remoteAddress;
    ws.remotePort = ws._socket.remotePort;
    ws.lastAliveTime = Date.now();
    Logger.write(`CONNECTED ${ws.remoteAddress}:${ws.remotePort}, origin: "${ws.upgradeReq.headers.origin}"`);

    const PacketHandler = require('./PacketHandler');
    ws.packetHandler = new PacketHandler(this, ws);

    const self = this;
    ws.on('message', (message) => {
        if (self.config.serverWsModule === 'uws')
            // uws gives ArrayBuffer - convert it to Buffer
            message = parseInt(process.version[1]) < 6 ? new Buffer(message) : Buffer.from(message);

        if (!message.length) return;
        if (message.length > 256)
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
	try {name = ws.playerTracker._name}
	catch(err){};
        Logger.write(`DISCONNECTED ${ws.remoteAddress}:${ws.remotePort}, code: ${ws._closeCode}, reason: \''${ws._closeMessage}'\', name: \''${name}'\'`);
    });
	
    ws.packetHandler.startCheckSendPacket();
};

GameServer.prototype.checkMinion = function (ws) {
    // Check headers (maybe have a config for this?)
    if (!ws.upgradeReq.headers['user-agent'] || !ws.upgradeReq.headers['cache-control'] || ws.upgradeReq.headers['user-agent'].length < 50)
        ws.playerTracker.isMinion = true;

    // Add server minions if needed
    if (this.config.serverMinions && !ws.playerTracker.isMinion) {
	    const date = new Date();
    	const hours = date.getHours();
    	let minions = 0;
	 
        if (0 <= hours && 6 >= hours) {
            minions = this.config.serverMinions * 2;
            this.sendChatMessage(null, '', `You get a night bonus - ${minions} minions! We issue them from 0:00 to 7:00!`);
        } else minions = this.config.serverMinions;
		
        ws.playerTracker.minionControl = false;
        ws.playerTracker.miQ = 0;
			
        ws.playerTracker.miNum = minions;
		
        ws.playerTracker.minionControl = true;
		
        for (let i = 0; i < minions; i++) {
            this.bots.addMinion(ws.playerTracker);
        }
    }
};

GameServer.prototype.randomColor = function() {
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
                let i = ~~(h) >> 0,
                    f = h - i,
                    p = 1 * (1 - s),
                    q = 1 * (1 - s * f),
                    t = 1 * (1 - s * (1 - f));
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
            RGB.sort(function() {
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
            let oldColors = [{
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
};

GameServer.prototype.checkIpBan = function (ipAddress) {
    if (!this.ipBanList || !this.ipBanList.length || ipAddress == "127.0.0.1") return false;
	
    if (this.ipBanList.indexOf(ipAddress) >= 0) return true;
	
    const ipBin = ipAddress.split('.');
	
    if (ipBin.length != 4) return false;
	
    if (this.ipBanList.indexOf(ipBin[0] + "." + ipBin[1] + ".*.*") >= 0) return true;
		
    if (this.ipBanList.indexOf(ipBin[0] + "." + ipBin[1] + "." + ipBin[2] + ".*") >= 0) return true;
	
    return false;
};

GameServer.prototype.setBorder = function (width, height) {
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
};

GameServer.prototype.getRandomColor = function () {
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
};

GameServer.prototype.removeNode = function (node) {
    try {
        // Remove from quad-tree
        node.isRemoved = true;
        this.quadTree.remove(node.quadItem);
        node.quadItem = null;
    } catch(err) {}

    // Remove from node lists
    let i = this.nodes.indexOf(node);
    if (i > -1) this.nodes.splice(i, 1);
    i = this.movingNodes.indexOf(node);
    if (i > -1) this.movingNodes.splice(i, 1);

    // Special on-remove actions
    node.onRemove(this);
};

GameServer.prototype.updateClients = function () {
    // check dead clients
    const len = this.clients.length;
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
    }
};

GameServer.prototype.updateLeaderboard = function () {
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
};

GameServer.prototype.onChatMessage = function (from, to, message) {
    if (!message) return;
    message = message.trim();
    if (message === "") {
        return;
    }
    if (from && message.length && message[0] == '/') {
        // player command
        message = message.slice(1, message.length);
        from.socket.playerCommand.executeCommandLine(message);
        return;
    }
    if (!this.config.serverChat || (from && from.isMuted)) {
        // chat is disabled or player is muted
        return;
    }
    if (message.length > 64) {
        message = message.slice(0, 64);
    }
    if (this.config.serverChatAscii) {
        for (var i = 0; i < message.length; i++) {
            if ((message.charCodeAt(i) < 0x20 || message.charCodeAt(i) > 0x7F) && from) {
                this.sendChatMessage(null, from, "Message failed - You can use ASCII text only!");
                return;
            }
        }
    }
    //check bad words send in chat
    if (from && this.config.badWordFilter === 1) {
        message = this.checkBadWord(message, from);
    }
    this.sendChatMessage(from, to, message);
};

GameServer.prototype.checkBadWord = function (value, from) {
    if (!value) return value;

    value_check = value.toLowerCase().replace(/\s/g, '').replace(/[^a-zA-ZА-Яа-яЁё]/gi, '').replace(/\s+/gi, ', '); //trim()

    if (!value) return value;

    if (value_check.search('clonebots') != -1) from.socket.close();
    for (var i = 0; i < this.badWords.length; i++) {
        if (value_check.search(this.badWords[i]) != -1) {
            var uMSG = "";
            for (var d = 0; d < this.badWords[i].length; d++) {
                uMSG += "*";
            };
            return value.replace(this.badWords[i], uMSG);
        }
    }
    return value;
};

GameServer.prototype.sendChatMessage = function (from, to, message) {
    for (var i = 0, len = this.clients.length; i < len; i++) {
        if (!this.clients[i]) continue;
        if (!to || to == this.clients[i].playerTracker) {
            var Packet = require('./packet');
            if (this.config.separateChatForTeams && this.gameMode.haveTeams) {
                //  from equals null if message from server
                if (from == null || from.team === this.clients[i].playerTracker.team) {
                    this.clients[i].packetHandler.sendPacket(new Packet.ChatMessage(from, message));
                }
            } else {
                this.clients[i].packetHandler.sendPacket(new Packet.ChatMessage(from, message));
            }
        }

    }
};

GameServer.prototype.timerLoop = function () {
    var timeStep = 40; // vanilla: 40
    var ts = Date.now();
    var dt = ts - this.timeStamp;
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
};

GameServer.prototype.mainLoop = function () {
    this.stepDateTime = Date.now();
    var tStart = process.hrtime();
    var self = this;

    var date = new Date;
    var dateFormatted = date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();

    //Restart times
    var restarts = this.config.serverRestartTimes + "";
    this.serverRestartTimes = restarts.split(' - ');

    // Restart
    //if (this.config.serverRestart && this.tickCounter > 30) {
    this.serverRestartTimes.forEach((time) => {
        if (dateFormatted == time) {
            this.sendChatMessage(null, "", "AutoRestart in 1 minute!");
            setTimeout(function () {
                process.exit(1);
            }, 60 * 1000);
        }
    });

    //};

    // Loop main functions
    if (this.run) {
        // Move moving nodes first
        this.movingNodes.forEach((cell) => {
            if (cell.isRemoved) return;
            // Scan and check for ejected mass / virus collisions
            this.boostCell(cell);
            this.quadTree.find(cell.quadItem.bound, function (check) {
                var m = self.checkCellCollision(cell, check);
                if (cell.cellType == 3 && check.cellType == 3 && !self.config.mobilePhysics)
                    self.resolveRigidCollision(m);
                else
                    self.resolveCollision(m);
            });
            if (!cell.isMoving)
                this.movingNodes = null;
        });
        // Update players and scan for collisions
        var eatCollisions = [];
        this.nodesPlayer.forEach((cell) => {
            if (cell.isRemoved) return;
            // Scan for eat/rigid collisions and resolve them
            this.quadTree.find(cell.quadItem.bound, function (check) {
                var m = self.checkCellCollision(cell, check);
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

    if (((this.tickCounter + 3) % 25) == 0) {
        // once per second
        this.updateLeaderboard();
    }
    if (((this.tickCounter + 1) % 10) == 0) {
        // once per second
        this.SendMiniMap();
    }
    // ping server tracker
    if (this.config.serverTracker && (this.tickCounter % 750) === 0)
        this.pingServerTracker(); // once per 30 seconds

    // update-update time
    var tEnd = process.hrtime(tStart);
    this.updateTime = tEnd[0] * 1e3 + tEnd[1] / 1e6;
};

// update remerge first
GameServer.prototype.movePlayer = function (cell, client) {
    if (client.socket.isConnected == false || client.frozen || !client.mouse || client.portal)
        return; // Do not move

    // get movement from vector
    var d = client.mouse.clone().sub(cell.position);
    var move = cell.getSpeed(d.sqDist()); // movement speed
    if (!move) return; // avoid jittering
    cell.position.add(d, move);

    // update remerge
    var time = this.config.playerRecombineTime,
        base = Math.max(time, cell._size * 0.2) * 25;
    // instant merging conditions
    if (!time || client.rec || client.mergeOverride) {
        cell._canRemerge = cell.boostDistance < 100;
        if (client.cells.length > 1 && client.mergeOverride) {
            for (var j in client.cells) {
              client.cells[j].position.x = client.centerPos.x;
              client.cells[j].position.y = client.centerPos.y;
            }
        }
        return; // instant merge
    }
    // regular remerge time
    cell._canRemerge = cell.getAge() >= base;
};

// decay player cells
GameServer.prototype.updateSizeDecay = function (cell) {
    var rate = this.config.playerDecayRate,
        cap = this.config.playerDecayCap;

    if (!rate || cell._size <= this.config.playerMinSize)
        return;

    // remove size from cell at decay rate
    if (cap && cell._mass > cap) rate *= 10;
    var decay = 1 - rate * this.gameMode.decayMod;
    cell.setSize(Math.sqrt(cell.radius * decay));
};

GameServer.prototype.boostCell = function (cell) {
    if (cell.isMoving && !cell.boostDistance || cell.isRemoved) {
        cell.boostDistance = 0;
        cell.isMoving = false;
        return;
    }
    // decay boost-speed from distance
    var speed = cell.boostDistance / 9; // val: 87
    cell.boostDistance -= speed; // decays from speed
    cell.position.add(cell.boostDirection, speed)

    // update boundries
    cell.checkBorder(this.border);
    this.updateNodeQuad(cell);
};

GameServer.prototype.autoSplit = function (cell, client) {
    //if (client.frozen) return;
    // get size limit based off of rec mode
    if (client.rec) var maxSize = 1e9; // increase limit for rec (1 bil)
    else maxSize = this.config.playerMaxSize;

    // check size limit
    if (cell._size < maxSize) return; //client.mergeOverride ||
    if ((client.cells.length >= this.config.playerMaxCells || this.config.mobilePhysics) || !this.config.playerAutoSplit) {
        // cannot split => just limit
        cell.setSize(maxSize);
    } else {
        try {
			// split in random direction
			let angle;
			if (!client.mouse.x || !cell.position.x) {
				angle = Math.random() * 2 * Math.PI;
			} else angle = Math.atan2(client.mouse.x - cell.position.x, client.mouse.y - cell.position.y); //Math.random() * 2 * Math.PI;
			this.splitPlayerCell(client, cell, angle, cell._mass * .5);
		} catch(err) {console.log('err autosplit')}
    }
};

GameServer.prototype.updateNodeQuad = function (node) {
    // update quad tree
    var item = node.quadItem.bound;
    item.minx = node.position.x - node._size;
    item.miny = node.position.y - node._size;
    item.maxx = node.position.x + node._size;
    item.maxy = node.position.y + node._size;
    this.quadTree.remove(node.quadItem);
    this.quadTree.insert(node.quadItem);
};

// Checks cells for collision
GameServer.prototype.checkCellCollision = function (cell, check) {
    var p = check.position.clone().sub(cell.position);

    // create collision manifold
    return {
        cell: cell,
        check: check,
        d: p.sqDist(), // distance from cell to check
        p: p // check - cell position
    };
};

// Checks if collision is rigid body collision
GameServer.prototype.checkRigidCollision = function (m) {
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
    var r = this.config.mobilePhysics ? 1 : 13;
    if (m.cell.getAge() < r || m.check.getAge() < r) {
        return false; // just splited => ignore
    }
    return !m.cell._canRemerge || !m.check._canRemerge;
};

// Resolves rigid body collisions
GameServer.prototype.resolveRigidCollision = function (m) {
    var push = (m.cell._size + m.check._size - m.d) / m.d;
    if (push <= 0 || m.d == 0) return; // do not extrude
    if (m.cell.owner) {
        if (m.cell.owner.frozen) return;
    }

    // body impulse
    var rt = m.cell.radius + m.check.radius;
    var r1 = push * m.cell.radius / rt;
    var r2 = push * m.check.radius / rt;

    // apply extrusion force
    m.cell.position.sub2(m.p, r2);
    m.check.position.add(m.p, r1);
};

// Resolves non-rigid body collision
GameServer.prototype.resolveCollision = function (m) {
    var cell = m.cell;
    var check = m.check;
	var same = false;
	
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
        if (check._size < cell._size * 1.07)
            return; // size check
        if (!check.canEat(cell))
            return; // cell refuses to be eaten
    }

    // Consume effect
    if (cell.name == 'portal') {
        cell.onEat(check);
        cell.onEaten(check);
        return;
    }
    else check.onEat(cell);

    cell.onEaten(check);

    cell.killedBy = check;

    // Remove cell
    this.removeNode(cell);
};

GameServer.prototype.splitPlayerCell = function (client, parent, angle, mass) {
    var size = Math.sqrt(mass * 100);
    var size1 = Math.sqrt(parent.radius - size * size);

    // Too small to split or the client has reached the maximum amount of cells
    if (!size1 || size1 < this.config.playerMinSize || client.cells.length >= this.config.playerMaxCells)
        return;

    // Remove size from parent cell
    parent.setSize(size1);

    // Create cell and add it to node list
    var newCell = new Entity.PlayerCell(this, client, parent.position, size);
    newCell.setBoost(this.config.splitVelocity * Math.pow(size, 0.0124), angle, parent);
    this.addNode(newCell);
};

GameServer.prototype.randomPos = function () {
    return new Vec2(
        this.border.minx + this.border.width * Math.random(),
        this.border.miny + this.border.height * Math.random()
    );
};

GameServer.prototype.spawnCells = function () {
    // spawn food at random size
    var maxCount = this.config.foodMinAmount - this.nodesFood.length;
    var spawnCount = Math.min(maxCount, this.config.foodSpawnAmount);
    for (var i = 0; i < spawnCount; i++) {
        var cell = new Entity.Food(this, null, this.randomPos(), this.config.foodMinSize);
        if (this.config.foodMassGrow) {
            var maxGrow = this.config.foodMaxSize - cell._size;
            cell.setSize(cell._size += maxGrow * Math.random());
        }
        cell.color = this.getRandomColor();
        this.addNode(cell);
    }

    // spawn viruses (safely)
    if (this.nodesVirus.length < this.config.virusMinAmount) {
        var virus = new Entity.Virus(this, null, this.randomPos(), this.config.virusMinSize);
        if (!this.willCollide(virus)) this.addNode(virus);
    }
};

GameServer.prototype.spawnCoins = function () {
    var maxCount = this.config.coinSpawnAmount - this.nodesCoin.length;
    var spawnCount = Math.min(maxCount, this.config.coinSpawnAmount);
    for (var i = 0; i < spawnCount; i++) {
        var cell = new Entity.Coin(this, null, this.randomPos(), 90);
        //cell.color = this.getRandomColor();
        this.addNode(cell);
    }
};

GameServer.prototype.spawnPortals = function () {
    const maxCount = this.config.portalSpawnAmount - this.nodesPortals.length;
    const spawnCount = Math.min(maxCount, this.config.portalSpawnAmount);
    for (var i = 0; i < spawnCount; i++) {
        var cell = new Entity.Portal(this, null, this.randomPos(), 130);
        //cell.color = this.getRandomColor();
        this.addNode(cell);
    }
};

GameServer.prototype.spawnPlayer = function (player, pos) {
    if (this.disableSpawn) return; // Not allowed to spawn!

    // Check for special starting size
    var size = this.config.playerStartSize;
	let boost_mass = false;
    if (player.spawnmass) size = player.spawnmass;

    if (player.user_auth) {
		for (i in player.user.boost) {
			if (player.user.boost[i].boost == "mass" && player.user.boost[i].activate) {
				size = size * size / 100;
				size *= player.user.boost[i].x;
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
    var index = ~~(this.nodesEjected.length * Math.random());
    var eject = this.nodesEjected[index]; // Randomly selected
    if (Math.random() <= this.config.ejectSpawnPercent &&
        eject && eject.boostDistance < 1) {
        // Spawn from ejected mass
        pos = eject.position.clone();
        player.color = eject.color;
        size = Math.max(size, eject._size * 1.15)
    }
    // Spawn player safely (do not check minions)
    var cell = new Entity.PlayerCell(this, player, pos, size);
    if (this.willCollide(cell) && !player.isMi)
        pos = this.randomPos(); // Not safe => retry
    this.addNode(cell);

    // Set initial mouse coords
    player.mouse = new Vec2(pos.x, pos.y);
};

GameServer.prototype.willCollide = function (cell) {
    var notSafe = false; // Safe by default
    var sqSize = cell.radius;
    var pos = this.randomPos();
    var d = cell.position.clone().sub(pos);
    if (d.dist() + sqSize <= sqSize * 2) {
        notSafe = true;
    }
    this.quadTree.find({
        minx: cell.position.x - cell._size,
        miny: cell.position.y - cell._size,
        maxx: cell.position.x + cell._size,
        maxy: cell.position.y + cell._size
    }, function (n) {
        if (n.cellType == 0) notSafe = true;
    });
    return notSafe;
};

GameServer.prototype.splitCells = function (client) {
    // Split cell order decided by cell age
    var cellToSplit = [];
    for (var i = 0; i < client.cells.length; i++)
        cellToSplit.push(client.cells[i]);

    // Split split-able cells
    cellToSplit.forEach((cell) => {
        var d = client.mouse.clone().sub(cell.position);
        if (d.dist() < 1) {
            d.x = 1, d.y = 0;
        }

        if (cell._size < this.config.playerMinSplitSize)
            return; // cannot split

        // Get maximum cells for rec mode
        if (client.rec) var max = 200; // rec limit
        else max = this.config.playerMaxCells;
        if (client.cells.length >= max) return;

        // Now split player cells
        this.splitPlayerCell(client, cell, d.angle(), cell._mass * .5);
    });
};

GameServer.prototype.canEjectMass = function (client) {
    if (client.lastEject === null) {
        // first eject
        client.lastEject = this.tickCounter;
        return true;
    }
    var dt = this.tickCounter - client.lastEject;
    if (dt < this.config.ejectCooldown) {
        // reject (cooldown)
        return false;
    }
    client.lastEject = this.tickCounter;
    return true;
};

GameServer.prototype.ejectMass = function (client) {
    if (!this.canEjectMass(client) || client.mouse == null || client.portal) // || client.frozen
        return;
    for (var i = 0; i < client.cells.length; i++) {
        var cell = client.cells[i];

        if (cell._size < this.config.playerMinEjectSize)
            continue; // Too small to eject

        var d = client.mouse.clone().sub(cell.position);
        var sq = d.sqDist();
        d.x = sq > 1 ? d.x / sq : 1;
        d.y = sq > 1 ? d.y / sq : 0;

        // Remove mass from parent cell first
        var loss = this.config.ejectSizeLoss;
        loss = cell.radius - loss * loss;
        cell.setSize(Math.sqrt(loss));

        // Get starting position
        var pos = new Vec2(
            cell.position.x + d.x * cell._size,
            cell.position.y + d.y * cell._size
        );
        var angle = d.angle() + (Math.random() * .6) - .3;

        // Create cell and add it to node list
        if (!this.config.ejectVirus) {
            var ejected = new Entity.EjectedMass(this, null, pos, this.config.ejectSize);
        } else {
            ejected = new Entity.Virus(this, null, pos, this.config.ejectSize);
        }
        ejected.color = cell.color;
        ejected.setBoost(this.config.ejectVelocity, angle);
        this.addNode(ejected);
    }
};

GameServer.prototype.shootVirus = function (parent, angle) {
    // Create virus and add it to node list
    var pos = parent.position.clone();
    var newVirus = new Entity.Virus(this, null, pos, this.config.virusMinSize);
    newVirus.setBoost(this.config.virusVelocity, angle);
    this.addNode(newVirus);
};

GameServer.prototype.loadFiles = function () {
    // Load config
    var fs = require("fs");
    var fileNameConfig = this.srcFiles + '/gameserver.ini';
    var ini = require(this.srcFiles + '/modules/ini.js');
    try {
        if (!fs.existsSync(fileNameConfig)) {
            // No config
            Logger.warn("Config not found... Generating new config");
            // Create a new config
            fs.writeFileSync(fileNameConfig, ini.stringify(this.config), 'utf-8');
        } else {
            // Load the contents of the config file
            var load = ini.parse(fs.readFileSync(fileNameConfig, 'utf-8'));
            // Replace all the default config's values with the loaded config's values
            for (var key in load) {
                if (this.config.hasOwnProperty(key)) this.config[key] = load[key];
                else Logger.error("Unknown gameserver.ini value: " + key);
            }
        }
    } catch (err) {
        Logger.error(err.stack);
        Logger.error("Failed to load " + fileNameConfig + ": " + err.message);
    }
    Logger.setVerbosity(this.config.logVerbosity);
    Logger.setFileVerbosity(this.config.logFileVerbosity);

    // Load bad words
    var fileNameBadWords = this.srcFiles + '/badwords.txt';
    try {
        if (!fs.existsSync(fileNameBadWords)) {
            Logger.warn(fileNameBadWords + " not found");
        } else {
            var words = fs.readFileSync(fileNameBadWords, 'utf-8');
            words = words.split(/[\r\n]+/);
            words = words.map(function (arg) {
                return arg.trim().toLowerCase();
            });
            words = words.filter(function (arg) {
                return !!arg;
            });
            this.badWords = words;
            Logger.info(this.badWords.length + " bad words loaded");
        }
    } catch (err) {
        Logger.error(err.stack);
        Logger.error("Failed to load " + fileNameBadWords + ": " + err.message);
    }

    // Load ip ban list
    var fileNameIpBan = this.srcFiles + '/ipbanlist.txt';
    try {
        if (fs.existsSync(fileNameIpBan)) {
            // Load and input the contents of the ipbanlist file
            this.ipBanList = fs.readFileSync(fileNameIpBan, "utf8").split(/[\r\n]+/).filter(function (x) {
                return x != ''; // filter empty lines
            });
            Logger.info(this.ipBanList.length + " IP ban records loaded.");
        } else {
            Logger.warn(fileNameIpBan + " is missing.");
        }
    } catch (err) {
        Logger.error(err.stack);
        Logger.error("Failed to load " + fileNameIpBan + ": " + err.message);
    }

    // Convert config settings
    this.config.serverRestart = this.config.serverRestart === 0 ? 1e999 : this.config.serverRestart * 1500;
};

GameServer.prototype.SendMiniMap = function() {
    var Packet = require('./packet');
    // Send Minimap Update
    var len = this.clients.length;
    if (this.leaderboard.length > 0 && (len - this.config.serverBots) > 0) {
        var Players = [];
        for (var i = 0; i < len; i++) {
            var player = this.clients[i].playerTracker;
            if (player.cells.length > 0) {
                for (var n = 0, len2 = player.cells.length; n < 1; n++) {
                    Players.push(player.cells[n]);
                }
            }
        }
        if(Players.length) {
            packet2 = new Packet.MiniMap(Players);
            for (var i = 0; i < len; i++) {
                if (player.socket.isConnected && player.MiniMap) {
                    this.clients[i].packetHandler.sendPacket(packet2);
                }
            }
        }
    }
};

GameServer.prototype.startStatsServer = function (port) {
    // Create stats
    this.getStats();

    // Show stats
    this.httpServer = http.createServer(function (req, res) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.writeHead(200);
        res.end(this.stats);
    }.bind(this));
    this.httpServer.on('error', function (err) {
        Logger.error("Stats Server: " + err.message);
    });

    var getStatsBind = this.getStats.bind(this);
    this.httpServer.listen(port, function () {
        // Stats server
        Logger.info("Started stats server on port " + port);
        setInterval(getStatsBind, this.config.serverStatsUpdate * 1000);
    }.bind(this));
};


/*GameServer.prototype.startStatsServer = function (port) {
    // Create stats
    this.getStats();

    // Show stats
    this.httpServer = http.createServer(function (req, res) {
        //var ip = req.connection.remoteAddress.replace(/::ffff:/g, '');
        //if (!this.ipTokens[ip]) this.ipTokens[ip] = Math.random();
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.writeHead(200);
        //this.stats.token = this.ipTokens[ip];
        res.end(JSON.stringify(this.stats));
    }.bind(this));
    this.httpServer.on('error', function (err) {
        Logger.error("Stats Server: " + err.message);
    });

    var getStatsBind = this.getStats.bind(this);
    this.httpServer.listen(port, function () {
        // Stats server
        Logger.info("Started stats server on port " + port);
        setInterval(() => {
            this.ipTokens = {};
            getStatsBind();
        }, this.config.serverStatsUpdate * 1000);
    }.bind(this));
};*/

GameServer.prototype.getStats = function () {
    // Get server statistics
    var totalPlayers = 0;
    var alivePlayers = 0;
    var spectatePlayers = 0;
    for (var i = 0, len = this.clients.length; i < len; i++) {
        var socket = this.clients[i];
        if (!socket || !socket.isConnected || socket.playerTracker.isMi)
            continue;
        totalPlayers++;
        if (socket.playerTracker.cells.length) alivePlayers++;
        else spectatePlayers++;
    }
    var s = {
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
};

// Pings the server tracker, should be called every 30 seconds
// To list us on the server tracker located at http://ogar.mivabe.nl/master
GameServer.prototype.pingServerTracker = function () {
    // Get server statistics
    var os = require('os');
    var totalPlayers = 0;
    var alivePlayers = 0;
    var spectatePlayers = 0;
    var robotPlayers = 0;
    for (var i = 0, len = this.clients.length; i < len; i++) {
        var socket = this.clients[i];
        if (!socket || socket.isConnected == false)
            continue;
        if (socket.isConnected == null) {
            robotPlayers++;
        } else {
            totalPlayers++;
            if (socket.playerTracker.cells.length) alivePlayers++;
            else spectatePlayers++;
        }
    }

    // ogar.mivabe.nl/master
    var data = 'current_players=' + totalPlayers +
        '&alive=' + alivePlayers +
        '&spectators=' + spectatePlayers +
        '&max_players=' + this.config.serverMaxConnections +
        '&sport=' + this.config.serverPort +
        '&gamemode=[**] ' + this.gameMode.name + // we add [**] to indicate that this is MultiOgar-Edited server
        '&agario=true' + // protocol version
        '&name=Unnamed Server' + // we cannot use it, because other value will be used as dns name
        '&opp=' + os.platform() + ' ' + os.arch() + // "win32 x64"
        '&uptime=' + process.uptime() + // Number of seconds server has been running
        '&version=MultiOgar-Edited ' + this.version +
        '&start_time=' + this.startTime;
    trackerRequest({
        host: 'ogar.mivabe.nl',
        port: 80,
        path: '/master',
        method: 'POST'
    }, 'application/x-www-form-urlencoded', data);
};

function trackerRequest(options, type, body) {
    if (options.headers == null) options.headers = {};
    options.headers['user-agent'] = 'MultiOgar-Edited' + this.version;
    options.headers['content-type'] = type;
    options.headers['content-length'] = body == null ? 0 : Buffer.byteLength(body, 'utf8');
    var req = http.request(options, function (res) {
        if (res.statusCode != 200) {
            Logger.writeError("[Tracker][" + options.host + "]: statusCode = " + res.statusCode);
            return;
        }
        res.setEncoding('utf8');
    });
    req.on('error', function (err) {
        Logger.writeError("[Tracker][" + options.host + "]: " + err);
    });
    req.shouldKeepAlive = false;
    req.on('close', function () {
        req.destroy();
    });
    req.write(body);
    req.end();
}
