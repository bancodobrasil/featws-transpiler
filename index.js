const ini = require("ini");
const fs = require("fs");
const ejs = require("ejs");
const { dirname } = require("path");

const compile = (expression) => {
  console.log(`expression ${expression}`);
  expression = expression.replace(/\$(\w+)/g, 'ctx.GetInt("$1")');
  expression = expression.replace(/\@(\w+)/g, 'ctx.GetBool("$1")');
  return expression;
};

const compiler = async (dir) => {
  const parameters = require(dir + "/parameters.json");
  const features = require(dir + "/features.json");
  console.log("Parameters:\n\t", parameters, "\n\n");
  console.log("Features:\n\t", features, "\n\n");

  const file = fs.readFileSync(dir + "/rules.feat", "utf8");
  const rulesPlain = ini.parse(file);

  console.log("RulesPlain:\n\t", rulesPlain, "\n\n");

  const precedence = {};

  Object.keys(rulesPlain).forEach((feat) => {
    precedence[feat] = rulesPlain[feat].match(/@(\w+)/g) || [];
  });

  console.log("precedence", precedence);

  const calcOrder = {};

  while (Object.keys(precedence).length > 0) {
    const feats = Object.keys(precedence);
    for (const feat of feats) {
      if (precedence[feat].length == 0) {
        calcOrder[feat] = 0;
        delete precedence[feat];
      } else {
        const unresolvedPrecedences = precedence[feat].filter(
          (p) => !Number.isInteger(p)
        );
        if (unresolvedPrecedences.length != 0) {

        // FIXME Tratar a referência cíclica    
        //   const cyclic = unresolvedPrecedences.filter(value => Object.keys(precedence).includes(value.substring(1)));
        //   if (JSON.stringify(cyclic)==JSON.stringify(unresolvedPrecedences)) {
        //       throw Error("Referência cíclica");
        //   }

          precedence[feat] = precedence[feat].map((p) => {
            if (Number.isInteger(p)) return p;
            const name = p.substring(1);
            if (name in calcOrder) return calcOrder[name];
            return p;
          });

        } else {
          calcOrder[feat] = Math.max(...precedence[feat]) + 1;
          delete precedence[feat];
        }
      }
    }

    console.log("precedence", precedence);
    console.log("calcOrder", calcOrder);
  }
  console.log("precedence", precedence);
  console.log("calcOrder", calcOrder);

  const maxLevel = Math.max(...Object.values(calcOrder));

  const base_salience = 1000;
  const saliences = {};

  Object.keys(calcOrder).forEach(feat => {
    saliences[feat] = base_salience + maxLevel - calcOrder[feat];
  })

  console.log("saliences", saliences);

  const grl = await ejs.renderFile(__dirname + "/resources/rules.ejs", {
    defaultValues: features.map((feat) => ({
      name: feat.name,
      defaultValue: feat.default,
    })),
    featureRules: Object.keys(rulesPlain).map((feat) => ({
      name: feat,
      precedence: `${saliences[feat]}`,
      expression: compile(rulesPlain[feat]),
    })),
  });

  console.log("GRL: \n\n", grl);

  fs.writeFileSync("./rules.grl", grl);
};

module.exports = {
  compiler,
};
