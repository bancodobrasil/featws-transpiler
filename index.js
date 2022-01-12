const ini = require("ini");
const fs = require("fs");
const ejs = require("ejs");
const { dirname } = require("path");

const compile = (expression, options) => {
  console.log("Compile Expression BEGIN:", expression, options);
  expression = expression.replace(/([$#%@])(\w+)/g, (_, scope, entryname) => {
    let source = "";
    let type = "number";
    
    if (scope === "@") scope = "#";

    if (scope === "#") {
      source = "result";
      const feat = options.features.find(f => f.name === entryname);
      if (feat) {
        type = feat.type;
      }
    }
    if (scope === "$") {
      source = "ctx";
      const param = options.parameters.find(p => p.name === entryname);
      if (param) {
        type = param.type;
      }
    }

    if (scope === "%") {
      return `processor.Contains(ctx.GetSlice("${entryname}_entries"), ctx.Get("${entryname}_value"))`
    }

    if (source === "") throw Error("Not implemented source: " + scope);
    
    let accessMethod = "";
    if (type === "string") accessMethod = "GetString";
    if (type === "boolean") accessMethod = "GetBool";
    if (type === "number") accessMethod = "GetInt";
    if (accessMethod === "") throw Error("Not implemented scope");

    return `${source}.${accessMethod}("${entryname}")`;
  });
  //expression = expression.replace(/\#(\w+)/g, 'ctx.GetBool("$1")');
  if (options.outputType === "boolean") { expression = `processor.Boolean(${expression})`; }
  if (options.outputType === "string" | options.outputType === "number") { expression = `${expression} + ""`; }
  console.log("Compile Expression RESULT:", expression);
  return expression;
};

const compiler = async (dir) => {
  const parameters = require(dir + "/parameters.json");
  const features = require(dir + "/features.json");
  console.log("Parameters:\n\t", parameters, "\n\n");
  console.log("Features:\n\t", features, "\n\n");

  fs.writeFileSync("./rules.grl", grl);
};

async function compileGRL(rulesPlain, parameters, features, groups) {
  
  console.log("Parameters:\n", parameters, "\n\n");
  console.log("Features:\n", features, "\n\n");
  console.log("RulesPlain:\n", rulesPlain, "\n\n");
  console.log("Groups: \n", groups, "\n\n");

  Object.entries(groups).forEach(([group, rules]) => {
    const group_feats = Object.entries(rules).map(([rule, items], index) => {
      const group_feat = `${group}_${index}`;
      const group_feat_value = `${group_feat}_value`;
      console.log(group_feat_value, rule, items);
      console.log("Original Rule", rule);
      rule = compileGroupRule(rule);
      console.log("Compiled Rule", rule);
      rulesPlain[group_feat_value] = { value: rule, type: "string", result: false };
      rulesPlain[group_feat] = { value: `%${group_feat}`, type: "boolean", result:true };
      features = features.concat([{
        name: group_feat,
        type: "boolean"
      }])
      return `#${group_feat}`;
    });
    features = features.concat([{
      name: group,
      type: "boolean"
    }])
    rulesPlain[group] = { value: group_feats.join(' || '), type: "boolean", result: true };
  });

  console.log("RulesPlain:\n\t", rulesPlain, "\n\n");

  const precedence = {};

  Object.keys(rulesPlain).forEach((feat) => {
    let rule = rulesPlain[feat];
    if (typeof rule === "object") {
      rule = rule.value;
    }
    precedence[feat] = [];
    precedence[feat] = precedence[feat].concat(rule.match(/#(\w+)/g) || []);
    precedence[feat] = precedence[feat].concat((rule.match(/[%@](\w+)/g) || []).map(g => {
      if (g == rule) {
        return `${g}_value`
      }
      return g
    }));
    console.log("Resolving precedences for", feat, rule, precedence[feat]);
  });

  console.log("precedence", precedence);
  //exit()
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

  return grl;
};

module.exports = {
  compiler,
};
