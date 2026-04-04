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
  return t.get("member", "shared", DEPS_KEY).then(function (map) {
    return map && map[cardId] ? map[cardId] : [];
  });
}

TrelloPowerUp.initialize({
  /* ── Front-of-card badge — simple blue link count ── */
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

  /* ── Card detail badge — always-visible "Link Cards" button ── */
  "card-detail-badges": function (t) {
    return isAuthorized(t).then(function (authorized) {
      return [
        {
          title: "Task Linker",
          text: "Link Cards",
          color: "green",
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

  /* ── Card back section — shows the linked cards list ── */
  "card-back-section": function (t) {
    return isAuthorized(t).then(function (authorized) {
      if (!authorized) return null;
      return t
        .card("id")
        .then(function (card) {
          return getDepsForCard(t, card.id);
        })
        .then(function (deps) {
          // Always show the section so user can see links; height adjusts to content
          var height =
            deps.length > 0 ? Math.min(40 + deps.length * 38, 240) : 50;
          return {
            title: "Dependencies",
            icon: window.location.origin + "/icons/link.svg",
            content: {
              type: "iframe",
              url: t.signUrl("./card-section.html"),
              height: height,
            },
          };
        });
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
      ];
    });
  },

  /* ── Board Buttons ── */
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
