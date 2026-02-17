// Wiki page — fetches game config from server and renders dynamic values
// so the wiki is always in sync with actual game balance.

let config = null;
let currentDifficulty = 'medium';

document.addEventListener('DOMContentLoaded', init);

async function init() {
  try {
    const res = await fetch('/api/wiki-config');
    config = await res.json();
    showDifficultySelector();
    render();
  } catch (err) {
    console.error('Failed to load wiki config:', err);
  }
}

function showDifficultySelector() {
  const el = document.getElementById('difficulty-selector');
  if (el) el.hidden = false;

  document.querySelectorAll('[data-difficulty]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentDifficulty = btn.dataset.difficulty;
      document.querySelectorAll('[data-difficulty]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      render();
    });
  });
}

// ── Helpers ──

function ms(val) { return val / 1000; }

function sec(val) {
  const s = ms(val);
  return s % 1 === 0 ? String(s) : s.toFixed(1);
}

function pct(val) { return Math.round(val * 100) + '%'; }

function setStats(id, lines) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = lines.map(l => '<div class="stat">' + l + '</div>').join('');
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(val);
}

function setHtml(id, val) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = val;
}

// ── Main render ──

function render() {
  if (!config) return;
  const d = config.difficulties[currentDifficulty];
  const m = config.mechanics;

  renderBugTypes(d, m);
  renderBoss(d, m);
  renderPowerups(d, m);
  renderMechanics(d, m);
}

// ── Bug Types ──

