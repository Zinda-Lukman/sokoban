// Replace these values before deployment. Telegram user IDs are numbers.
export const ADMIN_IDS = [1905330094, 5320472831];
export const MINI_APP_URL = 'https://telegram-sokoban.netlify.app';
export const APP_TITLE = 'SOKOBAN';
export const PAGE_SIZE = 8;

export function isAdmin(userId) {
  return ADMIN_IDS.includes(Number(userId));
}
