const { parser } = require("./parser");
const rules = require("./linter/rules");

const linter = async (dir) => {
  try {
    const data = await parser(dir);
    return (await Promise.all(Object.entries(rules).map(async ([ruleName, rule]) =>
      (
        await rule.validator(data))
        .map(e => `${ruleName}: ${e}`)
    )))
      .filter(r => typeof r !== 'undefined')
      .reduce((p, c) => {
        if (!Array.isArray(c)) c = [c];
        return p.concat(c);
      }, [])

  } catch (e) {
    console.err(e)
    throw e;
  }
};

module.exports = {
  linter,
};