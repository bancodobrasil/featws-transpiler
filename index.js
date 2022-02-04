const featws = require("js-featws");
const fs = require("fs");
const ejs = require("ejs");

const compile = (expression, options) => {
  // console.log("Compile Expression BEGIN:", expression, options);
  expression = expression.replace(/([$#%@])(\w+)/g, (_, scope, entryname) => {
    let source = "";
    let type = "integer";

    if (scope === "@") scope = "#";

    if (scope === "#") {
      source = "result";
      const feat = options.features.find((f) => f.name === entryname);
      if (feat) {
        type = feat.type;
      }
    }
    if (scope === "$") {
      source = "ctx";
      const param = options.parameters.find((p) => p.name === entryname);
      if (param) {
        type = param.type;
      }
    }

    if (scope === "%") {
      return `processor.Contains(ctx.GetSlice("${entryname}_entries"), ctx.Get("${entryname}_value"))`;
    }

    //if (source === "") throw Error("Not implemented source: " + scope);

    let accessMethod = "";
    if (type === "string") accessMethod = "GetString";
    if (type === "boolean") accessMethod = "GetBool";
    if (type === "integer") accessMethod = "GetInt";
    if (type === "decimal") accessMethod = "GetFloat";
    if (accessMethod === "")
      throw Error(
        "Not implemented accessMethod: " +
          JSON.stringify({
            scope,
            entryname,
            type,
          })
      );

    return `${source}.${accessMethod}("${entryname}")`;
  });
  //expression = expression.replace(/\#(\w+)/g, 'ctx.GetBool("$1")');
  if (options.outputType === "boolean") {
    expression = expression === 'false' ? expression = `${expression}` : expression = `processor.Boolean(${expression})`;
  }

  if (options.outputType === "string") {
    expression = `${expression} + ""`;
  } if (
    (options.outputType === "integer") |
    (options.outputType === "decimal")
  )
  {
    expression = `${expression}`;
  }
  // console.log("Compile Expression RESULT:", expression);
  return expression;
};

/*const compile_condition = (condition, options) => {
  // console.log("Compile Expression BEGIN:", expression, options);
  condition = condition.replace(/([$#%@])(\w+)/g, (_, scope, entryname) => {
    let source = "";
    let type = "boolean";

    if (scope === "@") scope = "#";

    if (scope === "#") {
      source = "result";
      const feat = options.features.find((f) => f.name === entryname);
      if (feat) {
        type = feat.type;
      }
    }
    if (scope === "$") {
      source = "ctx";
      const param = options.parameters.find((p) => p.name === entryname);
      if (param) {
        type = param.type;
      }
    }

    if (scope === "%") {
      return `processor.Contains(ctx.GetSlice("${entryname}_entries"), ctx.Get("${entryname}_value"))`;
    }

    //if (source === "") throw Error("Not implemented source: " + scope);

    let accessMethod = "";
    if (type === "string") accessMethod = "GetString";
    if (type === "boolean") accessMethod = "GetBool";
    if (type === "integer") accessMethod = "GetInt";
    if (type === "decimal") accessMethod = "GetFloat";
    if (accessMethod === "")
      throw Error(
        "Not implemented accessMethod: " +
          JSON.stringify({
            scope,
            entryname,
            type,
          })
      );

    return `${source}.${accessMethod}("${entryname}")`;
  });
  //expression = expression.replace(/\#(\w+)/g, 'ctx.GetBool("$1")');
  if (options.outputType === "integer") {
    condition = `processor.Boolean(${condition})`;
  }

  if (options.outputType === "boolean") {
    condition = `processor.Boolean(${condition})`;
  }
  
  if (
    (options.outputType === "string") |
    (options.outputType === "integer") |
    (options.outputType === "decimal")
  ) {
    condition = `${condition}`;
  }
  
  //console.log("Compile condition RESULT:", condition);
  return condition;
};*/

const compiler = async (dir) => {
  try {
    const rulesFile = dir + "/rules.featws";
    const file = fs.readFileSync(rulesFile, "utf8");
    const rulesPlain = featws.parse(file);

    const parametersFile = dir + "/parameters.json";
    const parameters = require(parametersFile);

    const featuresFile = dir + "/features.json";
    const features = require(featuresFile);

    const groups = {};
    const groupsDir = dir + "/groups/";

    if (fs.existsSync(groupsDir)) {
      const groupFiles = fs.readdirSync(groupsDir, "utf8");
      groupFiles.forEach((gf) => {
        groups[gf.substring(0, gf.length - 5)] = require(groupsDir + gf);
      });
    }

    const outputFile = dir + "/rules.grl";

    const grl = await compileGRL(rulesPlain, parameters, features, groups);

    // console.log("GRL: \n\n", grl);

    fs.writeFileSync(outputFile, grl);
  } catch (e) {
    throw e;
  }
};

async function compileGRL(rulesPlain, parameters, features, groups) {
  try {
    // console.log("Parameters:\n", parameters, "\n\n");
    // console.log("Features:\n", features, "\n\n");
    // console.log("RulesPlain:\n", rulesPlain, "\n\n");
    // console.log("Groups: \n", groups, "\n\n");

    Object.entries(groups).forEach(([group, rules]) => {
      const group_feats = Object.entries(rules).map(([rule, items], index) => {
        const group_feat = `${group}_${index}`;
        const group_feat_value = `${group_feat}_value`;
        // console.log(group_feat_value, rule, items);
        // console.log("Original Rule", rule);
        rule = compileGroupRule(rule);
        // console.log("Compiled Rule", rule);
        rulesPlain[group_feat_value] = {
          value: rule,
          type: "string",
          result: false,
        };
        rulesPlain[group_feat] = {
          value: `%${group_feat}`,
          type: "boolean",
          result: true,
        };
        features = features.concat([
          {
            name: group_feat,
            type: "boolean",
          },
        ]);
        return `#${group_feat}`;
      });
      features = features.concat([
        {
          name: group,
          type: "boolean",
        },
      ]);
      rulesPlain[group] = {
        value: group_feats.join(" || "),
        type: "boolean",
        result: true,
      };
    });

    // console.log("\nRulesPlain with groups:\n", rulesPlain, "\n\n");

    const precedence = {};

    Object.keys(rulesPlain).forEach((feat) => {
      let rule = rulesPlain[feat];
      console.log("rule", rule);
      if (typeof rule === "object") {
        const condition = rule.condition;
        rule = rule.value;

        if (typeof condition != "undefined") {
          rule += ` ${condition}`;
        }
      }
      console.log("rule plain", rule);
      precedence[feat] = [];
      precedence[feat] = precedence[feat].concat(
        rule.match(/[#@](\w+)/g) || []
      );
      precedence[feat] = precedence[feat].concat(
        (rule.match(/%(\w+)/g) || []).map((g) => `$${g.substring(1)}_value`)
      );
      // console.log("Resolving precedences for", feat, rule, precedence[feat]);
    });

    console.log("precedence", precedence);
    //exit()
    const calcOrder = {};

    const entries = features
      .map((feat) => feat.name)
      .concat(parameters.map((param) => param.name)).
      concat(Object.keys(rulesPlain))
      .filter((value, index, self) => {
        return self.indexOf(value) === index;
      }).sort();

    // console.log("entries", entries);

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
            precedence[feat] = await Promise.all(precedence[feat].map(async (p) => {
              if (Number.isInteger(p)) return p;
              const name = p.substring(1);

              if (!entries.includes(name)) {
                throw Error(`Unresolvable entry: ${name}`);
              }

              if (name in calcOrder) return calcOrder[name];
             
              return p;
            }));
          } else {
            calcOrder[feat] = Math.max(...precedence[feat]) + 1;
            delete precedence[feat];
          }
        }
      }

      //// console.log("precedence", precedence);
      //// console.log("calcOrder", calcOrder);
    }
    //// console.log("precedence", precedence);
    //// console.log("calcOrder", calcOrder);

    const maxLevel = Math.max(...Object.values(calcOrder));

    const base_salience = 1000;
    const saliences = {};

    Object.keys(calcOrder).forEach((feat) => {
      saliences[feat] = base_salience + maxLevel - calcOrder[feat];
    });

    // console.log("saliences", saliences);

    const grl = await ejs.renderFile(__dirname + "/resources/rules.ejs", {
      groups,
      defaultValues: features
        .map((feat) => ({
          name: feat.name,
          defaultValue: feat.default,
        }))
        .filter((feat) => feat.defaultValue !== undefined),
      featureRules: Object.keys(rulesPlain).map((feat) => {
        let rule = rulesPlain[feat];
        let expression = rule;
        let condition = `${typeof expression.condition == "undefined" ? "true" : expression.condition}`;        let result = true;
        let outputType = (features.find((f) => f.name == feat) || {
          type: "boolean",
        })["type"];

        if (typeof rule === "object") {
          if (rule.type) {
            outputType = expression.type;
          }
          if (rule.value) {
            expression = expression.value;
          }
          if (typeof rule.result === "boolean") {
            result = rule.result;
          }
        }
        
        return {
          name: feat,
          condition: condition != 'true' ? compile(condition, {
            outputType: "boolean",
            parameters,
            features
          }): "true",
          precedence: `${saliences[feat] || base_salience}`,
          expression: compile(expression, {
            outputType,
            parameters,
            features,
          }),
          result,
        };

      }),
    });

    return grl;
  } catch (e) {
    throw e;
  }
}

function compileGroupRule(rule) {
  rule = `"${rule}"`;
  rule = rule.replace(/{/g, '"+');
  rule = rule.replace(/}/g, '+"');
  rule = rule.trim();
  rule = rule.replace(/^""\+/, "");
  rule = rule.replace(/\+""$/, "");
  return rule;
}

module.exports = {
  compiler,
};
