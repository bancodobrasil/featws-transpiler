const featws = require("js-featws");
const fs = require("fs");

const toBool = (s) => {
  if (typeof s === "string") {
    s = s.toLowerCase();
  }
  return s;
};

const compile = (expression, options) => {
  if (typeof expression === "object" || typeof expression === "boolean") {
    expression = JSON.stringify(expression);
  }

  expression = expression.replace(
    /([$#%@])(\w+)((\.?\w+)*)(::(\w+))?/g,
    (all, scope, entryname, params) => {
      let source = "";
      let type = "";

      if (scope === "@") scope = "#";

      if (scope === "#") {
        source = "result";
        const feat = options.features.find((f) => f.name === entryname);
        if (feat) {
          type = feat.type;
          if (typeof feat.result !== "undefined" && !feat.result) {
            source = "ctx";
          }
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

      if (source === "") throw Error("Not implemented source: " + scope);

      let typeCast = all.match(/::(\w+)$/);
      if (typeCast) {
        typeCast = typeCast[1];
      }

      if (!params && typeCast) {
        type = typeCast;
      }

      let accessMethod = resolveAccessMethod(type);
      if (accessMethod === "")
        throw Error(
          "Not implemented accessMethod: " +
          JSON.stringify({
            scope,
            entryname,
            type,
            required,
          })
        );

      let nestedAccess = "";
      if (params) {
        nestedAccess = params.replace(/\.(\w+)\./g, `.GetMap("$1").`);

        let accessMethod = resolveAccessMethod(typeCast ? typeCast : "");

        nestedAccess = nestedAccess.replace(
          /\.(\w+)$/,
          `.${accessMethod}("$1")`
        );
      }

      return `${source}.${accessMethod}("${entryname}")${nestedAccess}`;
    }
  );

  let outputType = options.outputType;

  if (outputType === "string") {
    if (expression.startsWith("ctx.") || expression.startsWith("result.")) {
      expression = `${expression} + ""`;
    } else if (!expression.startsWith('"')) {
      expression = `"${expression}"`;
    }
  }
  if (outputType === "object") {
    expression = JSON.stringify(expression);
    expression = `processor.ToMap(${expression})`;
  }
  if ((outputType === "integer") || (outputType === "decimal")) {
    expression = `${expression}`;
  }
  return expression;
};

const parser = async (dir) => {
  try {
    let rulesPlain;

    if (fs.existsSync(dir + "/rules.featws")) {
      const rulesFile = dir + "/rules.featws";
      const file = fs.readFileSync(rulesFile, "utf8");
      rulesPlain = featws.parse(file);
    }

    if (fs.existsSync(dir + "/rules.json")) {
      const rulesFile = dir + "/rules.json";
      rulesPlain = require(rulesFile);
    }

    if (typeof rulesPlain === "undefined") {
      throw new Error("Rules file not founded");
    }

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

    return compileGRL(rulesPlain, parameters, features, groups);

  } catch (e) {
    throw e;
  }
};

function resolveAccessMethod(type) {
  let accessMethod = "Get";
  if (type === "object") accessMethod = "GetMap";
  if (type === "string") accessMethod = "GetString";
  if (type === "boolean") accessMethod = "GetBool";
  if (type === "integer") accessMethod = "GetInt";
  if (type === "decimal") accessMethod = "GetFloat";
  if (type === "slice") accessMethod = "GetSlice";
  return accessMethod;
}

async function compileGRL(rulesPlain, parameters, features, groups) {
  try {
    Object.entries(groups).forEach(([group, rules]) => {
      const group_feats = Object.entries(rules).map(([rule, items], index) => {
        const group_feat = `${group}_${index}`;
        const group_feat_value = `${group_feat}_value`;
        rule = compileGroupRule(rule);
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
        value: group_feats.join(" && "),
        type: "boolean",
        result: true,
      };
    });

    const slices = [];

    Object.keys(rulesPlain).forEach((feat) => {
      const rule = rulesPlain[feat];
      if (Array.isArray(rule)) {
        if (!slices.includes(feat)) {
          slices.push(feat);
        }
        rule.forEach((r, i) => {
          const entry_name = feat + "_" + i;
          features = features.concat([
            {
              name: entry_name,
              type: r.type,
              result: false,
            },
          ]);
          rulesPlain[entry_name] = {
            ...r,
            result: false,
          };
        });
        delete rulesPlain[feat];
        const feature = {
          name: feat,
          type: "slice",
          writeMethod: "AddItems",
          result: true,
        };
        rulesPlain[feat] = {
          ...feature,
          value: rule.map((_, i) => "#" + feat + "_" + i).join(", "),
        };
        features = features.concat([feature]);
      }
    });


    const precedence = {};

    Object.keys(rulesPlain).forEach((feat) => {
      let rule = rulesPlain[feat];
      if (typeof rule === "object") {
        const condition = rule.condition;
        rule = JSON.stringify(rule.value);

        if (typeof condition != "undefined") {
          rule += ` ${condition}`;
        }
      }

      if (typeof rule !== "string") rule = JSON.stringify(rule);

      // console.log("rule plain", rule);
      precedence[feat] = [];
      precedence[feat] = precedence[feat].concat(
        rule.match(/[#@](\w+)/g) || []
      );
      precedence[feat] = precedence[feat].concat(
        (rule.match(/%(\w+)/g) || []).map((g) => `$${g.substring(1)}_value`)
      );
    });

    const calcOrder = {};

    const entries = features
      .map((feat) => feat.name)
      .concat(parameters.map((param) => param.name))
      .concat(Object.keys(rulesPlain))
      .filter((value, index, self) => {
        return self.indexOf(value) === index;
      })
      .sort();

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
            precedence[feat] = await Promise.all(
              precedence[feat].map(async (p) => {
                if (Number.isInteger(p)) return p;
                const name = p.substring(1);

                if (!entries.includes(name)) {
                  throw Error(`Unresolvable entry: ${name}`);
                }

                if (name in calcOrder) return calcOrder[name];

                return p;
              })
            );
          } else {
            calcOrder[feat] = Math.max(...precedence[feat]) + 1;
            delete precedence[feat];
          }
        }
      }

    }

    const maxLevel = Math.max(...Object.values(calcOrder));

    const base_salience = 1000;
    const saliences = {};

    Object.keys(calcOrder).forEach((feat) => {
      saliences[feat] = base_salience + maxLevel - calcOrder[feat];
    });

    const requiredParams = parameters.filter((p) => toBool(p.required));

    return {
      parameters,
      features,
      groups,
      slices,
      remoteLoadeds: parameters.filter((p) => !!p.resolver),
      requiredParams,
      setupReady: requiredParams.length == 0,
      defaultValues: features
        .filter((feat) => typeof feat.default !== "undefined")
        .map((feat) => ({
          name: feat.name,
          defaultValue: compile(feat.default, {
            outputType:
              typeof feat.default === "boolean" || feat["type"] === "boolean"
                ? "string"
                : feat["type"],
            parameters,
            features,
          }),
        }))
        .filter((feat) => feat.defaultValue !== undefined),
      featureRules: Object.keys(rulesPlain).map((feat) => {
        const rule = rulesPlain[feat];
        let expression = rule;
        const condition = `${typeof expression.condition == "undefined"
          ? "true"
          : expression.condition
          }`;
        let result = true;
        const feature = features.find((f) => f.name == feat) || {
          type: "boolean",
        };
        let outputType = feature["type"];

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
          ...feature,
          name: feat,
          accessMethod: resolveAccessMethod(outputType),
          condition:
            condition != "true"
              ? compile(condition, {
                outputType: "boolean",
                parameters,
                features,
              })
              : "true",
          precedence: `${saliences[feat] || base_salience}`,
          expression: compile(expression, {
            outputType,
            parameters,
            features,
          }),
          result,
        };
      }),
    };
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
  parser,
};
