/* Task Linker – Trello Power-Up connector */
var Promise = TrelloPowerUp.Promise;

var STORAGE_KEY = "task-linker-auth";

function isAuthorized(t) {
  return t.get("member", "private", STORAGE_KEY).then(function (val) {
    return !!val;
  });
}

TrelloPowerUp.initialize({
  /* ── Card Badges (small badge on card front) ── */
  "card-badges": function (t, options) {
    return isAuthorized(t).then(function (authorized) {
      if (!authorized) return [];
      return t.get("card", "shared", "dependencies").then(function (deps) {
        if (!deps || deps.length === 0) return [];
        return [
          {
            text: deps.length + " dep" + (deps.length > 1 ? "s" : ""),
            icon: window.location.origin + "/icons/link.svg",
            color: "green",
          },
        ];
      });
    });
  },

  /* ── Card Detail Badges (inside card back) ── */
  "card-detail-badges": function (t, options) {
    return isAuthorized(t).then(function (authorized) {
      if (!authorized) {
        return [
          {
            title: "Task Linker",
            text: "Authorize to use",
            callback: function (t) {
              return t.popup({
                title: "Task Linker",
                url: "./authorize.html",
                height: 320,
              });
            },
          },
        ];
      }
      return t.get("card", "shared", "dependencies").then(function (deps) {
        var count = deps && deps.length ? deps.length : 0;
        return [
          {
            title: "Dependencies",
            text: count > 0 ? count + " linked" : "None",
            color: count > 0 ? "green" : null,
            callback: function (t) {
              return t.popup({
                title: "Task Linker",
                url: "./dependency.html",
                height: 380,
              });
            },
          },
        ];
      });
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

  /* ── Card Buttons (Power-Ups section in card back) ── */
  "card-buttons": function (t, options) {
    return isAuthorized(t).then(function (authorized) {
      return [
        {
          icon: window.location.origin + "/icons/link.svg",
          text: "Dependencies",
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
              height: 380,
            });
          },
        },
      ];
    });
  },

  /* ── Card Section (the "Set dependency" section inside card back) ── */
  "card-back-section": function (t, options) {
    return isAuthorized(t).then(function (authorized) {
      if (!authorized) return null;
      return {
        title: "Dependencies",
        icon: window.location.origin + "/icons/link.svg",
        content: {
          type: "iframe",
          url: t.signUrl("./card-section.html"),
          height: 100,
        },
      };
    });
  },

  "on-enable": function (t, options) {
    return t.popup({
      title: "Task Linker",
      url: "./authorize.html",
      height: 320,
    });
  },
});
