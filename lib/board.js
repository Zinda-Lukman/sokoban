import Tile from "./tiles/tile.js";
import Floor from "./tiles/floor.js";
import Wall from "./tiles/wall.js";
import Player from "./tiles/player.js";
import Box from "./tiles/box.js";
import Checkpoint from "./tiles/checkpoint.js";
import { playMoveSound, playSettleSound } from "./audio.js";

class Board {

  constructor(textGrid, options = {}) {
    this.tileSize = options.tileSize || 64; /* new */
    this.stage = new createjs.Stage("canvas");
    this.stepCount = 0;
    this.boxPushes = 0;
    this.history = [];
    this.objectGrid = this.compile(textGrid);
    this.rows = this.objectGrid.length;
    this.cols = Math.max(...this.objectGrid.map(row => row.length));
    this.maxRow = this.rows - 1;
    this.stage.canvas.width = this.cols * this.tileSize; /* new */
    this.stage.canvas.height = this.rows * this.tileSize; /* new */
    this.render();
  }

  compile(textGrid) {
    return textGrid.map((array, rowIndex) => {
      return array.map((symbol, colIndex) => {
        let floor, box, player, checkpoint;
        switch(symbol) {
          case "#":
            return this.createTile(new Wall(rowIndex, colIndex));

          case " ":
            return this.createTile(new Floor(rowIndex, colIndex));

          case ".":
            return this.createTile(new Checkpoint(rowIndex, colIndex));

          case "$":
            floor = new Floor(rowIndex, colIndex);
            floor.box = new Box(rowIndex, colIndex);
            return this.createTile(floor);

          case "*":
            checkpoint = new Checkpoint(rowIndex, colIndex);
            checkpoint.box = new Box(rowIndex, colIndex, true);
            return this.createTile(checkpoint);

          case "@":
            floor = new Floor(rowIndex, colIndex);
            floor.player = new Player(rowIndex, colIndex);
            this.playerObject = floor.player;
            return this.createTile(floor);

          case "+":
            checkpoint = new Checkpoint(rowIndex, colIndex);
            checkpoint.player = new Player(rowIndex, colIndex);
            this.playerObject = checkpoint.player;
            return this.createTile(checkpoint);
        }
      });
    });
  }

  createTile(tile) {
    tile.tileSize = this.tileSize;
    return tile;
  }

  resize(tileSize) {
    this.tileSize = tileSize;
    this.stage.canvas.width = this.cols * tileSize;
    this.stage.canvas.height = this.rows * tileSize;
    this.stage.removeAllChildren();
    this.render();
    this.stage.update();
  }

  syncBoxImages() {
    this.objectGrid.forEach(row => {
      row.forEach(tile => {
        if (tile.box) {
          tile.box.setOnCheckpoint(tile instanceof Checkpoint);
        }
      });
    });
  }

  render() {
    this.syncBoxImages();
    this.objectGrid.forEach(row => {
      row.forEach(tileClass => {
        tileClass.render(this.stage);
      });
    });
    this.stage.update();
  }

  renderDirtyTiles(tiles = []) {
    const uniqueTiles = Array.from(new Set(tiles.filter(Boolean)));
    if (!uniqueTiles.length) return;

    this.syncBoxImages();
    uniqueTiles.forEach(tile => {
      tile.render(this.stage);
    });
    this.stage.update();
  }

  getPlayerInfo() {
    const playerObject = this.playerObject;
    const row    = playerObject.row;
    const column = playerObject.column;
    return { playerObject, row, column };
  }

  getGridObject(row, column) {
    if (row < 0 || column < 0) { return undefined; }
    if (row >= this.rows) { return undefined; }
    return this.objectGrid[row]?.[column];
  }

  outsideOfBox(direction, row, column) {
    const currentRowLength = this.objectGrid[row]?.length || 0;
    if (direction === "left") {
      return column > 0;
    }

    if (direction === "right") {
      return column < currentRowLength - 1;
    }

    if (direction === "up") {
      return row > 0;
    }

    if (direction === "down") {
      return row < this.maxRow;
    }

    return false;
  }

