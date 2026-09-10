/* Fluência Contábil — diagnóstico da VSL.
   Emite somente dataLayer; GTM mantém consentimento e envio à Meta.
   Inerte enquanto o vídeo estiver oculto ou a gravação não estiver configurada. */
(function () {
  'use strict';
  if (window.FC_VSL_INSTALLED) return;
  var slot = document.getElementById('heroVsl');
  var frame = document.getElementById('heroVslFrame');
  if (!slot || !frame || slot.hidden) return;
  var src = frame.getAttribute('data-src') || '';
  var version = slot.getAttribute('data-vsl-version') || '';
  var duration = Number(slot.getAttribute('data-vsl-duration'));
  var pitch = Number(slot.getAttribute('data-vsl-pitch'));
  if (!src || src.indexOf('__PANDA_ID__') !== -1 || !version ||
      !Number.isFinite(duration) || duration <= 0 ||
      !Number.isFinite(pitch) || pitch <= 0 || pitch >= duration) return;
  var url;
  try { url = new URL(src, window.location.href); } catch (e) { return; }
  if (url.protocol !== 'https:' || !/^player-[a-z0-9-]+\.tv\.pandavideo\.com\.br$/.test(url.hostname)) return;
  var video = url.searchParams.get('v');
  if (!video) return;
  window.FC_VSL_INSTALLED = true;
  var key = 'fc_vsl_session:' + video + ':' + version;
  var sent = {}, intervals = [], playing = false, seeking = false;
  var previousTime = null, previousWall = null, lastKnownTime = null, rate = 1;
  try {
    var saved = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (saved && Array.isArray(saved.intervals) && saved.intervals.length <= 200) {
      intervals = saved.intervals.filter(function (p) {
        return Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) &&
          Number.isFinite(p[1]) && p[0] >= 0 && p[1] > p[0] && p[1] <= duration;
      });
      if (saved.sent && typeof saved.sent === 'object' && !Array.isArray(saved.sent)) sent = saved.sent;
    }
  } catch (e) {}
  function save() {
    try { sessionStorage.setItem(key, JSON.stringify({sent: sent, intervals: intervals})); } catch (e) {}
  }
  function watched() { return intervals.reduce(function (total, p) { return total + p[1] - p[0]; }, 0); }
  function addInterval(start, end) {
    var all = intervals.concat([[start, end]]).sort(function (a, b) { return a[0] - b[0]; });
    var merged = [];
    all.forEach(function (p) {
      var last = merged[merged.length - 1];
      if (last && p[0] <= last[1] + 0.05) last[1] = Math.max(last[1], p[1]);
      else merged.push(p.slice());
    });
    // Em casos extremos, deixar de contar novos fragmentos é preferível a inflar retenção.
    intervals = merged.slice(0, 200);
  }
  function emit(name, currentTime, once) {
    if (once !== false && sent[name]) return;
    if (once !== false) sent[name] = true;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({event: name, content_name: 'assinatura_2026',
      vsl_version: version, video_id: video, video_duration: duration,
      video_position: Math.round(currentTime || 0), watched_seconds: Math.round(watched()),
      watched_percent: Math.min(100, Math.floor(watched() / duration * 100))});
    save();
  }
  function resetSample() { previousTime = null; previousWall = null; }
  function sample(time, canStart) {
    var now = Date.now();
    if (!Number.isFinite(time) || time < 0 || time > duration + 1) { resetSample(); return; }
    time = Math.min(duration, time);
    if (!playing || seeking || document.visibilityState === 'hidden') { resetSample(); return; }
    // Se o play ocorreu com a aba oculta, esperar uma atualização real do player
    // já visível. visibilitychange sozinho não comprova reprodução.
    if (canStart) emit('vsl_start', time);
    if (previousTime !== null) {
      var delta = time - previousTime, elapsed = (now - previousWall) / 1000;
      // Pulos, aba em segundo plano e reprodução repetida não viram minutos assistidos.
      if (delta > 0 && elapsed >= 0 && elapsed <= 5 && delta <= elapsed * rate + 0.6) {
        addInterval(previousTime, time);
        var total = watched();
        [25, 50, 75, 95].forEach(function (mark) {
          if (total + 0.05 >= duration * mark / 100) emit('vsl_' + mark, time);
        });
        if (total >= 30) emit('vsl_30s', time);
        if (total >= 60) emit('vsl_60s', time);
        // Chegada ao pitch exige atravessar o ponto em reprodução, não arrastar a barra.
        if (previousTime < pitch && time >= pitch) emit('vsl_pitch_reached', time);
      }
    }
    previousTime = time; previousWall = now;
  }
  window.addEventListener('message', function (event) {
    if (event.source !== frame.contentWindow || event.origin !== url.origin) return;
    var data = event.data;
    if (!data || typeof data !== 'object' || typeof data.message !== 'string') return;
    var rawTime = data.currentTime;
    var time = typeof rawTime === 'number' || (typeof rawTime === 'string' && rawTime.trim() !== '') ? Number(rawTime) : NaN;
    if (Number.isFinite(time) && time >= 0 && time <= duration + 1) lastKnownTime = Math.min(duration, time);
    if (data.isMutedIndicator === true) { playing = false; resetSample(); return; }
    switch (data.message) {
      case 'panda_play':
        playing = true; seeking = false; resetSample();
        if (document.visibilityState !== 'hidden') emit('vsl_start', lastKnownTime);
        if (Number.isFinite(time)) sample(time);
        break;
      case 'panda_timeupdate': sample(time, true); break;
      case 'panda_pause':
        sample(time); playing = false; resetSample(); emit('vsl_pause', time); break;
      case 'panda_seeking': seeking = true; resetSample(); break;
      case 'panda_seeked': seeking = false; resetSample(); break;
      case 'panda_ended': sample(time); playing = false; resetSample(); save(); break;
      case 'panda_error': playing = false; resetSample(); emit('vsl_error', time); break;
      case 'panda_speed_update':
        var nextRate = Number(data.speed || data.playbackRate);
        if (Number.isFinite(nextRate) && nextRate >= 0.25 && nextRate <= 4) rate = nextRate;
        resetSample(); break;
    }
  });
  document.addEventListener('visibilitychange', function () { resetSample(); save(); });
  document.addEventListener('click', function (event) {
    var button = event.target && event.target.closest ? event.target.closest('[data-fc-vsl-cta]') : null;
    if (button && slot.contains(button)) emit('vsl_cta_click', lastKnownTime);
  });
  window.addEventListener('pagehide', save);
})();
