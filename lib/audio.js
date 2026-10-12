const SOUND_PATH = "sounds";

function buildSoundUrl(name, extension = "wav") {
  const normalizedName = name.endsWith(`.${extension}`) ? name : `${name}.${extension}`;
  return `${SOUND_PATH}/${normalizedName}`;
}

export function isSoundEnabled() {
  if (typeof window === "undefined") return false;
  if (window.sokobanSoundEnabled === undefined) {
    window.sokobanSoundEnabled = true;
  }
  return window.sokobanSoundEnabled !== false;
}

export function playSound(name, extension = "wav") {
  if (!isSoundEnabled()) return;

  const audio = new Audio(buildSoundUrl(name, extension));
  audio.preload = "auto";
  audio.volume = 0.65;

  const playPromise = audio.play();
  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(() => {
      // Browsers may block autoplay until the user interacts, so we fail silently here.
    });
  }
}

export function playClickSound() {
  playSound("click");
}

export function playMoveSound() {
  playSound("push");
}

export function playSettleSound() {
  playSound("settle");
}

export function playRandomVictorySound() {
  const victoryFiles = [
    "victory/victory1",
    "victory/victory2",
    "victory/victory3",
    "victory/victory4"
  ];
  const chosen = victoryFiles[Math.floor(Math.random() * victoryFiles.length)];
  playSound(chosen, "mp3");
}
