/**
 * Neon Dash — level select screen.
 *
 * Three tabs:
 *   Official — the four built-in levels (with saved best % / attempts)
 *   My Levels — the player's editor creations (play / edit / delete)
 *   Online — browse, search, download, like & upload levels via the API
 */
/* global GD */
GD.register('levelselect', function (GD) {
  'use strict';

  var ui = GD.ui;
  var t = function (k) { return GD.i18n.t(k); };
  var esc = ui.esc;

  function starsHtml(difficulty) {
    var d = GD.level.DIFFICULTIES[difficulty] || GD.level.DIFFICULTIES[1];
    var out = '<span class="diff-face" style="background:' + d.color + '">' + esc(d.name) + '</span>';
    out += '<span class="diff-stars">';
    for (var i = 0; i < d.stars; i++) out += '★';
    out += '</span>';
    return out;
  }

  /** A level card with a play button.  meta = {best, attempts, completed, sub, statsHtml, actions[]} */
  function levelCard(opts) {
    var prog = opts.progress || {};
    var pct = Math.round((prog.best || 0) * 100);
    var bar = el('div.level-progress',
      el('div.level-progress-fill' + (prog.completed ? ' done' : ''), { style: { width: pct + '%' } }),
      el('span.level-progress-text', { text: (prog.completed ? '✔ ' : '') + pct + '%' }));

    var actions = el('div.level-actions');
    (opts.actions || []).forEach(function (a) {
      actions.appendChild(el('button.btn.btn-small.' + (a.cls || 'btn-secondary'), {
        type: 'button', 'data-testid': a.testid, text: a.label,
        onclick: function (e) { e.stopPropagation(); a.onClick(); }
      }));
    });

    return el('div.level-card' + (opts.highlight ? ' highlight' : ''), {
      'data-testid': 'level-card', 'data-level': opts.testid || '',
      onclick: opts.onClick || null
    },
      el('div.level-card-main',
        el('div.level-card-title', { text: opts.name }),
        el('div.level-card-sub', { html: opts.subHtml || '' })),
      bar,
      el('div.level-card-stats',
        el('span.level-stat', { text: t('select.attempts') + ': ' + (prog.attempts || 0) }),
        opts.statsHtml || ''),
      actions);
  }

  var el = ui.el;

  ui.registerScreen('select', function (root) {
    var state = { tab: 'official' };
    var container = el('div.screen.select-screen#select-screen');
    var tabBar, content;

    function setTab(tab) {
      state.tab = tab;
      Array.prototype.forEach.call(tabBar.querySelectorAll('.tab-btn'), function (b) {
        b.classList.toggle('active', b.getAttribute('data-tab') === tab);
      });
      renderTab();
      GD.audio.play('click');
    }

    tabBar = el('div.tab-bar#tab-bar',
      ['official', 'custom', 'online'].map(function (tab) {
        return el('button.tab-btn', {
          type: 'button', 'data-tab': tab, 'data-testid': 'tab-' + tab,
          text: t('select.' + (tab === 'official' ? 'official' : tab === 'custom' ? 'custom' : 'online')),
          onclick: function () { setTab(tab); }
        });
      }));

    var backBtn = el('button.btn.btn-back', {
      type: 'button', 'data-testid': 'back', text: '◀ ' + t('common.back'),
      onclick: function () { GD.audio.play('back'); ui.show('menu'); }
    });

    content = el('div.tab-content#tab-content');
    container.appendChild(el('h2.screen-title', { text: t('select.title') }));
    container.appendChild(tabBar);
    container.appendChild(content);
    container.appendChild(el('div.screen-footer', backBtn));
    root.appendChild(container);

    function renderTab() {
      content.innerHTML = '';
      if (state.tab === 'official') renderOfficial();
      else if (state.tab === 'custom') renderCustom();
      else renderOnline();
    }

    // ------------------------------------------------------------ official
    function renderOfficial() {
      var progress = GD.storage.getProgress();
      GD.official.levels.forEach(function (entry) {
        var prog = progress['official:' + entry.id] || {};
        var level = GD.encoding.decode(entry.code);
        var card = levelCard({
          name: entry.name,
          testid: 'official-' + entry.id,
          progress: prog,
          subHtml: t('select.by') + ' ' + esc(level.author) + ' · ' +
            starsHtml(entry.difficulty) + ' · ' + t('select.length') + ': ' + level.length,
          statsHtml: '<span class="level-stat">' + t('select.objects') + ': ' + level.objects.length + '</span>',
          onClick: function () {
            GD.audio.unlock();
            GD.audio.play('click');
            ui.show('game', {
              level: level,
              storageKey: 'official:' + entry.id,
              levelKey: 'official:' + entry.id
            });
          }
        });
        content.appendChild(card);
      });
    }

    // -------------------------------------------------------------- custom
    function renderCustom() {
      var newBtn = el('button.btn.btn-primary.level-new', {
        type: 'button', 'data-testid': 'new-level', text: '+ ' + t('select.newLevel'),
        onclick: function () { GD.audio.play('click'); ui.show('editor', {}); }
      });
      content.appendChild(newBtn);

      var levels = GD.storage.getCustomLevels();
      if (!levels.length) {
        content.appendChild(el('p.empty-note', { text: t('select.noCustom') }));
        return;
      }
      levels.forEach(function (entry) {
        var prog = GD.storage.getProgress()['custom:' + entry.id] || {};
        var level;
        try { level = GD.encoding.decode(entry.code); }
        catch (e) {
          content.appendChild(el('div.level-card', el('div.level-card-title',
            { text: entry.name + ' (⚠ corrupt)' })));
          return;
        }
        content.appendChild(levelCard({
          name: entry.name,
          testid: 'custom-' + entry.id,
          progress: prog,
          subHtml: starsHtml(level.difficulty) + ' · ' + t('select.objects') + ': ' + level.objects.length,
          actions: [
            {
              label: '✎ ' + t('editor.title'), onClick: function () {
                ui.show('editor', { loadId: entry.id });
              }
            },
            {
              label: t('common.delete'), cls: 'btn-danger',
              onClick: function () {
                ui.confirm(t('editor.deleteLevel'), entry.name, function () {
                  GD.storage.deleteCustomLevel(entry.id);
                  renderTab();
                });
              }
            }
          ],
          onClick: function () {
            GD.audio.unlock();
            GD.audio.play('click');
            ui.show('game', {
              level: level,
              storageKey: 'custom:' + entry.id,
              levelKey: 'custom:' + entry.id
            });
          }
        }));
      });
    }

    // --------------------------------------------------------------- online
    var online = { loading: false, levels: [], sort: 'new', q: '', page: 1 };

    function renderOnline() {
      var searchInput = el('input.text-input.online-search', {
        type: 'search', placeholder: t('online.searchPlaceholder'), value: online.q,
        'data-testid': 'online-search'
      });
      searchInput.addEventListener('change', function () {
        online.q = searchInput.value;
        loadOnline();
      });

      var sortSel = el('select.select.online-sort', { 'data-testid': 'online-sort' });
      [['new', 'sort.new'], ['likes', 'sort.likes'], ['downloads', 'sort.downloads'], ['plays', 'sort.plays']].forEach(function (pair) {
        var o = el('option', { value: pair[0], text: t(pair[1]) });
        if (pair[0] === online.sort) o.selected = true;
        sortSel.appendChild(o);
      });
      sortSel.addEventListener('change', function () {
        online.sort = sortSel.value;
        loadOnline();
      });

      var refresh = el('button.btn.btn-small.btn-secondary', { type: 'button', text: '⟳ ' + t('select.refresh') });
      refresh.addEventListener('click', function () { loadOnline(); });

      var upload = el('button.btn.btn-small.btn-primary', {
        type: 'button', 'data-testid': 'upload-level', text: '↑ ' + t('online.upload')
      });
      upload.addEventListener('click', uploadDialog);

      content.appendChild(el('div.online-controls', searchInput, sortSel, refresh, upload));
      content.appendChild(el('div.online-status#online-status', { text: t('common.loading') }));
      content.appendChild(el('div.online-list#online-list'));

      if (!online.loading && !online.levels.length) loadOnline();
      else drawOnlineList();
    }

    function loadOnline() {
      var status = document.getElementById('online-status');
      var list = document.getElementById('online-list');
      if (!status || !list) return;
      online.loading = true;
      status.textContent = t('common.loading');
      status.className = 'online-status';
      list.innerHTML = '';
      GD.net.listLevels({ q: online.q, sort: online.sort, limit: 30 }).then(function (res) {
        online.loading = false;
        if (!status.isConnected) return;
        if (!res.ok) {
          status.textContent = t('online.needServer');
          status.className = 'online-status error';
          return;
        }
        online.levels = (res.data && res.data.levels) || [];
        status.textContent = online.q
          ? online.levels.length + ' × ' + t('common.search')
          : '';
        drawOnlineList();
      });
    }

    function drawOnlineList() {
      var list = document.getElementById('online-list');
      if (!list) return;
      list.innerHTML = '';
      if (!online.levels.length) {
        list.appendChild(el('p.empty-note', { text: t('online.noResults') }));
        return;
      }
      online.levels.forEach(function (meta) {
        var stats = meta.stats || {};
        list.appendChild(el('div.level-card.online-card', { 'data-testid': 'online-card', 'data-level-id': String(meta.id) },
          el('div.level-card-main',
            el('div.level-card-title', { text: meta.name }),
            el('div.level-card-sub', {
              html: t('select.by') + ' ' + esc(meta.author) + ' · ' + starsHtml(meta.difficulty)
            })),
          el('div.level-card-stats',
            el('span.level-stat', { html: '👁 ' + GD.util.formatNumber(stats.views || 0) }),
            el('span.level-stat', { html: '♥ ' + GD.util.formatNumber(stats.likes || 0) }),
            el('span.level-stat', { html: '⬇ ' + GD.util.formatNumber(stats.downloads || 0) }),
            el('span.level-stat', { html: '🏁 ' + GD.util.formatNumber(stats.completions || 0) })),
          el('div.level-actions',
            el('button.btn.btn-small.btn-primary', {
              type: 'button', 'data-testid': 'play-online', text: '▶ ' + t('common.play'),
              onclick: function () { playOnline(meta); }
            }),
            el('button.btn.btn-small.btn-secondary', {
              type: 'button', 'data-testid': 'like-online', text: '♥ ' + t('online.like'),
              onclick: function () { likeOnline(meta, this); }
            })
          )
        ));
      });
    }

    function playOnline(meta) {
      GD.audio.unlock();
      GD.audio.play('click');
      var status = document.getElementById('online-status');
      if (status) { status.textContent = t('common.loading'); status.className = 'online-status'; }
      GD.net.downloadLevel(meta.id).then(function (res) {
        if (!res.ok) {
          ui.toast(t('online.needServer'), 'error');
          if (status) status.textContent = t('online.needServer');
          return;
        }
        try {
          var level = GD.encoding.decode(res.data.code);
          level.serverId = meta.id;
          GD.storage.saveDownload(String(meta.id), { id: meta.id, name: meta.name, code: res.data.code });
          ui.toast(t('online.downloadSuccess'));
          ui.show('game', {
            level: level,
            storageKey: 'online:' + meta.id,
            levelKey: 'online:' + meta.id,
            report: {
              attempt: function () { GD.net.reportEvent(meta.id, 'attempt'); },
              complete: function () { GD.net.reportEvent(meta.id, 'completion'); }
            }
          });
        } catch (e) {
          ui.toast(t('editor.importFailed') + ': ' + e.message, 'error');
        }
      });
    }

    function likeOnline(meta, btn) {
      GD.net.likeLevel(meta.id, 1).then(function (res) {
        if (res.ok) {
          btn.textContent = '♥ ' + t('online.liked');
          btn.disabled = true;
          if (res.data && res.data.likes !== undefined) {
            var stats = (meta.stats = meta.stats || {});
            stats.likes = res.data.likes;
            drawOnlineList();
          }
        } else {
          ui.toast(t('online.needServer'), 'error');
        }
      });
    }

    function uploadDialog() {
      var levels = GD.storage.getCustomLevels();
      if (!levels.length) {
        ui.toast(t('select.noCustom'));
        return;
      }
      var listEl = el('div.upload-list');
      levels.forEach(function (entry) {
        listEl.appendChild(el('button.btn.btn-secondary.upload-pick', {
          type: 'button', 'data-upload-id': entry.id, text: '↑ ' + entry.name,
          onclick: function () { doUpload(entry); }
        }));
      });
      ui.dialog(t('online.chooseLevel'), listEl, [
        { label: t('common.cancel'), cls: 'btn-secondary', onClick: null }
      ]);
    }

    function doUpload(entry) {
      var settings = GD.storage.getSettings();
      closeOverlayFn();
      GD.net.uploadLevel({
        name: entry.name,
        author: settings.nickname || 'Player',
        code: entry.code
      }).then(function (res) {
        if (res.ok) {
          ui.toast(t('online.uploadSuccess') + ' #' + res.data.id);
          if (state.tab === 'online') loadOnline();
        } else {
          ui.toast(t('online.serverError') + ': ' + ((res.data && res.data.error) || res.status), 'error');
        }
      });
    }

    var closeOverlayFn = function () {
      var ov = document.querySelector('.modal-overlay');
      if (ov) ov.remove();
    };

    renderTab();
    return null;
  });

  return {};
});
