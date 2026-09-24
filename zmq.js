/*
 * ZMQ playback repair — 2026-09-24
 * Loon response script; configure requires_body=true.
 * Only rewrites supported playback pages. Unknown layouts pass through unchanged.
 * No eval, remote API calls, URL/atob/btoa dependency in the Loon runtime.
 */
(function () {
  "use strict";
  var URL_GUARD = /^https?:\/\/(?:[a-z0-9-]+\.)*(?:zimuquan|zmqurl|zmqsite)\d*\.(?:top|com|uk)(?::\d+)?\/(?:index\.php\/)?vod\/play\/id\/\d+\/sid\/\d+\/nid\/\d+\.html(?:\?[^#]*)?(?:#.*)?$/i;
  var BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  var MARKER = 'id="zmq-player-repair"';

  function log(message) {
    if (typeof console !== "undefined") console.log("[ZMQ] " + message);
  }

  // Work with binary strings, without requiring browser globals in JavaScriptCore.
  function fromBase64(text) {
    text = text.replace(/\s/g, "").replace(/-/g, "+").replace(/_/g, "/");
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(text) || text.replace(/=/g, "").length % 4 === 1) {
      throw new Error("invalid base64");
    }
    var value = 0, bits = 0, result = [];
    for (var i = 0; i < text.length && text[i] !== "="; i++) {
      value = (value << 6) | BASE64.indexOf(text[i]);
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        result.push(String.fromCharCode((value >>> bits) & 255));
        value &= (1 << bits) - 1;
      }
    }
    return result.join("");
  }

  function toBase64(text) {
    var result = [];
    for (var i = 0; i < text.length; i += 3) {
      var a = text.charCodeAt(i), b = text.charCodeAt(i + 1), c = text.charCodeAt(i + 2);
      result.push(BASE64[a >> 2], BASE64[((a & 3) << 4) | (isNaN(b) ? 0 : b >> 4)],
        isNaN(b) ? "=" : BASE64[((b & 15) << 2) | (isNaN(c) ? 0 : c >> 6)],
        isNaN(c) ? "=" : BASE64[c & 63]);
    }
    return result.join("");
  }

  function utf8Decode(binary) {
    return decodeURIComponent(binary.replace(/[\s\S]/g, function (char) {
      return "%" + ("0" + char.charCodeAt(0).toString(16)).slice(-2);
    }));
  }

  function utf8Encode(text) {
    return encodeURIComponent(text).replace(/%([0-9a-f]{2})/gi, function (_, hex) {
      return String.fromCharCode(parseInt(hex, 16));
    });
  }

  function unescapeHtml(text) {
    return String(text).replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt);/gi, function (all, entity) {
      var names = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">" };
      if (entity[0] !== "#") return names[entity.toLowerCase()];
      var code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      if (code > 0x10ffff || code < 0) return all;
      return code <= 0xffff ? String.fromCharCode(code) :
        String.fromCharCode(0xd800 + ((code - 0x10000) >> 10), 0xdc00 + ((code - 0x10000) & 1023));
    });
  }

  function attr(tag, name) {
    var match = new RegExp("(?:^|\\s)" + name + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s>]+))", "i").exec(tag);
    return match ? unescapeHtml(match[1] !== undefined ? match[1] : match[2] !== undefined ? match[2] : match[3]) : "";
  }

  function hasClass(tag, name) {
    return (" " + attr(tag, "class").replace(/\s+/g, " ") + " ").indexOf(" " + name + " ") >= 0;
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function absoluteUrl(value, pageUrl) {
    if (typeof value !== "string") return "";
    value = unescapeHtml(value).trim();
    if (/[\s<>"\\]/.test(value)) return "";
    var base = /^(https?):\/\/([^/]+)(\/[^?#]*)?/i.exec(pageUrl);
    if (value.slice(0, 2) === "//") value = base[1] + ":" + value;
    else if (value[0] === "/") value = base[1] + "://" + base[2] + value;
    else if (value && !/^[a-z][a-z\d+.-]*:/i.test(value)) {
      value = base[1] + "://" + base[2] + (base[3] || "/").replace(/[^/]*$/, "") + value;
    }
    return /^https?:\/\/[^/?#]+\/[^#]*$/i.test(value) ? value : "";
  }

  function mediaUrl(value, pageUrl) {
    var url = absoluteUrl(value, pageUrl);
    return /\.(?:m3u8|mp4)(?:\?|$)/i.test(url) ? url : "";
  }

  // Keep the complete origin, storage path and query string. Do not assume /video/.
  function sourceFromPoster(poster, pageUrl) {
    var url = absoluteUrl(poster, pageUrl);
    return /\/vod\.(?:jpe?g|png|webp)(?:\?|$)/i.test(url) ?
      url.replace(/\/vod\.(?:jpe?g|png|webp)(?=\?|$)/i, "/index.m3u8") : "";
  }

  // Pair div tags; ignore comments, quoted attributes and raw-text elements.
  function divs(html) {
    var token = /<!--[\s\S]*?-->|<(script|style|textarea|title)\b(?:[^>"']|"[^"]*"|'[^']*')*>[\s\S]*?<\/\1\s*>|<\/?div\b(?:[^>"']|"[^"]*"|'[^']*')*>/ig;
    var stack = [], result = [], match;
    while ((match = token.exec(html))) {
      var tag = match[0];
      if (!/^<\/?div\b/i.test(tag)) continue;
      if (/^<\//.test(tag)) {
        var node = stack.pop();
        if (node) { node.end = token.lastIndex; node.close = match.index; }
      } else {
        var opened = { start: match.index, inner: token.lastIndex, tag: tag, parent: stack[stack.length - 1], end: -1 };
        result.push(opened);
        stack.push(opened);
      }
    }
    return result;
  }

  function playerTarget(html) {
    var nodes = divs(html), i;
    // Both mobile .show_poster and desktop .popup are inside the player shell.
    for (i = 0; i < nodes.length; i++) {
      var node = nodes[i], parent = node.parent;
      if (node.end < 0 || !(hasClass(node.tag, "popup") || hasClass(node.tag, "show_poster"))) continue;
      while (parent) {
        if (hasClass(parent.tag, "container") || hasClass(parent.tag, "play_video")) return node;
        parent = parent.parent;
      }
    }
    for (i = 0; i < nodes.length; i++) {
      if (nodes[i].end > 0 && hasClass(nodes[i].tag, "dplayer")) return nodes[i];
    }
    // Existing mobile player: retain its wrapper and back button.
    for (i = 0; i < nodes.length; i++) {
      if (nodes[i].end > 0 && hasClass(nodes[i].tag, "play_video") &&
          /\bplayer_\w+\s*=/.test(html.slice(nodes[i].inner, nodes[i].close))) return nodes[i];
    }
    return null;
  }

  function currentMedia(html, target, pageUrl) {
    var region = html.slice(target.start, target.end);
    var script = /<script\b[^>]*>\s*(?:(?:var|let|const)\s+)?player_\w+\s*=\s*(\{[\s\S]*?\})\s*;?\s*<\/script>/ig;
    var match, source = "", poster = "";
    // A real player URL takes priority over a cover-derived guess.
    while ((match = script.exec(region))) {
      try {
        var config = JSON.parse(match[1]);
        var candidate = config.url;
        if (String(config.encrypt) === "2") candidate = fromBase64(candidate);
        if (/^[12]$/.test(String(config.encrypt))) candidate = unescape(candidate);
        source = mediaUrl(candidate, pageUrl);
        if (source) return { source: source, poster: absoluteUrl(config.poster || "", pageUrl) };
      } catch (_) {}
    }
    var localMedia = /<(?:video|source)\b(?:[^>"']|"[^"]*"|'[^']*')*>/ig;
    while ((match = localMedia.exec(region))) {
      source = mediaUrl(attr(match[0], "src"), pageUrl);
      if (source) return { source: source, poster: absoluteUrl(attr(match[0], "poster"), pageUrl) };
    }
    // Never take a recommendation card's data-src or a random m3u8 in an advertisement.
    var history = /<(?:span|div)\b(?:[^>"']|"[^"]*"|'[^']*')*>/ig;
    while ((match = history.exec(html))) {
      if (hasClass(match[0], "mac_history_set")) {
        poster = attr(match[0], "data-pic");
        source = sourceFromPoster(poster, pageUrl);
        if (source) return { source: source, poster: absoluteUrl(poster, pageUrl) };
      }
    }
    // Older layouts may only keep the cover on the player placeholder itself.
    poster = attr(target.tag, "data-pic");
    if (!poster) {
      var background = /background-image\s*:\s*url\(\s*(['"]?)(.*?)\1\s*\)/i.exec(attr(target.tag, "style"));
      if (background) poster = background[2];
    }
    source = sourceFromPoster(poster, pageUrl);
    return source ? { source: source, poster: absoluteUrl(poster, pageUrl) } : null;
  }

  // This function runs in the browser, not in Loon.
  function mountPlayer(source) {
    var root = document.getElementById("zmq-player-repair");
    if (!root || root.getAttribute("data-ready")) return;
    root.setAttribute("data-ready", "1");
    var video = root.querySelector("video");
    var status = root.querySelector("[data-status]");
    var retry = root.querySelector("button");
    var instance = null, networkRetries = 0, mediaRetries = 0;
    function message(text) { status.textContent = text; }
    function reset() {
      if (instance) { instance.destroy(); instance = null; }
      networkRetries = 0; mediaRetries = 0; message("");
    }
    function attachHls() {
      retry.disabled = false;
      if (!window.Hls || !window.Hls.isSupported()) {
        message("当前浏览器不支持此视频格式，请用 Safari 或系统播放器打开下方视频地址。");
        return;
      }
      instance = new window.Hls({ enableWorker: true });
      instance.on(window.Hls.Events.ERROR, function (_, data) {
        if (!data.fatal) return;
        if (data.type === window.Hls.ErrorTypes.NETWORK_ERROR && networkRetries++ < 2) instance.startLoad();
        else if (data.type === window.Hls.ErrorTypes.MEDIA_ERROR && mediaRetries++ < 1) instance.recoverMediaError();
        else message("视频加载失败，请重试；也可打开视频地址检查网络或源站状态。");
      });
      instance.loadSource(source);
      instance.attachMedia(video);
    }
    function loadHls(index) {
      // Prefer the site's existing HLS dependency, with a pinned public fallback.
      var libraries = ["/static/player/dplayer/hls.min.js", "https://cdn.jsdelivr.net/npm/hls.js@1.5.18/dist/hls.min.js"];
      if (window.Hls && window.Hls.isSupported()) { attachHls(); return; }
      if (index >= libraries.length) {
        retry.disabled = false;
        message("播放器组件加载失败，请重试或打开视频地址。"); return;
      }
      var element = document.createElement("script");
      element.src = libraries[index];
      var finished = false;
      var timer = setTimeout(next, 8000);
      function next() {
        if (finished) return;
        finished = true; clearTimeout(timer);
        if (element.parentNode) element.parentNode.removeChild(element);
        loadHls(index + 1);
      }
      element.onload = function () {
        if (finished) return;
        if (!window.Hls || !window.Hls.isSupported()) { next(); return; }
        finished = true; clearTimeout(timer); attachHls();
      };
      element.onerror = next;
      document.head.appendChild(element);
    }
    function start() {
      if (retry.disabled) return;
      retry.disabled = true;
      reset();
      if (!/\.m3u8(?:\?|$)/i.test(source) || video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = source;
        video.load();
        retry.disabled = false;
      } else loadHls(0);
    }
    retry.onclick = start;
    video.addEventListener("error", function () {
      message("视频暂时无法加载，请重试或打开视频地址检查。");
    });
    video.addEventListener("loadedmetadata", function () { message(""); });
    start();
  }

  function playerHtml(media) {
    var source = JSON.stringify(media.source).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
    return '<div id="zmq-player-repair" style="position:relative;width:100%;background:#000;color:#fff">' +
      '<video controls playsinline webkit-playsinline preload="metadata" poster="' + escapeHtml(media.poster) +
      '" style="display:block;width:100%;height:auto;aspect-ratio:16/9;background:#000"></video>' +
      '<div style="padding:6px 10px;font-size:12px;line-height:1.5">' +
      '<span data-status role="status"></span> <button type="button">重新加载</button> ' +
      '<a style="color:#8cd5ff" href="' + escapeHtml(media.source) + '" target="_blank" rel="noopener">打开视频地址</a></div>' +
      "<script>(" + mountPlayer.toString() + ")(" + source + ");</script></div>";
  }

  function transform(html, pageUrl) {
    if (html.indexOf(MARKER) >= 0) return html;
    var target = playerTarget(html);
    if (!target) return html;
    var media = currentMedia(html, target, pageUrl);
    if (!media) return html;
    var replacement = playerHtml(media);
    if (hasClass(target.tag, "play_video")) {
      var back = /<i\b[^>]*\bclass\s*=\s*["']back["'][^>]*>[\s\S]*?<\/i>/i.exec(html.slice(target.inner, target.close));
      replacement = target.tag + (back ? back[0] : "") + replacement + "</div>";
    }
    return html.slice(0, target.start) + replacement + html.slice(target.end);
  }

  function rewrite(body, pageUrl) {
    // Decode only literal HTML payloads; never execute code from the response.
    var pattern = /\batob\s*\(\s*(["'])([A-Za-z0-9+/_=\s-]+)\1\s*\)/g;
    var match;
    while ((match = pattern.exec(body))) {
      try {
        var binary = fromBase64(match[2]), html, mode;
        var prefix = body.slice(Math.max(0, match.index - 100), match.index);
        if (/decodeURIComponent\s*\(\s*$/.test(prefix)) {
          mode = "percent"; html = decodeURIComponent(binary);
        } else {
          mode = "utf8"; html = utf8Decode(binary);
        }
        if (!/<(?:html|div|span)\b/i.test(html)) continue;
        var changed = transform(html, pageUrl);
        if (changed === html) continue;
        // Preserve the wrapper's exact encoding contract, including literal % characters.
        var encoded = toBase64(mode === "percent" ? encodeURIComponent(changed) : utf8Encode(changed));
        return body.slice(0, match.index) + 'atob("' + encoded + '")' + body.slice(pattern.lastIndex);
      } catch (_) { /* Not a supported HTML payload; try the next candidate. */ }
    }
    return transform(body, pageUrl);
  }

  var result = {};
  try {
    var request = typeof $request === "undefined" ? {} : $request;
    var response = typeof $response === "undefined" ? {} : $response;
    var url = request.url || "", body = response.body;
    var status = response.status === undefined ? response.statusCode : response.status;
    if (URL_GUARD.test(url) && (status === undefined || Number(status) === 200) && typeof body === "string" && body.length) {
      var updated = rewrite(body, url);
      if (updated !== body) { result = { body: updated }; log("已替换播放区域"); }
      else log("未识别到可修复的播放区域，保留原响应");
    }
  } catch (_) {
    log("解析失败，保留原响应");
  }
  // Loon automatically adjusts transport headers after a body change.
  // An empty object passes the original response through; call $done exactly once.
  $done(result);
})();
