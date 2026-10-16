export const SHARE_IMAGE_URL = './PNG/share_image.png';

export function getCompletionShareText(level, referralCode = '') {
  const normalizedLevel = Number(level) + 1;
  const referralSuffix = referralCode ? `?start=${referralCode}` : '';

  return [
    `I completed Sokoban level ${normalizedLevel}!`,
    'You can also PLAY on Telegram, NO fake airdrops and Fake rewards',
    '',
    'JUST FUN SOLVING PUZZLES',
    '',
    `https://t.me/looks_sokobanBot${referralSuffix}`
  ].join('\n');
}

export function getCompletionSharePayload(level, referralCode = '') {
  return {
    imageUrl: SHARE_IMAGE_URL,
    text: getCompletionShareText(level, referralCode)
  };
}
