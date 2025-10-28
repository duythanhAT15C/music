document.addEventListener("DOMContentLoaded", () => {
  if (!document.querySelector(".player-bar")) return;

  // --- State ---
  let player;
  let playerReady = null;
  let currentVideoId = null;
  let isDraggingProgress = false;
  let replayMode = 0; // 0 = off, 1 = repeat one, 2 = repeat all
  let currentPlaylist = [];
  let currentIndex = 0;
  let currentVolume = 80;
  let rafId = null;
  let isMuted = false;

  // --- DOM ---
  const searchInput = document.getElementById("search-input");
  const searchBtn = document.getElementById("search-btn");
  const searchResults = document.getElementById("track-list");

  const playBtn = document.querySelector(".play-btn");
  const playBtnIcon = playBtn ? playBtn.querySelector("i") : null;

  const prevBtn = document.querySelector(".prev-btn");
  const nextBtn = document.querySelector(".next-btn");
  const replayBtn = document.querySelector(".replay-btn");
  const shuffleBtn = document.querySelector(".shuffle-btn");

  const playerTitle = document.querySelector(".player-title");
  const playerArtist = document.querySelector(".player-artist");
  const playerCover = document.querySelector(".player-cover");

  const progressSlider = document.querySelector(".progress-slider");
  const currentTimeEl = document.getElementById("current-time");
  const totalTimeEl = document.getElementById("total-time");

  const volumeSlider = document.querySelector(".volume-slider");
  const volUpBtn = document.querySelector(".volume-up");

  // -------------------------
  // Marquee/Scrolling Logic
  // -------------------------
  function updateMarquee() {
    // Function to process one element (Title or Artist)
    function processMarquee(el) {
      if (!el) return;

      // 1. Clean up previous scrolling state
      el.classList.remove("is-scrolling");
      // Restore original text content (remove the <span> wrapper)
      const text = el.textContent;
      el.textContent = text;

      // 2. Check if content is wider than container
      // If scrollWidth > clientWidth, the text is being clipped
      if (el.scrollWidth > el.clientWidth) {
        // 3. Apply scrolling logic
        const originalText = el.textContent;

        // Add a wrapper span for the animation
        const span = document.createElement("span");
        span.className = "scrolling-text";
        span.textContent = originalText;

        el.classList.add("is-scrolling"); // Mark the container for CSS targeting
        el.innerHTML = "";
        el.appendChild(span);
      }
    }

    processMarquee(playerTitle);
    processMarquee(playerArtist);
  }

  // -------------------------
  // Helpers (Consolidated safeSetInner)
  // -------------------------
  function formatTime(seconds) {
    if (isNaN(seconds) || seconds === Infinity || seconds < 0) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  // Consolidated safeSetInner to call Marquee
  function safeSetInner(el, text) {
    if (el) {
      el.textContent = text;
      // Only update marquee if text is being set for player title/artist
      if (el === playerTitle || el === playerArtist) {
        // Use requestAnimationFrame để đảm bảo DOM đã render và đo lường chính xác
        requestAnimationFrame(updateMarquee);
      }
    }
  }

  function updateSliderBackground(slider) {
    const value = slider.value;
    slider.style.background = `linear-gradient(to right, #00ff88 0%, #00ff88 ${value}%, #444 ${value}%, #444 100%)`;
  }

  // -------------------------
  // YouTube Iframe Player
  // -------------------------
  playerReady = new Promise((resolve) => {
    function initPlayer() {
      player = new YT.Player("youtube-player", {
        height: "1",
        width: "1",
        videoId: "",
        playerVars: { autoplay: 0, controls: 0, origin: location.origin },
        events: {
          onReady: (e) => {
            e.target.setVolume(currentVolume);
            resolve(e.target);
          },
          onStateChange: handlePlayerStateChange,
        },
      });
    }

    if (window.YT && YT.Player) initPlayer();
    else window.onYouTubeIframeAPIReady = initPlayer;
  });

  // -------------------------
  // Search
  // -------------------------
  async function searchYouTube(query) {
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
      if (videoIds.length === 0) return [];

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
  }

  function renderSearchResults(videos) {
    if (!searchResults) return;
    searchResults.innerHTML = "";
    if (!videos || videos.length === 0) {
      searchResults.innerHTML = `<div class="text-muted small">Không tìm thấy bài hát nào.</div>`;
      return;
    }

    currentPlaylist = videos;
    currentIndex = 0;

    videos.forEach((video, index) => {
      const div = document.createElement("div");
      div.className = "list-group-item d-flex align-items-center";
      div.innerHTML = `
        <img src="${
          video.snippet.thumbnails?.default?.url || ""
        }" class="rounded me-3" width="50" height="50"/>
        <div>
          <div class="fw-bold">${video.snippet.title}</div>
          <div class="small text-white-50">${video.snippet.channelTitle}</div>
        </div>
      `;
      div.addEventListener("click", () => playVideoFromList(index));
      searchResults.appendChild(div);
    });
  }

  // -------------------------
  // Play video
  // -------------------------
  async function playVideoFromList(index) {
    if (!currentPlaylist || !currentPlaylist[index]) return;
    currentIndex = index;
    currentVideoId = currentPlaylist[index].id.videoId;
    const p = await playerReady;
    p.loadVideoById(currentVideoId);
    p.playVideo();

    if (isMuted) p.mute();
    else {
      p.unMute();
      p.setVolume(currentVolume);
    }

    if (progressSlider) {
      progressSlider.value = 0;
      updateSliderBackground(progressSlider);
    }
    safeSetInner(currentTimeEl, "0:00");
    safeSetInner(totalTimeEl, "0:00");

    // Dùng safeSetInner đã sửa lỗi để gọi Marquee
    safeSetInner(playerTitle, currentPlaylist[index].snippet.title);
    safeSetInner(playerArtist, currentPlaylist[index].snippet.channelTitle);

    if (playerCover)
      playerCover.src = `https://img.youtube.com/vi/${currentVideoId}/default.jpg`;
    if (playBtnIcon) playBtnIcon.className = "far fa-pause-circle fa-2x";
    updateFavButton();
  }

  // -------------------------
  // Play/Pause button
  // -------------------------
  if (playBtn) {
    playBtn.addEventListener("click", async () => {
      if (!currentPlaylist.length) return;
      if (!currentVideoId) return playVideoFromList(currentIndex);
      const p = await playerReady;
      const state = p.getPlayerState();
      if (state === YT.PlayerState.PLAYING) {
        p.pauseVideo();
        if (playBtnIcon) playBtnIcon.className = "far fa-play-circle fa-2x";
      } else {
        p.playVideo();
        if (playBtnIcon) playBtnIcon.className = "far fa-pause-circle fa-2x";
      }
    });
  }

  // -------------------------
  // Next / Prev
  // -------------------------
  if (nextBtn)
    nextBtn.addEventListener("click", () => {
      if (!currentPlaylist.length) return;
      currentIndex = (currentIndex + 1) % currentPlaylist.length;
      playVideoFromList(currentIndex);
    });

  if (prevBtn)
    prevBtn.addEventListener("click", async () => {
      if (!currentPlaylist.length) return;
      const p = await playerReady;
      try {
        const time = p.getCurrentTime();
        if (time > 3) {
          p.seekTo(0, true);
          return;
        }
      } catch {}
      currentIndex =
        (currentIndex - 1 + currentPlaylist.length) % currentPlaylist.length;
      playVideoFromList(currentIndex);
    });

  // -------------------------
  // Replay button
  // -------------------------
  if (replayBtn) {
    function updateReplayUI() {
      replayBtn.classList.remove("mode-off", "mode-one", "mode-all");
      if (replayMode === 0) {
        replayBtn.title = "Lặp lại: Tắt";
        replayBtn.innerHTML = '<i class="fas fa-redo"></i>';
      } else if (replayMode === 1) {
        replayBtn.title = "Lặp lại: 1 bài";
        replayBtn.classList.add("mode-one");
        replayBtn.innerHTML = `<i class="fas fa-redo"></i><span class="small replay-badge">1</span>`;
      } else {
        replayBtn.title = "Lặp lại: Danh sách";
        replayBtn.classList.add("mode-all");
        replayBtn.innerHTML = `<i class="fas fa-sync-alt"></i>`;
      }
    }
    replayBtn.addEventListener("click", () => {
      replayMode = (replayMode + 1) % 3;
      updateReplayUI();
    });
    updateReplayUI();
  }

  // -------------------------
  // Shuffle
  // -------------------------
  if (shuffleBtn)
    shuffleBtn.addEventListener("click", () => {
      if (!currentPlaylist.length) return;
      let randomIndex;
      if (currentPlaylist.length === 1) randomIndex = 0;
      else
        do {
          randomIndex = Math.floor(Math.random() * currentPlaylist.length);
        } while (randomIndex === currentIndex);
      playVideoFromList(randomIndex);
    });

  // -------------------------
  // Player state changes
  // -------------------------
  async function handlePlayerStateChange(event) {
    const p = await playerReady;
    if (event.data === YT.PlayerState.PLAYING) {
      p.setVolume(currentVolume);
      startProgressUpdate();
      if (playBtnIcon) playBtnIcon.className = "far fa-pause-circle fa-2x";
      const duration = p.getDuration();
      safeSetInner(totalTimeEl, formatTime(duration));
    } else if (event.data === YT.PlayerState.PAUSED) {
      if (rafId) cancelAnimationFrame(rafId);
      if (playBtnIcon) playBtnIcon.className = "far fa-play-circle fa-2x";
    } else if (event.data === YT.PlayerState.ENDED) {
      if (rafId) cancelAnimationFrame(rafId);
      if (replayMode === 1) {
        p.seekTo(0, true);
        p.playVideo();
      } else if (replayMode === 2) {
        currentIndex = (currentIndex + 1) % currentPlaylist.length;
        playVideoFromList(currentIndex);
      } else if (playBtnIcon) {
        playBtnIcon.className = "far fa-play-circle fa-2x";
      }
    }
  }

  // -------------------------
  // Progress slider
  // -------------------------
  async function startProgressUpdate() {
    const p = await playerReady;
    if (rafId) cancelAnimationFrame(rafId);

    function update() {
      try {
        if (
          p.getPlayerState() === YT.PlayerState.PLAYING &&
          !isDraggingProgress
        ) {
          const current = p.getCurrentTime();
          const duration = p.getDuration();
          if (duration > 0) {
            const percent = (current / duration) * 100;
            if (progressSlider) {
              progressSlider.value = percent;
              updateSliderBackground(progressSlider);
            }
            safeSetInner(currentTimeEl, formatTime(current));
          }
        }
      } catch {}
      rafId = requestAnimationFrame(update);
    }
    update();
  }

  if (progressSlider) {
    progressSlider.addEventListener("input", async (e) => {
      isDraggingProgress = true;
      const p = await playerReady;
      if (!p || !currentVideoId) return;
      const percent = Number(e.target.value);
      const duration = p.getDuration() || 0;
      const newTime = (percent / 100) * duration;
      safeSetInner(currentTimeEl, formatTime(newTime));
      updateSliderBackground(progressSlider);
      if (rafId) cancelAnimationFrame(rafId);
    });

    progressSlider.addEventListener("change", async (e) => {
      const p = await playerReady;
      if (!p || !currentVideoId) {
        isDraggingProgress = false;
        return;
      }
      const percent = Number(e.target.value);
      const duration = p.getDuration() || 0;
      const newTime = (percent / 100) * duration;
      try {
        p.seekTo(newTime, true);
        if (progressSlider) {
          progressSlider.value = percent;
          updateSliderBackground(progressSlider);
        }
        safeSetInner(currentTimeEl, formatTime(newTime));
        if (p.getPlayerState() !== YT.PlayerState.PLAYING) p.playVideo();
      } catch {}
      setTimeout(() => {
        isDraggingProgress = false;
      }, 100);
    });
  }

  // -------------------------
  // Volume slider
  // -------------------------
  if (volumeSlider) {
    volumeSlider.value = currentVolume;
    updateSliderBackground(volumeSlider);

    volumeSlider.addEventListener("input", async (e) => {
      const v = Number(e.target.value);
      currentVolume = v;
      const p = await playerReady;
      try {
        p.setVolume(currentVolume);
        if (v === 0) {
          p.mute();
          isMuted = true;
          volUpBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
        } else {
          if (isMuted) {
            p.unMute();
            isMuted = false;
          }
          volUpBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
        }
      } catch {}
      updateSliderBackground(volumeSlider);
    });
  }

  if (volUpBtn) {
    volUpBtn.addEventListener("click", async () => {
      const p = await playerReady;
      if (!p) return;
      if (!isMuted) {
        p.mute();
        isMuted = true;
        volUpBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
      } else {
        p.unMute();
        isMuted = false;
        if (currentVolume === 0) currentVolume = 50;
        p.setVolume(currentVolume);
        if (volumeSlider) {
          volumeSlider.value = currentVolume;
          updateSliderBackground(volumeSlider);
        }
        volUpBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
      }
    });
  }

  // -------------------------
  // Search button
  // -------------------------
  if (searchBtn && searchInput) {
    searchBtn.addEventListener("click", async () => {
      const q = searchInput.value.trim();
      if (!q) return;
      searchBtn.disabled = true;
      searchBtn.innerHTML =
        '<span class="spinner-border spinner-border-sm"></span> Đang tìm...';
      const results = await searchYouTube(q);
      currentPlaylist = results;
      currentIndex = 0;
      renderSearchResults(results);
      searchBtn.disabled = false;
      searchBtn.innerHTML = '<i class="fas fa-search"></i> Tìm';
      // if (results.length) playVideoFromList(0);
    });

    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        searchBtn.click();
      }
    });
  }
  // -------------------------
  // Favorite songs (localStorage)
  // -------------------------
  const favBtn = document.querySelector(".fav-btn");
  let favorites = JSON.parse(sessionStorage.getItem("favorites") || "[]");

  function saveFavorites() {
    sessionStorage.setItem("favorites", JSON.stringify(favorites));
  }

  function toggleFavorite() {
    if (!currentPlaylist.length || currentIndex === undefined) return;
    const song = currentPlaylist[currentIndex];
    if (!song?.id?.videoId) return;

    const videoId = song.id.videoId;
    const index = favorites.findIndex((f) => f.id.videoId === videoId);

    if (index === -1) {
      favorites.push(song);
      favBtn.innerHTML = '<i class="fa-solid fa-heart"></i>';
    } else {
      favorites.splice(index, 1);
      favBtn.innerHTML = '<i class="fa-regular fa-heart"></i>';
    }
    saveFavorites();
  }

  function updateFavButton() {
    if (!currentPlaylist.length || currentIndex === undefined) return;
    const song = currentPlaylist[currentIndex];
    if (!song?.id?.videoId) return;

    const isFav = favorites.some((f) => f.id.videoId === song.id.videoId);
    favBtn.innerHTML = isFav
      ? '<i class="fa-solid fa-heart"></i>'
      : '<i class="fa-regular fa-heart"></i>';
  }

  if (favBtn) {
    favBtn.addEventListener("click", () => {
      toggleFavorite();
      updateFavButton(); // cập nhật lại ngay
    });
  }

  console.log("script.js initialized");
});

// -------------------------
// Sidebar toggle mobile
// -------------------------
const burgerBtn = document.querySelector(".burger-btn");
const sidebar = document.querySelector(".sidebar");
const overlay = document.getElementById("overlay");

if (burgerBtn && sidebar && overlay) {
  burgerBtn.addEventListener("click", () => {
    sidebar.classList.add("active");
    overlay.classList.add("active");
  });

  overlay.addEventListener("click", () => {
    sidebar.classList.remove("active");
    overlay.classList.remove("active");
  });
}
