const fs = require("fs");
const path = require("path");
const { linter } = require('../../lib/linter');

const cases_dir = path.join(__dirname, "cases");

const isRulesheetFolder = (dir) => fs.existsSync(path.join(dir, "rules.featws")) || fs.existsSync(path.join(dir, "rules.json"));

function scanDir(baseDir, baseName) {
    const cases = fs.readdirSync(path.join(baseDir), "utf8");

    cases.filter(entry => fs.lstatSync(path.join(baseDir, entry)).isDirectory()).map(dir => {
        const name = [baseName, dir].join(" / ");

        if (isRulesheetFolder(path.join(baseDir, dir))) {
            test(name, async () => {
                if (fs.existsSync(path.join(baseDir, dir, "expected.error"))) {
                    const expected = fs.readFileSync(path.join(baseDir, dir, "expected.error")).toString();
                    return expect(linter(path.join(baseDir, dir))).resolves.toContain(expected);
                } else {
                    return expect(linter(path.join(baseDir, dir))).resolves.toHaveLength(0);
                }
            });
        } else {
            scanDir(path.join(baseDir, dir), name);
        }
    });
}

scanDir(cases_dir, "Case");