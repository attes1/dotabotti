var irc = require('irc');
var mongo = require('mongodb');
var monk = require('monk');
var db = monk('localhost:27017/dotabotti');

var config = {
	channels: [ '#dotabotti' ],
	server: 'irc.freenode.net',
	nick: 'Meepo',
	debug: true
};

var bot = new irc.Client(config.server, config.nick, {
	channels: config.channels,
	userName: 'meepo',
	realName: 'Dotabotti'
});

bot.addListener('error', function(message) {
    console.log('error: ', message);
});

gamestate = {
	challenged : 0,
	accepted : 1,
	signup : 2,
	draft : 3,
	shuffle : 4,
	live : 5,
	ended : 6
}

gamemode = {
	draft : 0,
	shuffle : 1
}

var game = null;
var signed = [];
var picking = null;

function sign(nick, callback)
{
	if(game != null && signed.length < 10 && game.state == gamestate.signup)
	{
		get_player(nick, true, function(player) {
			if(signed.indexOf(player) < 0)
			{
				signed.push(player);
				callback(player);
			}
			else 
			{
				callback(null);
			}
		});
	}
	else
	{
		callback(null);
	}
}

function out(nick)
{
	var index = signed.indexOf(nick);
	if(game != null && index > -1 && nick != game.dire.captain && nick != game.radiant.captain)
	{
		signed.splice(index, 1);
		return true;
	}

	return false;
}

function start(nick)
{
	if(game == null || game.state == gamestate.ended)
	{
		game = {
			radiant: {
				name: 'Radiant',
				captain: null,
				players: []
			},
			dire: {
				name: 'Dire',
				captain: null,
				players : []
			},
			gameid: '',
			state: gamestate.signup,
			mode: gamemode.shuffle,
			winner: null
		}

		get_player(nick, true, function(player) { signed = [player] });

		get_player('winkzi', true, function(player) { signed.push(player); });
		get_player('shancial', true, function(player) { signed.push(player); });
		get_player('agu', true, function(player) { signed.push(player); });
		get_player('ra', true, function(player) { signed.push(player); });
		get_player('cadiac', true, function(player) { signed.push(player); });
		get_player('snowell', true, function(player) { signed.push(player); });
		get_player('cawa', true, function(player) { signed.push(player); });
		get_player('aira', true, function(player) { signed.push(player); });

		return true;
	}

	return false;
}

function challenge(nick)
{
	if(game == null || game.state == gamestate.ended)
	{
		game = {
			radiant: {
				name: 'Radiant',
				captain: null,
				players: []
			},
			dire: {
				name: 'Dire',
				captain: null,
				players : []
			},
			gameid: '',
			state: gamestate.challenged,
			mode: gamemode.draft,
			winner: null
		}

		get_player(nick, true, function(player) { game.radiant.captain = player });
		signed = [nick];

		return true;
	}

	return false;
}

function accept(nick)
{
	if(game != null && game.state == gamestate.challenged && game.radiant.captain != nick)
	{
		get_player(nick, true, function(player) { game.dire.captain = player });
		game.dire.players = [];
		signed.push(nick);
		game.state = gamestate.signup;

		return true;
	}

	return false;
}

function cancel(nick)
{
	var index = signed.indexOf(nick);
	if(game != null && index > -1)
	{
		game = null;

		return true;
	}

	return false;
}

function end(winner)
{
	if(game != null && game.state == gamestate.live)
	{
		game.state = gamestate.ended;
		
		if(winner.toLowerCase() == 'radiant')
		{
			game.winner = game.radiant;
		}
		else
		{
			game.winner = game.dire;
		}

		var games = db.get('games');
		games.insert(game, function(err, res) { if(err) console.log(err); });

		return true;
	}

	return false;
}

function shuffle()
{
	for(var j, x, i = signed.length; i; j = Math.floor(Math.random() * i), x = signed[--i], signed[i] = signed[j], signed[j] = x);
	game.radiant.players = signed.slice(0,5);
	game.dire.players = signed.slice(5,10);
	game.radiant.captain = game.radiant.players[0];
	game.dire.captain = game.dire.players[0];
}

function draft()
{
	if(game != null && game.mode == gamemode.draft)
	{
		game.state = gamestate.draft;
		var rand = Math.floor(Math.random()*2);
		if(rand == 0)
		{
			picking = game.radiant;
		}
		else
		{
			picking = game.dire;
		}

		pick(picking.captain);
		pick(picking.captain);
	}
}

function pick(nick)
{
	var index = signed.indexOf(nick);
	
	if(index > -1 && game.radiant.players.length + game.dire.players.length < 10)
	{
		picking.players.push(nick);
		
		if(picking == game.radiant)
		{
			picking = game.dire;
		}
		else
		{
			picking = game.radiant;
		}
		
		signed.splice(index, 1);
		
		return true;
	}

	return false;
}

function get_signed()
{
	var players = '';
	for(var i = 0; i < signed.length; i++)
	{
		players += (signed[i].nick + ' ');
	}
	return players;
}

function get_dire()
{
	if(game == null)
	{
		return '';
	}

	var dire = '';
	
	for(var i = 0; i < game.dire.players.length; i++)
	{
		dire += (game.dire.players[i].nick + ' ');
	}
	
	return dire;
}

function get_radiant()
{
	if(game == null)
	{
		return '';
	}

	var radiant = '';
	
	for(var i = 0; i < game.radiant.players.length; i++)
	{
		radiant += (game.radiant.players[i].nick + ' ');
	}
	
	return radiant;
}