function renderBugTypes(d, m) {
  // Normal Bug
  setStats('normal-bug-stats', [
    '\u26A1 Click to squash',
    '\uD83D\uDCB0 ' + d.bugPoints + ' points',
    '\uD83D\uDC94 ' + d.hpDamage + ' HP damage if escaped',
  ]);
  setText('normal-escape-times',
    sec(d.levels[1].escapeTime) + 's \u2192 ' +
    sec(d.levels[2].escapeTime) + 's \u2192 ' +
    sec(d.levels[3].escapeTime) + 's');

  // Heisenbug
  setText('heisenbug-badge', pct(d.specialBugs.heisenbugChance) + ' spawn chance');
  var heisenPoints = d.bugPoints * m.heisenbug.pointsMultiplier;
  var heisenFasterPct = Math.round((1 - m.heisenbug.escapeTimeMultiplier) * 100);
  setStats('heisenbug-stats', [
    '\uD83C\uDFC3 Flees when clicked (' + m.heisenbug.maxFlees + 'x max)',
    '\uD83D\uDCB0 ' + heisenPoints + ' points (' + m.heisenbug.pointsMultiplier + 'x multiplier)',
    '\u23F1\uFE0F ' + heisenFasterPct + '% faster escape time',
  ]);
  setText('heisenbug-catches', m.heisenbug.maxFlees + 1);
  setText('heisenbug-multiplier-word', m.heisenbug.pointsMultiplier === 3 ? 'triple' : m.heisenbug.pointsMultiplier + 'x');
  setText('heisenbug-faster', heisenFasterPct + '%');

  // Feature Bug
  setText('feature-badge',
    pct(d.specialBugs.codeReviewChance) + ' spawn chance (Level ' + d.specialBugs.codeReviewStartLevel + '+)');
  setStats('feature-stats', [
    '\u26A1 Click to squash',
    '\uD83D\uDCB0 ' + d.bugPoints + ' points',
    '\u2764\uFE0F No HP damage if escaped',
  ]);
  setText('feature-penalty', m.feature.hpPenalty);
  setText('feature-start-level', d.specialBugs.codeReviewStartLevel);

  // Memory Leak
  setText('memory-leak-badge', pct(d.specialBugs.memoryLeakChance) + ' spawn chance');
  var holdMin = sec(m.memoryLeak.holdTimeByStage[0]);
  var holdMax = sec(m.memoryLeak.holdTimeByStage[m.memoryLeak.holdTimeByStage.length - 1]);
  var slowerPct = Math.round((m.memoryLeak.escapeTimeMultiplier - 1) * 100);
  var pointsDesc = m.memoryLeak.pointsByStage.slice().reverse().join('\u2192');
  var damageDesc = m.memoryLeak.damageByStage.join('\u2192');
  setStats('memory-leak-stats', [
    '\uD83D\uDDB1\uFE0F Click & HOLD to clear (' + holdMin + '-' + holdMax + 's)',
    '\uD83D\uDC65 Multiple holders = faster progress!',
    '\uD83D\uDCC8 Grows while being held!',
    '\uD83D\uDCB0 ' + pointsDesc + ' points (start early!)',
    '\uD83D\uDC94 ' + damageDesc + ' HP damage (stage-based)',
    '\u23F1\uFE0F ' + slowerPct + '% slower escape time',
  ]);
  var holdTimesDesc = m.memoryLeak.holdTimeByStage.map(function(t) { return sec(t) + 's'; }).join('/');
  setText('memory-leak-growth-interval', ms(m.memoryLeak.growthInterval));
  setText('memory-leak-hold-times', holdTimesDesc);

  // Merge Conflict
  setText('merge-conflict-badge',
    pct(d.specialBugs.mergeConflictChance) + ' spawn chance (' + m.mergeConflict.minPlayers + '+ players)');
  var mcDamage = d.hpDamage * 2;
  setStats('merge-conflict-stats', [
    '\uD83D\uDC65 Spawns in pairs',
    '\uD83D\uDCB0 ' + m.mergeConflict.bonusPoints + ' bonus points if resolved',
    '\uD83D\uDC94\uD83D\uDC94 ' + mcDamage + ' HP damage if both escape',
    '\u23F1\uFE0F ' + sec(m.mergeConflict.resolveWindow) + ' second resolve window',
  ]);
  setText('merge-conflict-window', sec(m.mergeConflict.resolveWindow));
  setText('merge-conflict-damage', mcDamage);

  // Pipeline Bug
  setText('pipeline-badge',
    pct(d.specialBugs.pipelineBugChance) + ' spawn chance (Level ' + d.specialBugs.pipelineBugStartLevel + '+)');
  setStats('pipeline-stats', [
    '\uD83D\uDC0D Spawns in chains of ' + m.pipeline.minChainLength + '-' + m.pipeline.maxChainLength + ' bugs',
    '\uD83D\uDD22 Must squash in order (1\u21922\u21923\u2192...)',
    '\uD83D\uDCB0 ' + m.pipeline.pointsPerBug + ' points per bug + ' + m.pipeline.chainBonus + ' chain bonus',
    '\uD83D\uDC94 ' + d.hpDamage + ' HP per bug if chain escapes',
    '\u23F1\uFE0F ' + m.pipeline.escapeTimeMultiplier + 'x escape time',
  ]);
  setText('pipeline-bonus', m.pipeline.chainBonus);

  // Infinite Loop
  setText('infinite-loop-badge',
    pct(d.specialBugs.infiniteLoopChance) + ' spawn chance (Level ' + d.specialBugs.infiniteLoopStartLevel + '+)');
  setStats('infinite-loop-stats', [
    '\uD83D\uDD04 Orbits in an elliptical loop',
    '\uD83D\uDEAB Invulnerable to direct clicks',
    '\uD83D\uDD34 Click the red breakpoint as bug passes through',
    '\uD83D\uDCB0 ' + m.infiniteLoop.points + ' points',
    '\u23F1\uFE0F ' + m.infiniteLoop.escapeTimeMultiplier + 'x escape time',
  ]);

  // Boss Minion
  setStats('boss-minion-stats', [
    '\u26A1 Click to squash',
    '\uD83D\uDCB0 ' + d.bugPoints + ' points',
    '\uD83D\uDC94 ' + d.hpDamage + ' HP damage if escaped',
    '\u23F1\uFE0F ' + sec(d.boss.minionEscapeTime) + ' second escape time',
  ]);
}

