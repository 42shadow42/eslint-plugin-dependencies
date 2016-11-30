'use strict';

module.exports = (function() {
    var defineCall = {
        name: 'define',
        definition: {
            type: 'CallExpression',
            callee: {
                type: 'Identifier',
                name: 'define'
            },
            arguments: function(args) {
                return args[0].type === 'ArrayExpression' && args[1].type === 'FunctionExpression';
            }
        },
        getModules: function(node) {
            return node.arguments[0].elements.map(function(module) {
                return {
                    node: module,
                    name: module.value
                };
            });
        }
    };
    var requireCall = {
        name: 'require',
        definition: {
            type: 'CallExpression',
            callee: {
                type: 'Identifier',
                name: 'require'
            },
            arguments: [{
                type: 'Literal'
            }]
        },
        getModules: function(node) {
            return [{
                node: node.arguments[0],
                name: node.arguments[0].value
            }];
        }
    };
    var resolveCall = {
        name: 'resolve',
        definition: {
            type: 'CallExpression',
            callee: {
                type: 'MemberExpression',
                computed: false,
                object: {
                    type: 'Identifier',
                    name: 'require'
                },
                property: {
                    type: 'Identifier',
                    name: 'resolve'
                }
            },
            arguments: [{
                type: 'Literal'
            }]
        },
        getModules: function(node) {
            return [{
                node: node.arguments[0],
                name: node.arguments[0].value
            }];
        }
    };
    var importDeclaration = {
        name: 'import',
        definition: {
            type: 'ImportDeclaration',
            importKind: function(kind) {
                return kind == null || kind === 'value';
            },
            source: {
                type: 'Literal'
            }
        },
        getModules: function(node) {
            return [{
                node: node.source,
                name: node.source.value
            }];
        }
    };
    var exportDeclaration = {
        name: 'export',
        definition: {
            type: function(type) {
                return type === 'ExportAllDeclaration' || type === 'ExportNamedDeclaration';
            },
            importKind: function(kind) {
                return kind == null || kind === 'value';
            },
            source: {
                type: 'Literal'
            }
        },
        getModules: function(node) {
            return [{
                node: node.source,
                name: node.source.value
            }];
        }
    };

    var types = [
        defineCall,
        requireCall,
        resolveCall,
        importDeclaration,
        exportDeclaration
    ];

    return {
        isDependency: isDependency,
        getDependencies: getDependencies
    };

    function isDependency(node, exclusions) {
        return types.some(function(type) {
            return !isExcluded(exclusions, type) && compare(type.definition, node);
        });
    }

    function getDependencies(node, exclusions) {
        var type = types.filter(function(type) {
            return !isExcluded(exclusions, type) && compare(type.definition, node);
        });

        if (type.length === 0) return [];

        return type[0].getModules(node);
    }

    function compare(definition, source) {
        for (var key in definition) {
            var expected = definition[key];
            var actual = source[key];

            if (typeof(expected) === 'string') {
                if (expected !== actual) return false;
            }
            else if (typeof(expected) === 'function') {
                if (!expected(actual)) return false;
            }
            else if (!compare(expected, actual)) return false;
        }

        return true;
    }

    function isExcluded(exclusions, type) {
        return exclusions && exclusions.indexOf(type.name) !== -1;
    }
})();
