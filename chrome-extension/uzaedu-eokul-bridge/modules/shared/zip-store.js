function uzaCrc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function uzaLe32(n) {
  return new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]);
}

function uzaLe16(n) {
  return new Uint8Array([n & 255, (n >>> 8) & 255]);
}

function uzaUtf8(s) {
  return new TextEncoder().encode(String(s || ''));
}

/** STORED zip (sıkıştırmasız) — fotoğraf paketleri için. */
function uzaBuildStoredZip(files) {
  const list = Array.isArray(files) ? files : [];
  const parts = [];
  const central = [];
  let offset = 0;
  for (const f of list) {
    const name = uzaUtf8(f.name || 'file.bin');
    const data = f.bytes instanceof Uint8Array ? f.bytes : new Uint8Array(f.bytes || []);
    const crc = uzaCrc32(data);
    const local = new Uint8Array(30 + name.length + data.length);
    local.set(uzaLe32(0x04034b50), 0);
    local.set(uzaLe16(20), 4);
    local.set(uzaLe16(0), 6);
    local.set(uzaLe16(0), 8);
    local.set(uzaLe16(0), 10);
    local.set(uzaLe32(crc), 14);
    local.set(uzaLe32(data.length), 18);
    local.set(uzaLe32(data.length), 22);
    local.set(uzaLe16(name.length), 26);
    local.set(uzaLe16(0), 28);
    local.set(name, 30);
    local.set(data, 30 + name.length);
    parts.push(local);
    const cd = new Uint8Array(46 + name.length);
    cd.set(uzaLe32(0x02014b50), 0);
    cd.set(uzaLe16(20), 4);
    cd.set(uzaLe16(20), 6);
    cd.set(uzaLe16(0), 8);
    cd.set(uzaLe16(0), 10);
    cd.set(uzaLe16(0), 12);
    cd.set(uzaLe16(0), 14);
    cd.set(uzaLe32(crc), 16);
    cd.set(uzaLe32(data.length), 20);
    cd.set(uzaLe32(data.length), 24);
    cd.set(uzaLe16(name.length), 28);
    cd.set(uzaLe16(0), 30);
    cd.set(uzaLe16(0), 32);
    cd.set(uzaLe16(0), 34);
    cd.set(uzaLe16(0), 36);
    cd.set(uzaLe32(0), 38);
    cd.set(uzaLe32(offset), 42);
    cd.set(name, 46);
    central.push(cd);
    offset += local.length;
  }
  const centralSize = central.reduce((a, b) => a + b.length, 0);
  const end = new Uint8Array(22);
  end.set(uzaLe32(0x06054b50), 0);
  end.set(uzaLe16(0), 4);
  end.set(uzaLe16(0), 6);
  end.set(uzaLe16(list.length), 8);
  end.set(uzaLe16(list.length), 10);
  end.set(uzaLe32(centralSize), 12);
  end.set(uzaLe32(offset), 16);
  end.set(uzaLe16(0), 20);
  const total = offset + centralSize + 22;
  const out = new Uint8Array(total);
  let p = 0;
  for (const x of parts) {
    out.set(x, p);
    p += x.length;
  }
  for (const x of central) {
    out.set(x, p);
    p += x.length;
  }
  out.set(end, p);
  return out;
}

function uzaDataUrlToBytes(dataUrl) {
  const m = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/i);
  if (!m) return new Uint8Array(0);
  const bin = atob(m[2]);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
