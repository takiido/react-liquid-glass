import React, { useEffect } from "react";

const LiquidGlass = ({ width = 300, height = 200 }) => {
  useEffect(() => {
    // --- Helper math functions ---
    const clamp01 = (t) => Math.max(0, Math.min(1, t));
    const mix = (a, b, t) => a + (b - a) * t;
    const easedStep = (edge0, edge1, x) => {
      const t = clamp01((x - edge0) / (edge1 - edge0));
      return t * t * (3 - 2 * t);
    };
    const vecLength = (x, y) => Math.hypot(x, y);

    // Distance field for rounded rectangle
    const sdfRoundedBox = (px, py, hw, hh, radius) => {
      const dx = Math.abs(px) - hw + radius;
      const dy = Math.abs(py) - hh + radius;
      const outer = vecLength(Math.max(dx, 0), Math.max(dy, 0));
      return Math.min(Math.max(dx, dy), 0) + outer - radius;
    };

    // Simple texture proxy
    const uvTexture = (u, v) => ({ x: u, y: v });

    // Generate unique filter ID
    const makeUID = () => "glass-liquid-" + Math.random().toString(36).slice(2);

    // --- Visual Distortion Class ---
    class Distortion {
      constructor(opts = {}) {
        this.w = opts.w || 100;
        this.h = opts.h || 100;
        this.effect = opts.effect || ((uv) => uvTexture(uv.x, uv.y));
        this.mouse = { x: 0, y: 0 };
        this.mouseAccessed = false;
        this.dpi = 1;
        this.margin = 10;
        this.uid = makeUID();

        this._buildElements();
        this._attachListeners();
        this.refresh();
      }

      // Create container, svg filter, canvas
      _buildElements() {
        this.wrapper = document.createElement("div");
        Object.assign(this.wrapper.style, {
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: `${this.w}px`,
          height: `${this.h}px`,
          borderRadius: "150px",
          overflow: "hidden",
          boxShadow:
            "0 4px 8px rgba(0,0,0,0.25), 0 -10px 25px inset rgba(0,0,0,0.15)",
          cursor: "grab",
          zIndex: 9999,
          pointerEvents: "auto",
          backdropFilter: `url(#${this.uid}_f) blur(0.3px) contrast(1.15) brightness(1.05) saturate(1.1)`,
        });

        // SVG filter setup
        this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        this.svg.setAttribute("width", "0");
        this.svg.setAttribute("height", "0");
        Object.assign(this.svg.style, {
          position: "fixed",
          top: 0,
          left: 0,
          pointerEvents: "none",
          zIndex: 9998,
        });

        const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
        const filter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
        filter.setAttribute("id", `${this.uid}_f`);
        filter.setAttribute("x", "0");
        filter.setAttribute("y", "0");
        filter.setAttribute("width", this.w.toString());
        filter.setAttribute("height", this.h.toString());
        filter.setAttribute("filterUnits", "userSpaceOnUse");
        filter.setAttribute("colorInterpolationFilters", "sRGB");

        this.map = document.createElementNS("http://www.w3.org/2000/svg", "feImage");
        this.map.setAttribute("id", `${this.uid}_map`);
        this.map.setAttribute("width", this.w.toString());
        this.map.setAttribute("height", this.h.toString());

        this.disp = document.createElementNS("http://www.w3.org/2000/svg", "feDisplacementMap");
        this.disp.setAttribute("in", "SourceGraphic");
        this.disp.setAttribute("in2", `${this.uid}_map`);
        this.disp.setAttribute("xChannelSelector", "R");
        this.disp.setAttribute("yChannelSelector", "G");

        filter.appendChild(this.map);
        filter.appendChild(this.disp);
        defs.appendChild(filter);
        this.svg.appendChild(defs);

        // Canvas buffer
        this.canvas = document.createElement("canvas");
        this.canvas.width = this.w * this.dpi;
        this.canvas.height = this.h * this.dpi;
        this.canvas.style.display = "none";

        this.ctx = this.canvas.getContext("2d");
      }

      // Constrain to viewport
      _clampPos(x, y) {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const minX = this.margin;
        const maxX = vw - this.w - this.margin;
        const minY = this.margin;
        const maxY = vh - this.h - this.margin;
        return {
          x: Math.max(minX, Math.min(maxX, x)),
          y: Math.max(minY, Math.min(maxY, y)),
        };
      }

      _attachListeners() {
        let dragging = false;
        let startX, startY, origX, origY;

        this.wrapper.addEventListener("mousedown", (e) => {
          dragging = true;
          this.wrapper.style.cursor = "grabbing";
          startX = e.clientX;
          startY = e.clientY;
          const rect = this.wrapper.getBoundingClientRect();
          origX = rect.left;
          origY = rect.top;
          e.preventDefault();
        });

        document.addEventListener("mousemove", (e) => {
          if (dragging) {
            const nx = origX + (e.clientX - startX);
            const ny = origY + (e.clientY - startY);
            const clamped = this._clampPos(nx, ny);
            this.wrapper.style.left = clamped.x + "px";
            this.wrapper.style.top = clamped.y + "px";
            this.wrapper.style.transform = "none";
          }
          const rect = this.wrapper.getBoundingClientRect();
          this.mouse.x = (e.clientX - rect.left) / rect.width;
          this.mouse.y = (e.clientY - rect.top) / rect.height;
          if (this.mouseAccessed) this.refresh();
        });

        document.addEventListener("mouseup", () => {
          dragging = false;
          this.wrapper.style.cursor = "grab";
        });

        window.addEventListener("resize", () => {
          const rect = this.wrapper.getBoundingClientRect();
          const clamped = this._clampPos(rect.left, rect.top);
          this.wrapper.style.left = clamped.x + "px";
          this.wrapper.style.top = clamped.y + "px";
          this.wrapper.style.transform = "none";
        });
      }

      refresh() {
        const proxyMouse = new Proxy(this.mouse, {
          get: (target, prop) => {
            this.mouseAccessed = true;
            return target[prop];
          },
        });

        this.mouseAccessed = false;
        const w = this.w * this.dpi;
        const h = this.h * this.dpi;
        const pixels = new Uint8ClampedArray(w * h * 4);

        let maxOffset = 0;
        const deltas = [];

        // Sample effect for each pixel
        for (let i = 0; i < pixels.length; i += 4) {
          const px = (i / 4) % w;
          const py = Math.floor(i / 4 / w);
          const uv = this.effect({ x: px / w, y: py / h }, proxyMouse);
          const dx = uv.x * w - px;
          const dy = uv.y * h - py;
          maxOffset = Math.max(maxOffset, Math.abs(dx), Math.abs(dy));
          deltas.push(dx, dy);
        }

        maxOffset *= 0.5;

        // Pack into RG channels
        let idx = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          const r = deltas[idx++] / maxOffset + 0.5;
          const g = deltas[idx++] / maxOffset + 0.5;
          pixels[i] = r * 255;
          pixels[i + 1] = g * 255;
          pixels[i + 2] = 0;
          pixels[i + 3] = 255;
        }

        this.ctx.putImageData(new ImageData(pixels, w, h), 0, 0);
        this.map.setAttributeNS(
          "http://www.w3.org/1999/xlink",
          "href",
          this.canvas.toDataURL()
        );
        this.disp.setAttribute("scale", (maxOffset / this.dpi).toString());
      }

      mount(parent) {
        parent.appendChild(this.svg);
        parent.appendChild(this.wrapper);
      }

      remove() {
        this.svg.remove();
        this.wrapper.remove();
        this.canvas.remove();
      }
    }

    // Instantiate the effect
    const visual = new Distortion({
      w: width,
      h: height,
      effect: (uv, mouse) => {
        const cx = uv.x - 0.5;
        const cy = uv.y - 0.5;
        const dist = sdfRoundedBox(cx, cy, 0.3, 0.2, 0.6);
        const t = easedStep(0.8, 0, dist - 0.15);
        const scale = easedStep(0, 1, t);
        return uvTexture(cx * scale + 0.5, cy * scale + 0.5);
      },
    });

    visual.mount(document.body);
    console.log("Glass Liquid effect initialized");

    return () => visual.remove();
  }, [width, height]);

  return null;
};

export default LiquidGlass;
