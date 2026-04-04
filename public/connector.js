/* Task Linker – Trello Power-Up connector */
var Promise = TrelloPowerUp.Promise;

var AUTH_KEY = "task-linker-auth"; // member, private  — the OAuth token
var DEPS_KEY = "task-linker-deps"; // member, shared   — all dependency data keyed by cardId

/* ── Storage helpers ──────────────────────────────────────────────────── */

function getToken(t) {
  return t.get("member", "private", AUTH_KEY);
}

function isAuthorized(t) {
  return getToken(t).then(function (val) {
    return !!val;
  });
}

/** Read the full deps map: { [cardId]: [ {id, name, boardId, boardName, rel}, ... ] } */
function getDepsMap(t) {
  return t.get("member", "shared", DEPS_KEY).then(function (map) {
    return map || {};
  });
}

/** Get deps array for a specific cardId */
function getDepsForCard(t, cardId) {
  return getDepsMap(t).then(function (map) {
    return map[cardId] || [];
  });
}

/** Save the full deps map back */
function saveDepsMap(t, map) {
  return t.set("member", "shared", DEPS_KEY, map);
}

/* ── Trello REST API helpers ──────────────────────────────────────────── */

var API = "https://api.trello.com/1";
var API_KEY = "cd814b7c7f01e5029860d3eed20daae5"; // ← replace with your key

function apiUrl(path, token, extra) {
  var params = "key=" + API_KEY + "&token=" + token;
  if (extra) params += "&" + extra;
  return API + path + "?" + params;
}

function apiFetch(url) {
  return fetch(url).then(function (r) {
    return r.json();
  });
}

/** Fetch all boards for the authed member */
function fetchBoards(token) {
  return apiFetch(
    apiUrl("/members/me/boards", token, "fields=id,name&filter=open"),
  );
}

/** Fetch all open cards on a board */
function fetchBoardCards(token, boardId) {
  return apiFetch(
    apiUrl(
      "/boards/" + boardId + "/cards",
      token,
      "fields=id,name,idList&filter=open",
    ),
  );
}

/** Fetch all lists on a board */
function fetchBoardLists(token, boardId) {
  return apiFetch(
    apiUrl(
      "/boards/" + boardId + "/lists",
      token,
      "fields=id,name&filter=open",
    ),
  );
}

/** Fetch a single card's list (for health check on foreign boards) */
function fetchCard(token, cardId) {
  return apiFetch(apiUrl("/cards/" + cardId, token, "fields=id,idList"));
}

/** Fetch a single list (to check its name) */
function fetchList(token, listId) {
  return apiFetch(apiUrl("/lists/" + listId, token, "fields=id,name"));
}

/* ── Health badge ─────────────────────────────────────────────────────── */

var DONE_LISTS = [
  "done",
  "complete",
  "completed",
  "finished",
  "closed",
  "released",
];

function isDoneList(name) {
  return DONE_LISTS.indexOf((name || "").toLowerCase().trim()) !== -1;
}

function getHealthBadge(t, deps) {
  var blockers = deps.filter(function (d) {
    return d.rel === "blocked-by" || d.rel === "is-blocked-by";
  });

  if (blockers.length === 0) {
    return Promise.resolve([
      {
        text: deps.length + " link" + (deps.length > 1 ? "s" : ""),
        icon: window.location.origin + "/icons/link.svg",
        color: "sky",
      },
    ]);
  }

  return getToken(t).then(function (token) {
    if (!token) {
      return [
        {
          text: blockers.length + " blocker" + (blockers.length > 1 ? "s" : ""),
          color: "red",
        },
      ];
    }

    // For each blocker, fetch its current list name via REST
    var checks = blockers.map(function (b) {
      return fetchCard(token, b.id)
        .then(function (card) {
          if (!card || !card.idList) return false;
          return fetchList(token, card.idList).then(function (list) {
            return isDoneList(list && list.name);
          });
        })
        .catch(function () {
          return false;
        });
    });

    return Promise.all(checks).then(function (results) {
      var total = results.length;
      var resolved = results.filter(Boolean).length;

      if (resolved === total) {
        return [
          {
            text: "✓ All clear",
            icon: window.location.origin + "/icons/link.svg",
            color: "green",
          },
        ];
      } else if (resolved > 0) {
        return [
          {
            text: resolved + "/" + total + " resolved",
            icon: window.location.origin + "/icons/link.svg",
            color: "yellow",
          },
        ];
      } else {
        return [
          {
            text: "🔴 Blocked",
            icon: window.location.origin + "/icons/link.svg",
            color: "red",
          },
        ];
      }
    });
  });
}

/* ── Power-Up initialization ──────────────────────────────────────────── */

TrelloPowerUp.initialize({
  /* Front-of-card badge — simple blue link count */
  "card-badges": function (t) {
    return isAuthorized(t).then(function (authorized) {
      if (!authorized) return [];
      return t
        .card("id")
        .then(function (card) {
          return getDepsForCard(t, card.id);
        })
        .then(function (deps) {
          if (!deps.length) return [];
          return [
            {
              text: deps.length + " link" + (deps.length > 1 ? "s" : ""),
              icon: window.location.origin + "/icons/link.svg",
              color: "sky",
            },
          ];
        });
    });
  },

  /* Inside-card badge — health status */
  "card-detail-badges": function (t) {
    return isAuthorized(t).then(function (authorized) {
      if (!authorized) return [];
      return t
        .card("id")
        .then(function (card) {
          return getDepsForCard(t, card.id);
        })
        .then(function (deps) {
          if (!deps.length) return [];
          return getHealthBadge(t, deps);
        });
    });
  },

  /* Card back section — always shows Link Cards button */
  "card-back-section": function (t) {
    return {
      title: "Dependencies",
      icon: window.location.origin + "/icons/link.svg",
      content: {
        type: "iframe",
        url: t.signUrl("./card-section.html"),
        height: 60,
      },
    };
  },

  /* Card buttons (Power-Ups section) */
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
      ];
    });
  },

  /* Board buttons */
  "board-buttons": function (t) {
    return [
      {
        text: "Task Linker",
        icon: window.location.origin + "/icons/link.svg",
        callback: function (t) {
          return t.popup({
            title: "Task Linker",
            url: "./authorize.html",
            height: 320,
          });
        },
      },
    ];
  },

  "on-enable": function (t) {
    return t.popup({
      title: "Task Linker",
      url: "./authorize.html",
      height: 320,
    });
  },
});
