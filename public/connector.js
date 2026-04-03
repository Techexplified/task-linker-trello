/* Task Linker – Trello Power-Up connector */
var Promise = TrelloPowerUp.Promise;

var STORAGE_KEY = "task-linker-auth";

function isAuthorized(t) {
  return t.get("member", "private", STORAGE_KEY).then(function (val) {
    return !!val;
  });
}

function getCardDeps(t) {
  return t
    .card("id")
    .then(function (card) {
      return t.get("board", "shared", "card-deps-" + card.id);
    })
    .then(function (deps) {
      return deps || [];
    });
}

/**
 * Health badge logic:
 * - Looks at all cards this card is "blocked-by"
 * - Checks which list each blocker is in
 * - If ALL blockers are in a "done-like" list → green  ✅ All clear
 * - If ANY blocker is in a "done-like" list → yellow  ⚠ Partially blocked
 * - If NO blocker is in a "done-like" list → red      🔴 Blocked
 * - "Done-like" list names (case-insensitive): done, complete, completed, finished, closed, released
 */
var DONE_LISTS = [
  "done",
  "complete",
  "completed",
  "finished",
  "closed",
  "released",
];

function isDoneList(listName) {
  return DONE_LISTS.indexOf((listName || "").toLowerCase().trim()) !== -1;
}

function getHealthBadge(t, deps) {
  // Only care about "blocked-by" relationships for health
  var blockers = deps.filter(function (d) {
    return d.rel === "blocked-by" || d.rel === "is-blocked-by";
  });

  if (blockers.length === 0) {
    // Has deps but none are blockers — show neutral info badge
    return [
      {
        text: deps.length + " link" + (deps.length > 1 ? "s" : ""),
        icon: window.location.origin + "/icons/link.svg",
        color: "blue",
      },
    ];
  }

  // Fetch all board lists to check which are "done"
  return t.lists("id", "name").then(function (lists) {
    var doneListIds = lists
      .filter(function (l) {
        return isDoneList(l.name);
      })
      .map(function (l) {
        return l.id;
      });

    // Fetch all board cards to find blocker list positions
    return t.cards("id", "idList").then(function (allCards) {
      var blockerCardMap = {};
      allCards.forEach(function (c) {
        blockerCardMap[c.id] = c.idList;
      });

      var totalBlockers = blockers.length;
      var resolvedCount = blockers.filter(function (b) {
        var listId = blockerCardMap[b.id];
        return listId && doneListIds.indexOf(listId) !== -1;
      }).length;

      if (resolvedCount === totalBlockers) {
        // All blockers done
        return [
          {
            text: "✓ All clear",
            icon: window.location.origin + "/icons/link.svg",
            color: "green",
          },
        ];
      } else if (resolvedCount > 0) {
        // Some blockers done
        return [
          {
            text: resolvedCount + "/" + totalBlockers + " resolved",
            icon: window.location.origin + "/icons/link.svg",
            color: "yellow",
          },
        ];
      } else {
        // No blockers done
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

TrelloPowerUp.initialize({
  /* ── Card Badges (health-aware badge on card front) ── */
  "card-badges": function (t, options) {
    return isAuthorized(t).then(function (authorized) {
      if (!authorized) return [];
      return getCardDeps(t).then(function (deps) {
        if (!deps || deps.length === 0) return [];
        return getHealthBadge(t, deps);
      });
    });
  },

  /* ── Card Detail Badges (health badge inside card back header) ── */
  "card-detail-badges": function (t, options) {
    return isAuthorized(t).then(function (authorized) {
      if (!authorized) return [];
      return getCardDeps(t).then(function (deps) {
        if (!deps || deps.length === 0) return [];
        return getHealthBadge(t, deps);
      });
    });
  },

  /* ── Card Back Section ── always shows Link Cards button ── */
  "card-back-section": function (t, options) {
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

  /* ── Card Buttons (Power-Ups section) ── */
  "card-buttons": function (t, options) {
    return isAuthorized(t).then(function (authorized) {
      return [
        {
          icon: window.location.origin + "/icons/link.svg",
          text: "Task Linker",
          callback: function (t) {
            if (!authorized) {
              return t.popup({
                title: "Task Linker",
                url: "./authorize.html",
                height: 320,
              });
            }
            return t.popup({
              title: "Link Cards",
              url: "./dependency.html",
              height: 420,
            });
          },
        },
      ];
    });
  },

  /* ── Board Buttons ── */
  "board-buttons": function (t, options) {
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

  "on-enable": function (t, options) {
    return t.popup({
      title: "Task Linker",
      url: "./authorize.html",
      height: 320,
    });
  },
});