  getAdjacentTiles(direction, row, column) {
    const playerTile = this.getGridObject(row, column);
    const player     = this.playerObject;
    let oneTileFromPlayer, twoTilesFromPlayer;
    switch(direction) {
      case "left":
        oneTileFromPlayer  = this.getGridObject(row, column - 1);
        twoTilesFromPlayer = this.getGridObject(row, column - 2);
        break;

      case "right":
        oneTileFromPlayer  = this.getGridObject(row, column + 1);
        twoTilesFromPlayer = this.getGridObject(row, column + 2);
        break;

      case "up":
        oneTileFromPlayer  = this.getGridObject(row - 1, column);
        twoTilesFromPlayer = this.getGridObject(row - 2, column);
        break;

      case "down":
        oneTileFromPlayer  = this.getGridObject(row + 1, column);
        twoTilesFromPlayer = this.getGridObject(row + 2, column);
        break;
    }

    return { playerTile, oneTileFromPlayer, twoTilesFromPlayer, player};
  }

  handlePlayerTileSwitch(direction, player) {
    if (direction === "left") {
      player.column -= 1;
    } else if (direction === "right") {
      player.column += 1;
    } else if (direction === "up") {
      player.row -= 1;
    } else if (direction === "down") {
      player.row += 1;
    }
  }

  obstacleInPlayerPath(oneTileFromPlayer, twoTilesFromPlayer) {
    if (
      (oneTileFromPlayer instanceof Wall) ||
      (oneTileFromPlayer.box && twoTilesFromPlayer instanceof Wall) ||
      (oneTileFromPlayer.box && twoTilesFromPlayer.box)
    ) {
      return true;
    }
  }

  createSnapshot() {
    const boxes = [];
    this.objectGrid.forEach(row => {
      row.forEach(tile => {
        if (tile.box) {
          boxes.push({ row: tile.row, column: tile.column });
        }
      });
    });

    return {
      player: { row: this.playerObject.row, column: this.playerObject.column },
      boxes,
      stepCount: this.stepCount,
      boxPushes: this.boxPushes
    };
  }

  restoreSnapshot(snapshot) {
    this.objectGrid.forEach(row => {
      row.forEach(tile => {
        tile.player = false;
        tile.box = false;
      });
    });

    this.playerObject.row = snapshot.player.row;
    this.playerObject.column = snapshot.player.column;
    const playerTile = this.getGridObject(snapshot.player.row, snapshot.player.column);
    if (playerTile) {
      playerTile.player = this.playerObject;
    }

    snapshot.boxes.forEach(({ row, column }) => {
      const tile = this.getGridObject(row, column);
      if (tile) {
        const box = new Box(row, column, tile instanceof Checkpoint);
        tile.box = box;
        box.row = row;
        box.column = column;
      }
    });

    this.stepCount = snapshot.stepCount;
    this.boxPushes = snapshot.boxPushes;
    this.syncBoxImages();
  }

  undoMove() {
    if (!this.history.length) return false;
    this.restoreSnapshot(this.history.pop());
    this.stage.removeAllChildren();
    this.render();
    return true;
  }

  handleMovement(direction) {

    const { playerObject, row, column } = this.getPlayerInfo();
    if (!this.outsideOfBox(direction, row, column)) return false;
    const { playerTile,
            oneTileFromPlayer, twoTilesFromPlayer,
            player } = this.getAdjacentTiles(direction, row, column);

    if (!oneTileFromPlayer) return false;
    if (oneTileFromPlayer.box && !twoTilesFromPlayer) return false;
    if (this.obstacleInPlayerPath(oneTileFromPlayer, twoTilesFromPlayer)) {
      return false;
    }

    const boxWasPushed = Boolean(oneTileFromPlayer.box);
    const boxWillSettleOnTarget = boxWasPushed && twoTilesFromPlayer instanceof Checkpoint;

    
    let snapshot = this.createSnapshot()
    oneTileFromPlayer.player = playerTile.player;
    this.handlePlayerTileSwitch(direction, player);

    playerTile.player = false;
    this.stepCount++;

    if (oneTileFromPlayer.box) {
      twoTilesFromPlayer.box = oneTileFromPlayer.box;
      oneTileFromPlayer.box = false;
      this.boxPushes++;
      this.history.push(snapshot);
    }

    playMoveSound();
    if (boxWillSettleOnTarget) {
      playSettleSound();
    }

    return true;

  }

  gameOver() {
    const flattened   = _.flatten(this.objectGrid);
    const checkpoints = flattened.filter(object => {
      return object instanceof Checkpoint;
    });
    return checkpoints.every(checkpoint => {
      return checkpoint.box;
    });
  }

  movePlayer(direction) {
    this.stage.removeAllChildren();
    this.playerObject.switchImage(direction);
    const moved = this.handleMovement(direction);
    this.render();
    return moved;
  }

}

export default Board;
