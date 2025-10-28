// favorites.js
document.addEventListener("DOMContentLoaded", () => {
  // --- DOM elements (nếu tồn tại) ---
  const favListEl = document.getElementById("fav-track-list");
  const searchInput = document.getElementById("fav-search-input");
  const searchBtn = document.getElementById("fav-search-btn");

  // --- Lấy danh sách yêu thích từ localStorage ---
  function getFavorites() {
    return JSON.parse(localStorage.getItem("favorites") || "[]");
  }

  // --- Render danh sách yêu thích ---
  function renderFavorites(list) {
    if (!favListEl) return; // check null trên home
    favListEl.innerHTML = "";
    if (!list.length) {
      favListEl.innerHTML =
        '<div class="text-muted">Chưa có bài hát yêu thích nào.</div>';
      return;
    }

    list.forEach((track) => {
      const videoId = track.id?.videoId;
      const title = track.snippet?.title || "Không rõ tên bài hát";
      const artist = track.snippet?.channelTitle || "Không rõ nghệ sĩ";
      const thumb =
        track.snippet?.thumbnails?.default?.url || track.thumb || "";

      const item = document.createElement("div");
      item.className =
        "list-group-item list-group-item-action d-flex justify-content-between align-items-center";
      item.innerHTML = `
        <div class="d-flex align-items-center" style="cursor:pointer" data-id="${videoId}">
          <img src="${thumb}" width="50" height="50" class="rounded me-3"/>
          <div>
            <strong>${title}</strong><br>
            <small>${artist}</small>
          </div>
        </div>
      `;
      favListEl.appendChild(item);
    });
  }

  // --- Toggle favorite (dùng chung cho home + favorites) ---
  window.toggleFavorite = function (track) {
    if (!track) return;

    let favs = getFavorites();
    const exists = favs.find((t) => t.id.videoId === track.id.videoId);

    if (exists) {
      // Xóa khỏi favorites
      favs = favs.filter((t) => t.id.videoId !== track.id.videoId);
    } else {
      // Thêm vào favorites
      favs.push({
        ...track,
        thumb:
          track.snippet?.thumbnails?.medium?.url ||
          track.snippet?.thumbnails?.default?.url ||
          "",
      });
    }

    localStorage.setItem("favorites", JSON.stringify(favs));
    renderFavorites(favs); // Live update danh sách
    return !exists; // trả về trạng thái hiện tại: true = đã thích
  };

  // --- Click trên danh sách favorite (chỉ nếu favListEl tồn tại) ---
  if (favListEl) {
    favListEl.addEventListener("click", (e) => {
      if (e.target.closest(".remove-fav")) {
        const id = e.target.closest(".remove-fav").dataset.id;
        let list = getFavorites();
        list = list.filter((t) => t.id.videoId !== id);
        localStorage.setItem("favorites", JSON.stringify(list));
        renderFavorites(list);
        return;
      }

      const item = e.target.closest("[data-id]");
      if (item) {
        const id = item.dataset.id;
        const list = getFavorites();
        const track = list.find((t) => t.id.videoId === id);
        if (!track) return;

        window.currentPlaylist = list;
        window.currentIndex = list.findIndex((t) => t.id.videoId === id);

        const title = track.snippet?.title || track.title;
        const artist = track.snippet?.channelTitle || track.artist;
        const thumb = track.snippet?.thumbnails?.default?.url || track.thumb;

        if (typeof window.playVideoById === "function") {
          window.playVideoById(id, title, artist, thumb);
        }
      }
    });
  }

  // --- Tìm kiếm (chỉ nếu searchInput + searchBtn tồn tại) ---
  if (searchBtn && searchInput) {
    searchBtn.addEventListener("click", () => {
      const keyword = searchInput.value.trim().toLowerCase();
      const list = getFavorites();
      const filtered = list.filter(
        (t) =>
          (t.snippet?.title || t.title || "").toLowerCase().includes(keyword) ||
          (t.snippet?.channelTitle || t.artist || "")
            .toLowerCase()
            .includes(keyword)
      );
      renderFavorites(filtered);
    });
  }
  // --- Search -----
  // Thêm ở favorites.js hoặc trong main.js nhưng check id
  const favSearchInput = document.getElementById("fav-search-input");
  const favSearchBtn = document.getElementById("fav-search-btn");

  if (favSearchInput && favSearchBtn) {
    // Nhấn Enter cũng trigger click
    favSearchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        favSearchBtn.click();
      }
    });

    favSearchBtn.addEventListener("click", () => {
      const query = favSearchInput.value.trim().toLowerCase();
      const favorites = JSON.parse(localStorage.getItem("favorites") || "[]");

      // 🔹 Hiển thị loading
      favSearchBtn.disabled = true;
      const originalHTML = favSearchBtn.innerHTML;
      favSearchBtn.innerHTML =
        '<span class="spinner-border spinner-border-sm"></span> Đang tìm...';

      // 🔹 Giả lập delay 200ms để thấy spinner (nếu muốn, optional)
      setTimeout(() => {
        const filtered = favorites.filter(
          (f) =>
            f.snippet?.title.toLowerCase().includes(query) ||
            f.snippet?.channelTitle.toLowerCase().includes(query)
        );

        renderFavorites(filtered);

        // Reset nút
        favSearchBtn.disabled = false;
        favSearchBtn.innerHTML = originalHTML;
      }, 100); // 100ms là đủ load spinner
    });
  }

  // --- Khởi tạo trang ---
  renderFavorites(getFavorites());
  window.currentPlaylist = getFavorites();
  window.currentIndex = 0;
});
