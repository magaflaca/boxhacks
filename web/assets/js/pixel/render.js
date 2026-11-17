const SVG_NS = 'http://www.w3.org/2000/svg';

function runsByColor(rows, palette) {
  const runs = {};
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      const cell = row[x];
      let length = 1;
      while (row[x + length] === cell) length++;
      if (palette[cell]) (runs[cell] ??= []).push(`M${x} ${y}h${length}v1h-${length}z`);
      x += length;
    }
  });
  return runs;
}

export function pixelPaths(rows, palette) {
  return Object.entries(runsByColor(rows, palette)).map(([cell, segments]) => {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', segments.join(''));
    path.style.fill = palette[cell];
    return path;
  });
}

export function pixelSvg(rows, palette, { scale = 4, label } = {}) {
  const width = Math.max(...rows.map((row) => row.length));
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${rows.length}`);
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('width', width * scale);
  svg.setAttribute('height', rows.length * scale);
  svg.classList.add('pixel');
  if (label) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', label);
  } else {
    svg.setAttribute('aria-hidden', 'true');
  }
  svg.append(...pixelPaths(rows, palette));
  return svg;
}

export function patchRows(rows, patches) {
  return rows.map((row, index) => patches[index] ?? row);
}

export function pixelDataUrl(rows, palette, scale) {
  const styles = getComputedStyle(document.documentElement);
  const resolve = (color) => color.replace(/var\((--[\w-]+)\)/g, (_, name) => styles.getPropertyValue(name).trim());
  const colors = Object.fromEntries(Object.entries(palette).map(([cell, color]) => [cell, resolve(color)]));
  const svg = pixelSvg(rows, colors, { scale });
  svg.setAttribute('xmlns', SVG_NS);
  return `data:image/svg+xml,${encodeURIComponent(svg.outerHTML)}`;
}
