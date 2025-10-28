// main.js
document.addEventListener("DOMContentLoaded", () => {
  if (!document.querySelector(".player-bar")) return;

  const PlayerCore = window.PlayerCore;

  // DOM Elements
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
  const favBtn = document.querySelector(".fav-btn");
  let replayMode = 0; // 0 = off, 1 = repeat one, 2 = repeat all

  // -----------------------------
  // Player state change handler
  // -----------------------------
  function handlePlayerStateChange(event) {
    const p = PlayerCore.state.player;
    if (!p) return;

    if (event.data === YT.PlayerState.PLAYING) {
      startProgressUpdate();
      if (playBtnIcon) playBtnIcon.className = "far fa-pause-circle fa-2x";
      const duration = p.getDuration();
      PlayerCore.safeSetInner(
        totalTimeEl,
        PlayerCore.formatTime(duration),
        playerTitle,
        playerArtist
      );
    } else if (event.data === YT.PlayerState.PAUSED) {
      if (PlayerCore.state.rafId) cancelAnimationFrame(PlayerCore.state.rafId);
      if (playBtnIcon) playBtnIcon.className = "far fa-play-circle fa-2x";
    } else if (event.data === YT.PlayerState.ENDED) {
      if (PlayerCore.state.rafId) cancelAnimationFrame(PlayerCore.state.rafId);

      if (PlayerCore.state.replayMode === 1) {
        p.seekTo(0, true);
        p.playVideo();
      } else if (PlayerCore.state.replayMode === 2) {
        window.currentIndex =
          (window.currentIndex + 1) % window.currentPlaylist.length;
        playVideoFromList(window.currentIndex);
      } else {
        if (playBtnIcon) playBtnIcon.className = "far fa-play-circle fa-2x";
      }
    }

    // Update progress
    function startProgressUpdate() {
      if (PlayerCore.state.rafId) cancelAnimationFrame(PlayerCore.state.rafId);

      function update() {
        try {
          if (
            p.getPlayerState() === YT.PlayerState.PLAYING &&
            !PlayerCore.state.isDraggingProgress
          ) {
            const current = p.getCurrentTime();
            const duration = p.getDuration();
            if (duration > 0) {
              const percent = (current / duration) * 100;
              if (progressSlider) {
                progressSlider.value = percent;
                PlayerCore.updateSliderBackground(progressSlider);
              }
              PlayerCore.safeSetInner(
                currentTimeEl,
                PlayerCore.formatTime(current),
                playerTitle,
                playerArtist
              );
            }
          }
        } catch {}
        PlayerCore.state.rafId = requestAnimationFrame(update);
      }

      update();
    }
  }

  // -----------------------------
  // Initialize Player
  // -----------------------------
  PlayerCore.initPlayer(handlePlayerStateChange);

  // Expose globals for favorites.js
  window.currentPlaylist = PlayerCore.state.currentPlaylist;
  window.currentIndex = PlayerCore.state.currentIndex;
  // ✅ Check nếu bài đầu tiên đã nằm trong favorites
  if (window.currentPlaylist.length > 0) {
    updateFavButton(window.currentPlaylist[window.currentIndex]);
  }

  window.playVideoById = async function (id, title, artist, thumb) {
    const index = window.currentPlaylist.findIndex((t) => t.id.videoId === id);
    if (index === -1) return;
    window.currentIndex = index;

    const p = await PlayerCore.state.playerReady;
    p.loadVideoById(id);
    p.playVideo();

    const track = window.currentPlaylist[index];
    if (track) {
      PlayerCore.safeSetInner(playerTitle, title, playerTitle, playerArtist);
      PlayerCore.safeSetInner(playerArtist, artist, playerTitle, playerArtist);
      if (playerCover) playerCover.src = thumb;
      updateFavButton(track); // ✅ thêm dòng này
    }
  };

  function playVideoFromList(index) {
    const track = window.currentPlaylist[index];
    if (!track) return;
    window.currentIndex = index;
    playVideoById(
      track.id.videoId,
      track.snippet.title,
      track.snippet.channelTitle,
      track.snippet.thumbnails?.medium?.url || ""
    );
  }

  // -----------------------------
  // Play / Pause button
  // -----------------------------
  if (playBtn) {
    playBtn.addEventListener("click", async () => {
      const p = await PlayerCore.state.playerReady;
      if (!p) return;

      const state = p.getPlayerState();
      if (state === YT.PlayerState.PLAYING) p.pauseVideo();
      else p.playVideo();
    });
  }

  // -----------------------------
  // Next / Prev
  // -----------------------------
  if (nextBtn)
    nextBtn.addEventListener("click", () => {
      if (!window.currentPlaylist.length) return;
      window.currentIndex =
        (window.currentIndex + 1) % window.currentPlaylist.length;
      playVideoFromList(window.currentIndex);
    });

  if (prevBtn)
    prevBtn.addEventListener("click", () => {
      if (!window.currentPlaylist.length) return;
      window.currentIndex =
        (window.currentIndex - 1 + window.currentPlaylist.length) %
        window.currentPlaylist.length;
      playVideoFromList(window.currentIndex);
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
      PlayerCore.state.replayMode = replayMode; // ✅ thêm dòng này

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

  // -----------------------------
  // Progress slider
  // -----------------------------
  if (progressSlider) {
    progressSlider.addEventListener("input", async (e) => {
      const p = await PlayerCore.state.playerReady;
      if (!p) return;

      const percent = Number(e.target.value);
      const duration = p.getDuration();
      if (duration > 0) {
        const time = (percent / 100) * duration;
        p.seekTo(time, true);
      }
      PlayerCore.updateSliderBackground(progressSlider);
    });

    progressSlider.addEventListener("mousedown", () => {
      PlayerCore.state.isDraggingProgress = true;
    });
    progressSlider.addEventListener("mouseup", () => {
      PlayerCore.state.isDraggingProgress = false;
    });
  }

  // -----------------------------
  // Volume slider / mute
  // -----------------------------
  if (volumeSlider) {
    volumeSlider.value = PlayerCore.state.currentVolume;
    PlayerCore.updateSliderBackground(volumeSlider);

    volumeSlider.addEventListener("input", async (e) => {
      const v = Number(e.target.value);
      PlayerCore.state.currentVolume = v;
      const p = await PlayerCore.state.playerReady;
      if (!p) return;

      if (v === 0) {
        p.mute();
        PlayerCore.state.isMuted = true;
        if (volUpBtn) volUpBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
      } else {
        if (PlayerCore.state.isMuted) p.unMute();
        PlayerCore.state.isMuted = false;
        p.setVolume(v);
        if (volUpBtn) volUpBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
      }
      PlayerCore.updateSliderBackground(volumeSlider);
    });
  }

  if (volUpBtn) {
    volUpBtn.addEventListener("click", async () => {
      const p = await PlayerCore.state.playerReady;
      if (!p) return;

      if (!PlayerCore.state.isMuted) {
        p.mute();
        PlayerCore.state.isMuted = true;
        volUpBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
      } else {
        p.unMute();
        PlayerCore.state.isMuted = false;
        const vol = PlayerCore.state.currentVolume || 50;
        p.setVolume(vol);
        if (volumeSlider) {
          volumeSlider.value = vol;
          PlayerCore.updateSliderBackground(volumeSlider);
        }
        volUpBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
      }
    });
  }

  // -----------------------------
  // Favorites button
  // -----------------------------
  function updateFavButton(track) {
    if (!favBtn) return;
    const favIcon = favBtn.querySelector("i");
    if (!track) {
      if (favIcon) {
        favIcon.className = "fa-regular fa-heart";
        favIcon.style.color = "";
      }
      return;
    }

    const favs = JSON.parse(localStorage.getItem("favorites") || "[]");
    const exists = favs.find((t) => t.id.videoId === track.id.videoId);

    if (exists) {
      if (favIcon) {
        favIcon.className = "fa-solid fa-heart";
        favIcon.style.color = "red";
      }
    } else {
      if (favIcon) {
        favIcon.className = "fa-regular fa-heart";
        favIcon.style.color = "";
      }
    }
  }

  if (favBtn) {
    const favIcon = favBtn.querySelector("i");

    favBtn.addEventListener("click", () => {
      const track = window.currentPlaylist[window.currentIndex];
      if (!track) return;

      // Toggle favorite và nhận trạng thái mới
      const isFav = window.toggleFavorite(track);

      // Update nút trái tim ngay lập tức
      if (favIcon) {
        if (isFav) {
          favIcon.className = "fa-solid fa-heart";
          favIcon.style.color = "red";
        } else {
          favIcon.className = "fa-regular fa-heart";
          favIcon.style.color = "";
        }
      }
    });
  }

  // -----------------------------
  // Search
  // -----------------------------
  if (searchBtn && searchInput) {
    searchBtn.addEventListener("click", async () => {
      const q = searchInput.value.trim();
      if (!q) return;

      searchBtn.disabled = true;
      searchBtn.innerHTML =
        '<span class="spinner-border spinner-border-sm"></span> Đang tìm...';

      const results = await PlayerCore.searchYouTube(q);
      window.currentPlaylist = results;
      window.currentIndex = 0;

      // render search results
      searchResults.innerHTML = "";
      results.forEach((v, i) => {
        const div = document.createElement("div");
        div.className = "list-group-item d-flex align-items-center";
        div.innerHTML = `
          <img src="${
            v.snippet.thumbnails?.default?.url || ""
          }" class="rounded me-3" width="50" height="50"/>
          <div>
            <div class="fw-bold">${v.snippet.title}</div>
            <div class="small text-white-50">${v.snippet.channelTitle}</div>
          </div>
        `;
        div.addEventListener("click", () => playVideoFromList(i));
        searchResults.appendChild(div);
      });

      searchBtn.disabled = false;
      searchBtn.innerHTML = '<i class="fas fa-search"></i> Tìm';
    });

    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        searchBtn.click();
      }
    });
  }
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

  console.log("main.js initialized");
});
