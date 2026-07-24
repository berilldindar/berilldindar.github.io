const menuButton = document.querySelector("[data-menu-button]");
const menu = document.querySelector("[data-menu]");

if (menuButton && menu) {
  menuButton.addEventListener("click", () => {
    const open = menuButton.getAttribute("aria-expanded") === "true";
    menuButton.setAttribute("aria-expanded", String(!open));
    menu.classList.toggle("is-open", !open);
  });
}

const filterButtons = [...document.querySelectorAll("[data-filter]")];
const postCards = [...document.querySelectorAll("[data-post-card]")];
const searchInput = document.querySelector("[data-post-search]");
let activeFilter = "Tümü";

function filterPosts() {
  const query = (searchInput?.value || "").trim().toLocaleLowerCase("tr");

  postCards.forEach((card) => {
    const category = card.dataset.category || "";
    const searchable = card.dataset.search || "";
    const matchesCategory = activeFilter === "Tümü" || category === activeFilter;
    const matchesSearch = !query || searchable.toLocaleLowerCase("tr").includes(query);
    card.hidden = !(matchesCategory && matchesSearch);
  });

  const visible = postCards.filter((card) => !card.hidden).length;
  const empty = document.querySelector("[data-empty-state]");
  if (empty) empty.hidden = visible > 0;
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    filterButtons.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    filterPosts();
  });
});

searchInput?.addEventListener("input", filterPosts);

const progress = document.querySelector("[data-reading-progress]");
if (progress) {
  const updateProgress = () => {
    const height = document.documentElement.scrollHeight - window.innerHeight;
    const amount = height > 0 ? (window.scrollY / height) * 100 : 0;
    progress.style.width = `${Math.min(100, amount)}%`;
  };
  updateProgress();
  window.addEventListener("scroll", updateProgress, { passive: true });
}

document.querySelectorAll("pre").forEach((pre) => {
  const button = document.createElement("button");
  button.className = "copy-code";
  button.type = "button";
  button.textContent = "Kopyala";
  button.setAttribute("aria-label", "Kod örneğini kopyala");
  button.addEventListener("click", async () => {
    await navigator.clipboard.writeText(pre.innerText);
    button.textContent = "Kopyalandı!";
    window.setTimeout(() => { button.textContent = "Kopyala"; }, 1600);
  });
  pre.append(button);
});

document.querySelector("[data-year]")?.replaceChildren(String(new Date().getFullYear()));
