const fs = require("fs");
const path = require("path");
const { compiler } = require('../../lib/compiler');

const grlNormalize = (grl) => {
    grl = grl.replace(/[\s]+[\n\r]/g, "\n");
    grl = grl.replace(/^[\s]+/g, "");

    return grl;
}

const cases_dir = path.join(__dirname, "cases");

const cases = fs.readdirSync(path.join(cases_dir), "utf8");

cases.filter(entry => fs.lstatSync(path.join(cases_dir, entry)).isDirectory()).map(dir => {
    test(dir, async () => {

        if (fs.existsSync(path.join(cases_dir, dir, "rules.grl"))) {
            fs.unlinkSync(path.join(cases_dir, dir, "rules.grl"));
        }

        if (!fs.existsSync(path.join(cases_dir, dir, "expected.grl")) && !fs.existsSync(path.join(cases_dir, dir, "expected.error"))) {
            throw Error(`Expected file not founded into ${dir}!`);
        }

        if (fs.existsSync(path.join(cases_dir, dir, "expected.error"))) {
            const expected = fs.readFileSync(path.join(cases_dir, dir, "expected.error")).toString();
            return compiler(path.join(cases_dir, dir)).catch(e => {
                expect(e).toStrictEqual(Error(expected))
            });
        } else {
            await compiler(path.join(cases_dir, dir));
            const expected = grlNormalize(fs.readFileSync(path.join(cases_dir, dir, "expected.grl")).toString());
            const generated = grlNormalize(fs.readFileSync(path.join(cases_dir, dir, "rules.grl")).toString());
            //fs.unlinkSync(path.join(cases_dir, dir, "rules.grl"));
            //console.log("Asserting test >> ", dir);
            return expect(generated).toStrictEqual(expected);
        }
    });
});