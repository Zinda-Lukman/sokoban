export function normalizeReferralList(value) {
  if (Array.isArray(value)) {
    return [...new Set(
      value
        .filter((item) => typeof item === 'string' || typeof item === 'number')
        .map((item) => String(item).trim())
        .filter(Boolean)
    )];
  }

  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }

  return [];
}

export function addReferredUser(referrerData = {}, userId) {
  const referredUsers = normalizeReferralList(referrerData.referredUsers);
  const nextUsers = userId ? [...new Set([...referredUsers, String(userId)])] : referredUsers;

  return {
    ...referrerData,
    referredUsers: nextUsers,
    referralCount: nextUsers.length
  };
}

export function hasAlreadyBeenReferred(userData = {}) {
  return Boolean(
    userData?.referredBy ||
    userData?.referralSource ||
    userData?.referrerId ||
    userData?.referredByUserId
  );
}

export function hasAlreadyPlayedGame(userData = {}) {
  if (!userData || typeof userData !== 'object') {
    return false;
  }

  const lastLevel = Number(userData.lastLevel ?? 0);
  const completedLevels = Array.isArray(userData.completedLevels) ? userData.completedLevels.length : 0;
  const skippedLevels = Array.isArray(userData.skippedLevels) ? userData.skippedLevels.length : 0;
  const stars = Number(userData.stars ?? 0);

  return lastLevel > 0 || completedLevels > 0 || skippedLevels > 0 || stars > 0;
}

export function canApplyReferral({ userId, referralParam, userData = {}, referrerData = {} } = {}) {
  if (!userId || !referralParam || referralParam === userId) {
    return false;
  }

  if (hasAlreadyBeenReferred(userData) || hasAlreadyPlayedGame(userData)) {
    return false;
  }

  const referredUsers = normalizeReferralList(referrerData.referredUsers);
  return !referredUsers.includes(String(userId));
}
