// Import
const BinaryWriter = require('./BinaryWriter');

class UpdateLeaderboard {
    constructor(playerTracker, leaderboard, leaderboardType) {
        this.playerTracker = playerTracker;
        this.leaderboard = leaderboard;
        this.leaderboardType = leaderboardType;
        this.leaderboardCount = Math.min(leaderboard.length, playerTracker.gameServer.config.serverMaxLB);
		this.leaderboardWinners = [];
    }
    build(protocol) {
        switch (this.leaderboardType) {
            case 48:
                // UserText
                this.buildUserText(protocol);
            case 49:
                // FFA
                this.buildFFA();
            case 50:
                // Team
                this.buildTeam();
            default:
                return null;
        }
    }
    buildUserText(protocol) {
        const writer = new BinaryWriter();
		writer.writeUInt8(0x32); // Packet ID
    	writer.writeUInt32(this.leaderboard.length >>> 0); // Number of elements
	    
        for (const item of this.leaderboard) {
           	writer.writeUInt32(0);
           	writer.writeStringZeroUtf8(item);
        }
	    
        return writer.toBuffer();
    }
    buildFFA() {
        let player = this.playerTracker;
        if (player.spectate && player.spectateTarget != null) player = player.spectateTarget;

        const writer = new BinaryWriter();
        writer.writeUInt8(0x31); // Packet ID
        writer.writeUInt32(this.leaderboardCount + 1 >>> 0);
		let i = 0;
		
        for (const item of this.leaderboard) {
            if (item == null) return; // bad leaderboard just don't send it
			
            const name = item.getName();
            const id = item.pID == this.playerTracker.pID ? 1 : 0;
            writer.writeUInt32(id >>> 0); // isMe flag
			
            if (item.checkVIP() && item.user.vip.chatCrown) writer.writeUInt32(1);
            else writer.writeUInt32(0);
			i++;
            
			const mass = parseFloat((item.getMass() / 1000).toFixed(1)) + 'k';
			
            if (item.getMass() >= this.playerTracker.gameServer.config.massRestart || item.win) {
                name = `Win ${name}! Restart ${this.playerTracker.gameServer.getDate(this.playerTracker.gameServer.restart.time)}`;
				if (!item.win) item.win = true;
            }
            
            writer.writeStringZeroUtf8(`${i}. ${name} (${mass})`);
        }
        writer.writeUInt32(1 >>> 0);
		
        const pos = this.leaderboard.indexOf(this.playerTracker) + 1 || '';
        const name = this.playerTracker.getName();
		const mass = parseFloat((this.playerTracker.getMass() / 1000).toFixed(1)) + 'k';

        if (pos > 10) {
            if (item.checkVIP() && item.user.vip.chatCrown) writer.writeUInt32(1);
            else writer.writeUInt32(0);
			
            writer.writeStringZeroUtf8(`${pos}. ${name} (${mass})`);
        } else {
            writer.writeUInt32(0);
            writer.writeStringZeroUtf8(' ');
        }
        return writer.toBuffer();
    }
    buildTeam() {
        const writer = new BinaryWriter();
		writer.writeUInt8(0x32); // Packet ID
    	writer.writeUInt32(this.leaderboard.length >>> 0); // Number of elements
		
        for (const value of this.leaderboard) {
            if (value == null) return; // bad leaderboardm just don't send it
            if (isNaN(value)) value = 0;
            value = value < 0 ? 0 : value;
            value = value > 1 ? 1 : value;
            writer.writeFloat(value); // isMe flag (previously cell ID)
        }
        return writer.toBuffer();
    }
}

module.exports = UpdateLeaderboard;
