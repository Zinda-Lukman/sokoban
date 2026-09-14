class Tile {
  constructor(row, column) {
    this.row = row;
    this.column = column;
    this.imageSrc = "";
    this.tileSize = 64;
  }

  createBitmap(stage, imagePath, x, y) {
    const bitmap = new createjs.Bitmap(imagePath);
    const scale = (this.tileSize / 64) * 0.5;
          bitmap.scaleX = scale;
          bitmap.scaleY = scale;
          bitmap.x = this.column * this.tileSize;
          bitmap.y = this.row * this.tileSize;

    stage.addChild(bitmap);
    stage.update();
  }

  render(stage) {
    let image = new Image();

    // One object on the grid will have a valid player property
    // Load the background image first, then the player on top
    if (this.player) {

      const backgroundImage = new Image();
            backgroundImage.src = this.imageSrc;

      backgroundImage.onload = (event) => {
        this.createBitmap(stage, event.target, this.column * 64, this.row * 64);

        image.src = this.player.imageSrc;
        image.onload = (playerEvent) => {
          this.createBitmap(stage, playerEvent.target, this.column * 64, this.row * 64);
        };
      };

    } else if (this.box) {

      image.src = this.box.imageSrc;
      image.onload = (event) => {
        this.createBitmap(stage, event.target, this.column * 64, this.row * 64);
      };

    } else {

      image.src = this.imageSrc;
      image.onload = (event) => {
        this.createBitmap(stage, event.target, this.column * 64, this.row * 64);
      };
    }
  }

}

export default Tile;
