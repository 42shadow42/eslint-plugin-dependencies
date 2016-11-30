'use strict';

var Config = require('./config');
var resolver = require('./cached-resolver');
var parser = require('./dependency-parser');

var commondir = require('commondir');
var fs = require('fs');
var path = require('path');
var resolve = require('resolve');

var nodeExts = /\.(js|json|node)$/;

var _readdirCache = Object.create(null);
function readdirSync(dirname) {
  if (!(dirname in _readdirCache)) {
    try {
      _readdirCache[dirname] = fs.readdirSync(dirname);
    } catch (err) {
      _readdirCache[dirname] = null;
    }
  }
  return _readdirCache[dirname];
}

// turns "/a/b/c.js" into ["/a", "/a/b", "/a/b/c.js"]
function pathSteps(pathString) {
  return pathString
    .split('/')
    .map(function(part, i, parts) {
      return parts.slice(0, i + 1).join('/');
    })
    .filter(Boolean);
}

// if more than one possible suggestion is found, return none.
function getCaseSuggestion(needle, haystack) {
  var found = false;
  var lneedle = needle.toLowerCase();
  for (var i = 0; i < haystack.length; i++) {
    if (lneedle === haystack[i].toLowerCase()) {
      if (found) return false;
      found = haystack[i];
    }
  }
  return found;
}

module.exports = function(context) {

  var config = new Config(context);

  function validate(node) {
    var modules = parser.getDependencies(node);
    
    for(var index in modules){
      var module = modules[index];
      var id = module.name;
      var resolved = resolver.resolveSync(id, config);
      if (!resolved || resolve.isCore(resolved)) return;
      var prefix = commondir([config.target, resolved]);
      pathSteps(resolved)
        .filter(function(step) {
          // remove the steps outside of our request
          return step.indexOf(prefix) !== -1;
        })
        .forEach(function(step, i, steps) {
          var basename = path.basename(step);
          var dirname = path.dirname(step);
          var dirlist = readdirSync(dirname);
  
          // we don't have permission?
          if (!dirlist) return;
  
          // compare the directory listing to the requested path. this works
          // because "resolve" resolves by concating the path segments from the
          // input, so the resolved path will have the incorrect case:
          if (dirlist.indexOf(basename) !== -1) return;
  
          var shouldRemoveExt =
            i === steps.length - 1 &&   // last step
            nodeExts.test(basename) &&  // expected
            !nodeExts.test(id);         // actual
  
          var suggestion = getCaseSuggestion(basename, dirlist);
  
          var incorrect = shouldRemoveExt
            ? basename.replace(nodeExts, '')
            : basename;
  
          var correct = shouldRemoveExt && suggestion
            ? suggestion.replace(nodeExts, '')
            : suggestion;
  
          var idNode = module.node;
  
          if (correct) {
            context.report({
              node: idNode,
              data: {incorrect: incorrect, correct: correct},
              message: 'Case mismatch in "{{incorrect}}", expected "{{correct}}".',
            });
          } else {
            context.report({
              node: idNode,
              data: {incorrect: incorrect},
              message: 'Case mismatch in "{{incorrect}}".',
            });
          }
      });
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
  paths: {
    type: 'array',
    items: {
      type: 'string',
    },
  },
};
