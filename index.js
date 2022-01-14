const featws = require('js-featws')
const fs = require('fs')
const ejs = require('ejs')
var path = require('path')

const compile = (expression, options) => {
  console.log('Compile Expression BEGIN:', expression, options)
  expression = expression.replace(/([$#%@])(\w+)/g, (_, scope, entryname) => {
    let source = ''
    let type = 'number'

    if (scope === '@')
      scope = '#'

    if (scope === '#') {
      source = 'result'
      const feat = options.features.find(f => f.name === entryname)
      if (feat)
        type = feat.type
    }
    if (scope === '$') {
      source = 'ctx'
      const param = options.parameters.find(p => p.name === entryname)
      if (param)
        type = param.type
    }

    if (scope === '%')
      return `processor.Contains(ctx.GetSlice("${entryname}_entries"), ctx.Get("${entryname}_value"))`

    if (source === '')
      throw Error('Not implemented source: ' + scope)

    let accessMethod = ''
    if (type === 'string')
      accessMethod = 'GetString'
    if (type === 'boolean')
      accessMethod = 'GetBool'
    if (type === 'number')
      accessMethod = 'GetInt'
    if (accessMethod === '')
      throw Error('Not implemented scope')

    return `${source}.${accessMethod}("${entryname}")`
  })
  // expression = expression.replace(/\#(\w+)/g, 'ctx.GetBool("$1")');
  if (options.outputType === 'boolean')
    expression = `processor.Boolean(${expression})`
  if (options.outputType === 'string' | options.outputType === 'number')
    expression = `${expression} + ""`
  console.log('Compile Expression RESULT:', expression)
  return expression
}

const compiler = async (dir) => {
  const rulesFile = dir + '/rules.featws'
  const file = fs.readFileSync(rulesFile, 'utf8')
  const rulesPlain = featws.parse(file)

  const parametersFile = dir + '/parameters.json'
  const parameters = require(parametersFile)

  const featuresFile = dir + '/features.json'
  const features = require(featuresFile)

  const groupsDir = dir + '/groups/'
  const groupFiles = fs.readdirSync(groupsDir, 'utf8')
  const groups = {}
  groupFiles.forEach((gf) => {
    groups[gf.substring(0, gf.length - 5)] = require(groupsDir + gf)
  })

  const outputFile = './rules.grl'

  const grl = await compileGRL(rulesPlain, parameters, features, groups)

  console.log('GRL: \n\n', grl)

  fs.writeFileSync(outputFile, grl)
}

async function compileGRL (rulesPlain, parameters, features, groups) {
  console.log('Parameters:\n', parameters, '\n\n')
  console.log('Features:\n', features, '\n\n')
  console.log('RulesPlain:\n', rulesPlain, '\n\n')
  console.log('Groups: \n', groups, '\n\n')

  Object.entries(groups).forEach(([group, rules]) => {
    const groupFeats = Object.entries(rules).map(([rule, items], index) => {
      const groupFeat = `${group}_${index}`
      const groupFeatValue = `${groupFeat}_value`
      console.log(groupFeatValue, rule, items)
      console.log('Original Rule', rule)
      rule = compileGroupRule(rule)
      console.log('Compiled Rule', rule)
      rulesPlain[groupFeatValue] = { value: rule, type: 'string', result: false }
      rulesPlain[groupFeat] = { value: `%${groupFeat}`, type: 'boolean', result: true }
      features = features.concat([{
        name: groupFeat,
        type: 'boolean',
      }])
      return `#${groupFeat}`
    })
    features = features.concat([{
      name: group,
      type: 'boolean',
    }])
    rulesPlain[group] = { value: groupFeats.join(' || '), type: 'boolean', result: true }
  })

  console.log('\nRulesPlain with groups:\n', rulesPlain, '\n\n')

  const precedence = {}

  Object.keys(rulesPlain).forEach((feat) => {
    let rule = rulesPlain[feat]
    if (typeof rule === 'object')
      rule = rule.value

    precedence[feat] = []
    precedence[feat] = precedence[feat].concat(rule.match(/#(\w+)/g) || [])
    precedence[feat] = precedence[feat].concat((rule.match(/[%@](\w+)/g) || []).map(g => {
      if (g === rule)
        return `${g}_value`

      return g
    }))
    console.log('Resolving precedences for', feat, rule, precedence[feat])
  })

  console.log('precedence', precedence)
  // exit()
  const calcOrder = {}

  while (Object.keys(precedence).length > 0) {
    const feats = Object.keys(precedence)
    for (const feat of feats) {
      if (precedence[feat].length === 0) {
        calcOrder[feat] = 0
        delete precedence[feat]
      } else {
        const unresolvedPrecedences = precedence[feat].filter(
          (p) => !Number.isInteger(p)
        )
        if (unresolvedPrecedences.length !== 0) {
          // FIXME Tratar a referência cíclica
          //   const cyclic = unresolvedPrecedences.filter(value => Object.keys(precedence).includes(value.substring(1)));
          //   if (JSON.stringify(cyclic)==JSON.stringify(unresolvedPrecedences)) {
          //       throw Error("Referência cíclica");
          //   }
          precedence[feat] = precedence[feat].map((p) => {
            if (Number.isInteger(p))
              return p
            const name = p.substring(1)
            if (name in calcOrder)
              return calcOrder[name]
            return p
          })
        } else {
          calcOrder[feat] = Math.max(...precedence[feat]) + 1
          delete precedence[feat]
        }
      }
    }

    // console.log("precedence", precedence);
    // console.log("calcOrder", calcOrder);
  }
  // console.log("precedence", precedence);
  // console.log("calcOrder", calcOrder);

  const maxLevel = Math.max(...Object.values(calcOrder))

  const baseSalience = 1000
  const saliences = {}

  Object.keys(calcOrder).forEach((feat) => {
    saliences[feat] = baseSalience + maxLevel - calcOrder[feat]
  })

  console.log('saliences', saliences)

  const grl = await ejs.renderFile(path.join(__dirname, '/resources/rules.ejs'), {
    groups,
    defaultValues: features.map((feat) => ({
      name: feat.name,
      defaultValue: feat.default,
    })),
    featureRules: Object.keys(rulesPlain).map((feat) => {
      const rule = rulesPlain[feat]
      let expression = rule
      let result = true
      let outputType = (features.find((f) => f.name === feat) || {
        type: 'boolean',
      }).type

      if (typeof rule === 'object') {
        if (rule.type)
          outputType = expression.type

        if (rule.value)
          expression = expression.value

        if (typeof rule.result === 'boolean')
          result = rule.result
      }

      return {
        name: feat,
        precedence: `${saliences[feat] || baseSalience}`,
        expression: compile(expression, {
          outputType,
          parameters,
          features,
        }),
        result,
      }
    }),
  })

  return grl
}

function compileGroupRule (rule) {
  rule = `"${rule}"`
  rule = rule.replace(/{/g, '"+')
  rule = rule.replace(/}/g, '+"')
  rule = rule.trim()
  rule = rule.replace(/^""\+/, '')
  rule = rule.replace(/\+""$/, '')
  return rule
}

module.exports = {
  compiler,
}
