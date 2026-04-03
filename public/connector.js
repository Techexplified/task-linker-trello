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

TrelloPowerUp.initialize({
  /* ── Card Badges (small green badge on card front) ── */
  "card-badges": function (t, options) {
    return isAuthorized(t).then(function (authorized) {
      if (!authorized) return [];
      return getCardDeps(t).then(function (deps) {
        if (!deps || deps.length === 0) return [];
        return [
          {
            text: deps.length + " link" + (deps.length > 1 ? "s" : ""),
            icon: window.location.origin + "/icons/link.svg",
            color: "green",
          },
        ];
      });
    });
  },

  /* ── Card Back Section ──────────────────────────────────────────────────
     Always renders the green "Set dependency" button.
     Auth check happens inside card-section.html on click — so the button
     always appears, and clicking it opens either the authorize popup or
     the dependency popup depending on auth state.
  ── */
  // "card-back-section": function (t, options) {
  //   return {
  //     title: "Links",
  //     icon: window.location.origin + "/icons/link.svg",
  //     content: {
  //       type: "iframe",
  //       url: t.signUrl("./card-section.html"),
  //       height: 60,
  //     },
  //   };
  // },

  "card-detail-badges": function (t, options) {
    return {
      title: "Links",
      icon: window.location.origin + "/icons/link.svg",
      content: {
        type: "iframe",
        url: t.signUrl("./card-section.html"),
        height: 60,
      },
    };
  },

  /* ── Card Buttons (Power-Ups section in card back) ── */
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
              title: "Task Linker",
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
