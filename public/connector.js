/* Task Linker – Trello Power-Up connector */
var Promise = TrelloPowerUp.Promise;

var AUTH_KEY = "task-linker-auth";
var DEPS_KEY = "task-linker-deps";

function getToken(t) {
  return t.get("member", "private", AUTH_KEY);
}

function isAuthorized(t) {
  return getToken(t).then(function (val) {
    return !!val;
  });
}

function getDepsForCard(t, cardId) {
  return t.get("member", "shared", "deps-" + cardId).then(function (map) {
    return map && map[cardId] ? map[cardId] : [];
  });
}

// Add this helper function inside connector.js
function getCardStatus(t, cardId, depsMap) {
  const deps = depsMap[cardId] || [];
  
  // 1. BLOCKED (Highest Priority)
  if (deps.some(d => d.rel === 'blocked-by' || d.rel === 'is-blocked-by')) {
    return Promise.resolve({ text: 'Blocked', color: 'red' });
  }

  // 2. AT RISK (Check due date)
  return t.card('due', 'dueComplete').then(card => {
    if (card.due && !card.dueComplete) {
      const miles = new Date(card.due) - new Date();
      const daysLeft = miles / (1000 * 60 * 60 * 24);
      // If due within 2 days
      if (daysLeft >= 0 && daysLeft <= 2) {
        return { text: 'At Risk', color: 'yellow' };
      }
    }
    // 3. CLEAR
    return { text: 'Clear', color: 'green' };
  });
}

TrelloPowerUp.initialize({
  /* ── Front-of-card badge — simple blue link count ── */
  "card-badges": function (t) {
    return Promise.all([
      isAuthorized(t),
      t.card('id'),
      t.get('member', 'shared', DEPS_KEY)
    ]).then(res => {
      const [auth, card, map] = res;
      if (!auth || !map) return [];

      const deps = map[card.id] || [];
      const badges = [];

      // 1. RESTORED: The Link Count Badge (Blue)
      if (deps.length > 0) {
        badges.push({
          text: deps.length + " link" + (deps.length > 1 ? "s" : ""),
          icon: window.location.origin + "/icons/link.svg",
          color: "sky"
        });
      }

      // 2. The Status Badge (Red / Yellow)
      return getCardStatus(t, card.id, map).then(status => {
        // Only show status badge on the front if it's Blocked or At Risk
        if (status.text !== 'Clear') {
          badges.push({
            text: status.text,
            color: status.color
          });
        }
        return badges;
      });
    });
  },

  /* ── Card detail badge — always-visible "Link Cards" button ── */
 "card-detail-badges": function (t) {
    return Promise.all([
      isAuthorized(t),
      t.card('id'),
      t.get('member', 'shared', DEPS_KEY)
    ]).then(function (res) {
      var authorized = res[0];
      var card = res[1];
      var map = res[2];
      var badges = [];

      // 1. The "Link Cards" Action Button (Green)
      badges.push({
        title: "Task Linker",
        text: "Link Cards",
        color: "green",
        callback: function (t) {
          return t.popup({
            title: authorized ? "Link Cards" : "Task Linker",
            url: authorized ? "./dependency.html" : "./authorize.html",
            height: authorized ? 420 : 320,
          });
        },
      });

      // 2. NEW: The "View Chain" Action Button (Blue)
      badges.push({
        title: "Network",
        text: "View Chain",
        color: "blue",
        callback: function (t) {
          if (!authorized) {
            return t.popup({ title: "Task Linker", url: "./authorize.html", height: 320 });
          }
          // Opens the wide modal for the graph
          return t.modal({
            title: "Dependency Map",
            url: "./chain.html",
            fullscreen: false,
            height: 600
          });
        },
      });

      // 3. The Status Label (Red)
      if (authorized && map) {
        var deps = map[card.id] || [];
        var blockers = deps.filter(function (d) {
          return d.rel === 'blocked-by' || d.rel === 'is-blocked-by';
        });

        if (blockers.length > 0) {
          badges.push({
            title: "Status",
            text: "Blocked",
            color: "red",
          });
        }
      }

      return badges;
    });
  },

  /* ── Card back section — shows the linked cards list ── */
  'card-back-section': function(t) {
    return Promise.all([
      t.card('id'),
      t.get('member', 'shared', DEPS_KEY)
    ]).then(function(res) {
      var cardId = res[0].id;
      var map = res[1] || {};
      var deps = map[cardId] || [];
      
      // V2 Height: 60px base + 50px per card to ensure no scrolling
      var calculatedHeight = 60 + (deps.length * 50);
      if (deps.length > 0) calculatedHeight += 20; // Extra padding for the alert banner

      var blockers = deps.filter(d => d.rel === 'blocked-by' || d.rel === 'is-blocked-by');

      if (blockers.length > 0) {
        t.alert({
          message: 'BLOCKED: Waiting on ' + blockers[0].name,
          duration: 6,
          display: 'error',
        });
      }

      return {
        title: "Links",
        icon: window.location.origin + "/icons/link.svg",
        content: {
          type: "iframe",
          url: t.signUrl("./card-section.html"),
          height: calculatedHeight, 
        },
      };
    });
  },

  /* ── Card Buttons (Power-Ups section) ── */
  "card-buttons": function (t) {
    return isAuthorized(t).then(function (authorized) {
      return [
        {
          icon: window.location.origin + "/icons/link.svg",
          text: "Task Linker",
          callback: function (t) {
            return t.popup({
              title: authorized ? "Link Cards" : "Task Linker",
              url: authorized ? "./dependency.html" : "./authorize.html",
              height: authorized ? 420 : 320,
            });
          },
        },
        // --- ADD THIS SECOND BUTTON BLOCK ---
        {
          icon: window.location.origin + "/icons/link.svg", // You can update this to a graph icon later
          text: "View Chain",
          callback: function (t) {
            if (!authorized) {
              return t.popup({ title: "Task Linker", url: "./authorize.html", height: 320 });
            }
            // Use t.modal() instead of t.popup() so the graph has a wide screen to draw on!
            return t.modal({
              title: "Dependency Map",
              url: "./chain.html",
              fullscreen: false,
              height: 600
            });
          },
        }
        // ------------------------------------
      ];
    });
  },

  "list-sorters": function (t) {
    return t.list('name', 'id').then(function (list) {
      return [{
        text: "Most Task Links",
        callback: function (t, opts) {
          return t.get('member', 'shared', DEPS_KEY).then(function(map) {
            var cards = opts.cards;
            cards.sort(function(a, b) {
              var aLen = (map && map[a.id]) ? map[a.id].length : 0;
              var bLen = (map && map[b.id]) ? map[b.id].length : 0;
              return bLen - aLen; // Sort descending (most links at top)
            });
            return { sortedIds: cards.map(c => c.id) };
          });
        }
      }];
    });
  },

  /* ── Board Buttons ── */
  /* ── Board Buttons ── */
  "board-buttons": function (t) {
    return isAuthorized(t).then(function (authorized) {
      return [{
        text: "Dependency Map",
        icon: window.location.origin + "/icons/link.svg",
        callback: function (t) {
          return t.popup({
            title: "Task Linker Network",
            url: authorized ? "./chain.html" : "./authorize.html",
            height: authorized ? 500 : 320,
          });
        },
      }];
    });
  },

  "on-enable": function (t) {
    return t.popup({
      title: "Task Linker",
      url: "./authorize.html",
      height: 320,
    });
  },
});
