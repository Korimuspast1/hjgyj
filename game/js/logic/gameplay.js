/**
 * Neon Dash — gameplay session.
 *
 * Wraps the pure physics simulation with attempt/death/respawn management,
 * progress tracking, persistent stats and event dispatch to the UI layer.
 * Rendering-agnostic: the same session drives the on-screen game, the
 * editor's "Test" mode and the headless verification bot.
 */
/* global GD */
GD.register('gameplay', function (GD) {
  'use strict';

  var DEATH_DELAY = 0.55;   // seconds from death to instant respawn

  function GameSession(level, opts) {
    opts = opts || {};
    this.level = level;
    this.index = GD.level.buildIndex(level);
    this.onEvent = opts.onEvent || null;   // callback(ev, session)
    this.storageKey = opts.storageKey || null;
    this.report = opts.report || null;     // {attempt(levelKey), complete(levelKey)} — online stats
    this.levelKey = opts.levelKey || ('official:' + level.name);

    this.attempt = 0;
    this.best = 0;
    this.completed = false;
    this.mode = 'playing';                  // playing | dead | finished
    this.deathTimer = 0;
    this.time = 0;
    this.input = { held: false, buffer: 0 };
    this.events = [];                       // events from the current frame

    if (this.storageKey) {
      var prog = GD.storage.getProgress()[this.storageKey];
      if (prog) {
        this.best = prog.best || 0;
        this.attempt = prog.attempts || 0;
        this.completed = !!prog.completed;
      }
    }

    this.resetAttempt(true);
  }

  GameSession.prototype.resetAttempt = function (first) {
    this.state = GD.physics.createState();
    this.state.x = 0;
    if (!first) this.attempt++;
    this.mode = 'playing';
    this.deathTimer = 0;
    this.input.held = false;
    this.input.buffer = 0;
    if (this.report && this.report.attempt) {
      try { this.report.attempt(this.levelKey); } catch (e) { /* network never blocks gameplay */ }
    }
  };

  GameSession.prototype.press = function () {
    this.input.held = true;
    this.input.buffer = GD.physics.ORB_BUFFER;
  };

  GameSession.prototype.release = function () {
    this.input.held = false;
  };

  GameSession.prototype.update = function (dt) {
    this.events = [];
    if (this.mode === 'dead') {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) this.resetAttempt(false);
      return this.events;
    }
    if (this.mode === 'finished') return this.events;

    this.time += dt;
    var evs = GD.physics.step(this.state, this.level, this.index, dt, this.input);
    for (var i = 0; i < evs.length; i++) {
      var ev = evs[i];
      this.events.push(ev);
      if (ev.type === 'death') {
        this.mode = 'dead';
        this.deathTimer = DEATH_DELAY;
        this._recordProgress();
      } else if (ev.type === 'finish') {
        this.mode = 'finished';
        this.best = 1;
        this.completed = true;
        this._recordProgress();
        if (this.report && this.report.complete) {
          try { this.report.complete(this.levelKey); } catch (e) { /* ignore */ }
        }
      }
      if (this.onEvent) this.onEvent(ev, this);
    }
    // Track best progress
    if (this.state.progress > this.best && this.mode === 'playing') {
      this.best = this.state.progress;
    }
    return this.events;
  };

  GameSession.prototype._recordProgress = function () {
    if (!this.storageKey) return;
    var best = Math.max(this.best, this.state.progress);
    GD.storage.setLevelProgress(this.storageKey, {
      best: Math.round(best * 1000) / 1000,
      attempts: this.attempt + 1,   // the in-flight attempt counts (attempt 0 = 1st try)
      completed: this.completed
    });
  };

  GameSession.prototype.progressPercent = function () {
    return Math.round(this.state.progress * 100);
  };

  return { GameSession: GameSession, DEATH_DELAY: DEATH_DELAY };
});
