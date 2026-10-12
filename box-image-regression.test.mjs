import assert from 'node:assert/strict';
import Box from './lib/tiles/box.js';

const box = new Box(0, 0, false);
assert.equal(box.imageSrc, './PNG/Crates/crate_05.png');

box.setOnCheckpoint(true);
assert.equal(box.imageSrc, './PNG/Crates/crate_04.png');

box.setOnCheckpoint(false);
assert.equal(box.imageSrc, './PNG/Crates/crate_05.png');

console.log('box image state regression test passed');
