const { fromWei } = require('web3-utils');
const {
  BN,
} = require('@openzeppelin/test-helpers');

class UniversalTracker {
  constructor(acc, getValueFn, unit) {
    this.account = acc;
    this.unit = unit;
    this.getValueFn = getValueFn;
  }

  async valueCurrent() {
    return new BN(fromWei(await this.getValueFn(this.account), this.unit));
  }

  async delta(unit = this.unit) {
    const current = await this.valueCurrent(this.account);
    const delta = current.sub(this.prev);
    this.prev = current;

    return new BN(fromWei(delta, unit));
  }

  async deltaInvertedSign(unit = this.unit) {
    return (await this.delta(unit)).mul(new BN(-1));
  }

  async get(unit = this.unit) {
    this.prev = await this.valueCurrent(this.account);

    return new BN(fromWei(this.prev, unit));
  }

  async log(unit = this.unit) {
    const value = await this.get(unit);
    global.console.log(value.toString());
  }
}

async function createTrackerInstance(owner, getBalanceFn, unit = 'wei') {
  const tracker = new UniversalTracker(owner, getBalanceFn, unit);
  await tracker.get();
  return tracker;
}

module.exports = createTrackerInstance;
