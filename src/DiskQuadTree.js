const { Level } = require('level');
const { v4: uuidv4 } = require('uuid');
const { Rectangle, Point } = require('./Geometry');

class DiskQuadTree {
  constructor(db, rootId, capacity) {
    this.db = db;
    this.rootId = rootId;
    this.capacity = capacity;
  }

  static async init(path, boundary, capacity = 4) {
    const db = new Level(path, { valueEncoding: 'json' });
    let rootId;
    try {
      rootId = await db.get('meta:root');
    } catch {
      rootId = uuidv4();
      await db.put('meta:root', rootId);
      await db.put(`node:${rootId}`, {
        id: rootId,
        boundary,
        points: [],
        divided: false
      });
    }
    return new DiskQuadTree(db, rootId, capacity);
  }

  async insert(x, y, data) {
    const point = new Point(x, y, data);
    await this._insert(this.rootId, point);
  }

  async _insert(nodeId, point) {
    const node = await this.db.get(`node:${nodeId}`);
    const boundary = new Rectangle(
      node.boundary.x, node.boundary.y,
      node.boundary.w, node.boundary.h
    );

    if (!boundary.contains(point)) return false;

    if (node.points.length < this.capacity && !node.divided) {
      node.points.push(point);
      await this.db.put(`node:${nodeId}`, node);
      return true;
    }

    if (!node.divided) await this._subdivide(node);

    const children = node.children;
    for (const dir of ['ne', 'nw', 'se', 'sw']) {
      if (await this._insert(children[dir], point)) return true;
    }

    return false;
  }

  async _subdivide(node) {
    const { x, y, w, h } = node.boundary;
    const children = {};
    for (const dir of ['ne', 'nw', 'se', 'sw']) {
      const id = uuidv4();
      const dx = dir.includes('e') ? 1 : -1;
      const dy = dir.includes('s') ? 1 : -1;
      const child = {
        id,
        boundary: {
          x: x + dx * w / 2,
          y: y + dy * h / 2,
          w: w / 2,
          h: h / 2
        },
        points: [],
        divided: false
      };
      await this.db.put(`node:${id}`, child);
      children[dir] = id;
    }
    node.divided = true;
    node.children = children;
    await this.db.put(`node:${node.id}`, node);
  }

  async range(minX, minY, maxX, maxY) {
    const range = new Rectangle(
      (minX + maxX) / 2,
      (minY + maxY) / 2,
      (maxX - minX) / 2,
      (maxY - minY) / 2
    );
    return await this._query(this.rootId, range);
  }

  async _query(nodeId, range, found = []) {
    const node = await this.db.get(`node:${nodeId}`);
    const boundary = new Rectangle(
      node.boundary.x, node.boundary.y,
      node.boundary.w, node.boundary.h
    );

    if (!boundary.intersects(range)) return found;

    for (const p of node.points) {
      const pt = new Point(p.x, p.y, p.data);
      if (range.contains(pt)) found.push(pt);
    }

    if (node.divided) {
      for (const dir of ['ne', 'nw', 'se', 'sw']) {
        await this._query(node.children[dir], range, found);
      }
    }

    return found;
  }

  async nearest(x, y, radius = 100) {
    const candidates = await this.range(x - radius, y - radius, x + radius, y + radius);
    candidates.sort((a, b) => {
      const da = (a.x - x) ** 2 + (a.y - y) ** 2;
      const db = (b.x - x) ** 2 + (b.y - y) ** 2;
      return da - db;
    });
    return candidates[0] || null;
  }
}

module.exports = { DiskQuadTree };
