const { ZERO } = require('../../utils/constants').utils;

function logValues (msg, _crv, _cvx, _xbe, _cvxcrv) {
  console.log(`${msg}:\tcrv: ${_crv},\tcvx: ${_cvx},\txbe: ${_xbe},\tcvxCRV:${_cvxcrv}`);
}

async function checkTokenValid(vault, token) {
  return await vault.isTokenValid(token);
}

async function wrapReward(vault, user, token) {
  if (await checkTokenValid(vault, token)) {
    return await vault.rewards(user, token);
  }
  return ZERO;
}

async function wrapEarned(vault, user, token) {
  if (await checkTokenValid(vault, token)) {
    return await vault.earned(token, user);
  }
  return ZERO;
}

async function wrapRpts(vault, token) {
  if (await checkTokenValid(vault, token)) {
    return await vault.rewardsPerTokensStored(token);
  }
  return ZERO;
}
async function wrapRpt(vault, token) {
  if (await checkTokenValid(vault, token)) {
    return await vault.rewardPerToken(token);
  }
  return ZERO;
}

async function wrapUrptp(vault, user, token) {
  if (await checkTokenValid(vault, token)) {
    return await vault.userRewardPerTokenPaid(token, user);
  }
  return ZERO;
}

module.exports = {
  logValues,
  checkTokenValid,
  wrapReward,
  wrapEarned,
  wrapRpts,
  wrapRpt,
  wrapUrptp,
}
