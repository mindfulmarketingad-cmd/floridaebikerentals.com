/* Florida Ebike Rentals - front-end behaviour.
   Vanilla JS, no third-party libraries, no innerHTML for data that came from the
   Outscraper import or from the URL bar: every dynamic string is written with
   textContent / setAttribute so scraped copy can never become markup. */
(function () {
  "use strict";

  var d = document;
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  d.documentElement.classList.remove("no-js");

  function $(sel, root) { return (root || d).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || d).querySelectorAll(sel)); }
  function el(tag, cls, text) {
    var node = d.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }
  function num(v) { return typeof v === "number" && isFinite(v) ? v : null; }

  /* ---------------------------------------------------------------- nav */
  // Header dropdowns: the arrow button opens the menu on touch screens and in the mobile menu.
  $$(".nav-drop__toggle").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var open = btn.parentNode.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
  });
  d.addEventListener("click", function (e) {
    $$(".nav-drop.is-open").forEach(function (li) {
      if (!li.contains(e.target)) { li.classList.remove("is-open"); $(".nav-drop__toggle", li).setAttribute("aria-expanded", "false"); }
    });
  });
  // Quick Book Now forms on content pages: no past days.
  $$(".quick-rent input[type=date]").forEach(function (inp) {
    var t = new Date();
    inp.min = t.getFullYear() + "-" + ("0" + (t.getMonth() + 1)).slice(-2) + "-" + ("0" + t.getDate()).slice(-2);
  });
  var navToggle = $(".nav-toggle");
  var nav = $("#site-nav");
  if (navToggle && nav) {
    navToggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    d.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("is-open")) {
        nav.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
        navToggle.focus();
      }
    });
  }

  /* ------------------------------------------------ promo banner */
  var promo = $("[data-promo]");
  if (promo) {
    var PROMO_KEY = "fer:promo-dismissed";
    try {
      if (window.sessionStorage.getItem(PROMO_KEY) === "1") promo.hidden = true;
    } catch (err) { /* private mode: just show it */ }

    var promoClose = $("[data-promo-close]", promo);
    if (promoClose) {
      promoClose.addEventListener("click", function () {
        promo.hidden = true;
        // Session-scoped, so the offer returns on the visitor's next visit.
        try { window.sessionStorage.setItem(PROMO_KEY, "1"); } catch (err) { /* nothing to do */ }
      });
    }
  }

  /* ------------------------------------------ promo banner rotation */
  /* Several offers share the strip and take turns. The markup already holds
     them all, so this only moves the is-current flag around. */
  $$("[data-promo-rotate]").forEach(function (strip) {
    var slides = $$(".promo__link", strip);
    if (slides.length < 2) return;
    var every = parseInt(strip.getAttribute("data-promo-rotate"), 10) || 7000;
    var at = 0;
    var timer = null;

    var deck = $(".promo__deck", strip) || strip;
    var SLIDE_MS = 600;

    function show(next) {
      if (next === at) return;
      var outgoing = slides[at];
      var incoming = slides[next];

      // The incoming offer is already parked off-stage to the right, so giving
      // it is-current is what slides it in; the outgoing one leaves to the left.
      outgoing.classList.remove("is-current");
      outgoing.classList.add("is-leaving");
      outgoing.setAttribute("aria-hidden", "true");
      outgoing.setAttribute("tabindex", "-1");
      incoming.classList.add("is-current");
      incoming.removeAttribute("aria-hidden");
      incoming.removeAttribute("tabindex");
      at = next;

      // Once it is out of sight, send it back to the starting side without
      // animating, ready for its next turn.
      window.setTimeout(function () {
        deck.classList.add("is-still");
        outgoing.classList.remove("is-leaving");
        // Read a layout value so the browser applies the reset before the
        // transition comes back, rather than collapsing the two into one frame.
        void deck.offsetWidth;
        deck.classList.remove("is-still");
      }, SLIDE_MS);
    }

    function start() {
      if (timer) return;
      timer = window.setInterval(function () { show((at + 1) % slides.length); }, every);
    }
    function stop() {
      if (!timer) return;
      window.clearInterval(timer);
      timer = null;
    }

    // Hold still while someone is reading or tabbing through the offers, and
    // while the tab is in the background, where the turns would be wasted.
    // Hover is watched on the offers themselves, not the whole strip: the strip
    // runs the full width of the window, so a cursor resting anywhere along the
    // top edge would otherwise freeze the rotation for the rest of the visit.
    var hoverTarget = $(".promo__deck", strip) || strip;
    hoverTarget.addEventListener("mouseenter", stop);
    hoverTarget.addEventListener("mouseleave", start);
    strip.addEventListener("focusin", stop);
    strip.addEventListener("focusout", start);
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop(); else start();
    });
    start();
  });

  /* ------------------------------------------------- image fallbacks */
  $$("img[data-fallback]").forEach(function (img) {
    img.addEventListener("error", function () {
      var wrap = img.parentNode;
      img.remove();
      if (wrap && !wrap.querySelector(".media-fallback")) {
        wrap.classList.add("media-fallback");
      }
    }, { once: true });
  });

  /* ------------------------------------------ listicle reveal + drift */
  var items = $$(".listicle__item");
  if (items.length) {
    if (!("IntersectionObserver" in window) || reduceMotion) {
      items.forEach(function (i) { i.classList.add("is-visible"); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var i = items.indexOf(entry.target);
          entry.target.style.transitionDelay = Math.min(i % 4, 3) * 70 + "ms";
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
      items.forEach(function (i) { io.observe(i); });

      /* Bubbly parallax: media panel and rank badge drift as the card passes. */
      var parallaxTargets = items.map(function (item) {
        return { item: item, media: $(".listicle__media img", item), rank: $(".listicle__rank", item) };
      }).filter(function (t) { return t.media || t.rank; });

      var ticking = false;
      var onScroll = function () {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(function () {
          var vh = window.innerHeight || 800;
          parallaxTargets.forEach(function (t) {
            var rect = t.item.getBoundingClientRect();
            if (rect.bottom < -200 || rect.top > vh + 200) return;
            var progress = (rect.top + rect.height / 2 - vh / 2) / vh; /* -1 .. 1 */
            if (t.media) t.media.style.transform = "translate3d(0," + (progress * -14).toFixed(2) + "px,0) scale(1.08)";
            if (t.rank) t.rank.style.transform = "translate3d(0," + (progress * 8).toFixed(2) + "px,0)";
          });
          ticking = false;
        });
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll, { passive: true });
      onScroll();
    }
  }

  /* ------------------------------------------------ generic carousels */
  $$("[data-carousel]").forEach(function (root) {
    var track = $(".carousel__track", root);
    var prev = $("[data-carousel-prev]", root);
    var next = $("[data-carousel-next]", root);
    if (!track) return;
    function step() {
      var first = track.firstElementChild;
      return first ? first.getBoundingClientRect().width + 14 : 280;
    }
    function sync() {
      var max = track.scrollWidth - track.clientWidth - 2;
      if (prev) prev.disabled = track.scrollLeft <= 2;
      if (next) next.disabled = track.scrollLeft >= max;
    }
    if (prev) prev.addEventListener("click", function () { track.scrollBy({ left: -step() * 1.5, behavior: reduceMotion ? "auto" : "smooth" }); });
    if (next) next.addEventListener("click", function () { track.scrollBy({ left: step() * 1.5, behavior: reduceMotion ? "auto" : "smooth" }); });
    track.addEventListener("scroll", function () { window.requestAnimationFrame(sync); }, { passive: true });
    window.addEventListener("resize", sync, { passive: true });
    sync();
  });

  /* ------------------------------------------------------- data store */
  var dataPromise = null;
  function listings() {
    if (!dataPromise) {
      var src = d.body.getAttribute("data-index") || "/data/listings.json";
      dataPromise = fetch(src, { credentials: "omit" })
        .then(function (r) { return r.ok ? r.json() : { listings: [] }; })
        .then(function (json) { return Array.isArray(json.listings) ? json.listings : []; })
        .catch(function () { return []; });
    }
    return dataPromise;
  }

  function milesBetween(lat1, lon1, lat2, lon2) {
    var R = 3958.76, rad = Math.PI / 180;
    var dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  function starRow(rating) {
    var wrap = el("span", "stars");
    wrap.setAttribute("aria-hidden", "true");
    for (var i = 1; i <= 5; i++) {
      var svg = d.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 20 20");
      svg.setAttribute("width", "16"); svg.setAttribute("height", "16");
      var path = d.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", "M10 1.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.6 7.7l5.8-.8z");
      path.setAttribute("fill", rating >= i - 0.25 ? "currentColor" : "#dbe3f5");
      svg.appendChild(path);
      wrap.appendChild(svg);
    }
    return wrap;
  }

  function slideFor(item, distance) {
    var a = el("a", "slide");
    a.href = item.url;
    var media = el("span", "slide__media");
    if (item.photo) {
      var img = d.createElement("img");
      img.src = item.photo;
      img.alt = item.name + " in " + (item.city || "Florida");
      img.loading = "lazy"; img.decoding = "async"; img.referrerPolicy = "no-referrer";
      img.addEventListener("error", function () { img.remove(); }, { once: true });
      media.appendChild(img);
    }
    if (distance != null) media.appendChild(el("span", "slide__badge", distance.toFixed(distance < 10 ? 1 : 0) + " mi away"));
    else if (item.rating >= 4.8) media.appendChild(el("span", "slide__badge", "Top rated"));
    a.appendChild(media);

    var body = el("span", "slide__body");
    body.appendChild(el("span", "slide__name", item.name));
    var meta = el("span", "slide__meta");
    meta.textContent = [item.city, item.region].filter(Boolean).join(" · ");
    body.appendChild(meta);
    if (item.rating) {
      var rating = el("span", "rating");
      rating.appendChild(starRow(item.rating));
      rating.appendChild(el("span", null, item.rating.toFixed(1)));
      rating.appendChild(el("span", "rating__count", "(" + item.reviews + ")"));
      body.appendChild(rating);
    }
    body.appendChild(el("span", "slide__foot", "View details"));
    a.appendChild(body);
    return a;
  }

  /* --------------------------------------------------- "near me" hero */
  var nearRoot = $("[data-near-me]");
  if (nearRoot) {
    var track = $(".carousel__track", nearRoot);
    var label = $("[data-near-label]", nearRoot);
    var button = $("[data-near-button]", nearRoot);
    var DISMISS_KEY = "fer:geo-dismissed";

    var remember = function (value) {
      try { window.sessionStorage.setItem(DISMISS_KEY, value); } catch (err) { /* private mode */ }
    };
    var wasDismissed = function () {
      try { return window.sessionStorage.getItem(DISMISS_KEY) === "1"; } catch (err) { return false; }
    };

    var render = function (rows, withDistance) {
      if (!track) return;
      track.textContent = "";
      rows.forEach(function (row) { track.appendChild(slideFor(row, withDistance ? row._d : null)); });
    };

    var showNearest = function (pos) {
      listings().then(function (rows) {
        var lat = pos.coords.latitude, lng = pos.coords.longitude;
        var scored = rows.filter(function (r) { return num(r.lat) !== null && num(r.lng) !== null; })
          .map(function (r) { r._d = milesBetween(lat, lng, r.lat, r.lng); return r; })
          .sort(function (a, b) { return a._d - b._d; })
          .slice(0, 12);
        if (!scored.length) { if (label) label.textContent = "No listings matched your location"; return; }
        if (label) label.textContent = "Closest e-bike rentals to you";
        if (button) button.hidden = true;
        remember("0");
        render(scored, true);
      });
    };

    var failed = function (auto) {
      return function (error) {
        // A denial or a dismissed prompt should not be re-asked on every page.
        if (!error || error.code !== 3) remember("1");
        if (label) {
          label.textContent = error && error.code === 1
            ? "Location off — showing Florida's top rated rentals"
            : "Location unavailable — showing Florida's top rated rentals";
        }
        if (button) {
          button.disabled = false;
          button.hidden = false;
          if (!auto) button.textContent = "Try my location again";
        }
      };
    };

    var locate = function (auto) {
      if (!navigator.geolocation) {
        if (label) label.textContent = "Location is not available in this browser";
        if (button) button.hidden = true;
        return;
      }
      if (label) label.textContent = "Finding rentals near you\u2026";
      if (button) button.disabled = true;
      navigator.geolocation.getCurrentPosition(showNearest, failed(auto), {
        enableHighAccuracy: false,
        timeout: auto ? 12000 : 9000,
        maximumAge: 600000,
      });
    };

    if (button) button.addEventListener("click", function () { locate(false); });

    /* Ask on landing so the homepage is tailored to where the visitor is.
       An already-granted permission resolves with no prompt at all; a visitor
       who declined once is not asked again for the rest of the session. */
    var autoLocate = function () {
      if (wasDismissed()) return;
      if (!navigator.permissions || !navigator.permissions.query) { locate(true); return; }
      navigator.permissions.query({ name: "geolocation" }).then(function (status) {
        if (status.state === "denied") {
          if (label) label.textContent = "Location off — showing Florida's top rated rentals";
          return;
        }
        locate(true);
        status.onchange = function () { if (status.state === "granted") locate(true); };
      }).catch(function () { locate(true); });
    };

    if (d.readyState === "complete") autoLocate();
    else window.addEventListener("load", autoLocate, { once: true });
  }

  /* ----------------------------------------------------------- maps */
  /* Leaflet is self-hosted under /assets/vendor/leaflet and loaded on demand,
     so the 180KB only ever reaches visitors who actually reach a map. */
  var leafletPromise = null;

  function loadAsset(tag, attrs) {
    return new Promise(function (resolve, reject) {
      var node = d.createElement(tag);
      Object.keys(attrs).forEach(function (k) { node[k] = attrs[k]; });
      node.onload = resolve;
      node.onerror = reject;
      d.head.appendChild(node);
    });
  }

  function loadLeaflet() {
    if (leafletPromise) return leafletPromise;
    leafletPromise = Promise.all([
      loadAsset("link", { rel: "stylesheet", href: "/assets/vendor/leaflet/leaflet.css" }),
      loadAsset("link", { rel: "stylesheet", href: "/assets/vendor/leaflet/MarkerCluster.css" }),
      loadAsset("link", { rel: "stylesheet", href: "/assets/vendor/leaflet/MarkerCluster.Default.css" }),
    ])
      .then(function () { return loadAsset("script", { src: "/assets/vendor/leaflet/leaflet.js" }); })
      .then(function () { return loadAsset("script", { src: "/assets/vendor/leaflet/leaflet.markercluster.js" }); })
      .then(function () { return window.L; });
    return leafletPromise;
  }

  function escapeHtml(text) {
    return String(text == null ? "" : text)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function popupHtml(point) {
    var bits = ["<strong>" + escapeHtml(point.name) + "</strong>"];
    if (point.city) bits.push('<span class="map__popup-meta">' + escapeHtml(point.city) + ", FL</span>");
    if (point.rating) {
      bits.push('<span class="map__popup-meta">' + point.rating.toFixed(1) + " stars · " +
        escapeHtml(String(point.reviews)) + " reviews</span>");
    }
    if (point.url) bits.push('<a href="' + escapeHtml(point.url) + '">View listing</a>');
    return bits.join("");
  }

  function buildMap(container, points, opts) {
    opts = opts || {};
    var pts = points.filter(function (p) { return num(p.lat) !== null && num(p.lng) !== null; });
    if (!pts.length) {
      container.appendChild(el("p", "map__attr", "No mapped locations"));
      return null;
    }

    return loadLeaflet().then(function (L) {
      if (!L) return null;
      var tileUrl = d.body.getAttribute("data-tile-url");
      if (!tileUrl) return null;

      /* On a phone, one-finger drag belongs to the page, not the map, so the
         map starts inert and the visitor taps once to take control. */
      // Coarse pointer, not a user-agent sniff: it is the same signal the
      // stylesheet uses, so the veil and the touch-sized pins agree.
      var touch = window.matchMedia
        ? window.matchMedia("(pointer: coarse)").matches
        : L.Browser.mobile;
      var map = L.map(container, {
        scrollWheelZoom: false,
        dragging: !touch,
        tap: false,
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer(tileUrl, {
        maxZoom: parseInt(d.body.getAttribute("data-tile-maxzoom") || "18", 10),
        attribution: '<a href="' + escapeHtml(d.body.getAttribute("data-tile-attribution-url") || "") +
          '" rel="noopener nofollow" target="_blank">' +
          escapeHtml(d.body.getAttribute("data-tile-attribution") || "OpenStreetMap contributors") + "</a>",
      }).addTo(map);

      var markers = pts.map(function (p) {
        var numbered = p.rank !== 0;
        var icon = L.divIcon({
          className: "map__marker" + (numbered ? "" : " map__marker--dot"),
          html: '<span>' + (numbered ? "<i>" + escapeHtml(String(p.rank)) + "</i>" : "") + "</span>",
          iconSize: numbered ? [30, 38] : [22, 26],
          iconAnchor: numbered ? [15, 38] : [11, 26],
          popupAnchor: [0, numbered ? -36 : -24],
        });
        return L.marker([p.lat, p.lng], { icon: icon, title: p.name }).bindPopup(popupHtml(p));
      });

      /* Cluster once there are enough pins that they would otherwise overlap. */
      var layer;
      if (pts.length > 20 && L.markerClusterGroup) {
        layer = L.markerClusterGroup({
          showCoverageOnHover: false,
          maxClusterRadius: 45,
          spiderfyOnMaxZoom: true,
        });
        markers.forEach(function (m) { layer.addLayer(m); });
      } else {
        layer = L.featureGroup(markers);
      }
      layer.addTo(map);

      if (pts.length === 1) {
        map.setView([pts[0].lat, pts[0].lng], opts.zoom || 14);
      } else {
        map.fitBounds(L.featureGroup(markers).getBounds(), { padding: [34, 34] });
      }

      /* Wheel zoom only after a deliberate click, so scrolling the page over a
         map does not zoom it. */
      map.on("click", function () { map.scrollWheelZoom.enable(); });
      map.on("mouseout", function () { map.scrollWheelZoom.disable(); });

      if (touch) {
        var veil = el("div", "map__veil");
        veil.appendChild(el("span", null, "Tap to move the map"));
        container.appendChild(veil);
        veil.addEventListener("click", function () {
          map.dragging.enable();
          veil.remove();
        });
      }

      setTimeout(function () { map.invalidateSize(); }, 60);
      return map;
    }).catch(function () {
      container.appendChild(el("p", "map__attr", "The map could not be loaded"));
      return null;
    });
  }

  /* map toggles: <button data-map-toggle="#mapPanelId"> */
  $$("[data-map-toggle]").forEach(function (btn) {
    var panel = d.querySelector(btn.getAttribute("data-map-toggle"));
    if (!panel) return;
    var host = $(".map", panel);
    var built = false;
    btn.addEventListener("click", function () {
      var show = panel.hasAttribute("hidden");
      if (show) {
        panel.removeAttribute("hidden");
        btn.setAttribute("aria-expanded", "true");
        btn.textContent = btn.getAttribute("data-label-hide") || "Hide map";
        if (!built && host) {
          built = true;
          var points = [];
          try { points = JSON.parse(host.getAttribute("data-points") || "[]"); } catch (err) { points = []; }
          buildMap(host, points, { zoom: parseInt(host.getAttribute("data-zoom") || "8", 10) });
        }
      } else {
        panel.setAttribute("hidden", "");
        btn.setAttribute("aria-expanded", "false");
        btn.textContent = btn.getAttribute("data-label-show") || "Show map";
      }
    });
  });

  /* Always-on maps build when they come into view, so a visitor who never
     scrolls that far downloads neither Leaflet nor a single tile. */
  $$(".map[data-map-auto]").forEach(function (host) {
    var start = function () {
      var points = [];
      try { points = JSON.parse(host.getAttribute("data-points") || "[]"); } catch (err) { points = []; }
      buildMap(host, points, { zoom: parseInt(host.getAttribute("data-zoom") || "14", 10) });
    };
    if (!("IntersectionObserver" in window)) { start(); return; }
    var io = new IntersectionObserver(function (entries) {
      if (!entries.some(function (e) { return e.isIntersecting; })) return;
      io.disconnect();
      start();
    }, { rootMargin: "300px" });
    io.observe(host);
  });

  /* ------------------------------------- sort a listicle by distance */
  var nearbyRoot = $("[data-nearby-sort]");
  if (nearbyRoot) {
    var nearbyStatus = $("[data-nearby-status]", nearbyRoot);
    var nearbyButton = $("[data-nearby-button]", nearbyRoot);
    var NEARBY_KEY = "fer:geo-dismissed";

    var nearbyDismissed = function () {
      try { return window.sessionStorage.getItem(NEARBY_KEY) === "1"; } catch (err) { return false; }
    };
    var rememberNearby = function (value) {
      try { window.sessionStorage.setItem(NEARBY_KEY, value); } catch (err) { /* private mode */ }
    };

    var sortByDistance = function (lat, lng) {
      var cards = $$("[data-filter-item]", nearbyRoot);
      if (!cards.length) return 0;
      var parent = cards[0].parentNode;
      var placed = 0;

      cards.forEach(function (card) {
        var cLat = parseFloat(card.getAttribute("data-lat"));
        var cLng = parseFloat(card.getAttribute("data-lng"));
        if (!isFinite(cLat) || !isFinite(cLng)) { card.dataset.distance = "99999"; return; }
        var d = milesBetween(lat, lng, cLat, cLng);
        card.dataset.distance = d.toFixed(2);
        placed++;

        var host = $(".listicle__rank", card);
        if (host && !$(".distance-badge", card)) {
          var badge = el("span", "distance-badge", d.toFixed(d < 10 ? 1 : 0) + " mi away");
          var title = $(".listicle__title", card);
          if (title && title.parentNode) title.parentNode.insertBefore(badge, title.nextSibling);
        } else {
          var existing = $(".distance-badge", card);
          if (existing) existing.textContent = d.toFixed(d < 10 ? 1 : 0) + " mi away";
        }
      });

      cards.slice()
        .sort(function (a, b) { return parseFloat(a.dataset.distance) - parseFloat(b.dataset.distance); })
        .forEach(function (card, i) {
          parent.appendChild(card);
          var rank = $(".listicle__rank", card);
          if (rank) rank.textContent = String(i + 1);
        });
      return placed;
    };

    var nearbyLocate = function (auto) {
      if (!navigator.geolocation) {
        if (nearbyStatus) nearbyStatus.textContent = "Location is not available in this browser.";
        return;
      }
      if (nearbyStatus) nearbyStatus.textContent = "Finding the rentals closest to you\u2026";
      if (nearbyButton) nearbyButton.disabled = true;
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          var placed = sortByDistance(pos.coords.latitude, pos.coords.longitude);
          rememberNearby("0");
          if (nearbyStatus) {
            nearbyStatus.textContent = placed
              ? "Sorted by distance from you \u2014 closest first."
              : "No mapped listings on this page.";
          }
          if (nearbyButton) nearbyButton.hidden = true;
          nearbyRoot.setAttribute("data-nearby-active", "1");
        },
        function (error) {
          if (!error || error.code !== 3) rememberNearby("1");
          if (nearbyStatus) {
            nearbyStatus.textContent = error && error.code === 1
              ? "Location off \u2014 showing our statewide ranking instead."
              : "Location unavailable \u2014 showing our statewide ranking instead.";
          }
          if (nearbyButton) { nearbyButton.disabled = false; nearbyButton.hidden = false; }
        },
        { enableHighAccuracy: false, timeout: auto ? 12000 : 9000, maximumAge: 600000 }
      );
    };

    if (nearbyButton) nearbyButton.addEventListener("click", function () { nearbyLocate(false); });

    var nearbyAuto = function () {
      if (nearbyDismissed()) return;
      if (!navigator.permissions || !navigator.permissions.query) { nearbyLocate(true); return; }
      navigator.permissions.query({ name: "geolocation" }).then(function (status) {
        if (status.state === "denied") {
          if (nearbyStatus) nearbyStatus.textContent = "Location off \u2014 showing our statewide ranking.";
          return;
        }
        nearbyLocate(true);
      }).catch(function () { nearbyLocate(true); });
    };

    if (d.readyState === "complete") nearbyAuto();
    else window.addEventListener("load", nearbyAuto, { once: true });
  }

  /* ------------------------------------- category shortcuts above a filter */
  /* Buttons that pre-set one of the form's own selects, so the list has a way
     in per activity without a second filtering path to keep in step. */
  $$("[data-category-jump]").forEach(function (button) {
    button.addEventListener("click", function () {
      var select = $('[data-filter-field="category"]');
      if (!select) return;
      var want = button.getAttribute("data-category-jump");
      select.value = select.value === want ? "" : want;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      var form = select.form || $("[data-filter-form]");
      if (form && form.scrollIntoView) form.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    });
  });

  /* ------------------------------------------- /find destination picker */
  /* "Where" in the /find search bar goes to another town or region's page.
     The rest of the bar filters this page's list via the engine below. */
  $$("[data-destination]").forEach(function (select) {
    var here = window.location.pathname;
    var go = function () {
      if (select.value && select.value !== here) window.location.href = select.value;
    };
    select.addEventListener("change", go);
    if (select.form) {
      select.form.addEventListener("submit", function () {
        if (select.value && select.value !== here) { go(); return; }
        var results = $("[data-find-results]");
        if (results && results.scrollIntoView) {
          results.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
        }
      });
    }
  });

  /* ------------------------------------------------ Rent Now request */
  /* Saves the request to the site's Supabase table with the public anon key;
     row-level security lets that key insert a lead and do nothing else. */
  (function () {
  var rentForm = $("[data-rent-form]");
  if (!rentForm) return;
  {
    var rentStatus = $("[data-rent-status]");
    var params = new URLSearchParams(window.location.search);
    var shopsEl = d.getElementById("rent-shops");
    var shopNames = {};
    try { shopNames = JSON.parse(shopsEl ? shopsEl.textContent : "{}"); } catch (e) {}
    var pTown = params.get("town"), pListing = params.get("listing"), pService = params.get("service");
    var shop = pListing && shopNames[pListing];
    if (shop && !pTown) pTown = shop[1];
    if (pTown && rentForm.town.querySelector('option[value="' + pTown.replace(/[^a-z0-9-]/g, "") + '"]')) rentForm.town.value = pTown;
    if (pService && rentForm.service.querySelector('option[value="' + pService.replace(/[^a-z0-9-]/g, "") + '"]')) rentForm.service.value = pService;
    // ?style= from an electric-bike-type guide preselects that style.
    var pStyle = (params.get("style") || "").replace(/[^a-z-]/g, "");
    var styleInput = pStyle && rentForm.querySelector('input[name=bike_style][value="' + pStyle + '"]');
    if (styleInput) styleInput.checked = true;
    if (shop) {
      var shopNote = $("[data-rent-shop]");
      shopNote.textContent = "You came from " + shop[0] + ". We will ask them first, and find another shop nearby if they can't help.";
      shopNote.hidden = false;
    }
    // Local date, not UTC: an evening visitor in Florida must still be able to pick today.
    var today = new Date();
    var ymd = function (dt) { return dt.getFullYear() + "-" + ("0" + (dt.getMonth() + 1)).slice(-2) + "-" + ("0" + dt.getDate()).slice(-2); };
    rentForm.start_date.min = ymd(today);
    // ?date= from a quick Rent Now form on a content page.
    var pDate = (params.get("date") || "").replace(/[^0-9-]/g, "");
    if (/^\d{4}-\d{2}-\d{2}$/.test(pDate) && pDate >= ymd(today)) rentForm.start_date.value = pDate;
    // Day: show the weekday under the date so "Saturday" is never a guess.
    var dayNote = $("[data-rent-day]");
    var dayText = function (v) {
      var p = (v || "").split("-");
      if (p.length !== 3) return "";
      var dt = new Date(+p[0], +p[1] - 1, +p[2]);
      return dt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    };
    rentForm.start_date.addEventListener("input", function () { dayNote.textContent = dayText(rentForm.start_date.value); });
    if (rentForm.start_date.value) dayNote.textContent = dayText(rentForm.start_date.value);
    // An exact start time picks the matching time of day.
    var todInputs = $$("input[name=time_of_day]", rentForm);
    $("[data-rent-start]").addEventListener("change", function () {
      var v = this.value;
      if (!v) return;
      var h = parseInt(v, 10) + parseInt(v.slice(3), 10) / 60;
      todInputs.forEach(function (r) {
        var from = parseFloat(r.getAttribute("data-from")), to = parseFloat(r.getAttribute("data-to"));
        if (!isNaN(from) && h >= from && h < to) r.checked = true;
      });
    });
    // Bike style only matters for rentals; tours and repairs hide it.
    var styleBox = $("[data-rent-styles]");
    var styleServices = (styleBox.getAttribute("data-style-services") || "").split(" ");
    var syncStyles = function () { styleBox.hidden = styleServices.indexOf(rentForm.service.value) === -1; };
    rentForm.service.addEventListener("change", syncStyles);
    syncStyles();

    rentForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var f = rentForm;
      var say = function (msg, bad) { rentStatus.textContent = msg; rentStatus.classList.toggle("is-error", !!bad); };
      // Bots fill the hidden field. Its name means nothing to browser autofill
      // (a field called "company" got filled from saved addresses and silently
      // dropped real requests), and a hit still ends on the thank-you screen.
      if (f.fer_hp && f.fer_hp.value) { f.hidden = true; $("[data-rent-done]").hidden = false; return; }
      if (!f.town.value) return say("Choose the town you want to ride in.", true);
      if (!f.start_date.value) return say("Choose the day you want to ride.", true);
      if (f.start_date.value < f.start_date.min) return say("That day has already passed. Choose today or later.", true);
      var tod = f.querySelector("input[name=time_of_day]:checked");
      if (!tod) return say("Choose a time of day, or Flexible.", true);
      if (!f.name.value.trim()) return say("Add your name.", true);
      if (!f.phone.value.trim() && !f.email.value.trim()) return say("Add a phone number or an email so we can reach you.", true);
      if (f.email.value && !f.email.checkValidity()) return say("That email address doesn't look right.", true);
      if (!f.consent.checked) return say("Tick the box so we can share your request with the shop.", true);
      var endpoint = f.getAttribute("data-endpoint"), key = f.getAttribute("data-key");
      if (!endpoint || !key) return say("Online requests aren't switched on yet. Please call us instead.", true);
      var townOpt = f.town.options[f.town.selectedIndex];
      var lead = {
        name: f.name.value.trim().slice(0, 120),
        phone: f.phone.value.trim().slice(0, 40) || null,
        email: f.email.value.trim().slice(0, 180) || null,
        town: f.town.value,
        town_name: townOpt ? townOpt.textContent : null,
        service: f.service.value,
        bike_style: styleBox.hidden ? null : ((f.querySelector("input[name=bike_style]:checked") || {}).value || null),
        start_date: f.start_date.value || null,
        time_of_day: tod.value,
        start_time: f.start_time.value || null,
        duration: f.duration.value || null,
        bikes: Math.max(1, Math.min(50, parseInt(f.bikes.value, 10) || 1)),
        notes: f.notes.value.trim().slice(0, 2000) || null,
        listing: shop ? pListing : null,
        source: (d.referrer || "").slice(0, 300) || null
      };
      var btn = f.querySelector("button[type=submit]");
      btn.disabled = true;
      say("Sending...");
      var post = function (body) {
        return fetch(endpoint + "/rest/v1/fer_leads", {
          method: "POST",
          headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify(body)
        });
      };
      post(lead).then(function (res) {
        // Until the time columns are added to fer_leads (supabase/leads.sql),
        // Supabase rejects them as unknown (PGRST204): keep the lead, with the
        // time written into the notes instead.
        if (res.status !== 400) return res;
        return res.clone().json().then(function (j) {
          if (!j || j.code !== "PGRST204") return res;
          var fallback = Object.assign({}, lead);
          var timeLabel = (tod.parentNode.querySelector("strong") || {}).textContent || tod.value;
          var startOpt = f.start_time.options[f.start_time.selectedIndex];
          delete fallback.time_of_day; delete fallback.start_time;
          fallback.notes = ("[Time: " + timeLabel + (f.start_time.value ? ", start " + startOpt.textContent : "") + "] " + (lead.notes || "")).trim().slice(0, 2000);
          return post(fallback);
        }, function () { return res; });
      }).then(function (res) {
        if (!res.ok) {
          return res.text().then(function (t) {
            var detail = "";
            try { var j = JSON.parse(t); detail = j.message || j.msg || j.error || ""; } catch (e2) { detail = t.slice(0, 160); }
            throw new Error("error " + res.status + (detail ? ": " + detail : ""));
          });
        }
        f.hidden = true;
        $("[data-rent-done]").hidden = false;
        if (typeof window.gtag === "function") window.gtag("event", "generate_lead", { service: lead.service, town: lead.town });
      }).catch(function (err) {
        btn.disabled = false;
        if (window.console) console.error("Rent Now request failed:", err);
        say("Sorry, that didn't go through (" + ((err && err.message) || "network error") + "). Please try again, or call us.", true);
      });
    });
  }

  })();

  /* ---------------------------------------------------- lead desk */
  (function () {
  var admin = $("[data-admin]");
  if (!admin) return;
  {
    var A = {
      url: admin.getAttribute("data-endpoint"),
      key: admin.getAttribute("data-key"),
      services: {},
      shops: null,
      leads: [],
      token: null
    };
    JSON.parse(admin.getAttribute("data-services") || "[]").forEach(function (s) { A.services[s[0]] = s[1]; });
    A.styles = {};
    JSON.parse(admin.getAttribute("data-styles") || "[]").forEach(function (s) { A.styles[s[0]] = s[1]; });
    var loginForm = $("[data-admin-login]"), app = $("[data-admin-app]");
    var listEl = $("[data-admin-leads]"), detail = $("[data-admin-detail]");
    var esc = function (v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
    var api = function (path, opts) {
      opts = opts || {};
      opts.headers = Object.assign({ apikey: A.key, Authorization: "Bearer " + (A.token || A.key), "Content-Type": "application/json" }, opts.headers || {});
      return fetch(A.url + path, opts).then(function (r) {
        if (r.status === 401) { signOut("Your session ended. Sign in again."); throw new Error("401"); }
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.status === 204 ? null : r.json();
      });
    };
    var signOut = function (msg) {
      A.token = null;
      try { sessionStorage.removeItem("fer-admin"); } catch (e) {}
      app.hidden = true; loginForm.hidden = false;
      $("[data-admin-login-status]").textContent = msg || "";
    };
    var start = function () {
      loginForm.hidden = true; app.hidden = false;
      var shopsReady = A.shops ? Promise.resolve() : fetch(admin.getAttribute("data-shops")).then(function (r) { return r.json(); }).then(function (j) { A.shops = j; });
      shopsReady.then(loadLeads);
    };
    var loadLeads = function () {
      var f = $("[data-admin-filter]").value;
      var q = "/rest/v1/fer_leads?select=*&order=created_at.desc&limit=500";
      if (f === "open") q += "&status=in.(new,contacted,matched,quoted,paid)";
      else if (f) q += "&status=eq." + encodeURIComponent(f);
      api(q).then(function (rows) {
        A.leads = rows || [];
        $("[data-admin-count]").textContent = A.leads.length + (A.leads.length === 1 ? " lead" : " leads");
        listEl.innerHTML = A.leads.map(function (l, i) {
          return '<li><button type="button" class="admin-lead" data-i="' + i + '"><span class="admin-lead__status s-' + esc(l.status) + '">' + esc(l.status) + '</span>' +
            '<strong>' + esc(l.name) + '</strong> <span>' + esc(A.services[l.service] || l.service) + (l.bike_style && l.bike_style !== "any" ? " · " + esc(A.styles[l.bike_style] || l.bike_style) : "") + '</span>' +
            '<span class="muted">' + esc(l.town_name || l.town) + (l.start_date ? " · " + esc(dayLabel(l.start_date)) + (l.start_time ? " " + esc(clock(l.start_time)) : TOD[l.time_of_day] && l.time_of_day !== "flexible" ? " " + esc(TOD[l.time_of_day].toLowerCase()) : "") : "") + " · " + esc(new Date(l.created_at).toLocaleString()) + '</span></button></li>';
        }).join("") || '<li class="muted">No leads here yet.</li>';
      }).catch(function () {});
    };
    var miles = function (a, b, c, e) {
      var R = 3958.8, toR = Math.PI / 180, dLat = (c - a) * toR, dLng = (e - b) * toR;
      var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a * toR) * Math.cos(c * toR) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
      return 2 * R * Math.asin(Math.sqrt(h));
    };
    var matches = function (lead, radius, anyService) {
      var town = A.shops.towns[lead.town] || {};
      return A.shops.shops.map(function (s) {
        var dist = s.t === lead.town ? 0 : (town.lat != null && s.lat != null ? miles(town.lat, town.lng, s.lat, s.lng) : Infinity);
        return { s: s, dist: dist, fits: s.sv.indexOf(lead.service) !== -1, asked: !!lead.listing && s.s === lead.listing };
      // The shop the rider came from is always shown, first: the form told them we would ask it first.
      }).filter(function (m) { return m.asked || (m.dist <= radius && (anyService || m.fits)); })
        .sort(function (x, y) { return (y.asked - x.asked) || (x.dist - y.dist) || (y.s.ra - x.s.ra) || (y.s.rv - x.s.rv); });
    };
    var showLead = function (i) {
      var l = A.leads[i];
      var radius = parseInt(detail.getAttribute("data-radius") || "15", 10);
      var anyService = detail.getAttribute("data-any") === "1";
      var list = matches(l, radius, anyService);
      var row = function (k, v) { return v ? "<div><dt>" + k + "</dt><dd>" + v + "</dd></div>" : ""; };
      detail.innerHTML =
        '<h2>' + esc(l.name) + '</h2>' +
        '<dl class="datalist">' +
          row("Wants", esc(A.services[l.service] || l.service)) +
          row("Preferred style", l.bike_style ? esc(A.styles[l.bike_style] || l.bike_style) + ' <span class="admin-off">a preference: put what the shop actually has in the quote details</span>' : "") +
          row("Where", esc(l.town_name || l.town)) +
          row("When", esc(dateText(l))) +
          row("Bikes", esc(l.bikes)) +
          row("Phone", l.phone ? '<a href="tel:' + esc(l.phone) + '">' + esc(l.phone) + "</a>" : "") +
          row("Email", l.email ? '<a href="mailto:' + esc(l.email) + '">' + esc(l.email) + "</a>" : "") +
          row("Notes", esc(l.notes)) +
          row("Came from shop", l.listing ? esc(shopName(l.listing)) : "") +
          row("Assigned to", esc(l.assigned_listing)) +
        "</dl>" +
        quoteBox(l) +
        '<div class="admin-edit"><label class="field"><span>Status</span><select data-lead-status>' +
          ["new", "contacted", "matched", "quoted", "paid", "booked", "cancelled", "refunded", "lost"].map(function (s) { return '<option' + (s === l.status ? " selected" : "") + ">" + s + "</option>"; }).join("") +
        '</select></label><label class="field"><span>Your notes</span><textarea rows="2" data-lead-notes>' + esc(l.admin_notes) + '</textarea></label>' +
        '<button class="btn btn--blue btn--sm" type="button" data-lead-save>Save</button> <span class="small" data-lead-saved></span></div>' +
        '<h3>Shops that can fulfil this (' + list.length + ')</h3>' +
        '<div class="admin-bar"><label class="field"><span>Within</span><select data-radius>' +
          [5, 15, 30, 60].map(function (r) { return "<option value=" + r + (r === radius ? " selected" : "") + ">" + r + " miles</option>"; }).join("") +
        '</select></label><label class="admin-check"><input type="checkbox" data-any' + (anyService ? " checked" : "") + "> Show shops without this service</label></div>" +
        '<ol class="admin-shops">' + (list.map(function (m) {
          var s = m.s;
          return '<li class="' + (m.fits ? "" : "is-off") + (m.asked ? " is-asked" : "") + '"><div>' +
            (m.asked ? '<span class="admin-asked">Rider asked for this shop: ask them first</span>' : "") +
            '<a href="' + esc(s.u) + '" target="_blank" rel="noopener"><strong>' + esc(s.n) + "</strong></a> " +
            '<span class="muted">' + esc(s.c) + (m.dist ? " · " + m.dist.toFixed(1) + " mi" : " · in town") + (s.ra ? " · " + s.ra.toFixed(1) + "★ (" + s.rv + ")" : "") + "</span>" +
            (m.fits ? "" : ' <span class="admin-off">does not list this service</span>') +
            '<div class="small muted">' + esc(s.tg.join(" · ")) + "</div></div>" +
            '<div class="admin-shop__actions">' +
              (s.p ? '<a class="btn btn--outline btn--sm" href="tel:' + esc(s.p) + '">' + esc(s.p) + "</a>" : "") +
              (s.w ? '<a class="btn btn--outline btn--sm" href="' + esc(s.w) + '" target="_blank" rel="noopener nofollow">Website</a>' : "") +
              (s.m ? '<a class="btn btn--outline btn--sm" href="' + esc(s.m) + '" target="_blank" rel="noopener nofollow">Map</a>' : "") +
              '<button class="btn btn--blue btn--sm" type="button" data-assign="' + esc(s.s) + '">Assign</button>' +
            "</div></li>";
        }).join("") || '<li class="muted">No shops within ' + radius + " miles. Widen the distance.</li>") + "</ol>";
      detail.setAttribute("data-lead", i);
    };
    var money = function (c) { return "$" + (c / 100).toFixed(2); };
    var shopName = function (slug) {
      var s = slug && A.shops.shops.filter(function (x) { return x.s === slug; })[0];
      return s ? s.n : (slug || "");
    };
    var TOD = { morning: "Morning", midday: "Midday", afternoon: "Afternoon", sunset: "Evening / sunset", flexible: "Flexible time" };
    var clock = function (t) { if (!t) return ""; var h = parseInt(t, 10), m = t.slice(3, 5); return ((h + 11) % 12 + 1) + ":" + m + (h < 12 ? " AM" : " PM"); };
    var dayLabel = function (v) {
      var p = (v || "").split("-");
      if (p.length !== 3) return v || "";
      return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    };
    // "Sat, Nov 2 · Morning · 9:00 AM start · full day"
    var dateText = function (l) {
      return [l.start_date ? dayLabel(l.start_date) : "", TOD[l.time_of_day] || "", l.start_time ? clock(l.start_time) + " start" : "",
        l.duration && l.duration !== "not sure" ? l.duration : ""].filter(Boolean).join(" · ");
    };
    var quoteMessage = function (l) {
      var total = (l.quote_rental_cents || 0) + (l.quote_fee_cents || 0);
      return "Hi " + l.name.split(" ")[0] + ", here is your e-bike rental quote from Florida Ebike Rentals.\n" +
        (l.bikes ? l.bikes + (l.bikes > 1 ? " bikes" : " bike") : "Bike rental") +
        " in " + (l.town_name || l.town) + (dateText(l) ? ", " + dateText(l) : "") + ".\n" +
        (A.styles[l.bike_style] && l.bike_style !== "any" ? "You asked for: " + A.styles[l.bike_style] + " (a preference; the shop's bikes are described below).\n" : "") +
        (l.quote_details ? l.quote_details + "\n" : "") +
        "Rental " + money(l.quote_rental_cents) + " + booking fee " + money(l.quote_fee_cents) + " = " + money(total) + ".\n" +
        "Pay here to confirm (link valid 23 hours): " + l.quote_url + "\n" +
        "Full refund if you cancel 24+ hours before your rental. Booking terms: " + location.origin + "/terms/#rent-now-bookings";
    };
    var confirmMessage = function (l) {
      return "Hi " + l.name.split(" ")[0] + ", you're booked! " +
        (l.quote_shop ? "Your rental is with " + l.quote_shop + " in " + (l.town_name || l.town) + ". " : "") +
        (dateText(l) ? "When: " + dateText(l) + ". " : "") +
        (l.quote_details ? l.quote_details + " " : "") +
        "Bring a photo ID; the shop may ask you to sign its rental agreement and waiver at pickup. " +
        "Need to change anything? Reply to this message. - Florida Ebike Rentals";
    };
    var shareLinks = function (l, text) {
      var enc = encodeURIComponent(text);
      return '<div class="admin-shop__actions">' +
        '<button class="btn btn--outline btn--sm" type="button" data-copy>Copy message</button>' +
        (l.phone ? '<a class="btn btn--outline btn--sm" href="sms:' + esc(l.phone.replace(/[^0-9+]/g, "")) + "?&body=" + enc + '">Text it</a>' : "") +
        (l.email ? '<a class="btn btn--outline btn--sm" href="mailto:' + esc(l.email) + "?subject=" + encodeURIComponent("Your e-bike rental") + "&body=" + enc + '">Email it</a>' : "") +
        '</div><textarea class="admin-msg" rows="6" readonly data-msg>' + esc(text) + "</textarea>";
    };
    var quoteBox = function (l) {
      var paid = l.status === "paid" || l.status === "booked";
      var h = '<div class="admin-quote"><h3>Quote and payment</h3>';
      if (paid) {
        h += '<p class="admin-paid">Paid ' + money(l.paid_cents || 0) + (l.paid_at ? " on " + esc(new Date(l.paid_at).toLocaleString()) : "") +
          (l.stripe_payment_intent ? ' · <a href="https://dashboard.stripe.com/payments/' + esc(l.stripe_payment_intent) + '" target="_blank" rel="noopener">View in Stripe</a> (refunds are made there)' : "") + "</p>" +
          (l.status === "paid" ? '<p class="small"><strong>Next:</strong> book ' + esc(l.quote_shop || "the shop") + ', then set the status to Booked and send the rider this confirmation:</p>' : "<p class=small>Confirmation for the rider:</p>") +
          shareLinks(l, confirmMessage(l));
        return h + "</div>";
      }
      h += '<div class="admin-quote__grid">' +
        '<label class="field"><span>Shop you will book</span><input type="text" data-q-shop value="' + esc(l.quote_shop || shopName(l.assigned_listing || l.listing)) + '"></label>' +
        '<label class="field"><span>Shop\'s price for the rental, incl. tax ($)</span><input type="number" min="1" step="0.01" data-q-rental value="' + (l.quote_rental_cents ? (l.quote_rental_cents / 100).toFixed(2) : "") + '"></label>' +
        '<label class="field"><span>Your booking fee ($)</span><input type="number" min="0" step="0.01" data-q-fee value="' + (l.quote_fee_cents != null ? (l.quote_fee_cents / 100).toFixed(2) : "") + '"></label>' +
        "</div>" +
        '<label class="field"><span>Details for the rider (pickup time and place, what is included)</span><textarea rows="2" maxlength="1000" data-q-details>' + esc(l.quote_details) + "</textarea></label>" +
        '<p class="small muted">Before you quote: check the shop has bikes free that day (ideally the ' + esc(A.styles[l.bike_style] || "preferred") + ' style; if not, say what they have in the details) and that its cancellation terms are no stricter than ours (full refund 24h+).</p>' +
        '<button class="btn btn--blue btn--sm" type="button" data-q-send>' + (l.quote_url ? "Make a new payment link" : "Create payment link") + '</button> <span class="small" data-q-status></span>';
      if (l.quote_url) {
        var expired = l.quote_expires_at && new Date(l.quote_expires_at) < new Date();
        h += '<p class="small">' + (expired ? '<strong>This link has expired.</strong> Make a new one.' : "Link expires " + esc(new Date(l.quote_expires_at).toLocaleString()) + ".") + "</p>" +
          (expired ? "" : shareLinks(l, quoteMessage(l)));
      }
      return h + "</div>";
    };
    var patch = function (i, fields) {
      var l = A.leads[i];
      return api("/rest/v1/fer_leads?id=eq." + encodeURIComponent(l.id), {
        method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(fields)
      }).then(function (rows) { if (rows && rows[0]) A.leads[i] = rows[0]; showLead(i); });
    };
    listEl.addEventListener("click", function (e) {
      var b = e.target.closest("[data-i]");
      if (b) showLead(+b.getAttribute("data-i"));
    });
    detail.addEventListener("change", function (e) {
      var i = +detail.getAttribute("data-lead");
      if (e.target.matches("[data-radius]")) { detail.setAttribute("data-radius", e.target.value); showLead(i); }
      if (e.target.matches("[data-any]")) { detail.setAttribute("data-any", e.target.checked ? "1" : "0"); showLead(i); }
    });
    detail.addEventListener("click", function (e) {
      var i = +detail.getAttribute("data-lead");
      if (e.target.matches("[data-lead-save]")) {
        patch(i, { status: $("[data-lead-status]", detail).value, admin_notes: $("[data-lead-notes]", detail).value || null })
          .then(function () { $("[data-lead-saved]", detail).textContent = "Saved."; loadLeads(); });
      }
      if (e.target.matches("[data-copy]")) {
        var msg = $("[data-msg]", detail);
        msg.select();
        (navigator.clipboard ? navigator.clipboard.writeText(msg.value) : Promise.reject()).then(function () { e.target.textContent = "Copied"; }, function () { document.execCommand("copy"); e.target.textContent = "Copied"; });
      }
      if (e.target.matches("[data-q-send]")) {
        var st = $("[data-q-status]", detail);
        var cents = function (sel) { var v = parseFloat($(sel, detail).value); return isNaN(v) ? NaN : Math.round(v * 100); };
        var body = { lead_id: A.leads[i].id, shop: $("[data-q-shop]", detail).value, rental_cents: cents("[data-q-rental]"), fee_cents: cents("[data-q-fee]"), details: $("[data-q-details]", detail).value };
        if (!(body.rental_cents > 0)) { st.textContent = "Enter the shop's price."; return; }
        if (!(body.fee_cents >= 0)) { st.textContent = "Enter your booking fee (0 is fine)."; return; }
        e.target.disabled = true;
        st.textContent = "Creating the Stripe link...";
        fetch("/api/quote/", { method: "POST", headers: { Authorization: "Bearer " + A.token, "Content-Type": "application/json" }, body: JSON.stringify(body) })
          .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || "Failed"); return j; }); })
          .then(function (j) { A.leads[i] = j.lead; showLead(i); loadLeads(); })
          .catch(function (err) { e.target.disabled = false; st.textContent = err.message; });
      }
      var a = e.target.closest("[data-assign]");
      if (a) patch(i, { assigned_listing: a.getAttribute("data-assign"), status: "matched" }).then(loadLeads);
    });
    $("[data-admin-filter]").addEventListener("change", loadLeads);
    $("[data-admin-refresh]").addEventListener("click", loadLeads);
    $("[data-admin-logout]").addEventListener("click", function () { signOut("Signed out."); });
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var st = $("[data-admin-login-status]");
      if (!A.url) { st.textContent = "Booking is not connected yet."; return; }
      st.textContent = "Signing in...";
      fetch(A.url + "/auth/v1/token?grant_type=password", {
        method: "POST",
        headers: { apikey: A.key, "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginForm.email.value, password: loginForm.password.value })
      }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error_description || j.msg || "Sign-in failed"); return j; }); })
        .then(function (j) {
          A.token = j.access_token;
          try { sessionStorage.setItem("fer-admin", JSON.stringify({ t: j.access_token, x: Date.now() + (j.expires_in || 3600) * 1000 })); } catch (e2) {}
          loginForm.password.value = "";
          st.textContent = "";
          start();
        }).catch(function (err) { st.textContent = err.message; });
    });
    try {
      var saved = JSON.parse(sessionStorage.getItem("fer-admin") || "null");
      if (saved && saved.x > Date.now() + 60000) { A.token = saved.t; start(); }
    } catch (e3) {}
  }
  })();

  /* ------------------------------------------- /cities/ town search */
  /* Filters the town cards as you type. Enter opens the town when only one
     matches; with no match the form falls through to /search/, which also
     looks at shop names and services. */
  var townForm = $("[data-town-search]");
  if (townForm) {
    var townInput = $("input[name=q]", townForm);
    var townStatus = $("[data-town-status]");
    var townRegions = $$("[data-region]");
    var townJump = $(".region-jump");
    var norm = function (v) {
      return String(v || "").toLowerCase().replace(/\bst\.?\s/g, "saint ").replace(/[^a-z0-9]+/g, " ").trim();
    };
    var townMatches = [];
    var filterTowns = function () {
      var q = norm(townInput.value);
      townMatches = [];
      townRegions.forEach(function (region) {
        var regionHit = q.length >= 4 && norm(region.getAttribute("data-region")).indexOf(q) !== -1;
        var shown = 0;
        $$("[data-town]", region).forEach(function (card) {
          var hit = !q || regionHit || norm(card.getAttribute("data-town")).indexOf(q) !== -1;
          card.hidden = !hit;
          if (hit) { shown++; townMatches.push(card); }
        });
        region.hidden = shown === 0;
      });
      if (townJump) townJump.hidden = !!q;
      d.body.classList.toggle("is-town-search", !!q);
      if (!q) townStatus.textContent = "";
      else if (!townMatches.length) townStatus.textContent = "No town by that name. Press Search to look through shop names and services instead.";
      else townStatus.textContent = townMatches.length + (townMatches.length === 1 ? " town matches." : " towns match.");
    };
    townInput.addEventListener("input", filterTowns);
    townForm.addEventListener("submit", function (e) {
      filterTowns();
      if (!norm(townInput.value) || !townMatches.length) return;
      e.preventDefault();
      var q = norm(townInput.value);
      var exact = townMatches.filter(function (c) { return norm(c.getAttribute("data-town")) === q; })[0];
      if (exact || townMatches.length === 1) { window.location.href = (exact || townMatches[0]).href; return; }
      townMatches[0].scrollIntoView({ behavior: "smooth", block: "center" });
      townMatches[0].focus({ preventScroll: true });
    });
  }

  /* ------------------------------------------------ listicle filters */
  var filterForm = $("[data-filter-form]");
  if (filterForm) {
    var cards = $$("[data-filter-item]");
    var counter = $("[data-filter-count]");
    var totalLabel = counter ? counter.getAttribute("data-noun") || "listings" : "listings";
    /* Extra controls opt in with data-filter-field + data-filter-mode, so a page
       can add its own facets without touching this function. */
    var extras = $$("[data-filter-field]", filterForm);

    var matchesExtras = function (card) {
      for (var i = 0; i < extras.length; i++) {
        var control = extras[i];
        var field = control.getAttribute("data-filter-field");
        var mode = control.getAttribute("data-filter-mode") || "exact";
        var raw = card.getAttribute("data-" + field);

        if (mode === "flag") {
          if (control.checked && raw !== "1") return false;
          continue;
        }
        var value = (control.value || "").trim();
        if (!value) continue;

        if (mode === "contains") {
          if ((raw || "").indexOf("|" + value + "|") === -1) return false;
        } else if (mode === "max") {
          var num = parseFloat(raw);
          if (!isFinite(num) || num > parseFloat(value)) return false;
        } else if (mode === "min") {
          var low = parseFloat(raw);
          if (!isFinite(low) || low < parseFloat(value)) return false;
        } else if (raw !== value) {
          return false;
        }
      }
      return true;
    };

    var apply = function () {
      var q = ($("[name=q]", filterForm) || {}).value || "";
      var city = ($("[name=city]", filterForm) || {}).value || "";
      var tag = ($("[name=tag]", filterForm) || {}).value || "";
      var sort = ($("[name=sort]", filterForm) || {}).value || "";
      q = q.trim().toLowerCase();
      var shown = 0;
      cards.forEach(function (card) {
        var hay = (card.getAttribute("data-search") || "").toLowerCase();
        var ok = (!q || hay.indexOf(q) !== -1) &&
                 (!city || card.getAttribute("data-city") === city) &&
                 (!tag || (card.getAttribute("data-tags") || "").indexOf("|" + tag + "|") !== -1) &&
                 matchesExtras(card);
        card.hidden = !ok;
        if (ok) shown++;
      });
      if (sort) {
        var parent = cards.length ? cards[0].parentNode : null;
        if (parent) {
          /* "field-asc" sorts ascending; anything else sorts descending. */
          var asc = /-asc$/.test(sort);
          var key = sort.replace(/-asc$/, "");
          cards.slice().sort(function (a, b) {
            if (key === "name") return (a.getAttribute("data-name") || "").localeCompare(b.getAttribute("data-name") || "");
            var av = parseFloat(a.getAttribute("data-" + key) || "0");
            var bv = parseFloat(b.getAttribute("data-" + key) || "0");
            return asc ? av - bv : bv - av;
          }).forEach(function (node, i) {
            parent.appendChild(node);
            var rank = $(".listicle__rank", node);
            if (rank && node.hasAttribute("data-renumber")) rank.textContent = String(i + 1);
          });
        }
      }
      var empty = $("[data-filter-empty]");
      if (empty) empty.hidden = shown !== 0;
      if (counter) counter.textContent = shown + " " + (shown === 1 ? totalLabel.replace(/s$/, "") : totalLabel);
    };
    filterForm.addEventListener("input", apply);
    filterForm.addEventListener("change", apply);
    filterForm.addEventListener("submit", function (e) { e.preventDefault(); apply(); });
    var reset = $("[data-filter-reset]", filterForm);
    if (reset) reset.addEventListener("click", function () { filterForm.reset(); apply(); });
  }

  /* ------------------------------------------------------ site search */
  var searchRoot = $("[data-site-search]");
  if (searchRoot) {
    var input = $("[name=q]", searchRoot);
    var results = $("[data-search-results]", searchRoot);
    var summary = $("[data-search-summary]", searchRoot);
    var pagesUrl = searchRoot.getAttribute("data-pages") || "/data/pages.json";
    var pagesPromise = null;

    function pages() {
      if (!pagesPromise) {
        pagesPromise = fetch(pagesUrl, { credentials: "omit" })
          .then(function (r) { return r.ok ? r.json() : { pages: [] }; })
          .then(function (j) { return Array.isArray(j.pages) ? j.pages : []; })
          .catch(function () { return []; });
      }
      return pagesPromise;
    }

    function score(page, terms) {
      var title = (page.t || "").toLowerCase();
      var body = (page.k || "").toLowerCase();
      var total = 0;
      for (var i = 0; i < terms.length; i++) {
        var t = terms[i];
        var inTitle = title.indexOf(t) !== -1;
        var inBody = body.indexOf(t) !== -1;
        if (!inTitle && !inBody) return 0;
        total += (inTitle ? 6 : 0) + (inBody ? 2 : 0);
        if (title.indexOf(t) === 0) total += 3;
      }
      return total + (page.w || 0);
    }

    function run(query) {
      var terms = query.toLowerCase().split(/\s+/).filter(function (t) { return t.length > 1; });
      if (!results) return;
      results.textContent = "";
      if (!terms.length) {
        if (summary) summary.textContent = "Type at least two characters to search the directory.";
        return;
      }
      pages().then(function (all) {
        var hits = all.map(function (p) { return { p: p, s: score(p, terms) }; })
          .filter(function (h) { return h.s > 0; })
          .sort(function (a, b) { return b.s - a.s; })
          .slice(0, 60);
        if (summary) {
          summary.textContent = hits.length
            ? hits.length + (hits.length === 60 ? "+" : "") + " pages match “" + query + "”"
            : "No pages match “" + query + "”. Try a city name such as Key West or Destin.";
        }
        var list = el("ul", "grid grid--2");
        list.style.listStyle = "none";
        list.style.padding = "0";
        hits.forEach(function (hit) {
          var li = d.createElement("li");
          var a = el("a", "card card--link");
          a.href = hit.p.u;
          a.appendChild(el("span", "eyebrow", hit.p.s || "Page"));
          a.appendChild(el("h3", null, hit.p.t));
          if (hit.p.d) a.appendChild(el("p", null, hit.p.d));
          a.appendChild(el("span", "card__more", "Open page"));
          li.appendChild(a);
          list.appendChild(li);
        });
        results.appendChild(list);
      });
    }

    var initial = new URLSearchParams(window.location.search).get("q") || searchRoot.getAttribute("data-query") || "";
    if (input && initial) input.value = initial;
    if (initial) run(initial);
    else if (summary) summary.textContent = "Search every city page, partner listing, review and guide on the site.";

    var form = searchRoot.tagName === "FORM" ? searchRoot : $("form", searchRoot);
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var q = (input && input.value || "").trim();
        run(q);
        try {
          var url = new URL(window.location.href);
          if (q) url.searchParams.set("q", q); else url.searchParams.delete("q");
          window.history.replaceState({}, "", url.toString());
        } catch (err) { /* history is a nicety, not a requirement */ }
      });
    }
  }

  /* ------------------------------------------------- open-now badges */
  $$("[data-hours-today]").forEach(function (node) {
    var today = new Date().getDay(); /* 0 = Sunday */
    var index = today === 0 ? 6 : today - 1;
    var rows = $$("tbody tr", node);
    if (rows[index]) rows[index].classList.add("is-today");
  });

  /* --------------------------------------------------- contact form */
  var contactForm = $("[data-contact-form]");
  if (contactForm) {
    contactForm.addEventListener("submit", function (e) {
      if (contactForm.getAttribute("action")) return; /* a real endpoint is configured */
      e.preventDefault();
      var status = $("[data-form-status]", contactForm);
      if ($("[name=fer_hp]", contactForm) && $("[name=fer_hp]", contactForm).value) return; /* honeypot */
      var name = ($("[name=name]", contactForm) || {}).value || "";
      var subject = ($("[name=subject]", contactForm) || {}).value || "Website enquiry";
      var message = ($("[name=message]", contactForm) || {}).value || "";
      var to = contactForm.getAttribute("data-mailto");
      if (!to) return;
      var body = "From: " + name + "\n\n" + message;
      window.location.href = "mailto:" + to + "?subject=" + encodeURIComponent(subject) +
        "&body=" + encodeURIComponent(body);
      if (status) status.textContent = "Opening your email app with the message ready to send.";
    });
  }
})();