// ── Boss ──

function renderBoss(d, m) {
  setStats('boss-stats', [
    '\u2764\uFE0F ' + d.boss.hp + ' HP (+' + m.bossHpPerExtraPlayer + ' per extra player)',
    '\uD83D\uDCA5 ' + d.boss.clickDamage + ' damage per click',
    '\uD83D\uDCB0 ' + d.boss.clickPoints + ' points per click',
    '\uD83C\uDFC6 ' + d.boss.killBonus + ' bonus points for killing',
    '\u23F1\uFE0F ' + d.boss.timeLimit + ' second time limit',
    '\uD83D\uDD04 Regenerates ' + d.boss.regenPerSecond + ' HP/s (+' + m.bossRegenPerExtraPlayer + ' per extra player)',
  ]);

  // Boss phases
  var bp = d.boss.bossPhases;
  var escalationHtml = d.boss.escalation.map(function(e) {
    return '<li>At ' + e.timeRemaining + 's: Spawn rate ' + sec(e.spawnRate) + 's, max ' + e.maxOnScreen + ' minions</li>';
  }).join('');
  setHtml('boss-phases', '' +
    '<div class="phase">' +
      '<strong>\uD83C\uDFC3 Phase 1: The Sprint (100% \u2192 ' + pct(bp.phase2Threshold) + ' HP)</strong>' +
      '<ul>' +
        '<li>Standard mechanics \u2014 boss wanders, minions spawn</li>' +
        '<li>Boss fully visible and clickable at all times</li>' +
        '<li>Regen: ' + d.boss.regenPerSecond + ' HP/s</li>' +
      '</ul>' +
    '</div>' +
    '<div class="phase">' +
      '<strong>\uD83D\uDEE1\uFE0F Phase 2: The Shield (' + pct(bp.phase2Threshold) + ' \u2192 ' + pct(bp.phase3Threshold) + ' HP)</strong>' +
      '<ul>' +
        '<li>Boss gains a shield: ' + sec(bp.shieldInterval) + 's vulnerable \u2192 ' + sec(bp.shieldDuration) + 's shielded (repeating)</li>' +
        '<li>Clicks deal 0 damage during shield</li>' +
        '<li>Regen doubles while shielded</li>' +
        '<li>Faster wander (' + sec(bp.phase2WanderInterval) + 's interval)</li>' +
        '<li>Minion spawn rate ' + bp.phase2SpawnRateMultiplier + 'x faster</li>' +
      '</ul>' +
    '</div>' +
    '<div class="phase">' +
      '<strong>\uD83D\uDC1B Phase 3: The Swarm (' + pct(bp.phase3Threshold) + ' \u2192 0% HP)</strong>' +
      '<ul>' +
        '<li>Boss anchors to center and shrinks</li>' +
        '<li>Regen stops entirely</li>' +
        '<li>Minion spawn rate ' + bp.phase3SpawnRateMultiplier + 'x faster, ' + bp.phase3MaxOnScreenMultiplier + 'x max on screen</li>' +
        '<li>Screen wipe every ' + sec(bp.screenWipeInterval) + 's (' + bp.screenWipeBugCount + ' minions in a line)</li>' +
        '<li>Swarm armor: each minion blocks ' + pct(bp.phase3DamageReductionPerMinion) + ' damage (max ' + pct(bp.phase3MaxDamageReduction) + ')</li>' +
        '<li>Time reduced by ' + pct(bp.phase3TimeReduction) + ' on phase entry</li>' +
      '</ul>' +
    '</div>' +
    '<div class="phase">' +
      '<strong>\u26A1 Escalation (time-based)</strong>' +
      '<ul>' + escalationHtml + '</ul>' +
    '</div>' +
    '<div class="phase">' +
      '<strong>\u23F3 Phase Transitions</strong>' +
      '<ul>' +
        '<li>' + sec(bp.transitionInvulnTime) + 's invulnerability during transitions</li>' +
        '<li>All active minions cleared on phase change</li>' +
      '</ul>' +
    '</div>');

  setText('boss-time-limit', d.boss.timeLimit);
}

