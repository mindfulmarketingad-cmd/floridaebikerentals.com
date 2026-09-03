/* A deliberately small Markdown subset for blog posts and long-form pages.
   Supported: front matter, h2/h3/h4, paragraphs, bold, italics, inline code,
   links, unordered + ordered lists, blockquotes, pipe tables, horizontal rules.
   Raw HTML in the source is escaped, so a post can never inject a script tag. */
import { esc, slugify } from "./util.mjs";

function inline(text) {
  let out = esc(text);
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, href) => {
    if (!/^(https?:\/\/|\/|#|mailto:|tel:)/.test(href)) return label;
    const external = /^https?:\/\//.test(href);
    return `<a href="${href}"${external ? ' rel="noopener nofollow" target="_blank"' : ""}>${label}</a>`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[\s(])\*([^*]+)\*/g, "$1<em>$2</em>");
  return out;
}

export function parseFrontMatter(raw) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!match) return { meta: {}, body: raw };
  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(line.trim());
    if (!kv) continue;
    let value = kv[2].trim();
    if (value.startsWith("[") && value.endsWith("]")) {
      value = value
        .slice(1, -1)
        .split(",")
        .map((v) => v.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else {
      value = value.replace(/^["']|["']$/g, "");
    }
    meta[kv[1]] = value;
  }
  return { meta, body: raw.slice(match[0].length) };
}

export function render(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  const headings = [];
  let i = 0;

  const flushList = (ordered, items) => {
    html.push(`<${ordered ? "ol" : "ul"}>${items.map((t) => `<li>${inline(t)}</li>`).join("")}</${ordered ? "ol" : "ul"}>`);
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) { i++; continue; }

    const heading = /^(#{2,4})\s+(.*)$/.exec(trimmed);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2].trim();
      const id = slugify(text);
      if (level === 2) headings.push({ id, text });
      html.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
      i++;
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(trimmed)) { html.push("<hr>"); i++; continue; }

    if (/^>\s?/.test(trimmed)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        buf.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      html.push(`<blockquote><p>${inline(buf.join(" "))}</p></blockquote>`);
      continue;
    }

    if (/^\|.*\|$/.test(trimmed)) {
      const rows = [];
      while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) {
        rows.push(lines[i].trim().slice(1, -1).split("|").map((c) => c.trim()));
        i++;
      }
      const body = rows.filter((r) => !r.every((c) => /^:?-{2,}:?$/.test(c)));
      const head = body.shift() || [];
      // Wrapped so a wide table scrolls itself instead of widening the page.
      html.push(
        `<div class="table-scroll"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${body
          .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
          .join("")}</tbody></table></div>`
      );
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ""));
        i++;
      }
      flushList(false, items);
      continue;
    }

    if (/^\d+[.)]\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+[.)]\s+/, ""));
        i++;
      }
      flushList(true, items);
      continue;
    }

    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^(#{2,4}\s|[-*]\s|\d+[.)]\s|>|\|)/.test(lines[i].trim())) {
      buf.push(lines[i].trim());
      i++;
    }
    if (buf.length) html.push(`<p>${inline(buf.join(" "))}</p>`);
  }

  return { html: html.join("\n"), headings };
}

export function wordCount(markdown) {
  return markdown.replace(/[#*>|`\-]/g, " ").split(/\s+/).filter(Boolean).length;
}
