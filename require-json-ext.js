'use strict';

var path = require('path');
var Config = require('./config');
var parser = require('./dependency-parser');
var resolve = require('./cached-resolver');
var jsonExtRe = /\.json$/;

module.exports = function(context) {
  var config = new Config(context);

  function validate(node) {
    var modules = parser.getModules(node);
    for(var index in modules){
      var module = modules[index];
      var id = module.name;
      
      if (jsonExtRe.test(id)) return;
      var resolved = resolve.resolveSync(id, config);
      if (jsonExtRe.test(resolved)) {
        var basename = path.basename(id);
        var idNode = module.node;
        context.report({
            node: idNode,
            data: {basename: basename},
            message: '"{{basename}}" missing ".json" extension.',
            fix: function(fixer) {
              return fixer.insertTextBeforeRange([idNode.range[1] - 1], '.json');
            },
          }
        );
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

module.exports.schema = [];
