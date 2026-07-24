import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "dist");
const contentRoot = join(root, "content");

async function readJson(filename) {
  try {
    return JSON.parse(await readFile(join(contentRoot, filename), "utf8"));
  } catch (error) {
    throw new Error(`${filename} okunamadı: ${error.message}`);
  }
}

const profile = await readJson("profile.json");
const projects = await readJson("projects.json");
const experience = await readJson("experience.json");
const certificates = await readJson("certificates.json");
const site = profile.site;

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function parseScalar(value) {
  const clean = value.trim();
  if (clean === "true") return true;
  if (clean === "false") return false;
  if (clean.startsWith("[") && clean.endsWith("]")) {
    return clean.slice(1, -1).split(",").map((item) => item.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
  }
  return clean.replace(/^["']|["']$/g, "");
}

function parsePost(source, filename) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) throw new Error(`${filename}: front matter bulunamadı.`);
  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const divider = line.indexOf(":");
    if (divider < 0) continue;
    meta[line.slice(0, divider).trim()] = parseScalar(line.slice(divider + 1));
  }
  const slug = basename(filename, ".md").replace(/^\d{4}-\d{2}-\d{2}-/, "");
  const words = match[2].trim().split(/\s+/).length;
  return { ...meta, slug, body: match[2].trim(), readingTime: Math.max(1, Math.ceil(words / 190)) };
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\[([^\]]+)\]\((\/[^)]+)\)/g, '<a href="$2">$1</a>');
}

