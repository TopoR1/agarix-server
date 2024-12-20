module.exports = {
    Mode: require('./Mode'),
    FFA: require('./FFA'),
    Teams: require('./Teams'),
    Experimental: require('./Experimental'),
    Rainbow: require('./Rainbow'),
    Tournament: require('./Tournament'),
    HungerGames: require('./HungerGames'),
    zombie: require('./zombie'),
    Popsplit: require('./Popsplit'),
    SuperPower: require('./SuperPower'),
};

var get = function (id) {
    var mode;
    switch (parseInt(id)) {
        case 1: // Teams
            mode = new module.exports.Teams();
            break;
        case 2: // Experimental
            mode = new module.exports.Experimental();
            break;
        case 3: // Rainbow
            mode = new module.exports.Rainbow();
            break;
        case 4:// Tournament
            mode = new module.exports.Tournament();
            break;
        case 5:// Hunger Games
            mode = new module.exports.HungerGames();
            break;
        case 6:// Hunger Games
            mode = new module.exports.Popsplit();
            break;
        case 7:// Hunger Games
            mode = new module.exports.SuperPower();
            break;
        case 12:// Hunger Games
            mode = new module.exports.zombie();
            break;
        default: // FFA is default
            mode = new module.exports.FFA();
            break;
    }
    return mode;
};

module.exports.get = get;
