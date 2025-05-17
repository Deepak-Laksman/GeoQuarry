#!/usr/bin/env node

const readline = require('readline');
const { DiskQuadTree } = require('./src/DiskQuadTree');
const { Rectangle } = require('./src/Geometry');

(async () => {
  const tree = await DiskQuadTree.init('./data/db', new Rectangle(0, 0, 100, 100), 4);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.setPrompt('> ');
  rl.prompt();

  rl.on('line', async (line) => {
    const [cmd, ...args] = line.trim().split(' ');
    try {
      if (cmd === 'insert') {
        const [id, x, y] = args;
        await tree.insert(parseFloat(x), parseFloat(y), { id });
        console.log('Inserted');
      } else if (cmd === 'range') {
        const [minX, minY, maxX, maxY] = args.map(Number);
        const result = await tree.range(minX, minY, maxX, maxY);
        console.log(result.map(p => p.data));
      } else if (cmd === 'nearest') {
        const [x, y] = args.map(Number);
        const result = await tree.nearest(x, y);
        console.log(result ? result.data : 'None');
      } else {
        console.log('Unknown command');
      }
    } catch (err) {
      console.error('Error:', err.message);
    }
    rl.prompt();
  });
})();
