let player; // YouTube player
let currentVideoId = null;

// ✅ Gắn vào window để YouTube API nhận ra
window.onYouTubeIframeAPIReady = function () {
  player = new YT.Player("youtube-player", {
    height: "1",
    width: "1",
    playerVars: { autoplay: 0, controls: 0 },
    events: {
      onReady: () => console.log("✅ YouTube Player ready"),
    },
  });
};

// Hàm phát nhạc
function playVideoById(videoId, title, artist, thumb) {
  if (!player || typeof player.loadVideoById !== "function") {
    console.warn("⚠️ Player chưa sẵn sàng!");
    return;
  }

  currentVideoId = videoId;
  player.loadVideoById(videoId);

  // Cập nhật giao diện player-bar
  document.querySelector(".player-title").textContent = title || "Không rõ tên";
  document.querySelector(".player-artist").textContent = artist || "---";
  document.querySelector(".player-cover").src =
    thumb || "https://placehold.co/60";

  const playBtn = document.querySelector(".play-btn i");
  playBtn.classList.remove("fa-play-circle");
  playBtn.classList.add("fa-pause-circle");
}

// Toggle play/pause
document.querySelector(".play-btn").addEventListener("click", () => {
  if (!player) return;
  const state = player.getPlayerState();
  const icon = document.querySelector(".play-btn i");

  if (state === YT.PlayerState.PLAYING) {
    player.pauseVideo();
    icon.classList.remove("fa-pause-circle");
    icon.classList.add("fa-play-circle");
  } else {
    player.playVideo();
    icon.classList.remove("fa-play-circle");
    icon.classList.add("fa-pause-circle");
  }
});

// ✅ Debug: kiểm tra khi API load xong
console.log("📢 player.js loaded");

// 👉 Đưa đoạn này XUỐNG DƯỚI
if (window.YT && window.YT.Player) {
  console.log("⚡ YT API đã sẵn sàng, tự tạo player");
  window.onYouTubeIframeAPIReady();
}
