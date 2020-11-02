'use strict';

var player_names = [];
var player_ids = [];
var best_manches = [];

const addPlayer = (name) => {
	if (name.length == 0)
			return;
	player_names.push(escapeHtml(name));
	$('#inputPlayerName').val('');
	renderPlayerList();
	$('#inputPlayerName').focus();
};

const removePlayer = (id) => {
	player_names.splice(id, 1);
	renderPlayerList();
};

function renderPlayerList(domElem) {
	domElem.empty();
	if (player_names.length > 0) {
		domElem.append('<tr class="active"><td colspan="3"><strong>' + player_names.length + ' RACERS</strong></td></tr>');
	}
	_.each(player_names, function (value, index) {
		domElem.append('<tr><td class="text-center col-xs-1 col-print-sm"><strong>' + (index + 1) + '</strong></td><td class="col-xs-10">' + value + '</td><td class="text-center col-xs-1 col-print-sm"><span class="glyphicon glyphicon-remove button-remove-player" data-remove-player="' + index + '" aria-hidden="true"></span></td></tr>');
	});
}

const generate = (playerNames, manches) => {
	player_ids = _.map(player_names, function (n, index) {
		return index
	});

	if (player_ids.length < 3) {
			return;
	}

	// generate manches
	best_manches = [];
	best_manches.push(generateFirstManche());
	_(manches - 1).times(function (n) {
			best_manches.push(generateManche(n))
	});

	return best_manches;
};

function generateFirstManche() {
    console.log('===== GENERATING MANCHE 0 =====');
    var m_best = split(_.shuffle(player_ids));
    m_best = _.shuffle(m_best);
    m_best = _.map(m_best, function (g) {
        return _.shuffle(g)
    });
    console.log(m_best);
    return m_best;
}

function generateManche(n) {
    console.log('===== GENERATING MANCHE ' + (n + 1) + ' =====');
    var iterations = 500;
    var i, m_temp, m_best, score_temp, score_best = 9999;

    // clone first manche and rotate all lanes by 'n'
    m_best = best_manches[0].slice();
    m_best = _.map(m_best, function (g) {
        return rotate(g, n + 1)
    });

    for (i = 0; i < iterations; i++) {
        // clone rotated manche
        m_temp = m_best.slice();

        // transpose rows to columns, shuffle columns, and transpose back
        m_temp = _.zip.apply(_, m_temp);
        m_temp = _.map(m_temp, function (g) {
            return _.shuffle(g)
        });
        m_temp = _.zip.apply(_, m_temp);

        // keep manche if the score is better than the current best
        score_temp = calculate_score(m_temp);
        if (score_temp < score_best) {
            console.log('got score ' + score_temp + ' at iteration ' + i);
            score_best = score_temp;
            m_best = m_temp;
        }

        if (i == iterations - 1)
            console.log('score ' + score_best + ' still the best one at iteration ' + i);

        if (score_best <= 0)
            break;
    }

    console.log(m_best);

    return m_best;
}

// Split player_ids array into groups of 3.
// if player_ids.length % 3 == 2, the last group will contain 2 players.
// if player_ids.length % 3 == 1, the last two groups will contain 2 players.
function split(a) {
    var i, r = [];
    for (i = 0; i < a.length; i += 3) {
        r.push(a.slice(i, i + 3));
    }
    if (a.length % 3 == 1) {
        var f1 = r.pop();
        var f2 = r.pop();
        r.push(f2.slice(0, 2));
        r.push(f2.slice(2, 3).concat(f1));
    }
    _.each(r, function (a) {
        if (a.length < 3)
            a.push(-1);
    });
    return r;
}

// Rotate all arrays in a manche by n.
function rotate(a, n) {
    var head, tail;
    n = (n == null) ? 1 : n;
    n = n % a.length;
    tail = a.slice(n);
    head = a.slice(0, n);
    return tail.concat(head);
}

// Calculate the score of the manche. Lower is better.
// Score is better if each players competes against different opponents as much as possible.
function calculate_score(manche) {
    // return if there is a round with a single player
    let singles = _.some(manche, function(g) {
        return _.size(_.filter(g, function(p) {
            return p == -1;
        })) > 1;
    });
    if (singles) {
        return 9999;
    }

    var g_prev, g_curr, score = 0;
    var manches_to_check = _.last(best_manches, 2);
    _.each(player_ids, function (p) {
        // from the 2 previous manche, get the rounds with this player
        g_prev = _.flatten(_.map(manches_to_check, function (m) {
            return _.filter(m, function (g) {
                return _.contains(g, p)
            })
        }));
        // from the newly generated manche, get the round with this player
        g_curr = _.flatten(_.filter(manche, function (g) {
            return _.contains(g, p)
        }));
        // check that the intersection is as small as possible
        score = score + (_.intersection(g_curr, g_prev).length - 1);
    });
    return score;
}

////////////////////////////
// UTILS
////////////////////////////

var entity_map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;'
};

function escapeHtml(string) {
    return String(string).replace(/[&<>"'`=\/]/g, function (s) {
        return entity_map[s];
    });
}

module.exports = {
	addPlayer: addPlayer,
	removePlayer: removePlayer,
	renderPlayerList: renderPlayerList,
	generate: generate
}
