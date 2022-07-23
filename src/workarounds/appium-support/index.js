// @appium-support typescript declarations use `override` keyword which
// was introduced in typescript@4.3. This project uses typescript@3.9
// and upgrading to v4 will require upgrading ts-node, ts-loader and then
// also webpack to v5. Upgrade to webpack@5 breaks too many things.

export default require('@appium/support');