function markdownToHtml(markdown) {
  const lines = markdown.split(/\r?\n/);
  const output = [];
  let paragraph = [];
  let list = [];
  let code = [];
  let language = "";
  let inCode = false;

  const flushParagraph = () => {
    if (paragraph.length) output.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (list.length) output.push(`<ul>${list.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ul>`);
    list = [];
  };

  for (const line of lines) {
    const codeFence = line.match(/^```(.*)$/);
    if (codeFence) {
      if (inCode) {
        output.push(`<pre><code${language ? ` class="language-${escapeHtml(language)}"` : ""}>${escapeHtml(code.join("\n"))}</code></pre>`);
        code = [];
        language = "";
        inCode = false;
      } else {
        flushParagraph();
        flushList();
        language = codeFence[1].trim();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      code.push(line);
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = line.match(/^(#{2,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      const id = heading[2].toLocaleLowerCase("tr").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9çğıöşü]+/gi, "-").replace(/^-|-$/g, "");
      output.push(`<h${level} id="${id}">${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }
    if (line.startsWith("> ")) {
      flushParagraph();
      flushList();
      output.push(`<blockquote>${inlineMarkdown(line.slice(2))}</blockquote>`);
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      flushParagraph();
      list.push(line.replace(/^[-*]\s+/, ""));
      continue;
    }
    paragraph.push(line.trim());
  }
  flushParagraph();
  flushList();
  return output.join("\n");
}

function formatDate(value) {
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" })
    .format(new Date(`${value}T12:00:00`));
}

function nav(active) {
  const items = [["Ana Sayfa", "/"], ["Yazılar", "/blog/"], ["Projeler", "/projeler/"], ["Hakkımda", "/hakkimda/"]];
  return `
    <a class="brand" href="/" aria-label="${escapeHtml(profile.identity.name)} ana sayfa">
      <span class="brand-mark">&lt;/&gt;</span>
      <span>${escapeHtml(profile.identity.shortName)}<span class="brand-dot">.</span></span>
    </a>
    <button class="menu-button" type="button" aria-label="Menüyü aç" aria-expanded="false" data-menu-button>
      <span></span><span></span>
    </button>
    <nav class="site-nav" aria-label="Ana menü" data-menu>
      ${items.map(([label, href]) => `<a href="${href}"${active === href ? ' aria-current="page"' : ""}>${label}</a>`).join("")}
      <a class="nav-note" href="mailto:${escapeHtml(profile.identity.email)}">İletişime geçin <span>↗</span></a>
    </nav>`;
}

function layout({ title, description = site.description, active = "", content, pageClass = "", article = false }) {
  const fullTitle = title === site.title ? title : `${title} · ${site.title}`;
  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(fullTitle)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="theme-color" content="#071d33">
  <link rel="canonical" href="${site.url}${active || "/"}">
  <meta property="og:title" content="${escapeHtml(fullTitle)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:type" content="${article ? "article" : "website"}">
  <meta property="og:url" content="${site.url}${active || "/"}">
  <meta property="og:image" content="${site.url}${escapeHtml(profile.images.socialPreview)}">
  <link rel="icon" href="${escapeHtml(profile.images.favicon)}">
  <link rel="alternate" type="application/rss+xml" title="${site.title}" href="/feed.xml">
  <link rel="stylesheet" href="/assets/site.css">
</head>
<body class="${pageClass}">
  ${article ? '<div class="reading-progress" data-reading-progress></div>' : ""}
  <header class="site-header"><div class="shell header-inner">${nav(active)}</div></header>
  <main>${content}</main>
  <footer class="site-footer">
    <div class="shell footer-grid">
      <div><a class="brand footer-brand" href="/"><span class="brand-mark">&lt;/&gt;</span><span>${escapeHtml(profile.identity.shortName)}<span class="brand-dot">.</span></span></a><p>${escapeHtml(profile.footer.tagline)}</p></div>
      <div class="footer-links"><a href="/blog/">Yazılar</a><a href="/projeler/">Projeler</a>${profile.socials.map((social) => `<a href="${escapeHtml(social.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(social.label)} ↗</a>`).join("")}</div>
      <p class="footer-note">© <span data-year></span> ${escapeHtml(profile.identity.name)}<br>${escapeHtml(profile.identity.location)}</p>
    </div>
  </footer>
  <script src="/assets/site.js" defer></script>
</body>
</html>`;
}

function tagList(tags = []) {
  return `<div class="tag-list">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>`;
}

function postCard(post, large = false) {
  return `<article class="post-card accent-${escapeHtml(post.accent || "azure")}${large ? " post-card-large" : ""}" data-post-card data-category="${escapeHtml(post.category)}" data-search="${escapeHtml([post.title, post.description, ...(post.tags || [])].join(" "))}">
    <div class="post-card-top"><span class="post-category">${escapeHtml(post.category)}</span><span>${post.readingTime} dk okuma</span></div>
    <h3><a href="/blog/${post.slug}/">${escapeHtml(post.title)}</a></h3>
    <p>${escapeHtml(post.description)}</p>
    ${tagList(post.tags)}
    <div class="post-card-bottom"><time datetime="${escapeHtml(post.date)}">${formatDate(post.date)}</time><a class="round-link" href="/blog/${post.slug}/" aria-label="${escapeHtml(post.title)} yazısını oku">↗</a></div>
  </article>`;
}

function projectCard(project, index) {
  const title = escapeHtml(project.title);
  const body = `<article class="project-card">
    <div class="project-number">0${index + 1}</div>
    <img src="${project.image}" alt="${title} proje görseli" loading="lazy">
    <div class="project-card-body">
      <div class="project-title-line"><h3>${title}</h3>${project.note ? `<span class="project-note">${escapeHtml(project.note)}</span>` : ""}</div>
      <p>${escapeHtml(project.description)}</p>
      ${tagList(project.tags)}
      ${project.url ? `<a class="text-link" href="${project.url}" target="_blank" rel="noopener noreferrer">Projeye göz at <span>↗</span></a>` : `<span class="text-link text-link-muted">Kod müşteriye özel</span>`}
    </div>
  </article>`;
  return body;
}

function homePage(posts) {
  const latest = posts.slice(0, 3);
  const content = `
  <section class="hero">
    <div class="hero-scribble hero-scribble-one" aria-hidden="true"></div>
    <div class="hero-scribble hero-scribble-two" aria-hidden="true"></div>
    <div class="shell hero-grid">
      <div class="hero-copy">
        <div class="eyebrow"><span class="status-dot"></span> ${escapeHtml(profile.hero.eyebrow)}</div>
        <h1>${escapeHtml(profile.hero.headlinePrefix)} <span>${escapeHtml(profile.hero.headlineHighlight)}</span><br>${escapeHtml(profile.hero.headlineMiddle)}<br><em>${escapeHtml(profile.hero.headlineEmphasis)}</em> ${escapeHtml(profile.hero.headlineSuffix)}</h1>
        <p>${escapeHtml(profile.hero.description)}</p>
        <div class="hero-actions">
          <a class="button button-primary" href="/blog/">${escapeHtml(profile.hero.primaryAction)} <span>→</span></a>
          <a class="button button-ghost" href="/projeler/">${escapeHtml(profile.hero.secondaryAction)}</a>
        </div>
        <div class="social-row" aria-label="Sosyal bağlantılar">
          ${profile.socials.map((social) => `<a href="${escapeHtml(social.url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(social.label)}">${escapeHtml(social.short)}</a>`).join("")}
          <span>${escapeHtml(profile.hero.socialLabel)}</span>
        </div>
      </div>
      <div class="hero-visual">
        <div class="portrait-ring"><img src="${escapeHtml(profile.images.hero)}" alt="${escapeHtml(profile.identity.name)}" fetchpriority="high"></div>
        <div class="float-note note-one">${escapeHtml(profile.hero.badges[0])}</div>
        <div class="float-note note-two">${escapeHtml(profile.hero.badges[1])}</div>
        <div class="float-code" aria-hidden="true">${escapeHtml(profile.hero.badges[2])}</div>
      </div>
    </div>
  </section>
  <section class="marquee" aria-label="Uzmanlık alanları"><div>${profile.hero.expertise.map(escapeHtml).join("&nbsp;&nbsp;•&nbsp;&nbsp; ")}</div></section>
  <section class="section shell">
    <div class="section-heading">
      <div><span class="kicker">${escapeHtml(profile.home.writingEyebrow)}</span><h2>${escapeHtml(profile.home.writingTitle)}<br><em>${escapeHtml(profile.home.writingEmphasis)}</em></h2></div>
      <p>${escapeHtml(profile.home.writingDescription)}</p>
    </div>
    <div class="post-grid">${latest.map((post, index) => postCard(post, index === 0)).join("")}</div>
    <a class="all-link" href="/blog/">Tüm yazıları gör <span>→</span></a>
  </section>
  <section class="section section-ink">
    <div class="shell">
      <div class="section-heading section-heading-light">
        <div><span class="kicker">${escapeHtml(profile.home.projectsEyebrow)}</span><h2>${escapeHtml(profile.home.projectsTitle)}<br><em>${escapeHtml(profile.home.projectsEmphasis)}</em></h2></div>
        <p>${escapeHtml(profile.home.projectsDescription)}</p>
      </div>
      <div class="project-preview">${projects.slice(0, 3).map(projectCard).join("")}</div>
      <a class="all-link all-link-light" href="/projeler/">Tüm projeler <span>→</span></a>
    </div>
  </section>
  <section class="section shell">
    <div class="hello-card">
      <div><span class="kicker">${escapeHtml(profile.home.contactEyebrow)}</span><h2>${escapeHtml(profile.home.contactTitle)}<br><em>${escapeHtml(profile.home.contactEmphasis)}</em></h2></div>
      <p>${escapeHtml(profile.home.contactDescription)}</p>
      <a class="button button-primary" href="mailto:${escapeHtml(profile.identity.email)}">${escapeHtml(profile.home.contactAction)} ↗</a>
    </div>
  </section>`;
  return layout({ title: site.title, active: "/", content, pageClass: "home-page" });
}

function blogPage(posts) {
  const categories = ["Tümü", ...new Set(posts.map((post) => post.category))];
  const content = `
  <section class="page-hero page-hero-blog">
    <div class="shell narrow-shell">
      <span class="kicker">${escapeHtml(profile.blog.eyebrow)}</span>
      <h1>${escapeHtml(profile.blog.title)}<br><em>${escapeHtml(profile.blog.emphasis)}</em></h1>
      <p>${escapeHtml(profile.blog.description)}</p>
    </div>
  </section>
  <section class="section shell">
    <div class="blog-tools">
      <label class="search-box"><span aria-hidden="true">⌕</span><span class="sr-only">Yazılarda ara</span><input type="search" placeholder="Yazılarda ara…" data-post-search></label>
      <div class="filter-row" aria-label="Yazı kategorileri">${categories.map((category, index) => `<button type="button" data-filter="${escapeHtml(category)}" aria-pressed="${index === 0}">${escapeHtml(category)}</button>`).join("")}</div>
    </div>
    <div class="post-grid post-grid-all">${posts.map(postCard).join("")}</div>
    <div class="empty-state" data-empty-state hidden><span>¯\\_(ツ)_/¯</span><h2>Bu aramaya uygun bir yazı yok.</h2><p>Başka bir kelime deneyebilirsin.</p></div>
  </section>`;
  return layout({ title: "Yazılar", description: profile.blog.description, active: "/blog/", content, pageClass: "blog-page" });
}

function postPage(post) {
  const content = `
  <article>
    <header class="article-header">
      <div class="shell article-shell">
        <a class="back-link" href="/blog/">← Tüm yazılar</a>
        <span class="post-category">${escapeHtml(post.category)}</span>
        <h1>${escapeHtml(post.title)}</h1>
        <p class="article-lead">${escapeHtml(post.description)}</p>
        <div class="article-meta">
          <img src="${escapeHtml(profile.images.avatar)}" alt="" aria-hidden="true">
          <div><strong>${escapeHtml(profile.identity.name)}</strong><span><time datetime="${escapeHtml(post.date)}">${formatDate(post.date)}</time> · ${post.readingTime} dk okuma</span></div>
        </div>
        ${tagList(post.tags)}
      </div>
    </header>
    <div class="shell article-shell article-body">${markdownToHtml(post.body)}</div>
    <footer class="shell article-shell article-footer">
      <div><span class="kicker">YAZI HOŞUNA GİTTİ Mİ?</span><h2>Birlikte konuşalım.</h2><p>Fikrini, sorunu ya da kendi deneyimini paylaşabilirsin.</p></div>
      <a class="button button-primary" href="${escapeHtml(profile.socials.find((social) => social.label === "LinkedIn")?.url || profile.socials[0].url)}" target="_blank" rel="noopener noreferrer">LinkedIn’de buluşalım ↗</a>
    </footer>
  </article>`;
  return layout({ title: post.title, description: post.description, active: `/blog/${post.slug}/`, content, pageClass: "article-page", article: true });
}

function projectsPage() {
  const content = `
  <section class="page-hero page-hero-projects">
    <div class="shell narrow-shell"><span class="kicker">${escapeHtml(profile.projectsPage.eyebrow)}</span><h1>${escapeHtml(profile.projectsPage.title)}<br><em>${escapeHtml(profile.projectsPage.emphasis)}</em></h1><p>${escapeHtml(profile.projectsPage.description)}</p></div>
  </section>
  <section class="section shell"><div class="projects-list">${projects.map(projectCard).join("")}</div></section>`;
  return layout({ title: "Projeler", description: profile.projectsPage.description, active: "/projeler/", content, pageClass: "projects-page" });
}

function aboutPage() {
  const content = `
  <section class="page-hero page-hero-about">
    <div class="shell about-hero-grid">
      <div><span class="kicker">${escapeHtml(profile.about.eyebrow)}</span><h1>${escapeHtml(profile.about.title)}<br><em>${escapeHtml(profile.about.emphasis)}</em></h1><p>${escapeHtml(profile.about.description)}</p></div>
      <div class="about-photo"><img src="${escapeHtml(profile.images.about)}" alt="${escapeHtml(profile.identity.name)}"><span>${escapeHtml(profile.about.photoLabel)}</span></div>
    </div>
  </section>
  <section class="section shell about-grid">
    <div><span class="kicker">${escapeHtml(profile.about.experienceEyebrow)}</span><h2>${escapeHtml(profile.about.experienceTitle)}<br><em>${escapeHtml(profile.about.experienceEmphasis)}</em></h2></div>
    <div class="timeline">${experience.map((item) => `<article><span>${escapeHtml(item.date)}</span><h3>${escapeHtml(item.company)}</h3><p>${escapeHtml(item.role)}</p></article>`).join("")}</div>
  </section>
  <section class="section section-sky">
    <div class="shell certificate-grid">
      <div><span class="kicker">${escapeHtml(profile.about.certificatesEyebrow)}</span><h2>${escapeHtml(profile.about.certificatesTitle)}<br><em>${escapeHtml(profile.about.certificatesEmphasis)}</em></h2><p>${escapeHtml(profile.about.certificatesDescription)}</p></div>
      <div class="certificate-list">${certificates.map((certificate, index) => `<div><span>0${index + 1}</span><p>${escapeHtml(certificate)}</p></div>`).join("")}</div>
    </div>
  </section>`;
  return layout({ title: "Hakkımda", description: profile.about.description, active: "/hakkimda/", content, pageClass: "about-page" });
}

function notFoundPage() {
  const content = `<section class="not-found shell"><span>404</span><h1>Sayfa bulunamadı.</h1><p>Aradığınız içerik taşınmış veya kaldırılmış olabilir.</p><a class="button button-primary" href="/">Ana sayfaya dön</a></section>`;
  return layout({ title: "Sayfa bulunamadı", content, pageClass: "not-found-page" });
}

async function output(pathname, content) {
  const folder = join(dist, pathname);
  await mkdir(folder, { recursive: true });
  await writeFile(join(folder, "index.html"), content, "utf8");
}

export async function build() {
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });
  const postDir = join(root, "content", "posts");
  const files = (await readdir(postDir)).filter((file) => file.endsWith(".md") && !file.startsWith("_"));
  const posts = [];
  for (const file of files) {
    const post = parsePost(await readFile(join(postDir, file), "utf8"), file);
    if (!post.draft) posts.push(post);
  }
  posts.sort((a, b) => String(b.date).localeCompare(String(a.date)));

  await output("", homePage(posts));
  await output("blog", blogPage(posts));
  await output("projeler", projectsPage());
  await output("hakkimda", aboutPage());
  for (const post of posts) await output(join("blog", post.slug), postPage(post));
  await writeFile(join(dist, "404.html"), notFoundPage(), "utf8");

  await mkdir(join(dist, "assets"), { recursive: true });
  await writeFile(join(dist, "assets", "site.css"), await readFile(join(root, "src", "site.css"), "utf8"), "utf8");
  await writeFile(join(dist, "assets", "site.js"), await readFile(join(root, "src", "site.js"), "utf8"), "utf8");
  await cp(join(root, "assests"), join(dist, "assests"), { recursive: true });

  const rssItems = posts.map((post) => `<item><title>${escapeHtml(post.title)}</title><link>${site.url}/blog/${post.slug}/</link><guid>${site.url}/blog/${post.slug}/</guid><pubDate>${new Date(`${post.date}T12:00:00Z`).toUTCString()}</pubDate><description>${escapeHtml(post.description)}</description></item>`).join("");
  await writeFile(join(dist, "feed.xml"), `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${site.title}</title><link>${site.url}</link><description>${site.description}</description>${rssItems}</channel></rss>`, "utf8");

  const urls = ["/", "/blog/", "/projeler/", "/hakkimda/", ...posts.map((post) => `/blog/${post.slug}/`)];
  await writeFile(join(dist, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `<url><loc>${site.url}${url}</loc></url>`).join("")}</urlset>`, "utf8");
  await writeFile(join(dist, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${site.url}/sitemap.xml\n`, "utf8");
  await writeFile(join(dist, ".nojekyll"), "", "utf8");

  console.log(`Built ${posts.length} post(s) into ${dist}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await build();
}
