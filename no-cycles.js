'use strict';

var Config = require('./config');
var fs = require('fs');
var path = require('path');
var parser = require('./dependency-parser');
var resolver = require('./cached-resolver');

/**
 * A reference to the eslint module is needed to be able to require the same
 * parser that used to parse the file being linted, as well as to use eslint's
 * own traverser.
 */

var eslintModule = (function() {
  var parent = module.parent;
  var eslintLibRe = new RegExp(`\\${path.sep}node_modules\\${path.sep}eslint\\${path.sep}lib\\${path.sep}[^\\${path.sep}]+\\.js$`);
  do {
    if (eslintLibRe.test(parent.filename)) {
      return parent;
    }
  } while ((parent = parent.parent));
  throw new Error('Could not find eslint');
})();

var Traverser = eslintModule.require('./util/traverser');
var traverser = new Traverser();

//------------------------------------------------------------------------------
// Utils
//------------------------------------------------------------------------------

var externalRe = /^[^./]/;
var skipExts = /\.(?:json|node)$/;
var searchRe = /\b(?:require|import|export|define)\b/;

function StorageObject() {}
StorageObject.prototype = Object.create(null);

var NoopVisitor = {
  Program: function() {},
};

function parse(src, parserPath, parserOptions) {
  var parser = eslintModule.require(parserPath);
  try {
    return parser.parse(src, parserOptions);
  } catch (err) {
    return null;
  }
}

function read(filename) {
  try {
    return fs.readFileSync(filename, 'utf8');
  } catch(err) {
    return null;
  }
}

function resolveLocal(name, config) {
    return resolver.resolveSync(name, config);
}

function relativizeTrace(trace, basedir) {
  var out = [];
  for (var i = 0; i < trace.length; i++) {
    out.push(path.relative(basedir, trace[i]));
    basedir = path.dirname(trace[i]);
  }
  return out;
}

var depsCache = new StorageObject();
function getDeps(filename, src, ast, context, config) {
  if (depsCache[filename]) return depsCache[filename];
  var found = depsCache[filename] = [];

  if (skipExts.test(filename)) return found;

  if (!src) src = read(filename);
  if (!src) return found;

  if (!searchRe.test(src)) return found;

  if (!ast) ast = parse(src, context.parserPath, context.parserOptions);
  if (!ast) return found;

  traverser.traverse(ast, {
    enter: function(node, parent) {
      var start = node.range ? node.range[0] : node.start;
      var end = node.range ? node.range[1] : node.end;
      var section = src.slice(start, end);
      if (!searchRe.test(section)) return this.skip();
      
      var modules = parser.getDependencies(node, ['resolve']);
      for(var index in modules){
        var module = modules[index];
        var id = module.name;
        
        var resolved = resolveLocal(id, config);
        if (resolved) found.push(resolved);
      }
    },
  });

  return found;
}

//------------------------------------------------------------------------------
// Rule
//------------------------------------------------------------------------------

module.exports = function(context) {
  var extensions = ['.js'];
  var config = new Config(context, extensions);
  
  var shouldSkip = config.skip && config.skip.some(function(pattern) {
    return RegExp(pattern).test(config.target);
  });
  
  if (shouldSkip) {
    return NoopVisitor;
  }

  var seen = new StorageObject();
  var basedir = path.dirname(config.target);

  function trace(filename, depth, refs) {
    if (!depth) depth = [];
    if (!refs) refs = [];
    var deps = getDeps(filename, null, null, context, config);
    depth.push(filename);
    for (var i = 0; i < deps.length; i++) {
      filename = deps[i];
      if (filename === config.target) {
        refs.push(depth.slice());
      } else if (!seen[filename]) {
        seen[filename] = true;
        trace(filename, depth, refs);
      }
    }
    depth.pop();
    return refs;
  }

  function validate(node) {
    var modules = parser.getDependencies(node, ['resolve']);
    for(var index in modules){
      var module = modules[index];
      var id = module.name;
      var resolved = resolveLocal(id, config);
      if (resolved === config.target) {
        context.report({
          node: node,
          message: 'Self-reference cycle.',
        });
      } else if (resolved) {
        var refs = trace(resolved);
        for (var i = 0; i < refs.length; i++) {
          var prettyTrace = relativizeTrace(refs[i], basedir).join(' => ');
          context.report({
            node: node,
            data: {trace: prettyTrace},
            message: 'Cycle in {{trace}}.',
          });
        }
      }
    }
  }

  return {
    CallExpression: validate,
    ImportDeclaration: validate,
    ExportAllDeclaration: validate,
    ExportNamedDeclaration: validate,
    'Program:exit': function(node) {
      // since this ast has already been built, and traversing is cheap,
      // run it through references.deps so it's cached for future runs.
      getDeps(config.target, context.getSourceCode().text, node, context, config);
    },
  };
};

module.exports.schema = {
  skip: {
    type: 'array',
    items: {
      type: 'string',
    },
  },
};
