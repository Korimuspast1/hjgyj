/**
 * UI TESTS — level select: official/custom tabs, online tab with a mocked
 * network transport, navigation into the game screen.
 */
'use strict';
const assert = require('assert');
const { bootGame, q, qa, byTestid, click, waitFor } = require('./helpers.js');

function menuBtn(ctx, action) {
  return q(ctx.document, '.menu-btn[data-action="' + action + '"]');
}

/** Build a mock net transport: routes table { 'GET /api/levels': {...} } */
function mockTransport(routes) {
  return function (url, opts) {
    const method = (opts && opts.method) || 'GET';
    const path = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0];
    const hit = routes[method + ' ' + path];
    if (!hit) {
      return Promise.resolve({
        ok: false, status: 404,
        json: () => Promise.resolve({ error: 'not found: ' + method + ' ' + path })
      });
    }
    let body = typeof hit === 'function' ? hit(url, opts) : hit;
    return Promise.resolve({
      ok: body.__status ? body.__status < 400 : true,
      status: body.__status || 200,
      json: () => Promise.resolve(body)
    });
  };
}

function tinyLevelCode(GD) {
  const lv = GD.level.create('Mock Level', 'Mocker');
  lv.length = 40;
  lv.objects.push({ t: 1, x: 20, y: 0 });
  return GD.encoding.encode(lv);
}

describe('level select', function () {
  let ctx;
  beforeEach(function () {
    ctx = bootGame();
  });

  it('official tab shows 4 level cards with names and progress bars', function () {
    click(menuBtn(ctx, 'play'));
    assert.ok(byTestid(ctx.document, 'tab-official'), 'tab bar');
    const cards = qa(ctx.document, '[data-testid="level-card"]');
    assert.strictEqual(cards.length, 4, 'four official levels');
    const names = cards.map(c => c.querySelector('.level-card-title').textContent);
    assert.deepStrictEqual(names, ['Neon Genesis', 'Circuit Breaker', 'Voltage', 'Hyperdrive']);
    for (const c of cards) assert.ok(c.querySelector('.level-progress'), 'progress bar on every card');
    assert.ok(cards[0].textContent.includes('0%'), 'starts at 0%');
    assert.ok(cards[0].textContent.includes('★'), 'stars shown');
  });

  it('saved progress appears on the official cards', function () {
    ctx.GD.storage.setLevelProgress('official:l1', { best: 0.42, attempts: 7, completed: false });
    click(menuBtn(ctx, 'play'));
    const card = qa(ctx.document, '[data-testid="level-card"]')[0];
    assert.ok(card.textContent.includes('42%'));
    assert.ok(card.textContent.includes('7'), 'attempt count shown');
  });

  it('clicking an official level opens the game screen with HUD', function () {
    click(menuBtn(ctx, 'play'));
    click(qa(ctx.document, '[data-testid="level-card"]')[0]);
    assert.ok(q(ctx.document, '#game-screen'), 'game screen mounted');
    assert.ok(q(ctx.document, '#game-hud'), 'HUD mounted');
    assert.ok(q(ctx.document, '#btn-pause'), 'pause button');
    assert.ok(q(ctx.document, '#hud-progress-text').textContent.includes('%'));
  });

  it('custom tab: empty note, then a saved level appears with edit/delete', function () {
    click(menuBtn(ctx, 'play'));
    click(byTestid(ctx.document, 'tab-custom'));
    assert.ok(ctx.document.body.textContent.includes(ctx.GD.i18n.t('select.noCustom')));

    ctx.GD.storage.saveCustomLevel({ name: 'My First', code: tinyLevelCode(ctx.GD) });
    click(byTestid(ctx.document, 'tab-official'));
    click(byTestid(ctx.document, 'tab-custom'));   // re-render
    const cards = qa(ctx.document, '[data-testid="level-card"]');
    assert.strictEqual(cards.length, 1);
    assert.ok(cards[0].textContent.includes('My First'));
    const actions = qa(cards[0], '.level-actions button');
    assert.strictEqual(actions.length, 2, 'edit + delete actions');
  });

  it('new level button opens the editor', function () {
    click(menuBtn(ctx, 'play'));
    click(byTestid(ctx.document, 'tab-custom'));
    click(byTestid(ctx.document, 'new-level'));
    assert.ok(q(ctx.document, '#editor-screen'), 'editor opened');
  });

  it('back returns to the menu', function () {
    click(menuBtn(ctx, 'play'));
    click(byTestid(ctx.document, 'back'));
    assert.ok(q(ctx.document, '.menu-screen'), 'back on the menu');
  });
});

