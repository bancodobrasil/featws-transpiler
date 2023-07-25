const MATH_OPERATORS = ["<", ">", ">=", "<="]

const verifyFeatureRule = async (parsed, featureRule) => {

    const EXPRESSION_PATTERN = new RegExp('(?<source>[^.]+)\\.Get(?<type>[^(]*)\\("(?<variable>\\w+)"\\)\\s*(?<operator>(' + MATH_OPERATORS.join('|') + '))', 'gm')

    const matches = EXPRESSION_PATTERN.exec(featureRule.expression);

    if (!(matches?.groups)) return;

    let { variable } = matches.groups;

    let resolvedType = 'string';

    const param = parsed.parameters.find(p => p.name == variable);

    if (typeof param !== 'undefined') {
        resolvedType = param.type;
    } else {
        const feature = parsed.features.find(f => f.name == variable);
        if (typeof feature !== 'undefined') {
            resolvedType = feature.type;
        }
    }

    if (!['integer', 'decimal'].includes(resolvedType)) {
        return `parameter '${variable}' isn't an 'integer' or 'decimal'!`;
    }
};

module.exports = {
    description: "",
    validator: async (parsed) => {

        return (await Promise.all(parsed.featureRules.map(fr => verifyFeatureRule(parsed, fr))))
            .filter(r => typeof r !== 'undefined')
            .reduce((p, c) => {
                //console.log("p", p)
                //console.log("c", c)
                if (!Array.isArray(c)) c = [c];
                return p.concat(c);
            }, []);
    }
}