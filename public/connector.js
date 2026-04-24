/* Task Linker – Trello Power-Up connector */
var Promise = TrelloPowerUp.Promise;

var AUTH_KEY = "task-linker-auth";
var DEPS_KEY = "task-linker-deps";

/* ────────────────────────────────────────────────────────────
   ✅ PostHog tracking helper — ADD THIS
   Safe wrapper: won't crash if PostHog hasn't loaded yet
──────────────────────────────────────────────────────────── */
function track(t, eventName, extraProps) {
  if (!window.posthog) return;
  t.getContext().then(function (ctx) {
    window.posthog.capture(eventName, Object.assign({
      board_id: ctx.board,
      member_id: ctx.member,
      card_id: ctx.card || null,
    }, extraProps || {}));
  });
}

/* ────────────────────────────────────────────────────────────
   Auth helpers — unchanged
──────────────────────────────────────────────────────────── */
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

function getCardStatus(t, cardId, depsMap) {
  const deps = depsMap[cardId] || [];

  if (deps.some(d => d.rel === 'blocked-by' || d.rel === 'is-blocked-by')) {
    return Promise.resolve({ text: 'Blocked', color: 'red' });
  }

  return t.card('due', 'dueComplete').then(card => {
    if (card.due && !card.dueComplete) {
      const miles = new Date(card.due) - new Date();
      const daysLeft = miles / (1000 * 60 * 60 * 24);
      if (daysLeft >= 0 && daysLeft <= 2) {
        return { text: 'At Risk', color: 'yellow' };
      }
    }
    return { text: 'Clear', color: 'green' };
  });
}

/* ────────────────────────────────────────────────────────────
   Power-Up capabilities
──────────────────────────────────────────────────────────── */
TrelloPowerUp.initialize({

  /* ── Front-of-card badge ── */
  "card-badges": function (t) {
    // ✅ Track
    track(t, 'card_badge_rendered');

    return Promise.all([
      isAuthorized(t),
      t.card('id'),
      t.get('member', 'shared', DEPS_KEY)
    ]).then(res => {
      const [auth, card, map] = res;
      if (!auth || !map) return [];

      const deps = map[card.id] || [];
      const badges = [];

      if (deps.length > 0) {
        badges.push({
          text: deps.length + " link" + (deps.length > 1 ? "s" : ""),
          icon: window.location.origin + "/icons/link.svg",
          color: "sky"
        });
      }

      return getCardStatus(t, card.id, map).then(status => {
        // ✅ Track status shown on badge
        if (status.text !== 'Clear') {
          track(t, 'card_badge_status_shown', { status: status.text });
          badges.push({ text: status.text, color: status.color });
        }
        return badges;
      });
    });
  },

  /* ── Card detail badges ── */
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

      badges.push({
        title: "Task Linker",
        text: "Link Cards",
        color: "green",
        callback: function (t) {
          // ✅ Track
          track(t, 'link_cards_clicked', { authorized: authorized });
          return t.popup({
            title: authorized ? "Link Cards" : "Task Linker",
            url: authorized ? "./dependency.html" : "./authorize.html",
            height: authorized ? 420 : 320,
          });
        },
      });

      badges.push({
        title: "Network",
        text: "View Chain",
        color: "blue",
        callback: function (t) {
          // ✅ Track
          track(t, 'view_chain_clicked', { source: 'card_detail_badge', authorized: authorized });
          if (!authorized) {
            return t.popup({ title: "Task Linker", url: "./authorize.html", height: 320 });
          }
          return t.modal({
            title: "Dependency Map",
            url: "./chain.html",
            fullscreen: false,
            height: 600
          });
        },
      });

      if (authorized && map) {
        var deps = map[card.id] || [];
        var blockers = deps.filter(function (d) {
          return d.rel === 'blocked-by' || d.rel === 'is-blocked-by';
        });

        if (blockers.length > 0) {
          // ✅ Track
          track(t, 'blocked_card_viewed', { blocker_count: blockers.length });
          badges.push({ title: "Status", text: "Blocked", color: "red" });
        }
      }

      return badges;
    });
  },

  /* ── Card back section ── */
  'card-back-section': function (t) {
    // ✅ Track
    track(t, 'card_back_section_viewed');

    return Promise.all([
      t.card('id'),
      t.get('member', 'shared', DEPS_KEY)
    ]).then(function (res) {
      var cardId = res[0].id;
      var map = res[1] || {};
      var deps = map[cardId] || [];

      var calculatedHeight = 60 + (deps.length * 50);
      if (deps.length > 0) calculatedHeight += 20;

      var blockers = deps.filter(d => d.rel === 'blocked-by' || d.rel === 'is-blocked-by');

      if (blockers.length > 0) {
        // ✅ Track
        track(t, 'blocked_alert_shown', { blocker_name: blockers[0].name });
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

  /* ── Card Buttons ── */
  "card-buttons": function (t) {
    return isAuthorized(t).then(function (authorized) {
      return [
        {
          icon: window.location.origin + "/icons/link.svg",
          text: "Task Linker",
          callback: function (t) {
            // ✅ Track
            track(t, 'card_button_clicked', { button_name: 'Task Linker', authorized: authorized });
            return t.popup({
              title: authorized ? "Link Cards" : "Task Linker",
              url: authorized ? "./dependency.html" : "./authorize.html",
              height: authorized ? 420 : 320,
            });
          },
        },
        {
          icon: window.location.origin + "/icons/link.svg",
          text: "View Chain",
          callback: function (t) {
            // ✅ Track
            track(t, 'card_button_clicked', { button_name: 'View Chain', authorized: authorized });
            if (!authorized) {
              return t.popup({ title: "Task Linker", url: "./authorize.html", height: 320 });
            }
            return t.modal({
              title: "Dependency Map",
              url: "./chain.html",
              fullscreen: false,
              height: 600
            });
          },
        }
      ];
    });
  },

  /* ── List Sorters — unchanged ── */
  "list-sorters": function (t) {
    return t.list('name', 'id').then(function (list) {
      return [{
        text: "Most Task Links",
        callback: function (t, opts) {
          // ✅ Track
          track(t, 'list_sorted', { sorter: 'most_task_links' });
          return t.get('member', 'shared', DEPS_KEY).then(function (map) {
            var cards = opts.cards;
            cards.sort(function (a, b) {
              var aLen = (map && map[a.id]) ? map[a.id].length : 0;
              var bLen = (map && map[b.id]) ? map[b.id].length : 0;
              return bLen - aLen;
            });
            return { sortedIds: cards.map(c => c.id) };
          });
        }
      }];
    });
  },

  /* ── Board Buttons ── */
  "board-buttons": function (t) {
    return isAuthorized(t).then(function (authorized) {
      return [{
        text: "Dependency Map",
        icon: window.location.origin + "/icons/link.svg",
        callback: function (t) {
          // ✅ Track
          track(t, 'board_button_clicked', { button_name: 'Dependency Map', authorized: authorized });
          return t.popup({
            title: "Task Linker Network",
            url: authorized ? "./chain.html" : "./authorize.html",
            height: authorized ? 500 : 320,
          });
        },
      }];
    });
  },

  /* ── On Enable ── */
  "on-enable": function (t) {
    // ✅ Track — someone just installed your Power-Up!
    track(t, 'power_up_enabled');
    return t.popup({
      title: "Task Linker",
      url: "./authorize.html",
      height: 320,
    });
  },

});