describe('online tab (mocked transport)', function () {
  let ctx;
  beforeEach(function () {
    ctx = bootGame();
  });

  function openOnline(routes) {
    ctx.GD.net.setTransport(mockTransport(routes));
    click(menuBtn(ctx, 'play'));
    click(byTestid(ctx.document, 'tab-online'));
    return waitFor(() => qa(ctx.document, '[data-testid="online-card"]').length > 0 ||
      q(ctx.document, '#online-status').textContent !== ctx.GD.i18n.t('common.loading'), 3000);
  }

  it('lists online levels with stats and plays one', async function () {
    const code = tinyLevelCode(ctx.GD);
    await openOnline({
      'GET /api/levels': { levels: [
        { id: 1, name: 'Sunrise Run', author: 'Alpha', difficulty: 1, stats: { views: 120, likes: 34, downloads: 12, completions: 5 } },
        { id: 2, name: 'Deep Blue', author: 'Beta', difficulty: 3, stats: { views: 9, likes: 2, downloads: 1, completions: 0 } }
      ] },
      'GET /api/levels/1/download': { id: 1, code: code }
    });
    const cards = qa(ctx.document, '[data-testid="online-card"]');
    assert.strictEqual(cards.length, 2);
    assert.ok(cards[0].textContent.includes('Sunrise Run'));
    assert.ok(cards[0].textContent.includes('120'), 'views shown');

    click(byTestid(cards[0], 'play-online'));
    await waitFor(() => q(ctx.document, '#game-screen'), 3000);
    assert.ok(q(ctx.document, '#game-screen'), 'downloaded level started');
    // saved into downloads for offline replay
    assert.ok(ctx.GD.storage.getDownloads()['1'], 'download persisted');
  });

  it('search box filters via the API query', async function () {
    let seenQuery = '';
    await openOnline({
      'GET /api/levels': (url) => {
        seenQuery = url;
        return { levels: [] };
      }
    });
    assert.ok(q(ctx.document, '#online-status'), 'status area exists');
    const search = byTestid(ctx.document, 'online-search');
    search.value = 'volcano';
    search.dispatchEvent(new ctx.window.Event('change', { bubbles: true }));
    await waitFor(() => seenQuery.includes('volcano'), 3000);
    assert.ok(seenQuery.includes('q=volcano'), 'search term sent: ' + seenQuery);
  });

  it('offline transport shows the need-server message', async function () {
    ctx.GD.net.setTransport(() => Promise.reject(new Error('offline')));
    click(menuBtn(ctx, 'play'));
    click(byTestid(ctx.document, 'tab-online'));
    const status = q(ctx.document, '#online-status');
    await waitFor(() => status.textContent.includes(ctx.GD.i18n.t('online.needServer').split('.')[0]), 4000);
    assert.ok(status.className.includes('error'), 'error styling');
  });

  it('upload flow sends the level code to the server', async function () {
    const saved = ctx.GD.storage.saveCustomLevel({ name: 'UploadMe', code: tinyLevelCode(ctx.GD) });
    let uploaded = null;
    ctx.GD.net.setTransport(mockTransport({
      'GET /api/levels': { levels: [] },
      'POST /api/levels': (url, opts) => {
        uploaded = JSON.parse(opts.body);
        return { id: 77 };
      }
    }));
    click(menuBtn(ctx, 'play'));
    click(byTestid(ctx.document, 'tab-online'));
    await waitFor(() => q(ctx.document, '[data-testid="upload-level"]'), 2000);
    click(byTestid(ctx.document, 'upload-level'));
    const pick = q(ctx.document, '[data-upload-id="' + saved.id + '"]');
    assert.ok(pick, 'own level listed for upload');
    click(pick);
    await waitFor(() => uploaded !== null, 3000);
    assert.strictEqual(uploaded.name, 'UploadMe');
    assert.strictEqual(uploaded.author, 'Player');
    assert.ok(uploaded.code.startsWith('NDL1:'));
    await waitFor(() => q(ctx.document, '.toast'), 2000);
    assert.ok(ctx.document.body.textContent.includes('77'), 'new server id shown');
  });

  it('like button posts a like', async function () {
    let liked = null;
    await openOnline({
      'GET /api/levels': { levels: [
        { id: 5, name: 'Liker', author: 'X', difficulty: 0, stats: {} }
      ] },
      'POST /api/levels/5/like': (url, opts) => { liked = JSON.parse(opts.body); return { likes: 1 }; }
    });
    const card = qa(ctx.document, '[data-testid="online-card"]')[0];
    click(byTestid(card, 'like-online'));
    await waitFor(() => liked !== null, 3000);
    assert.deepStrictEqual(liked, { value: 1 });
  });
});
