class Tile {
  constructor(row, column) {
    this.row = row;
    this.column = column;
    this.imageSrc = "";
    this.tileSize = 64;
  }

  static assetCache = new Map();

  static getAsset(src) {
    if (!src) return null;
    if (!Tile.assetCache.has(src)) {
      const image = new Image();
      image.src = src;
      Tile.assetCache.set(src, image);
    }
    return Tile.assetCache.get(src);
  }

  createBitmap(stage, imagePath, x, y) {
    const bitmap = new createjs.Bitmap(imagePath);
    const scale = (this.tileSize / 64) * 0.5;
    bitmap.scaleX = scale;
    bitmap.scaleY = scale;
    bitmap.x = x;
    bitmap.y = y;

    stage.addChild(bitmap);
    stage.update();
  }

  render(stage) {
    let image = new Image();

    if (this.player) {
      const backgroundImage = Tile.getAsset(this.imageSrc);

      if (this.imageSrc && backgroundImage) {
        if (backgroundImage.complete && backgroundImage.naturalWidth > 0) {
          this.createBitmap(stage, backgroundImage, this.column * this.tileSize, this.row * this.tileSize);
        } else {
          backgroundImage.onload = () => {
            this.createBitmap(stage, backgroundImage, this.column * this.tileSize, this.row * this.tileSize);
          };
        }

        if (this.player && this.player.imageSrc) {
          image = Tile.getAsset(this.player.imageSrc);
          if (image.complete && image.naturalWidth > 0) {
            this.createBitmap(stage, image, this.column * this.tileSize, this.row * this.tileSize);
          } else {
            image.onload = (playerEvent) => {
              this.createBitmap(stage, playerEvent.target, this.column * this.tileSize, this.row * this.tileSize);
            };
          }
        }
      } else if (this.player && this.player.imageSrc) {
        image = Tile.getAsset(this.player.imageSrc);
        if (image.complete && image.naturalWidth > 0) {
          this.createBitmap(stage, image, this.column * this.tileSize, this.row * this.tileSize);
        } else {
          image.onload = (playerEvent) => {
            this.createBitmap(stage, playerEvent.target, this.column * this.tileSize, this.row * this.tileSize);
          };
        }
      }
    } else if (this.box) {
      if (this.box && this.box.imageSrc) {
        image = Tile.getAsset(this.box.imageSrc);
        if (image.complete && image.naturalWidth > 0) {
          this.createBitmap(stage, image, this.column * this.tileSize, this.row * this.tileSize);
        } else {
          image.onload = (event) => {
            this.createBitmap(stage, event.target, this.column * this.tileSize, this.row * this.tileSize);
          };
        }
      }
    } else if (this.imageSrc) {
      image = Tile.getAsset(this.imageSrc);
      if (image.complete && image.naturalWidth > 0) {
        this.createBitmap(stage, image, this.column * this.tileSize, this.row * this.tileSize);
      } else {
        image.onload = (event) => {
          this.createBitmap(stage, event.target, this.column * this.tileSize, this.row * this.tileSize);
        };
      }
    }
  }
}

export default Tile;
