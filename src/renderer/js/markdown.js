/*
 * M2_PROMPT
 * Copyright (c) 2026 OA Hsiao
 * SPDX-License-Identifier: MIT
 *
 * This source code is licensed under the MIT License found in the
 * LICENSE file in the root directory of this source tree.
 */
'use strict';

// ============================================================
// M2_PROMPT - tiny, dependency-free Markdown -> HTML renderer.
//
// Purpose: power the editor's live "preview" (WYSIWYG) view. It covers the
// Markdown a prompt author actually uses: headings, bold / italic / strike /
// inline code, fenced code blocks, links, images, blockquotes, ordered /
// unordered (nested) lists, horizontal rules, tables and paragraphs.
//
// Security: ALL text is HTML-escaped first, then a known set of tags is
// emitted, so user content can never inject markup / scripts into the preview.
// URLs are sanitized (javascript:/vbscript:/non-image data: are dropped).
//
// Exposes: window.M2MD.render(markdownString) -> htmlString
// ============================================================
(function () {
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Allow http(s), mailto, relative paths and data:image; block the rest.
  function safeUrl(url) {
    const u = String(url || '').trim();
    if (/^(javascript|vbscript|file):/i.test(u)) return '';
    if (/^data:/i.test(u) && !/^data:image\//i.test(u)) return '';
    return u;
  }

  const indentOf = (ln) => (ln.match(/^(\s*)/)[1] || '').replace(/\t/g, '    ').length;
  const isListItem = (ln) => /^\s*([-*+]\s+|\d+[.)]\s+)/.test(ln);

  function splitRow(row) {
    let r = row.trim().replace(/^\|/, '').replace(/\|$/, '');
    // Split on unescaped pipes.
    const cells = [];
    let cur = '';
    for (let i = 0; i < r.length; i += 1) {
      if (r[i] === '\\' && r[i + 1] === '|') {
        cur += '|';
        i += 1;
      } else if (r[i] === '|') {
        cells.push(cur);
        cur = '';
      } else {
        cur += r[i];
      }
    }
    cells.push(cur);
    return cells;
  }

  // Inline spans. Input is RAW (unescaped) text; output is safe HTML. Inline
  // code, images and links are converted first and stashed as placeholders so
  // the emphasis rules can never corrupt their contents — e.g. the underscores
  // in an image filename must NOT become <em>...</em>.
  function inline(text) {
    const stash = [];
    const keep = (html) => {
      stash.push(html);
      return '\u0000S' + (stash.length - 1) + '\u0000';
    };

    let out = String(text);

    // Inline code.
    out = out.replace(/`([^`]+)`/g, (m, c) => keep('<code>' + escapeHtml(c) + '</code>'));

    // Images: ![alt](url "title"). A title of the form "w=NNN" carries an
    // explicit pixel width set by the WYSIWYG zoom in / out controls.
    out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (m, alt, url, title) => {
      const u = safeUrl(url);
      if (!u) return m;
      let extra = '';
      const wm = String(title || '').match(/^\s*w=(\d{1,4})\s*$/i);
      if (wm) extra = ' style="width:' + wm[1] + 'px;max-width:none"';
      return keep('<img alt="' + escapeHtml(alt) + '" src="' + escapeHtml(u) + '"' + extra + ' />');
    });

    // Links: [text](url "title")
    out = out.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (m, txt, url) => {
      const u = safeUrl(url);
      if (!u) return m;
      return keep('<a href="' + escapeHtml(u) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(txt) + '</a>');
    });

    // Everything left is plain text — escape it, then apply emphasis.
    out = escapeHtml(out);

    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/(^|[^_])__([^_]+)__/g, '$1<strong>$2</strong>');
    out = out.replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, '$1<em>$2</em>');
    out = out.replace(/(^|[^_])_([^_\s][^_]*?)_/g, '$1<em>$2</em>');
    out = out.replace(/~~([^~]+)~~/g, '<del>$1</del>');

    // Restore stashed inline HTML (code / images / links).
    out = out.replace(/\u0000S(\d+)\u0000/g, (m, i) => stash[Number(i)]);
    return out;
  }

  function parseList(lines, start) {
    const baseIndent = indentOf(lines[start]);
    const ordered = /^\s*\d+[.)]\s+/.test(lines[start]);
    let i = start;
    let out = ordered ? '<ol>' : '<ul>';
    while (i < lines.length) {
      const ln = lines[i];
      if (/^\s*$/.test(ln)) {
        if (i + 1 < lines.length && isListItem(lines[i + 1]) && indentOf(lines[i + 1]) >= baseIndent) {
          i += 1;
          continue;
        }
        break;
      }
      if (!isListItem(ln) || indentOf(ln) < baseIndent) break;
      // A change of list type (ordered <-> unordered) starts a new list.
      if (/^\s*\d+[.)]\s+/.test(ln) !== ordered) break;
      const m = ln.match(/^\s*(?:[-*+]|\d+[.)])\s+(.*)$/);
      let li = '<li>' + inline(m ? m[1] : '');
      i += 1;
      if (i < lines.length && isListItem(lines[i]) && indentOf(lines[i]) > baseIndent) {
        const nested = parseList(lines, i);
        li += nested.html;
        i = nested.next;
      }
      li += '</li>';
      out += li;
    }
    out += ordered ? '</ol>' : '</ul>';
    return { html: out, next: i };
  }

  function render(src) {
    const lines = String(src == null ? '' : src).replace(/\r\n?/g, '\n').split('\n');
    const html = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Fenced code block ``` or ~~~
      const fence = line.match(/^(\s*)(```+|~~~+)\s*([A-Za-z0-9_+-]*)\s*$/);
      if (fence) {
        const marker = fence[2][0];
        const closer = marker === '`' ? /^\s*```+\s*$/ : /^\s*~~~+\s*$/;
        const buf = [];
        i += 1;
        while (i < lines.length && !closer.test(lines[i])) {
          buf.push(lines[i]);
          i += 1;
        }
        i += 1; // skip closing fence
        html.push('<pre class="md-code"><code>' + escapeHtml(buf.join('\n')) + '</code></pre>');
        continue;
      }

      if (/^\s*$/.test(line)) {
        i += 1;
        continue;
      }

      // ATX heading
      const h = line.match(/^\s*(#{1,6})\s+(.*?)\s*#*\s*$/);
      if (h) {
        const level = h[1].length;
        html.push('<h' + level + '>' + inline(h[2]) + '</h' + level + '>');
        i += 1;
        continue;
      }

      // Horizontal rule
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
        html.push('<hr />');
        i += 1;
        continue;
      }

      // Blockquote
      if (/^\s*>\s?/.test(line)) {
        const buf = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
          buf.push(lines[i].replace(/^\s*>\s?/, ''));
          i += 1;
        }
        html.push('<blockquote>' + render(buf.join('\n')) + '</blockquote>');
        continue;
      }

      // Table (header row + |---|:--:| separator)
      if (
        /\|/.test(line) &&
        i + 1 < lines.length &&
        /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(lines[i + 1]) &&
        /-/.test(lines[i + 1])
      ) {
        const header = splitRow(line);
        const align = splitRow(lines[i + 1]).map((c) => {
          const tt = c.trim();
          const l = tt.startsWith(':');
          const r = tt.endsWith(':');
          return l && r ? 'center' : r ? 'right' : l ? 'left' : '';
        });
        i += 2;
        const rows = [];
        while (i < lines.length && /\|/.test(lines[i]) && !/^\s*$/.test(lines[i])) {
          rows.push(splitRow(lines[i]));
          i += 1;
        }
        const cellStyle = (idx) => (align[idx] ? ' style="text-align:' + align[idx] + '"' : '');
        let tb = '<table class="md-table"><thead><tr>';
        header.forEach((c, idx) => {
          tb += '<th' + cellStyle(idx) + '>' + inline(c.trim()) + '</th>';
        });
        tb += '</tr></thead><tbody>';
        rows.forEach((r) => {
          tb += '<tr>';
          for (let k = 0; k < header.length; k += 1) {
            tb += '<td' + cellStyle(k) + '>' + inline((r[k] != null ? r[k] : '').trim()) + '</td>';
          }
          tb += '</tr>';
        });
        tb += '</tbody></table>';
        html.push(tb);
        continue;
      }

      // Lists
      if (isListItem(line)) {
        const parsed = parseList(lines, i);
        html.push(parsed.html);
        i = parsed.next;
        continue;
      }

      // Paragraph (gather until a blank line or a new block starts)
      const buf = [];
      while (
        i < lines.length &&
        !/^\s*$/.test(lines[i]) &&
        !/^\s*#{1,6}\s+/.test(lines[i]) &&
        !/^(\s*)(```+|~~~+)/.test(lines[i]) &&
        !/^\s*>\s?/.test(lines[i]) &&
        !isListItem(lines[i]) &&
        !/^\s*([-*_])(\s*\1){2,}\s*$/.test(lines[i])
      ) {
        buf.push(lines[i]);
        i += 1;
      }
      html.push('<p>' + inline(buf.join('\n')).replace(/\n/g, '<br />') + '</p>');
    }

    return html.join('\n');
  }

  // Split Markdown into top-level block strings (paragraphs, headings, lists,
  // blockquotes, tables, images, hr) separated by blank lines. Fenced code
  // blocks are kept intact even when they contain blank lines. Used by the
  // WYSIWYG editor to render / edit one block at a time.
  function splitBlocks(md) {
    const lines = String(md == null ? '' : md).replace(/\r\n?/g, '\n').split('\n');
    const blocks = [];
    let cur = [];
    let inFence = false;
    let fenceRe = null;
    const flush = () => {
      const s = cur.join('\n').replace(/\s+$/, '');
      if (s.trim() !== '') blocks.push(s);
      cur = [];
    };
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (inFence) {
        cur.push(line);
        if (fenceRe.test(line)) inFence = false;
        continue;
      }
      const f = line.match(/^\s*(```+|~~~+)/);
      if (f) {
        inFence = true;
        fenceRe = f[1][0] === '`' ? /^\s*```+\s*$/ : /^\s*~~~+\s*$/;
        cur.push(line);
        continue;
      }
      if (/^\s*$/.test(line)) {
        flush();
        continue;
      }
      cur.push(line);
    }
    flush();
    return blocks;
  }

  window.M2MD = { render: render, splitBlocks: splitBlocks };
})();
