'use strict';
var Config = require('./config');
var resolver = require('./cached-resolver');
var parser = require('./dependency-parser');

module.exports = function(context) {
  var config = new Config(context);

  function validate(node) {
    var modules = parser.getDependencies(node);
    for(var index in modules){
      var module = modules[index];
      var id = module.name;
      if (config.ignore && config.ignore.some(function(expression){
        return expression.test(id);
      })) continue;
      var resolved = resolver.resolveSync(id, config);
      if (!resolved) {
        context.report({
          node: module.node,
          data: {id: id},
          message: '"{{id}}" does not exist.',
        });
      }
    }
  }

  return {
    CallExpression: validate,
    ImportDeclaration: validate,
    ExportAllDeclaration: validate,
    ExportNamedDeclaration: validate,
  };
};

module.exports.schema = {
  ignore: {
    type: 'array',
    items: {
      type: 'string',
    },
  },
  paths: {
    type: 'array',
    items: {
      type: 'string',
    },
  },
};
