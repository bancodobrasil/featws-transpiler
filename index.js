const parameters = require("./parameters.json");
const features = require("./features.json");
const yaml = require("yaml");
const fs = require("fs");
const ejs = require("ejs");

const compile = (expression) => {
    expression = expression.replace(/\$(\w+)/g, "ctx.GetInt(\"$1\")")
    return expression;
};

const main = async () => {
    console.log("Parameters:\n\t", parameters, "\n\n");
    console.log("Features:\n\t", features, "\n\n");

    const file = fs.readFileSync('./rules.feat', 'utf8')
    const rulesPlain = yaml.parse(file);

    console.log("RulesPlain:\n\t", rulesPlain, "\n\n");

    const grl = await ejs.renderFile("./lib/rules.ejs", {
        "defaultValues": features.map(feat => ({
            "name": feat.name,
            "defaultValue": feat.default
        })),
        "featureRules": Object.keys(rulesPlain).map(feat => ({
            "name": feat,
            "expression": compile(rulesPlain[feat])
        }))
    });

    console.log("GRL: \n\n", grl);

    fs.writeFileSync("./rules.grl", grl);
}

main();




