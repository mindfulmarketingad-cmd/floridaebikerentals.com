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
      if ($("[name=company]", contactForm) && $("[name=company]", contactForm).value) return; /* honeypot */
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
