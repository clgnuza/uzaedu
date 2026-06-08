/** Node 20: pdfjs-dist (pdf-parse) için DOMMatrix */
if (typeof globalThis.DOMMatrix === 'undefined') {
  class DOMMatrix {
    constructor(init) {
      this.a = 1;
      this.b = 0;
      this.c = 0;
      this.d = 1;
      this.e = 0;
      this.f = 0;
      if (init && typeof init === 'object') Object.assign(this, init);
    }
    multiply() {
      return new DOMMatrix();
    }
    inverse() {
      return new DOMMatrix();
    }
    transformPoint(p = { x: 0, y: 0 }) {
      return { x: p.x ?? 0, y: p.y ?? 0 };
    }
    scale() {
      return new DOMMatrix();
    }
    translate() {
      return new DOMMatrix();
    }
  }
  globalThis.DOMMatrix = DOMMatrix;
}
