import Tile from "./tile.js";

class Box extends Tile {

  constructor(row, column, onGoal = false) {
    super(row, column);
    this.onCheckPoint = false;
    this.setOnCheckpoint(onGoal);
  }

  setOnCheckpoint(isOnCheckpoint) {
    this.onCheckPoint = Boolean(isOnCheckpoint);
    this.imageSrc = this.onCheckPoint
      ? "./PNG/Crates/crate_04.png"
      : "./PNG/Crates/crate_05.png";
  }

}

export default Box;
