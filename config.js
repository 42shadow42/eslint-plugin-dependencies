'use strict';

var path = require('path');

module.exports = function(context, extensions){
    var target = context.getFilename();
    var ignore = context.options[0] && context.options[0].ignore && context.options[0].ignore.map(function(item){
        return new RegExp(item);
    });
    var skip = context.options[0] && context.options[0].skip;
    
    return {
        target: target,
        basedir: path.dirname(target),
        extensions: extensions || ['.js', '.json','.node'],
        ignore: ignore,
        paths: getPaths(context),
        skip: skip
    };
    
    function getPaths(context){
        var paths = [];
    
        if (context.options[0] && context.options[0].paths) {
            paths = context.options[0].paths.map(function(single_path) {
              return path.resolve(single_path);
            });
        }
        
        return paths;
    }
};