// ── Powerups ──

function renderPowerups(d, m) {
  // Rubber Duck
  setStats('rubber-duck-stats', [
    '\uD83D\uDCB0 ' + d.powerups.rubberDuckPoints + ' points on collection',
    '\u2728 ' + d.powerups.rubberDuckPointsMultiplier + 'x points buff for ' + sec(d.powerups.rubberDuckBuffDuration) + ' seconds',
    '\u23F1\uFE0F Spawns every ' + sec(d.powerups.rubberDuckIntervalMin) + '-' + sec(d.powerups.rubberDuckIntervalMax) + ' seconds',
    '\u231B Despawns after ' + sec(d.powerups.rubberDuckDespawnTime) + ' seconds',
  ]);
  var duckMultWord = d.powerups.rubberDuckPointsMultiplier === 2 ? 'doubles' : d.powerups.rubberDuckPointsMultiplier + 'x';
  setText('duck-buff-multiplier', duckMultWord);
  setText('duck-buff-duration', sec(d.powerups.rubberDuckBuffDuration));

  // Hotfix Hammer
  setStats('hotfix-hammer-stats', [
    '\uD83D\uDCB0 ' + d.powerups.hotfixHammerPoints + ' points on collection',
    '\uD83D\uDCA5 Stuns all bugs and boss for ' + sec(d.powerups.hotfixHammerStunDuration) + ' seconds',
    '\u23F1\uFE0F Spawns every ' + sec(d.powerups.hotfixHammerIntervalMin) + '-' + sec(d.powerups.hotfixHammerIntervalMax) + ' seconds',
    '\u231B Despawns after ' + sec(d.powerups.hotfixHammerDespawnTime) + ' seconds',
  ]);
  setText('hammer-stun-duration', sec(d.powerups.hotfixHammerStunDuration));
}

// ── Game Mechanics ──

