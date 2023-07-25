const fs = require("fs");
const ejs = require("ejs");
const { parser } = require("./parser");

const compiler = async (dir) => {
  try {
    const data = await parser(dir);

    const grl = await ejs.renderFile(__dirname + "/resources/rules.ejs", data);

    const outputFile = dir + "/rules.grl";

    fs.writeFileSync(outputFile, grl);
  } catch (e) {
    console.error(e);
    throw e;
  }
};

module.exports = {
  compiler,
};
