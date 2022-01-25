const fs = require("fs");
const path = require("path");
const {compiler} = require('../index');

const grlNormalize = (grl) => {
    grl = grl.replace(/[\s]+[\n\r]/g, "\n");

    return grl;
}

const cases = fs.readdirSync(__dirname, "utf8");

cases.filter(entry => fs.lstatSync(path.join(__dirname, entry)).isDirectory()).forEach(dir => {
    test(dir, () => {
        compiler(path.join(__dirname, dir));
        const expected = grlNormalize(fs.readFileSync(path.join(__dirname, dir, "expected.grl")).toString());
        const generated = grlNormalize(fs.readFileSync(path.join(__dirname, dir, "rules.grl")).toString());
        fs.unlinkSync(path.join(__dirname, dir, "rules.grl"));

        expect(generated).toBe(expected);
    });
})