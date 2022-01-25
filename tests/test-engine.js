const fs = require("fs");
const path = require("path");
const {compiler} = require('../index');

const grlNormalize = (grl) => {
    grl = grl.replace(/[\s]+[\n\r]/g, "\n");
    grl = grl.replace(/^[\s]+/g, "");

    return grl;
}

const cases = fs.readdirSync(__dirname, "utf8");

cases.filter(entry => fs.lstatSync(path.join(__dirname, entry)).isDirectory()).map(dir => {
    test(dir, async () => {

        if (fs.existsSync(path.join(__dirname, dir, "rules.grl"))) {
            fs.unlinkSync(path.join(__dirname, dir, "rules.grl"));
        }

        if (!fs.existsSync(path.join(__dirname, dir, "expected.grl")) && !fs.existsSync(path.join(__dirname, dir, "expected.error"))) {
            throw Error(`Expected file not founded into ${dir}!`);
        }

        if (fs.existsSync(path.join(__dirname, dir, "expected.error"))) {
            const expected = fs.readFileSync(path.join(__dirname, dir, "expected.error")).toString();
            return compiler(path.join(__dirname, dir)).catch(e => {
                expect(e).toStrictEqual(Error(expected))
            });
        } else {
            await compiler(path.join(__dirname, dir));
            const expected = grlNormalize(fs.readFileSync(path.join(__dirname, dir, "expected.grl")).toString());
            const generated = grlNormalize(fs.readFileSync(path.join(__dirname, dir, "rules.grl")).toString());
            //fs.unlinkSync(path.join(__dirname, dir, "rules.grl"));
            //console.log("Asserting test >> ", dir);
            return expect(generated).toStrictEqual(expected);
        }
    });
});