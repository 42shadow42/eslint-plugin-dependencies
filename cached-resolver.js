'use strict';

var resolve = require('resolve');

module.exports = (function(){
    // The resolve cache is shared by all the rules, since the operation is very
    // common and expensive.
    var _resolveCache = Object.create(null);
    
    return {
      resolveSync: resolveSync,
    };
    
    function resolveSync(module, opts) {
        var cacheKey = JSON.stringify([module]);
        
        if (!(cacheKey in _resolveCache)) {
            try {
              _resolveCache[cacheKey] = resolve.sync(module, opts);
            } catch(err) {
              _resolveCache[cacheKey] = null;
            }
        }
        
        return _resolveCache[cacheKey];
    }
})()