function get_player(nick, create, callback) {
	var players = db.get('players');
 	players.findOne({ nick: nick })
    .on('complete', function (err, res) {
    	if(err)
    	{
    		console.log(err);
    		callback(null);
    	}

    	if(res == null && create == true)
    	{
    		players.insert({ nick: nick, rating: 1500, wins: 0, losses: 0 }, function(err, res) {
    			if(err) console.log(err);
    			callback(res);
    		});
    	}
    	else
    	{
    		callback(res);
    	}
    });
}

bot.addListener('message', function(from, to, text, message) {
	var str = text.split(' ');

	if(str[0][0] == '.')
	{
		switch(str[0])
		{
			case '.stats':
				get_player(str[1], false, function(player) {
					if(player != null)
					{
						bot.say(to, 'Nick: ' + player.nick + ' Rating: ' + player.rating + ' Wins: ' + player.wins + ' Losses: ' + 
							player.losses + ' Matches: ' + (player.wins + player.losses));
					}
					else
					{
						bot.say(to, 'Not found');
					}
				});
				break;
			case '.signed':
				bot.say(to, get_signed());
				break;
			case '.teams':
				break;
			case '.game':
				break;
			case '.shuffle':
				if(game.state == gamestate.shuffle)
				{
					shuffle();
					bot.say(to, 'Teams shuffled. Radiant: ' + get_radiant() + ' Dire: ' + get_dire() + '. Type .shuffle to reshuffle teams or type .go to proceed to game.');
				}
				else
				{
					bot.say(to, 'Error. Not in shuffle phase.');
				}
				break;
			case '.go':
				if(game.state == gamestate.shuffle)
				{
					bot.say(to, 'GAME ON. GL HF BIG PLAYS.');
					game.state = gamestate.live;
				}
				else
				{
					bot.say(to, 'Error?! :G');
				}
				break;
			case '.sign':
				sign(from, function(player) {
					if(player != null)
					{
						bot.say(to, from + ' added. ' + signed.length + '/10');

						if(signed.length == 10)
						{
							if(game.mode == gamemode.draft)
							{
								draft();
								bot.say(to, 'Draft starts. ' + picking.name + 's turn to pick. Captain: ' + picking.captain + '.');
								bot.say(to, 'Available players: ' + get_signed());
							}
							else if(game.mode == gamemode.shuffle)
							{
								game.state = gamestate.shuffle;
								shuffle();
								bot.say(to, 'Teams shuffled. Radiant: ' + get_radiant() + ' Dire: ' + get_dire() + '. Type .shuffle to reshuffle teams or type .go to proceed to game.');
							}
						}
					}
					else 
					{
						bot.say(to, 'Error?! :G');
					}
				});
				break;
			case '.out':
				if(out(from))
				{
					bot.say(to, from + ' removed. ' + signed.length + '/10')
				}
				else 
				{
					bot.say(to, 'Error?! :G');	
				}
				break;
			case '.pick':			
				if(game.state != gamestate.draft)
				{
					bot.say(to, 'Error. Not in draft phase.')
				}
				else if(from != picking.captain)
				{
					bot.say(to, picking.captain + 's turn to pick.');
				}
				else if(str.length != 2)
				{
					bot.say(to, 'Error. Type .pick <nick> to pick a player. Available players: ' + get_signed());
				}
				else if(pick(str[1], from))
				{
					var team = '';
					if(picking == game.dire)
					{
						team = get_dire();
					}
					else
					{
						team = get_radiant();
					}
					bot.say(to, str[1] + ' picked.');
					if(game.radiant.players.length + game.dire.players.length == 10)
					{
						bot.say(to, 'Draft finished. Radiant: ' + get_radiant() + '. Dire: ' + get_dire());
						bot.say(to, 'GAME ON. GL HF BIG PLAYS.');
						game.state = gamestate.live;
					}
					else
					{
						bot.say(to, picking.name + 's turn to pick. Captain: ' + picking.captain + '. Team: ' + team);
						bot.say(to, 'Available players: ' + get_signed());
					}
				}
				else
				{
					bot.say(to, 'Error. Type .pick <nick> to pick a player. Available players: ' + get_signed());
				}
				break;
			case '.start':
				if(start(from))
				{
					bot.say(to, 'Starting a new game (shuffle mode). Type .sign to sign up.');
				}
				else 
				{
					bot.say(to, 'Error?! :G');
				}
				break;
			case '.challenge':
				if(challenge(from))
				{
					bot.say(to, from + ' challenged. Type .accept to accept challenge.');
				}
				else 
				{
					bot.say(to, 'Error?! :G');
				}
				break;
			case '.accept':
				if(accept(from))
				{
					bot.say(to, 'Starting a new game (draft mode). Captains are ' + game.radiant.captain + ' and ' + game.dire.captain + '.' );
				}
				else 
				{
					bot.say(to, 'Error?! :G');
				}
				break;
			case '.end':
				if(str.length != 2)
				{
					bot.say(to, 'Error. Type .end <radiant/dire> to end the game.');
				}
				else if(end(str[1]))
				{
					bot.say(to, 'Game finished. ' + game.winner.name + ' wins.');
				}
				else
				{
					bot.say(to, 'Error?! :G');	
				}
				break;
			case '.cancel':
				if(cancel(from)) 
				{
					bot.say(to, 'Game canceled.');
				}
				else
				{
					bot.say(to, 'Error?! :G');	
				}
				break;
		}
	}
});