// player-core.js
// Chứa logic chính của YouTube Player, state, helper functions

window.PlayerCore = {
  state: {
    player: null,
    playerReady: null,
    currentVideoId: null,
    isDraggingProgress: false,
    replayMode: 0, // 0 = off, 1 = repeat one, 2 = repeat all
    currentPlaylist: [],
    currentIndex: 0,
    currentVolume: 80,
    rafId: null,
    isMuted: false,
    favorites: JSON.parse(sessionStorage.getItem("favorites") || "[]"),
  },

  // -------------------------
  // Helpers
  // -------------------------
  formatTime: function (seconds) {
    if (isNaN(seconds) || seconds === Infinity || seconds < 0) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  },

  updateSliderBackground: function (slider) {
    const value = slider.value;
    slider.style.background = `linear-gradient(to right, #00ff88 0%, #00ff88 ${value}%, #444 ${value}%, #444 100%)`;
  },

  updateMarquee: function (playerTitle, playerArtist) {
    function processMarquee(el) {
      if (!el) return;
      el.classList.remove("is-scrolling");
      const text = el.textContent;
      el.textContent = text;

      if (el.scrollWidth > el.clientWidth) {
        const originalText = el.textContent;
        const span = document.createElement("span");
        span.className = "scrolling-text";
        span.textContent = originalText;

        el.classList.add("is-scrolling");
        el.innerHTML = "";
        el.appendChild(span);
      }
    }
    processMarquee(playerTitle);
    processMarquee(playerArtist);
  },

  safeSetInner: function (el, text, playerTitle, playerArtist) {
    if (!el) return;
    el.textContent = text;
    if (el === playerTitle || el === playerArtist) {
      requestAnimationFrame(() =>
        this.updateMarquee(playerTitle, playerArtist)
      );
    }
  },

  initPlayer: function (onStateChange) {
    const self = this;
    self.state.playerReady = new Promise((resolve) => {
      function init() {
        self.state.player = new YT.Player("youtube-player", {
          height: "1",
          width: "1",
          videoId: "",
          playerVars: { autoplay: 0, controls: 0, origin: location.origin },
          events: {
            onReady: (e) => {
              e.target.setVolume(self.state.currentVolume);
              resolve(e.target);
            },
            onStateChange: onStateChange,
          },
        });
      }

      if (window.YT && YT.Player) init();
      else window.onYouTubeIframeAPIReady = init;
    });
  },

  searchYouTube: async function (query) {
    try {
      const API_KEY = "AIzaSyCPuU6j2TGV85R9bSTbOs-8DtRARTfR_z0";
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=15&q=${encodeURIComponent(
          query + " music"
        )}&videoCategoryId=10&key=${API_KEY}`
      );
      const data = await res.json();
      if (!data.items || data.items.length === 0) return [];

      const videoIds = data.items.map((it) => it.id.videoId).filter(Boolean);
      if (!videoIds.length) return [];

      const detailsRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id=${videoIds.join(
          ","
        )}&key=${API_KEY}`
      );
      const detailsData = await detailsRes.json();

      const items = (detailsData.items || []).map((it) => ({
        id: { videoId: it.id },
        snippet: it.snippet,
        duration: it.contentDetails?.duration || "PT0S",
      }));

      function parseISODuration(d) {
        const h = (d.match(/(\d+)H/) || [0, 0])[1] || 0;
        const m = (d.match(/(\d+)M/) || [0, 0])[1] || 0;
        const s = (d.match(/(\d+)S/) || [0, 0])[1] || 0;
        return Number(h) * 3600 + Number(m) * 60 + Number(s);
      }

      return items.filter((v) => parseISODuration(v.duration) >= 60);
    } catch (err) {
      console.error("searchYouTube error:", err);
      return [];
    }
  },

  saveFavorites: function () {
    sessionStorage.setItem("favorites", JSON.stringify(this.state.favorites));
  },

  toggleFavorite: function (currentIndex) {
    if (!this.state.currentPlaylist.length || currentIndex === undefined)
      return;
    const song = this.state.currentPlaylist[currentIndex];
    if (!song?.id?.videoId) return;

    const videoId = song.id.videoId;
    const index = this.state.favorites.findIndex(
      (f) => f.id.videoId === videoId
    );

    if (index === -1) this.state.favorites.push(song);
    else this.state.favorites.splice(index, 1);

    this.saveFavorites();
  },

  isFavorite: function (currentIndex) {
    if (!this.state.currentPlaylist.length || currentIndex === undefined)
      return false;
    const song = this.state.currentPlaylist[currentIndex];
    return this.state.favorites.some((f) => f.id.videoId === song.id.videoId);
  },
};