function renderMechanics(d, m) {
  // Levels
  setHtml('levels-card', '' +
    '<h3>\uD83D\uDCCA Levels</h3>' +
    '<p><strong>Level 1:</strong> ' + d.levels[1].bugsTotal + ' bugs, ' + sec(d.levels[1].escapeTime) + 's escape, max ' + d.levels[1].maxOnScreen + ' on screen</p>' +
    '<p><strong>Level 2:</strong> ' + d.levels[2].bugsTotal + ' bugs, ' + sec(d.levels[2].escapeTime) + 's escape, max ' + d.levels[2].maxOnScreen + ' on screen</p>' +
    '<p><strong>Level 3:</strong> ' + d.levels[3].bugsTotal + ' bugs, ' + sec(d.levels[3].escapeTime) + 's escape, max ' + d.levels[3].maxOnScreen + ' on screen</p>' +
    '<p><strong>Boss:</strong> Appears after completing all 3 levels</p>');

  // Health System
  var memDamage = m.memoryLeak.damageByStage.map(function(v) { return v; }).join('/');
  setHtml('health-card', '' +
    '<h3>\u2764\uFE0F Health System</h3>' +
    '<p><strong>Starting HP:</strong> ' + d.startingHp + '</p>' +
    '<p><strong>Bug escape:</strong> -' + d.hpDamage + ' HP</p>' +
    '<p><strong>Memory leak escape:</strong> -' + memDamage + ' HP (stage-based)</p>' +
    '<p><strong>Merge conflict escape:</strong> -' + (d.hpDamage * 2) + ' HP</p>' +
    '<p><strong>Pipeline chain escape:</strong> -' + d.hpDamage + ' HP per bug</p>' +
    '<p><strong>Feature bug clicked:</strong> -' + m.feature.hpPenalty + ' HP</p>' +
    '<p><strong>Game Over:</strong> When HP reaches 0</p>');

  // Multiplayer (mostly static)
  setHtml('multiplayer-card', '' +
    '<h3>\uD83D\uDC65 Multiplayer</h3>' +
    '<p><strong>Players:</strong> 2-8 per lobby</p>' +
    '<p><strong>Boss scaling:</strong> +' + m.bossHpPerExtraPlayer + ' HP per extra player</p>' +
    '<p><strong>Cooperation:</strong> Share HP and solve merge conflicts together</p>' +
    '<p><strong>Competition:</strong> Individual scores and leaderboard</p>');

  // Scoring
  var heisenPts = d.bugPoints * m.heisenbug.pointsMultiplier;
  var memPts = m.memoryLeak.pointsByStage.slice().reverse().join('/');
  setHtml('scoring-card', '' +
    '<h3>\uD83C\uDFAF Scoring</h3>' +
    '<p><strong>Normal bug:</strong> ' + d.bugPoints + ' points</p>' +
    '<p><strong>Heisenbug:</strong> ' + heisenPts + ' points (' + m.heisenbug.pointsMultiplier + 'x)</p>' +
    '<p><strong>Memory leak:</strong> ' + memPts + ' points (earlier = better)</p>' +
    '<p><strong>Merge conflict resolved:</strong> +' + m.mergeConflict.bonusPoints + ' bonus</p>' +
    '<p><strong>Pipeline bug:</strong> ' + m.pipeline.pointsPerBug + ' points each + ' + m.pipeline.chainBonus + ' chain bonus</p>' +
    '<p><strong>Infinite loop:</strong> ' + m.infiniteLoop.points + ' points</p>' +
    '<p><strong>Rubber duck:</strong> ' + d.powerups.rubberDuckPoints + ' points + ' + d.powerups.rubberDuckPointsMultiplier + 'x buff</p>' +
    '<p><strong>Hotfix hammer:</strong> ' + d.powerups.hotfixHammerPoints + ' points + stun</p>' +
    '<p><strong>Boss click:</strong> ' + d.boss.clickPoints + ' points</p>' +
    '<p><strong>Boss defeated:</strong> ' + d.boss.killBonus + ' bonus</p>' +
    '<p><strong>Level cleared:</strong> +100 XP</p>' +
    '<p style="margin-top:8px;"><em>All scores are multiplied by the difficulty multiplier (see below).</em></p>');

  // Difficulty Multipliers
  var allDiffs = config.difficulties;
  var diffLines = Object.keys(allDiffs).map(function(key) {
    var label = key.charAt(0).toUpperCase() + key.slice(1);
    var isDefault = key === 'medium' ? ' (default)' : '';
    var marker = key === currentDifficulty ? ' \u25C4' : '';
    return '<p><strong>' + label + ':</strong> ' + allDiffs[key].scoreMultiplier + 'x score' + isDefault + marker + '</p>';
  }).join('');
  var exBug = d.bugPoints;
  setHtml('difficulty-card', '' +
    '<h3>\uD83C\uDF9A\uFE0F Difficulty Multipliers</h3>' +
    '<p>All point rewards are scaled by a multiplier based on the selected difficulty:</p>' +
    diffLines +
    '<p style="margin-top:8px;"><em>Example: A ' + exBug + '-point bug is worth ' +
      Math.round(exBug * allDiffs.easy.scoreMultiplier) + ' on Easy, ' +
      Math.round(exBug * allDiffs.medium.scoreMultiplier) + ' on Medium, and ' +
      Math.round(exBug * allDiffs.hard.scoreMultiplier) + ' on Hard. This applies to all scoring \u2014 bugs, powerups, boss clicks, and bonuses.</em></p>');
}
