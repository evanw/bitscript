function assert(truth) {
    if (!truth) {
        throw new Error('assertion failed');
    }
}

function repeat(text, times) {
    return new Array(times + 1).join(text);
}

function flatten(array) {
    return Array.prototype.concat.apply(Array.prototype, array);
}

var Source = (function () {
    function Source(name, contents) {
        this.name = name;
        this.contents = contents;
        this.lines = contents.split('\n');
    }
    return Source;
})();

var Marker = (function () {
    function Marker(index, line, column) {
        this.index = index;
        this.line = line;
        this.column = column;
    }
    return Marker;
})();

var SourceRange = (function () {
    function SourceRange(source, start, end) {
        this.source = source;
        this.start = start;
        this.end = end;
    }
    return SourceRange;
})();

var Diagnostic = (function () {
    function Diagnostic(type, range, text) {
        this.type = type;
        this.range = range;
        this.text = text;
    }
    Diagnostic.prototype.toString = function () {
        var source = this.range.source;
        var start = this.range.start;
        var end = this.range.end;
        var line = source.lines[start.line - 1];
        var a = start.column - 1;
        var b = end.line === start.line ? end.column - 1 : line.length;
        return this.type + ' on line ' + start.line + ' of ' + source.name + ': ' + this.text + '\n\n' + line + '\n' + repeat(' ', a) + (b - a < 2 ? '^' : repeat('~', b - a)) + '\n';
    };
    return Diagnostic;
})();

var Log = (function () {
    function Log() {
        this.diagnostics = [];
        this.hasErrors = false;
    }
    Log.prototype.error = function (range, text) {
        this.diagnostics.push(new Diagnostic('error', range, text));
        this.hasErrors = true;
    };

    Log.prototype.warning = function (range, text) {
        this.diagnostics.push(new Diagnostic('warning', range, text));
    };
    return Log;
})();
function tokenKindToText(kind) {
    return new RegExp('\\w').test(kind) ? kind : '"' + kind + '"';
}

////////////////////////////////////////////////////////////////////////////////
// Syntax diagnostics
////////////////////////////////////////////////////////////////////////////////
function syntaxErrorUnexpectedToken(log, token) {
    log.error(token.range, 'unexpected ' + tokenKindToText(token.kind));
}

function syntaxErrorExpectedToken(log, found, expected) {
    log.error(found.range, 'expected ' + tokenKindToText(expected) + ' but found ' + tokenKindToText(found.kind));
}

function syntaxErrorBadEscapeSequence(log, range, text) {
    log.error(range, 'bad escape sequence "' + text + '"');
}

function syntaxErrorExtraData(log, range, text) {
    log.error(range, 'syntax error "' + text + '"');
}

function syntaxErrorDuplicateModifier(log, token) {
    log.error(token.range, 'duplicate ' + token.text + ' modifier');
}

////////////////////////////////////////////////////////////////////////////////
// Semantic diagnostics
////////////////////////////////////////////////////////////////////////////////
function semanticErrorDuplicateSymbol(log, range, symbol) {
    log.error(range, symbol.name + ' is already defined ' + (symbol.node !== null ? 'on line ' + symbol.node.range.start.line + (range.source.name !== symbol.node.range.source.name ? ' of ' + symbol.node.range.source.name : '') : 'internally'));
}

function semanticErrorIncompatibleTypes(log, range, from, to) {
    log.error(range, 'cannot convert from ' + from + ' to ' + to);
}

function semanticErrorCircularType(log, range) {
    log.error(range, 'circular type');
}

function semanticErrorUnknownSymbol(log, range, name) {
    log.error(range, name + ' is not defined');
}

function semanticErrorUnexpectedExpression(log, range, type) {
    log.error(range, 'unexpected ' + type);
}

function semanticErrorPointerModifierConflict(log, range) {
    log.error(range, 'cannot use both owned and shared');
}

function semanticErrorInvalidPointerModifier(log, range, type) {
    log.error(range, 'cannot make a pointer to ' + type);
}

function semanticErrorUnexpectedStatement(log, range, text) {
    log.error(range, 'cannot use ' + text + ' here');
}

function semanticErrorInvalidNew(log, range, type) {
    log.error(range, 'cannot use new on ' + type);
}

function semanticErrorInvalidCall(log, range, type) {
    log.error(range, 'cannot call ' + type);
}

function semanticErrorArgumentCount(log, range, expected, found) {
    log.error(range, 'expected ' + expected + ' argument' + (expected === 1 ? '' : 's') + ' but found ' + found + ' argument' + (found === 1 ? '' : 's'));
}

function semanticErrorRValueToRawPointer(log, range) {
    log.error(range, 'new object will be deleted immediately (store it somewhere with an owned or shared type instead)');
}

function semanticErrorNoMembers(log, range, type) {
    log.error(range, 'no members on ' + type);
}

function semanticErrorUnknownMemberSymbol(log, range, name, type) {
    log.error(range, name + ' is not defined on ' + type);
}

function semanticErrorNoUnaryOperator(log, range, op, type) {
    log.error(range, 'no unary operator ' + op + ' for ' + type);
}

function semanticErrorNoBinaryOperator(log, range, op, left, right) {
    log.error(range, 'no binary operator ' + op + ' for ' + left + ' and ' + right);
}

function semanticErrorExpectedReturnValue(log, range, type) {
    log.error(range, 'return statement must return ' + type);
}

function semanticErrorBadStorage(log, range) {
    log.error(range, 'cannot store to this location');
}

function semanticErrorBadBaseType(log, range, type) {
    log.error(range, 'cannot inherit from ' + type);
}

function semanticErrorNoCommonType(log, range, a, b) {
    log.error(range, 'no common type for ' + a + ' and ' + b);
}

function semanticErrorUnexpectedModifier(log, range, modifier, why) {
    log.error(range, 'cannot use the ' + modifier + ' modifier ' + why);
}

function semanticErrorModifierOverMissingBase(log, range, name) {
    log.error(range, name + ' has the "over" modifier but does not override anything');
}

function semanticErrorModifierMissingOver(log, range, name) {
    log.error(range, name + ' overrides another symbol with the same name but is missing the "over" modifier');
}

function semanticErrorOverrideNotFunctions(log, range, name, base) {
    log.error(range, name + ' overrides symbol with the same name in base class ' + base.asString());
}

function semanticErrorOverrideDifferentTypes(log, range, name, base, derived) {
    log.error(range, name + ' must have the same signature as the function it overrides (' + derived.asString() + ' overrides ' + base.asString() + ')');
}

function semanticErrorAbstractNew(log, node) {
    log.error(node.range, 'cannot use new on abstract ' + node.computedType);
}

function semanticErrorCannotParameterize(log, range, type) {
    log.error(range, 'cannot parameterize ' + type);
}

function semanticErrorParameterCount(log, range, expected, found) {
    log.error(range, 'expected ' + expected + ' type parameter' + (expected === 1 ? '' : 's') + ' but found ' + found + ' type parameter' + (found === 1 ? '' : 's'));
}

function semanticErrorUnparameterizedExpression(log, range, type) {
    log.error(range, 'cannot use unparameterized ' + type);
}

function semanticErrorParameterizedExpression(log, range, type) {
    log.error(range, 'cannot use parameterized ' + type);
}

function semanticErrorBadParameter(log, range, type) {
    log.error(range, 'cannot use ' + type + ' as a type parameter');
}
var Token = (function () {
    function Token(range, kind, text) {
        this.range = range;
        this.kind = kind;
        this.text = text;
    }
    return Token;
})();

function tokenize(log, source) {
    // Lists for tokenizing
    var operators = [
        '\\(',
        '\\)',
        '\\{',
        '\\}',
        '\\[',
        '\\]',
        '\\.',
        '~',
        ',',
        ';',
        '\\?',
        ':',
        '\\+\\+',
        '--',
        '&&',
        '\\|\\|',
        '\\+=',
        '-=',
        '\\*=',
        '/=',
        '%=',
        '&=',
        '\\|=',
        '\\^=',
        '>>>=',
        '<<=',
        '>>=',
        '\\+',
        '-',
        '\\*',
        '/',
        '%',
        '&',
        '\\|',
        '\\^',
        '>>>',
        '<<',
        '>>',
        '!=',
        '==',
        '<=',
        '>=',
        '<',
        '>',
        '!',
        '='
    ];
    var keywords = [
        'if',
        'else',
        'while',
        'continue',
        'break',
        'return',
        'class',
        'true',
        'false',
        'null',
        'new',
        'this',
        'owned',
        'shared',
        'ref',
        'over'
    ];

    // Regular expressions for tokenizing
    var splitter = new RegExp('(' + [
        '\\n',
        '//.*',
        '[ \\t]+',
        '(?:\\b)[0-9]+(?:\\.[0-9]+)?\\b',
        '\\b[A-Za-z_][A-Za-z\\$_0-9]*',
        '(?:' + operators.join('|') + ')'
    ].join('|') + ')');
    var isSpace = new RegExp('^(?:[\\n \\t]|//|$)');
    var isDouble = new RegExp('^[0-9]');
    var isIdent = new RegExp('^[A-Za-z\\_]');
    var isKeyword = new RegExp('^(?:' + keywords.join('|') + ')$');

    // Do most of the lexing with the runtime's built-in regular expression JIT
    var parts = source.contents.split(splitter);
    var tokens = [];
    var empty = true;
    var i = 0;
    var line = 1;
    var index = 0;
    var columnAdjust = 1;

    while (i < parts.length) {
        var part = parts[i];
        var length = part.length;
        i++;

        if (empty) {
            empty = false;
            if (length > 0) {
                var start = new Marker(index, line, index + columnAdjust);
                var end = new Marker(index + length, line, index + length + columnAdjust);
                syntaxErrorExtraData(log, new SourceRange(source, start, end), part);
            }
            index += length;
            continue;
        }
        empty = true;

        // Decode the matched part (more frequent parts are tested earlier for efficiency)
        var kind = part;
        if (isSpace.test(part)) {
            index += length;
            if (part === '\n') {
                columnAdjust = 1 - index;
                line++;
            }
            continue;
        } else if (isIdent.test(part)) {
            if (!isKeyword.test(part))
                kind = 'IDENTIFIER';
        } else if (isDouble.test(part))
            kind = part.indexOf('.') >= 0 ? 'DOUBLE' : 'INT';

        // Create the new token
        var start = new Marker(index, line, index + columnAdjust);
        var end = new Marker(index + length, line, index + length + columnAdjust);
        tokens.push(new Token(new SourceRange(source, start, end), kind, part));
        index += length;
    }

    // Every token stream ends in END
    var marker = new Marker(index, line, index + columnAdjust);
    tokens.push(new Token(new SourceRange(source, marker, marker), 'END', ''));
    return tokens;
}

function prepareTokens(tokens) {
    var tokenStack = [];
    var indexStack = [];

    nextToken:
    for (var i = 0; i < tokens.length; i++) {
        var token = tokens[i];

        while (tokenStack.length > 0) {
            var top = tokenStack[tokenStack.length - 1];

            if (top.kind === '<' && token.kind !== '<' && token.kind[0] !== '>' && token.kind !== 'IDENTIFIER' && token.kind !== ',' && token.kind !== 'owned' && token.kind !== 'shared') {
                tokenStack.pop();
                indexStack.pop();
            } else {
                break;
            }
        }

        if (token.kind === '(' || token.kind === '{' || token.kind === '[' || token.kind === '<') {
            tokenStack.push(token);
            indexStack.push(i);
            continue;
        }

        if (token.kind === ')' || token.kind === '}' || token.kind === ']' || token.kind[0] === '>') {
            while (tokenStack.length > 0) {
                var top = tokenStack[tokenStack.length - 1];

                if (token.kind[0] === '>' && top.kind !== '<') {
                    break;
                }

                if (top.kind === '<' && token.kind[0] !== '>') {
                    tokenStack.pop();
                    indexStack.pop();
                    continue;
                }

                if (token.kind[0] === '>' && token.kind.length > 1) {
                    var start = token.range.start;
                    var middle = new Marker(start.index + 1, start.line, start.column + 1);
                    tokens.splice(i + 1, 0, new Token(new SourceRange(token.range.source, middle, token.range.end), token.kind.slice(1), token.text.slice(1)));
                    token.range.end = middle;
                    token.kind = '>';
                    token.text = '>';
                }

                // Consume the matching token
                var match = tokenStack.pop();
                var index = indexStack.pop();

                if (match.kind === '<' && token.kind === '>') {
                    match.kind = 'START_PARAMETER_LIST';
                    token.kind = 'END_PARAMETER_LIST';
                }

                continue nextToken;
            }
        }
    }

    return tokens;
}
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var TypeModifier;
(function (TypeModifier) {
    TypeModifier[TypeModifier["OWNED"] = 1] = "OWNED";
    TypeModifier[TypeModifier["SHARED"] = 2] = "SHARED";
    TypeModifier[TypeModifier["STORAGE"] = 4] = "STORAGE";
    TypeModifier[TypeModifier["INSTANCE"] = 8] = "INSTANCE";
    TypeModifier[TypeModifier["UNOWNED"] = 16] = "UNOWNED";
    TypeModifier[TypeModifier["UNSHARED"] = 32] = "UNSHARED";
})(TypeModifier || (TypeModifier = {}));

var Type = (function () {
    function Type() {
        this.parameters = [];
    }
    Type.prototype.wrap = function (modifiers) {
        return new WrappedType(this, modifiers, []);
    };

    Type.prototype.asString = function () {
        assert(false);
        return '';
    };
    return Type;
})();

var SpecialType = (function (_super) {
    __extends(SpecialType, _super);
    function SpecialType(name) {
        _super.call(this);
        this.name = name;
    }
    SpecialType.prototype.asString = function () {
        return this.name;
    };
    SpecialType.INT = new SpecialType('int');
    SpecialType.BOOL = new SpecialType('bool');
    SpecialType.NULL = new SpecialType('null');
    SpecialType.VOID = new SpecialType('void');
    SpecialType.ERROR = new SpecialType('<error>');
    SpecialType.DOUBLE = new SpecialType('double');
    SpecialType.CIRCULAR = new SpecialType('<circular>');
    return SpecialType;
})(Type);

var FunctionType = (function (_super) {
    __extends(FunctionType, _super);
    function FunctionType(result, args) {
        _super.call(this);
        this.result = result;
        this.args = args;
    }
    FunctionType.prototype.asString = function () {
        return this.result.asString() + ' function(' + this.args.map(function (t) {
            return t.asString();
        }).join(', ') + ')';
    };
    return FunctionType;
})(Type);

var ObjectType = (function (_super) {
    __extends(ObjectType, _super);
    function ObjectType(name, scope) {
        _super.call(this);
        this.name = name;
        this.scope = scope;
        this.constructorTypeInitializer = null;
        this.cachedConstructorType = null;
        this.baseType = null;
        // Does some other object type have this as a base?
        this.hasDerivedTypes = false;
        // Does this object type have a (possibly inherited) function without a body?
        this.isAbstract = false;
        // Is this object type allowed to be the base class of another object type?
        this.isSealed = false;
    }
    // Lazily compute the constructor type when it's needed instead of when the
    // class is first initialized to get around tricky ordering problems:
    //
    //   class A { C c; }
    //   class B : A {}
    //   class C { B b; }
    //
    ObjectType.prototype.constructorType = function () {
        if (this.cachedConstructorType === null) {
            this.cachedConstructorType = this.constructorTypeInitializer();
        }
        return this.cachedConstructorType;
    };

    ObjectType.prototype.asString = function () {
        return this.name;
    };
    return ObjectType;
})(Type);

var TypeParameter = (function (_super) {
    __extends(TypeParameter, _super);
    function TypeParameter(name) {
        _super.call(this);
        this.name = name;
    }
    TypeParameter.prototype.asString = function () {
        return this.name;
    };
    return TypeParameter;
})(Type);

var Substitution = (function () {
    function Substitution(parameter, type) {
        this.parameter = parameter;
        this.type = type;
    }
    return Substitution;
})();

var WrappedType = (function () {
    function WrappedType(innerType, modifiers, substitutions) {
        this.innerType = innerType;
        this.modifiers = modifiers;
        this.substitutions = substitutions;
        assert(innerType !== null);
    }
    WrappedType.prototype.isOwned = function () {
        return (this.modifiers & TypeModifier.OWNED) !== 0;
    };

    WrappedType.prototype.isShared = function () {
        return (this.modifiers & TypeModifier.SHARED) !== 0;
    };

    WrappedType.prototype.isStorage = function () {
        return (this.modifiers & TypeModifier.STORAGE) !== 0;
    };

    WrappedType.prototype.isInstance = function () {
        return (this.modifiers & TypeModifier.INSTANCE) !== 0;
    };

    WrappedType.prototype.isUnowned = function () {
        return (this.modifiers & TypeModifier.UNOWNED) !== 0;
    };

    WrappedType.prototype.isUnshared = function () {
        return (this.modifiers & TypeModifier.UNSHARED) !== 0;
    };

    WrappedType.prototype.isPointer = function () {
        return this.isObject() || this.isNull();
    };

    WrappedType.prototype.isRawPointer = function () {
        return this.isPointer() && !this.isOwned() && !this.isShared();
    };

    WrappedType.prototype.isError = function () {
        return this.innerType === SpecialType.ERROR;
    };

    WrappedType.prototype.isCircular = function () {
        return this.innerType === SpecialType.CIRCULAR;
    };

    WrappedType.prototype.isNull = function () {
        return this.innerType === SpecialType.NULL;
    };

    WrappedType.prototype.isVoid = function () {
        return this.innerType === SpecialType.VOID;
    };

    WrappedType.prototype.isInt = function () {
        return this.innerType === SpecialType.INT;
    };

    WrappedType.prototype.isDouble = function () {
        return this.innerType === SpecialType.DOUBLE;
    };

    WrappedType.prototype.isBool = function () {
        return this.innerType === SpecialType.BOOL;
    };

    WrappedType.prototype.isPrimitive = function () {
        return this.isInt() || this.isDouble() || this.isBool();
    };

    WrappedType.prototype.isObject = function () {
        return this.innerType instanceof ObjectType;
    };

    WrappedType.prototype.isFunction = function () {
        return this.innerType instanceof FunctionType;
    };

    WrappedType.prototype.asObject = function () {
        return this.innerType instanceof ObjectType ? this.innerType : null;
    };

    WrappedType.prototype.asFunction = function () {
        return this.innerType instanceof FunctionType ? this.innerType : null;
    };

    WrappedType.prototype.asString = function () {
        return ((this.modifiers & TypeModifier.OWNED ? 'owned ' : '') + (this.modifiers & TypeModifier.SHARED ? 'shared ' : '') + this.innerType.asString() + (this.substitutions.length > 0 ? '<' + TypeLogic.filterSubstitutionsForType(this.substitutions, this.innerType).map(function (s) {
            return s.type.asString();
        }).join(', ') + '>' : ''));
    };

    WrappedType.prototype.toString = function () {
        return (this.modifiers & TypeModifier.INSTANCE ? (this.isPointer() ? 'pointer' : 'value') + ' of type ' : 'type ') + this.asString();
    };

    WrappedType.prototype.wrapWith = function (flag) {
        return new WrappedType(this.innerType, this.modifiers | flag, this.substitutions);
    };
    return WrappedType;
})();
var SymbolModifier;
(function (SymbolModifier) {
    SymbolModifier[SymbolModifier["OVER"] = 1] = "OVER";
})(SymbolModifier || (SymbolModifier = {}));

var Symbol = (function () {
    function Symbol(name, type, scope) {
        this.name = name;
        this.type = type;
        this.scope = scope;
        this.modifiers = 0;
        this.node = null;
        this.enclosingObject = null;
        this.isOverridden = false;
        this.isAbstract = false;
    }
    Symbol.prototype.isOver = function () {
        return (this.modifiers & SymbolModifier.OVER) !== 0;
    };
    return Symbol;
})();

var Scope = (function () {
    function Scope(lexicalParent) {
        this.lexicalParent = lexicalParent;
        this.symbols = [];
    }
    Scope.prototype.containsAbstractSymbols = function () {
        for (var i = 0; i < this.symbols.length; i++) {
            if (this.symbols[i].isAbstract)
                return true;
        }
        return false;
    };

    Scope.prototype.replace = function (symbol) {
        for (var i = 0; i < this.symbols.length; i++) {
            if (this.symbols[i].name === symbol.name) {
                this.symbols[i] = symbol;
                return;
            }
        }
        this.symbols.push(symbol);
    };

    Scope.prototype.define = function (name, type) {
        var symbol = new Symbol(name, type, this);
        this.symbols.push(symbol);
        return symbol;
    };

    Scope.prototype.find = function (name) {
        for (var i = 0; i < this.symbols.length; i++) {
            var symbol = this.symbols[i];
            if (symbol.name === name) {
                return symbol;
            }
        }
        return null;
    };

    Scope.prototype.lexicalFind = function (name) {
        var symbol = this.find(name);
        if (symbol === null && this.lexicalParent !== null) {
            return this.lexicalParent.lexicalFind(name);
        }
        return symbol;
    };
    return Scope;
})();
var NativeTypes = (function () {
    function NativeTypes() {
    }
    NativeTypes.createFunction = function (result, args) {
        return new FunctionType(result.wrap(TypeModifier.INSTANCE), args.map(function (t) {
            return t.wrap(TypeModifier.INSTANCE);
        })).wrap(TypeModifier.INSTANCE);
    };
    NativeTypes.MATH = new ObjectType('Math', new Scope(null));
    NativeTypes.LIST = new ObjectType('List', new Scope(null));
    NativeTypes.LIST_T = new TypeParameter('T');
    return NativeTypes;
})();

// TODO: Use static functions when those work
NativeTypes.MATH.scope.define('E', SpecialType.DOUBLE.wrap(TypeModifier.INSTANCE));
NativeTypes.MATH.scope.define('PI', SpecialType.DOUBLE.wrap(TypeModifier.INSTANCE));
NativeTypes.MATH.scope.define('NAN', SpecialType.DOUBLE.wrap(TypeModifier.INSTANCE));
NativeTypes.MATH.scope.define('INFINITY', SpecialType.DOUBLE.wrap(TypeModifier.INSTANCE));
NativeTypes.MATH.scope.define('cos', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE]));
NativeTypes.MATH.scope.define('sin', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE]));
NativeTypes.MATH.scope.define('tan', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE]));
NativeTypes.MATH.scope.define('acos', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE]));
NativeTypes.MATH.scope.define('asin', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE]));
NativeTypes.MATH.scope.define('atan', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE]));
NativeTypes.MATH.scope.define('atan2', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE, SpecialType.DOUBLE]));
NativeTypes.MATH.scope.define('floor', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE]));
NativeTypes.MATH.scope.define('ceil', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE]));
NativeTypes.MATH.scope.define('abs', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE]));
NativeTypes.MATH.scope.define('log', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE]));
NativeTypes.MATH.scope.define('exp', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE]));
NativeTypes.MATH.scope.define('sqrt', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE]));
NativeTypes.MATH.scope.define('pow', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE, SpecialType.DOUBLE]));
NativeTypes.MATH.scope.define('min', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE, SpecialType.DOUBLE]));
NativeTypes.MATH.scope.define('max', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE, SpecialType.DOUBLE]));
NativeTypes.MATH.scope.define('random', NativeTypes.createFunction(SpecialType.DOUBLE, []));

// Lists are special-cased for now
NativeTypes.LIST.isSealed = true;
NativeTypes.LIST.cachedConstructorType = new FunctionType(null, []);
NativeTypes.LIST.parameters.push(NativeTypes.LIST_T);
NativeTypes.LIST_LENGTH = NativeTypes.LIST.scope.define('length', SpecialType.INT.wrap(TypeModifier.INSTANCE));
NativeTypes.LIST_GET = NativeTypes.LIST.scope.define('get', NativeTypes.createFunction(NativeTypes.LIST_T, [SpecialType.INT]));
NativeTypes.LIST_SET = NativeTypes.LIST.scope.define('set', NativeTypes.createFunction(SpecialType.VOID, [SpecialType.INT, NativeTypes.LIST_T]));
NativeTypes.LIST_PUSH = NativeTypes.LIST.scope.define('push', NativeTypes.createFunction(SpecialType.VOID, [NativeTypes.LIST_T]));
NativeTypes.LIST_POP = NativeTypes.LIST.scope.define('pop', NativeTypes.createFunction(NativeTypes.LIST_T, []));
NativeTypes.LIST_UNSHIFT = NativeTypes.LIST.scope.define('unshift', NativeTypes.createFunction(SpecialType.VOID, [NativeTypes.LIST_T]));
NativeTypes.LIST_SHIFT = NativeTypes.LIST.scope.define('shift', NativeTypes.createFunction(NativeTypes.LIST_T, []));
NativeTypes.LIST_INDEX_OF = NativeTypes.LIST.scope.define('indexOf', NativeTypes.createFunction(SpecialType.INT, [NativeTypes.LIST_T]));
NativeTypes.LIST_INSERT = NativeTypes.LIST.scope.define('insert', NativeTypes.createFunction(SpecialType.VOID, [SpecialType.INT, NativeTypes.LIST_T]));
NativeTypes.LIST_REMOVE = NativeTypes.LIST.scope.define('remove', NativeTypes.createFunction(SpecialType.VOID, [SpecialType.INT]));

// Getting an element from a list of owned pointers should not steal ownership
NativeTypes.LIST_GET.type.asFunction().result.modifiers |= TypeModifier.UNOWNED | TypeModifier.UNSHARED;
NativeTypes.LIST_INDEX_OF.type.asFunction().args[0].modifiers |= TypeModifier.UNOWNED | TypeModifier.UNSHARED;
////////////////////////////////////////////////////////////////////////////////
// Nodes
////////////////////////////////////////////////////////////////////////////////
var AST = (function () {
    function AST(range) {
        this.range = range;
        this.uniqueID = AST.nextUniqueID++;
    }
    AST.nextUniqueID = 0;
    return AST;
})();

var Module = (function (_super) {
    __extends(Module, _super);
    function Module(range, block) {
        _super.call(this, range);
        this.block = block;
    }
    // Sort objects so base objects come before derived objects
    Module.prototype.sortedObjectDeclarations = function () {
        return this.block.statements.filter(function (n) {
            return n instanceof ObjectDeclaration;
        }).sort(function (a, b) {
            var A = a.symbol.type.asObject();
            var B = b.symbol.type.asObject();
            return +TypeLogic.isBaseTypeOf(A, B) - +TypeLogic.isBaseTypeOf(B, A);
        });
    };
    return Module;
})(AST);

var Identifier = (function (_super) {
    __extends(Identifier, _super);
    function Identifier(range, name) {
        _super.call(this, range);
        this.name = name;
    }
    return Identifier;
})(AST);

var Block = (function (_super) {
    __extends(Block, _super);
    function Block(range, statements) {
        _super.call(this, range);
        this.statements = statements;
        this.scope = null;
    }
    return Block;
})(AST);

var Statement = (function (_super) {
    __extends(Statement, _super);
    function Statement() {
        _super.apply(this, arguments);
    }
    Statement.prototype.acceptStatementVisitor = function (visitor) {
        assert(false);
        return null;
    };
    return Statement;
})(AST);

var ExpressionStatement = (function (_super) {
    __extends(ExpressionStatement, _super);
    function ExpressionStatement(range, value) {
        _super.call(this, range);
        this.value = value;
    }
    ExpressionStatement.prototype.acceptStatementVisitor = function (visitor) {
        return visitor.visitExpressionStatement(this);
    };
    return ExpressionStatement;
})(Statement);

var IfStatement = (function (_super) {
    __extends(IfStatement, _super);
    function IfStatement(range, test, thenBlock, elseBlock) {
        _super.call(this, range);
        this.test = test;
        this.thenBlock = thenBlock;
        this.elseBlock = elseBlock;
    }
    IfStatement.prototype.acceptStatementVisitor = function (visitor) {
        return visitor.visitIfStatement(this);
    };
    return IfStatement;
})(Statement);

var WhileStatement = (function (_super) {
    __extends(WhileStatement, _super);
    function WhileStatement(range, test, block) {
        _super.call(this, range);
        this.test = test;
        this.block = block;
    }
    WhileStatement.prototype.acceptStatementVisitor = function (visitor) {
        return visitor.visitWhileStatement(this);
    };
    return WhileStatement;
})(Statement);

var ReturnStatement = (function (_super) {
    __extends(ReturnStatement, _super);
    function ReturnStatement(range, value) {
        _super.call(this, range);
        this.value = value;
    }
    ReturnStatement.prototype.acceptStatementVisitor = function (visitor) {
        return visitor.visitReturnStatement(this);
    };
    return ReturnStatement;
})(Statement);

var BreakStatement = (function (_super) {
    __extends(BreakStatement, _super);
    function BreakStatement(range) {
        _super.call(this, range);
    }
    BreakStatement.prototype.acceptStatementVisitor = function (visitor) {
        return visitor.visitBreakStatement(this);
    };
    return BreakStatement;
})(Statement);

var ContinueStatement = (function (_super) {
    __extends(ContinueStatement, _super);
    function ContinueStatement(range) {
        _super.call(this, range);
    }
    ContinueStatement.prototype.acceptStatementVisitor = function (visitor) {
        return visitor.visitContinueStatement(this);
    };
    return ContinueStatement;
})(Statement);

var Declaration = (function (_super) {
    __extends(Declaration, _super);
    function Declaration(range, id, modifiers) {
        _super.call(this, range);
        this.id = id;
        this.modifiers = modifiers;
        this.symbol = null;
    }
    Declaration.prototype.acceptStatementVisitor = function (visitor) {
        return visitor.visitDeclaration(this);
    };

    Declaration.prototype.acceptDeclarationVisitor = function (visitor) {
        assert(false);
        return null;
    };
    return Declaration;
})(Statement);

var ObjectDeclaration = (function (_super) {
    __extends(ObjectDeclaration, _super);
    function ObjectDeclaration(range, id, modifiers, base, block) {
        _super.call(this, range, id, modifiers);
        this.base = base;
        this.block = block;
    }
    ObjectDeclaration.prototype.acceptDeclarationVisitor = function (visitor) {
        return visitor.visitObjectDeclaration(this);
    };
    return ObjectDeclaration;
})(Declaration);

var FunctionDeclaration = (function (_super) {
    __extends(FunctionDeclaration, _super);
    function FunctionDeclaration(range, id, modifiers, result, args, block) {
        _super.call(this, range, id, modifiers);
        this.result = result;
        this.args = args;
        this.block = block;
        // Store a separate scope for the function arguments because the function
        // may be abstract, in which case we can't use the scope of the body block
        this.scope = null;
    }
    FunctionDeclaration.prototype.acceptDeclarationVisitor = function (visitor) {
        return visitor.visitFunctionDeclaration(this);
    };
    return FunctionDeclaration;
})(Declaration);

var VariableDeclaration = (function (_super) {
    __extends(VariableDeclaration, _super);
    function VariableDeclaration(range, id, modifiers, type, value) {
        _super.call(this, range, id, modifiers);
        this.type = type;
        this.value = value;
    }
    VariableDeclaration.prototype.acceptDeclarationVisitor = function (visitor) {
        return visitor.visitVariableDeclaration(this);
    };
    return VariableDeclaration;
})(Declaration);

var Expression = (function (_super) {
    __extends(Expression, _super);
    function Expression() {
        _super.apply(this, arguments);
        this.computedType = null;
    }
    Expression.prototype.acceptExpressionVisitor = function (visitor) {
        assert(false);
        return null;
    };
    return Expression;
})(AST);

var SymbolExpression = (function (_super) {
    __extends(SymbolExpression, _super);
    function SymbolExpression(range, name) {
        _super.call(this, range);
        this.name = name;
        this.symbol = null;
    }
    SymbolExpression.prototype.acceptExpressionVisitor = function (visitor) {
        return visitor.visitSymbolExpression(this);
    };
    return SymbolExpression;
})(Expression);

var UnaryExpression = (function (_super) {
    __extends(UnaryExpression, _super);
    function UnaryExpression(range, op, value) {
        _super.call(this, range);
        this.op = op;
        this.value = value;
    }
    UnaryExpression.prototype.acceptExpressionVisitor = function (visitor) {
        return visitor.visitUnaryExpression(this);
    };
    return UnaryExpression;
})(Expression);

var BinaryExpression = (function (_super) {
    __extends(BinaryExpression, _super);
    function BinaryExpression(range, op, left, right) {
        _super.call(this, range);
        this.op = op;
        this.left = left;
        this.right = right;
    }
    BinaryExpression.prototype.acceptExpressionVisitor = function (visitor) {
        return visitor.visitBinaryExpression(this);
    };

    BinaryExpression.prototype.isAssignment = function () {
        return this.op === '=';
    };
    return BinaryExpression;
})(Expression);

var TernaryExpression = (function (_super) {
    __extends(TernaryExpression, _super);
    function TernaryExpression(range, value, trueValue, falseValue) {
        _super.call(this, range);
        this.value = value;
        this.trueValue = trueValue;
        this.falseValue = falseValue;
    }
    TernaryExpression.prototype.acceptExpressionVisitor = function (visitor) {
        return visitor.visitTernaryExpression(this);
    };
    return TernaryExpression;
})(Expression);

var MemberExpression = (function (_super) {
    __extends(MemberExpression, _super);
    function MemberExpression(range, value, id) {
        _super.call(this, range);
        this.value = value;
        this.id = id;
        this.symbol = null;
    }
    MemberExpression.prototype.acceptExpressionVisitor = function (visitor) {
        return visitor.visitMemberExpression(this);
    };
    return MemberExpression;
})(Expression);

var IntExpression = (function (_super) {
    __extends(IntExpression, _super);
    function IntExpression(range, value) {
        _super.call(this, range);
        this.value = value;
        assert(value === (0 | value));
    }
    IntExpression.prototype.acceptExpressionVisitor = function (visitor) {
        return visitor.visitIntExpression(this);
    };
    return IntExpression;
})(Expression);

var BoolExpression = (function (_super) {
    __extends(BoolExpression, _super);
    function BoolExpression(range, value) {
        _super.call(this, range);
        this.value = value;
    }
    BoolExpression.prototype.acceptExpressionVisitor = function (visitor) {
        return visitor.visitBoolExpression(this);
    };
    return BoolExpression;
})(Expression);

var DoubleExpression = (function (_super) {
    __extends(DoubleExpression, _super);
    function DoubleExpression(range, value) {
        _super.call(this, range);
        this.value = value;
    }
    DoubleExpression.prototype.acceptExpressionVisitor = function (visitor) {
        return visitor.visitDoubleExpression(this);
    };
    return DoubleExpression;
})(Expression);

var NullExpression = (function (_super) {
    __extends(NullExpression, _super);
    function NullExpression(range) {
        _super.call(this, range);
    }
    NullExpression.prototype.acceptExpressionVisitor = function (visitor) {
        return visitor.visitNullExpression(this);
    };
    return NullExpression;
})(Expression);

var ThisExpression = (function (_super) {
    __extends(ThisExpression, _super);
    function ThisExpression(range) {
        _super.call(this, range);
    }
    ThisExpression.prototype.acceptExpressionVisitor = function (visitor) {
        return visitor.visitThisExpression(this);
    };
    return ThisExpression;
})(Expression);

var CallExpression = (function (_super) {
    __extends(CallExpression, _super);
    function CallExpression(range, value, args) {
        _super.call(this, range);
        this.value = value;
        this.args = args;
    }
    CallExpression.prototype.acceptExpressionVisitor = function (visitor) {
        return visitor.visitCallExpression(this);
    };
    return CallExpression;
})(Expression);

var NewExpression = (function (_super) {
    __extends(NewExpression, _super);
    function NewExpression(range, type, args) {
        _super.call(this, range);
        this.type = type;
        this.args = args;
    }
    NewExpression.prototype.acceptExpressionVisitor = function (visitor) {
        return visitor.visitNewExpression(this);
    };
    return NewExpression;
})(Expression);

var TypeModifierExpression = (function (_super) {
    __extends(TypeModifierExpression, _super);
    function TypeModifierExpression(range, type, modifiers) {
        _super.call(this, range);
        this.type = type;
        this.modifiers = modifiers;
    }
    TypeModifierExpression.prototype.acceptExpressionVisitor = function (visitor) {
        return visitor.visitTypeModifierExpression(this);
    };
    return TypeModifierExpression;
})(Expression);

var TypeParameterExpression = (function (_super) {
    __extends(TypeParameterExpression, _super);
    function TypeParameterExpression(range, type, parameters) {
        _super.call(this, range);
        this.type = type;
        this.parameters = parameters;
    }
    TypeParameterExpression.prototype.acceptExpressionVisitor = function (visitor) {
        return visitor.visitTypeParameterExpression(this);
    };
    return TypeParameterExpression;
})(Expression);
function spanRange(start, end) {
    assert(start.source === end.source && start.start.index <= end.end.index);
    return new SourceRange(start.source, start.start, end.end);
}

var ParserContext = (function () {
    function ParserContext(log, tokens) {
        this.log = log;
        this.tokens = tokens;
        this.index = 0;
    }
    ParserContext.prototype.current = function () {
        return this.tokens[this.index];
    };

    ParserContext.prototype.next = function () {
        var token = this.current();
        if (this.index + 1 < this.tokens.length) {
            this.index++;
        }
        return token;
    };

    ParserContext.prototype.spanSince = function (range) {
        return spanRange(range, this.tokens[this.index > 0 ? this.index - 1 : 0].range);
    };

    ParserContext.prototype.peek = function (kind) {
        return this.current().kind === kind;
    };

    ParserContext.prototype.eat = function (kind) {
        if (this.peek(kind)) {
            this.next();
            return true;
        }
        return false;
    };

    ParserContext.prototype.expect = function (kind) {
        if (!this.eat(kind)) {
            syntaxErrorExpectedToken(this.log, this.current(), kind);
            return false;
        }
        return true;
    };
    return ParserContext;
})();

var Parselet = (function () {
    function Parselet(power) {
        this.power = power;
        this.prefix = null;
        this.infix = null;
    }
    return Parselet;
})();

// A Pratt parser is a parser that associates up to two operations per token,
// each with its own precedence. Pratt parsers excel at parsing expression
// trees with deeply nested precedence levels. For an excellent writeup, see:
//
//   http://journal.stuffwithstuff.com/2011/03/19/pratt-parsers-expression-parsing-made-easy/
//
var Pratt = (function () {
    function Pratt() {
        this.table = {};
    }
    Pratt.prototype.parselet = function (kind, power) {
        if (kind in this.table) {
            var parselet = this.table[kind];
            if (power > parselet.power)
                parselet.power = power;
            return parselet;
        }
        return this.table[kind] = new Parselet(power);
    };

    Pratt.prototype.parse = function (context, power) {
        var kind = context.current().kind;
        var parselet = this.table[kind] || null;
        if (parselet === null || parselet.prefix === null) {
            syntaxErrorUnexpectedToken(context.log, context.current());
            return null;
        }
        return this.resume(context, power, parselet.prefix(context));
    };

    Pratt.prototype.resume = function (context, power, left) {
        while (left !== null) {
            var kind = context.current().kind;
            var parselet = this.table[kind] || null;
            if (parselet === null || parselet.infix === null || parselet.power <= power)
                break;
            left = parselet.infix(context, left);
        }
        return left;
    };

    Pratt.prototype.literal = function (kind, callback) {
        this.parselet(kind, Power.LOWEST).prefix = function (context) {
            return callback(context, context.next());
        };
    };

    Pratt.prototype.prefix = function (kind, power, callback) {
        var _this = this;
        this.parselet(kind, Power.LOWEST).prefix = function (context) {
            var token = context.next();
            var value = _this.parse(context, power);
            return value !== null ? callback(context, token, value) : null;
        };
    };

    Pratt.prototype.postfix = function (kind, power, callback) {
        this.parselet(kind, power).infix = function (context, left) {
            return callback(context, left, context.next());
        };
    };

    Pratt.prototype.infix = function (kind, power, callback) {
        var _this = this;
        this.parselet(kind, power).infix = function (context, left) {
            var token = context.next();
            var right = _this.parse(context, power);
            return right !== null ? callback(context, left, token, right) : null;
        };
    };

    Pratt.prototype.infixRight = function (kind, power, callback) {
        var _this = this;
        this.parselet(kind, power).infix = function (context, left) {
            var token = context.next();
            var right = _this.parse(context, power - 1);
            return right !== null ? callback(context, left, token, right) : null;
        };
    };
    return Pratt;
})();
// The same operator precedence as C
var Power;
(function (Power) {
    Power[Power["LOWEST"] = 0] = "LOWEST";
    Power[Power["COMMA"] = 1] = "COMMA";
    Power[Power["ASSIGN"] = 2] = "ASSIGN";
    Power[Power["TERNARY"] = 3] = "TERNARY";
    Power[Power["OR"] = 4] = "OR";
    Power[Power["AND"] = 5] = "AND";
    Power[Power["BITOR"] = 6] = "BITOR";
    Power[Power["BITXOR"] = 7] = "BITXOR";
    Power[Power["BITAND"] = 8] = "BITAND";
    Power[Power["EQ_NEQ"] = 9] = "EQ_NEQ";
    Power[Power["COMPARE"] = 10] = "COMPARE";
    Power[Power["SHIFT"] = 11] = "SHIFT";
    Power[Power["ADD_SUB"] = 12] = "ADD_SUB";
    Power[Power["MUL_DIV"] = 13] = "MUL_DIV";
    Power[Power["UNARY"] = 14] = "UNARY";
    Power[Power["CALL"] = 15] = "CALL";
    Power[Power["MEMBER"] = 16] = "MEMBER";
})(Power || (Power = {}));

function parseGroup(context) {
    var token = context.current();
    if (!context.expect('('))
        return null;
    var value = pratt.parse(context, Power.LOWEST);
    if (value === null)
        return null;
    if (!context.expect(')'))
        return null;
    return value;
}

function parseBlock(context) {
    var token = context.current();
    if (!context.expect('{'))
        return null;
    var statements = parseStatements(context);
    if (statements === null)
        return null;
    if (!context.expect('}'))
        return null;
    return new Block(context.spanSince(token.range), statements);
}

function parseBlockOrStatement(context) {
    if (context.peek('{'))
        return parseBlock(context);
    var statement = parseStatement(context);
    if (statement === null)
        return null;
    return new Block(statement.range, [statement]);
}

function parseIdentifier(context) {
    var token = context.current();
    if (!context.expect('IDENTIFIER'))
        return null;
    return new Identifier(token.range, token.text);
}

function parseType(context) {
    var range = context.current().range;

    // Parse type modifiers
    var modifiers = 0;
    for (; ;) {
        var token = context.current();
        var modifier = 0;
        if (context.eat('owned'))
            modifier = TypeModifier.OWNED;
else if (context.eat('shared'))
            modifier = TypeModifier.SHARED;
else
            break;
        if (modifiers & modifier)
            syntaxErrorDuplicateModifier(context.log, token);
        modifiers |= modifier;
    }

    var value = pratt.parse(context, Power.MEMBER - 1);
    if (value === null)
        return null;
    return modifiers !== 0 ? new TypeModifierExpression(context.spanSince(range), value, modifiers) : value;
}

function parseArguments(context) {
    var args = [];
    while (!context.peek(')')) {
        if (args.length > 0 && !context.expect(','))
            return null;
        var type = parseType(context);
        if (type === null)
            return null;
        var id = parseIdentifier(context);
        if (id === null)
            return null;
        args.push(new VariableDeclaration(spanRange(type.range, id.range), id, 0, type, null));
    }
    return args;
}

function parseStatements(context) {
    var statements = [];
    while (!context.peek('}') && !context.peek('END')) {
        var statement = parseStatement(context);
        if (statement === null)
            return null;
        statements.push(statement);
    }
    return statements;
}

function parseStatement(context) {
    var range = context.current().range;

    // Parse symbol modifiers
    var modifiers = 0;
    for (; ;) {
        var token = context.current();
        var modifier = 0;
        if (context.eat('over'))
            modifier = SymbolModifier.OVER;
else
            break;
        if (modifiers & modifier)
            syntaxErrorDuplicateModifier(context.log, token);
        modifiers |= modifier;
    }

    if (context.eat('class')) {
        var id = parseIdentifier(context);
        if (id === null)
            return null;
        var base = null;
        if (context.eat(':')) {
            base = pratt.parse(context, Power.CALL);
            if (base === null)
                return null;
        }
        var block = parseBlock(context);
        if (block === null)
            return null;
        return new ObjectDeclaration(context.spanSince(range), id, modifiers, base, block);
    }

    if (modifiers !== 0 || context.peek('IDENTIFIER') || context.peek('owned') || context.peek('shared')) {
        var type = parseType(context);
        if (type === null)
            return null;
        if (modifiers === 0 && !context.peek('IDENTIFIER')) {
            var value = pratt.resume(context, Power.LOWEST, type);
            if (value === null)
                return null;
            if (!context.expect(';'))
                return null;
            return new ExpressionStatement(context.spanSince(range), value);
        }
        var id = parseIdentifier(context);
        if (id === null)
            return null;

        // Function declaration
        var group = context.current();
        if (context.eat('(')) {
            var args = parseArguments(context);
            if (args === null)
                return null;
            if (!context.expect(')'))
                return null;
            var block = null;
            if (!context.eat(';')) {
                block = parseBlock(context);
                if (block === null)
                    return null;
            }
            return new FunctionDeclaration(context.spanSince(range), id, modifiers, type, args, block);
        }

        // Variable declaration
        var value = null;
        if (context.eat('=')) {
            value = pratt.parse(context, Power.LOWEST);
            if (value === null)
                return null;
        }
        if (!context.expect(';'))
            return null;
        return new VariableDeclaration(context.spanSince(range), id, modifiers, type, value);
    }

    if (context.eat('if')) {
        var value = parseGroup(context);
        if (value === null)
            return null;
        var thenBlock = parseBlockOrStatement(context);
        if (thenBlock === null)
            return null;
        var elseBlock = null;
        if (context.eat('else')) {
            elseBlock = parseBlockOrStatement(context);
            if (elseBlock === null)
                return null;
        }
        return new IfStatement(context.spanSince(range), value, thenBlock, elseBlock);
    }

    if (context.eat('while')) {
        var value = parseGroup(context);
        if (value === null)
            return null;
        var block = parseBlockOrStatement(context);
        if (block === null)
            return null;
        return new WhileStatement(context.spanSince(range), value, block);
    }

    if (context.eat('return')) {
        var value = null;
        if (!context.eat(';')) {
            value = pratt.parse(context, Power.LOWEST);
            if (value === null)
                return null;
            if (!context.expect(';'))
                return null;
        }
        return new ReturnStatement(context.spanSince(range), value);
    }

    if (context.eat('break')) {
        if (!context.expect(';'))
            return null;
        return new BreakStatement(context.spanSince(range));
    }

    if (context.eat('continue')) {
        if (!context.expect(';'))
            return null;
        return new ContinueStatement(context.spanSince(range));
    }

    // Expression statement
    var value = pratt.parse(context, Power.LOWEST);
    if (value === null)
        return null;
    if (!context.expect(';'))
        return null;
    return new ExpressionStatement(context.spanSince(range), value);
}

function parseExpressions(context) {
    var values = [];
    while (!context.peek(')')) {
        if (values.length > 0 && !context.expect(','))
            return null;
        var value = pratt.parse(context, Power.COMMA);
        if (value === null)
            return null;
        values.push(value);
    }
    return values;
}

function parseTypes(context) {
    var types = [];
    while (!context.peek('END_PARAMETER_LIST')) {
        if (types.length > 0 && !context.expect(','))
            return null;
        var type = parseType(context);
        if (type === null)
            return null;
        types.push(type);
    }
    return types;
}

function buildUnaryPrefix(context, token, node) {
    return new UnaryExpression(spanRange(token.range, node.range), token.text, node);
}

function buildBinary(context, left, token, right) {
    return new BinaryExpression(spanRange(left.range, right.range), token.text, left, right);
}

// Cached parser
var pratt = new Pratt();

// Literals
pratt.literal('null', function (context, token) {
    return new NullExpression(token.range);
});
pratt.literal('this', function (context, token) {
    return new ThisExpression(token.range);
});
pratt.literal('INT', function (context, token) {
    return new IntExpression(token.range, 0 | token.text);
});
pratt.literal('true', function (context, token) {
    return new BoolExpression(token.range, true);
});
pratt.literal('false', function (context, token) {
    return new BoolExpression(token.range, false);
});
pratt.literal('DOUBLE', function (context, token) {
    return new DoubleExpression(token.range, +token.text);
});
pratt.literal('IDENTIFIER', function (context, token) {
    return new SymbolExpression(token.range, token.text);
});

// Unary expressions
pratt.prefix('+', Power.UNARY, buildUnaryPrefix);
pratt.prefix('-', Power.UNARY, buildUnaryPrefix);
pratt.prefix('!', Power.UNARY, buildUnaryPrefix);
pratt.prefix('~', Power.UNARY, buildUnaryPrefix);

// Binary expressions
pratt.infix(',', Power.COMMA, buildBinary);
pratt.infixRight('=', Power.ASSIGN, buildBinary);
pratt.infix('||', Power.OR, buildBinary);
pratt.infix('&&', Power.AND, buildBinary);
pratt.infix('|', Power.BITOR, buildBinary);
pratt.infix('^', Power.BITXOR, buildBinary);
pratt.infix('&', Power.BITAND, buildBinary);
pratt.infix('==', Power.EQ_NEQ, buildBinary);
pratt.infix('!=', Power.EQ_NEQ, buildBinary);
pratt.infix('<', Power.COMPARE, buildBinary);
pratt.infix('>', Power.COMPARE, buildBinary);
pratt.infix('<=', Power.COMPARE, buildBinary);
pratt.infix('>=', Power.COMPARE, buildBinary);
pratt.infix('<<', Power.SHIFT, buildBinary);
pratt.infix('>>', Power.SHIFT, buildBinary);
pratt.infix('>>>', Power.SHIFT, buildBinary);
pratt.infix('+', Power.ADD_SUB, buildBinary);
pratt.infix('-', Power.ADD_SUB, buildBinary);
pratt.infix('*', Power.MUL_DIV, buildBinary);
pratt.infix('/', Power.MUL_DIV, buildBinary);
pratt.infix('%', Power.MUL_DIV, buildBinary);

// Parenthetic group
pratt.parselet('(', Power.LOWEST).prefix = function (context) {
    return parseGroup(context);
};

// Ternary expression
pratt.parselet('?', Power.TERNARY).infix = function (context, left) {
    context.next();
    var middle = pratt.parse(context, Power.TERNARY);
    if (middle === null)
        return null;
    if (!context.expect(':'))
        return null;
    var right = pratt.parse(context, Power.TERNARY - 1);
    if (right === null)
        return null;
    return new TernaryExpression(context.spanSince(left.range), left, middle, right);
};

// Member expression
pratt.parselet('.', Power.MEMBER).infix = function (context, left) {
    var token = context.next();
    var id = parseIdentifier(context);
    if (id === null)
        return null;
    return new MemberExpression(context.spanSince(left.range), left, id);
};

// Call expression
pratt.parselet('(', Power.CALL).infix = function (context, left) {
    var token = context.next();
    var args = parseExpressions(context);
    if (args === null)
        return null;
    if (!context.expect(')'))
        return null;
    return new CallExpression(context.spanSince(left.range), left, args);
};

// Constructor expression
pratt.parselet('new', Power.LOWEST).prefix = function (context) {
    var token = context.next();
    var type = parseType(context);
    if (type === null)
        return null;
    if (!context.expect('('))
        return null;
    var args = parseExpressions(context);
    if (args === null)
        return null;
    if (!context.expect(')'))
        return null;
    return new NewExpression(context.spanSince(token.range), type, args);
};

// Type parameter expression
pratt.parselet('START_PARAMETER_LIST', Power.MEMBER).infix = function (context, left) {
    var token = context.next();
    var parameters = parseTypes(context);
    if (parameters === null)
        return null;
    if (!context.expect('END_PARAMETER_LIST'))
        return null;
    return new TypeParameterExpression(context.spanSince(left.range), left, parameters);
};

function parse(log, tokens) {
    var context = new ParserContext(log, tokens);
    var range = context.current().range;
    var statements = parseStatements(context);
    if (statements === null)
        return null;
    if (!context.expect('END'))
        return null;
    range = context.spanSince(range);
    return new Module(range, new Block(range, statements));
}
var TypeLogic = (function () {
    function TypeLogic() {
    }
    TypeLogic.equal = function (a, b) {
        if (a === b)
            return true;
        if (a instanceof FunctionType && b instanceof FunctionType) {
            var fa = a;
            var fb = b;
            return TypeLogic.equalWrapped(fa.result, fb.result) && TypeLogic.allEqualWrapped(fa.args, fb.args);
        }
        return false;
    };

    TypeLogic.equalWrapped = function (a, b) {
        return TypeLogic.equal(a.innerType, b.innerType) && a.modifiers === b.modifiers;
    };

    TypeLogic.allEqualWrapped = function (a, b) {
        return a.length === b.length && a.every(function (a, i) {
            return TypeLogic.equalWrapped(a, b[i]);
        });
    };

    TypeLogic.isBaseTypeOf = function (derived, base) {
        for (var type = derived; type !== null; type = type.baseType) {
            if (type === base)
                return true;
        }
        return false;
    };

    TypeLogic.commonBaseType = function (a, b) {
        for (var c = a; c !== null; c = c.baseType) {
            for (var d = b; d !== null; d = d.baseType) {
                if (c === d)
                    return c;
            }
        }
        return null;
    };

    TypeLogic.isValidOverride = function (derived, base) {
        return derived.isFunction() && base.isFunction() && TypeLogic.equalWrapped(derived, base);
    };

    TypeLogic.checkImplicitConversionTypes = function (from, to) {
        if (from.isInt() && to.isDouble())
            return true;
        if (from.isNull() && to.isPointer())
            return true;
        if (from.isObject() && to.isObject()) {
            return TypeLogic.isBaseTypeOf(from.asObject(), to.asObject());
        }
        return TypeLogic.equal(from.innerType, to.innerType);
    };

    TypeLogic.checkImplicitConversionTypeModifiers = function (from, to) {
        if (!from.isNull()) {
            if (from.substitutions.length !== to.substitutions.length)
                return false;
            if (from.substitutions.some(function (f) {
                return to.substitutions.every(function (t) {
                    return f.parameter !== t.parameter || !TypeLogic.equalWrapped(f.type, t.type);
                });
            }))
                return false;
        } else if (to.isPointer()) {
            return true;
        }
        if (from.isRawPointer() && to.isRawPointer())
            return true;
        if (from.isOwned() && to.isPointer())
            return true;
        if (from.isShared() && to.isPointer() && !to.isOwned())
            return true;
        if (from.isPrimitive() && to.isPrimitive())
            return true;
        return false;
    };

    TypeLogic.canImplicitlyConvert = function (from, to) {
        return TypeLogic.checkImplicitConversionTypes(from, to) && TypeLogic.checkImplicitConversionTypeModifiers(from, to);
    };

    TypeLogic.commonImplicitType = function (a, b) {
        if (TypeLogic.canImplicitlyConvert(a, b))
            return b;
        if (TypeLogic.canImplicitlyConvert(b, a))
            return a;
        if (a.isObject() && b.isObject()) {
            var base = TypeLogic.commonBaseType(a.asObject(), b.asObject());
            if (base !== null) {
                if (a.isRawPointer() || b.isRawPointer()) {
                    return base.wrap(TypeModifier.INSTANCE);
                }
                if (a.isShared() || b.isShared()) {
                    return base.wrap(TypeModifier.INSTANCE | TypeModifier.SHARED);
                }
                assert(a.isOwned() && b.isOwned());
                return base.wrap(TypeModifier.INSTANCE | TypeModifier.OWNED);
            }
        }
        return null;
    };

    TypeLogic.hasTypeParameters = function (type) {
        return type.innerType.parameters.length > 0;
    };

    TypeLogic.isParameterized = function (type) {
        if (TypeLogic.hasTypeParameters(type)) {
            if (type.innerType.parameters.some(function (p) {
                return !type.substitutions.some(function (s) {
                    return s.parameter === p;
                });
            })) {
                return false;
            }

            // Recursively check the substitutions
            return type.substitutions.every(function (s) {
                return !TypeLogic.hasTypeParameters(s.type) || TypeLogic.isParameterized(s.type);
            });
        }

        return false;
    };

    TypeLogic.filterSubstitutionsForType = function (substitutions, type) {
        return substitutions.filter(function (s) {
            return type.parameters.indexOf(s.parameter) >= 0;
        });
    };

    TypeLogic.substitute = function (type, substitutions) {
        if (substitutions.length === 0) {
            return type;
        }
        assert(type.substitutions.length === 0);

        if (type.innerType instanceof TypeParameter) {
            for (var i = 0; i < substitutions.length; i++) {
                var sub = substitutions[i];
                if (type.innerType === sub.parameter) {
                    var result = sub.type.wrapWith(TypeModifier.INSTANCE);

                    if (type.isUnowned()) {
                        result.modifiers &= ~TypeModifier.OWNED;
                    }

                    if (type.isUnshared()) {
                        result.modifiers &= ~TypeModifier.SHARED;
                    }

                    return result;
                }
            }
        }

        if (type.innerType instanceof FunctionType) {
            var f = type.innerType;
            return new WrappedType(new FunctionType(TypeLogic.substitute(f.result, substitutions), f.args.map(function (t) {
                return TypeLogic.substitute(t, substitutions);
            })), type.modifiers, []);
        }

        if (type.innerType instanceof ObjectType) {
            var o = type.innerType;
            return new WrappedType(o, type.modifiers, TypeLogic.filterSubstitutionsForType(substitutions, o));
        }

        return type;
    };
    return TypeLogic;
})();
var ResolverContext = (function () {
    function ResolverContext(scope, enclosingLoop, enclosingObject, enclosingFunction) {
        this.scope = scope;
        this.enclosingLoop = enclosingLoop;
        this.enclosingObject = enclosingObject;
        this.enclosingFunction = enclosingFunction;
    }
    ResolverContext.prototype.inLoop = function () {
        return this.enclosingLoop;
    };

    ResolverContext.prototype.inObject = function () {
        return this.enclosingObject !== null;
    };

    ResolverContext.prototype.inFunction = function () {
        return this.enclosingFunction !== null;
    };

    ResolverContext.prototype.clone = function () {
        return new ResolverContext(this.scope, this.enclosingLoop, this.enclosingObject, this.enclosingFunction);
    };

    ResolverContext.prototype.cloneWithScope = function (scope) {
        var clone = this.clone();
        clone.scope = scope;
        return clone;
    };

    ResolverContext.prototype.cloneForLoop = function () {
        var clone = this.clone();
        clone.enclosingLoop = true;
        return clone;
    };

    ResolverContext.prototype.cloneForObject = function (objectType) {
        var clone = this.clone();
        clone.enclosingObject = objectType;
        return clone;
    };

    ResolverContext.prototype.cloneForFunction = function (functionType) {
        var clone = this.clone();
        clone.enclosingFunction = functionType;
        return clone;
    };
    return ResolverContext;
})();

var Initializer = (function () {
    function Initializer(resolver) {
        this.resolver = resolver;
    }
    Initializer.prototype.visitObjectDeclaration = function (node) {
        var _this = this;
        // Check modifiers
        this.resolver.ignoreModifier(node, SymbolModifier.OVER, 'on a class declaration');

        // Create the block scope
        node.block.scope = new Scope(this.resolver.context.scope);
        var type = new ObjectType(node.symbol.name, node.block.scope);

        if (node.base !== null) {
            this.resolver.resolveAsParameterizedType(node.base);

            // Avoid reporting further errors
            var baseType = node.base.computedType;
            if (baseType.isError()) {
                return SpecialType.ERROR.wrap(0);
            }

            if (!baseType.isObject() || baseType.asObject().isSealed) {
                semanticErrorBadBaseType(this.resolver.log, node.base.range, baseType);
                return SpecialType.ERROR.wrap(0);
            }

            // Base type is valid (no need to check for cycles since
            // cycle detection is done for all declarations anyway)
            type.baseType = baseType.asObject();
            type.baseType.hasDerivedTypes = true;

            // Mix the symbols from the base scope in with this block's symbols
            // to make detecting abstract vs fully implemented types easier
            node.block.scope.symbols = type.baseType.scope.symbols.slice(0);
        }

        // Populate the block scope
        this.resolver.pushContext(this.resolver.context.cloneWithScope(node.block.scope));
        this.resolver.initializeBlock(node.block);
        this.resolver.popContext();

        // Initialize all member variables now so we can inspect their types
        node.symbol.type = type.wrap(0);
        node.block.statements.forEach(function (n) {
            if (n instanceof Declaration) {
                (n).symbol.enclosingObject = type;
                _this.resolver.ensureDeclarationIsInitialized(n);
            }
        });

        // Determine whether the class is abstract
        type.isAbstract = node.block.scope.containsAbstractSymbols();

        // Lazily compute the constructor type, see ObjectType for details
        type.constructorTypeInitializer = function () {
            var baseArgTypes = type.baseType !== null ? type.baseType.constructorType().args : [];
            var argTypes = node.block.statements.filter(function (n) {
                return n instanceof VariableDeclaration && (n).value === null;
            }).map(function (n) {
                return (n).symbol.type;
            });
            return new FunctionType(null, baseArgTypes.concat(argTypes));
        };

        return type.wrap(0);
    };

    Initializer.prototype.visitFunctionDeclaration = function (node) {
        var _this = this;
        this.resolver.resolveAsParameterizedType(node.result);

        // Determine whether the function is abstract
        node.symbol.isAbstract = node.block === null;

        // Create the function scope
        node.scope = new Scope(this.resolver.context.scope);
        if (node.block !== null) {
            node.block.scope = new Scope(node.scope);
        }

        // Define the arguments in the function scope
        this.resolver.pushContext(this.resolver.context.cloneWithScope(node.scope));
        var args = node.args.map(function (n) {
            _this.resolver.define(n);
            _this.resolver.ensureDeclarationIsInitialized(n);
            return n.symbol.type.wrapWith(TypeModifier.INSTANCE);
        });
        this.resolver.popContext();

        return new FunctionType(node.result.computedType.wrapWith(TypeModifier.INSTANCE), args).wrap(TypeModifier.INSTANCE | TypeModifier.STORAGE);
    };

    Initializer.prototype.visitVariableDeclaration = function (node) {
        // Check modifiers
        this.resolver.ignoreModifier(node, SymbolModifier.OVER, 'on a variable declaration');

        // Resolve the type
        this.resolver.resolveAsParameterizedType(node.type);
        return node.type.computedType.wrapWith(TypeModifier.INSTANCE | TypeModifier.STORAGE);
    };
    return Initializer;
})();

var Resolver = (function () {
    function Resolver(log) {
        this.log = log;
        this.stack = [];
        this.context = new ResolverContext(Resolver.createGlobalScope(), false, null, null);
        this.isInitialized = {};
        this.definitionContext = {};
        this.initializer = new Initializer(this);
    }
    Resolver.resolve = function (log, module) {
        new Resolver(log).visitBlock(module.block);
    };

    Resolver.createGlobalScope = function () {
        var scope = new Scope(null);
        scope.define('int', SpecialType.INT.wrap(0));
        scope.define('void', SpecialType.VOID.wrap(0));
        scope.define('bool', SpecialType.BOOL.wrap(0));
        scope.define('double', SpecialType.DOUBLE.wrap(0));
        scope.define('Math', NativeTypes.MATH.wrap(TypeModifier.INSTANCE));
        scope.define('List', NativeTypes.LIST.wrap(0));
        return scope;
    };

    Resolver.prototype.pushContext = function (context) {
        this.stack.push(this.context);
        this.context = context;
    };

    Resolver.prototype.popContext = function () {
        assert(this.stack.length > 0);
        this.context = this.stack.pop();
    };

    Resolver.prototype.resolve = function (node) {
        if (node.computedType === null) {
            node.computedType = SpecialType.ERROR.wrap(0);
            node.acceptExpressionVisitor(this);
        }
    };

    Resolver.prototype.resolveAsExpression = function (node) {
        if (node.computedType !== null) {
            return;
        }
        this.resolve(node);

        if (!node.computedType.isError() && !node.computedType.isInstance()) {
            semanticErrorUnexpectedExpression(this.log, node.range, node.computedType);
            node.computedType = SpecialType.ERROR.wrap(0);
        }
    };

    Resolver.prototype.resolveAsType = function (node) {
        if (node.computedType !== null) {
            return;
        }
        this.resolve(node);

        if (!node.computedType.isError() && node.computedType.isInstance()) {
            semanticErrorUnexpectedExpression(this.log, node.range, node.computedType);
            node.computedType = SpecialType.ERROR.wrap(0);
        }
    };

    Resolver.prototype.resolveAsParameterizedType = function (node) {
        if (node.computedType !== null) {
            return;
        }
        this.resolveAsType(node);

        if (TypeLogic.hasTypeParameters(node.computedType) && !TypeLogic.isParameterized(node.computedType)) {
            semanticErrorUnparameterizedExpression(this.log, node.range, node.computedType);
            node.computedType = SpecialType.ERROR.wrap(0);
        }
    };

    Resolver.prototype.resolveAsUnparameterizedType = function (node) {
        if (node.computedType !== null) {
            return;
        }
        this.resolveAsType(node);

        if (TypeLogic.hasTypeParameters(node.computedType) && TypeLogic.isParameterized(node.computedType)) {
            semanticErrorParameterizedExpression(this.log, node.range, node.computedType);
            node.computedType = SpecialType.ERROR.wrap(0);
        }
    };

    Resolver.prototype.define = function (node) {
        // Cache the context used to define the node so that when it's initialized
        // we can pass the context at the definition instead of at the use
        this.definitionContext[node.uniqueID] = this.context;

        // Always set the symbol so every declaration has one
        var scope = this.context.scope;
        node.symbol = new Symbol(node.id.name, null, scope);
        node.symbol.node = node;
        node.symbol.modifiers = node.modifiers;

        // Only add it to the scope if there isn't any conflict
        var symbol = scope.find(node.id.name);
        if (symbol === null || symbol.scope !== scope) {
            scope.replace(node.symbol);
        } else {
            semanticErrorDuplicateSymbol(this.log, node.id.range, symbol);
        }
    };

    Resolver.prototype.ignoreModifier = function (node, modifier, why) {
        if ((node.modifiers & modifier) !== 0) {
            semanticErrorUnexpectedModifier(this.log, node.id.range, 'over', why);
            node.modifiers = node.modifiers & ~modifier;
        }
    };

    Resolver.prototype.checkImplicitCast = function (type, node) {
        if (!type.isError() && !node.computedType.isError()) {
            if (!TypeLogic.canImplicitlyConvert(node.computedType, type)) {
                semanticErrorIncompatibleTypes(this.log, node.range, node.computedType, type);
            }
        }
    };

    Resolver.prototype.checkCallArguments = function (range, type, args) {
        var _this = this;
        if (type.args.length !== args.length) {
            semanticErrorArgumentCount(this.log, range, type.args.length, args.length);
            return;
        }

        args.forEach(function (n, i) {
            _this.checkImplicitCast(type.args[i], n);
        });
    };

    Resolver.prototype.checkRValueToRawPointer = function (type, node) {
        if (!node.computedType.isError() && type.isRawPointer() && node.computedType.isOwned() && !node.computedType.isStorage()) {
            semanticErrorRValueToRawPointer(this.log, node.range);
        }
    };

    Resolver.prototype.checkStorage = function (node) {
        if (!node.computedType.isStorage()) {
            semanticErrorBadStorage(this.log, node.range);
        }
    };

    Resolver.prototype.ensureDeclarationIsInitialized = function (node) {
        // Only initialize once (symbol should be set by block initialization)
        assert(node.symbol !== null);
        if (node.symbol.type !== null) {
            return;
        }

        // Set the symbol's type to the circular type sentinel for the duration
        // of the declaration's initialization. This way we can detect cycles
        // that try to use the symbol in its own type, such as 'foo foo;'. The
        // declaration should return SpecialType.ERROR in this case.
        node.symbol.type = SpecialType.CIRCULAR.wrap(0);
        this.pushContext(this.definitionContext[node.uniqueID]);
        var type = node.acceptDeclarationVisitor(this.initializer);
        this.popContext();
        assert(type !== null && !type.isCircular());
        node.symbol.type = type;
        this.checkOverModifier(node);
    };

    Resolver.prototype.checkOverModifier = function (node) {
        if (node.symbol.enclosingObject === null) {
            this.ignoreModifier(node, SymbolModifier.OVER, 'outside a class');
            return;
        }
        if (node.symbol.enclosingObject.baseType === null) {
            this.ignoreModifier(node, SymbolModifier.OVER, 'in a class with no base class');
            return;
        }

        // Find the symbol we are overriding
        var symbol = this.findMemberSymbol(node.symbol.enclosingObject.baseType, node.id);
        if (symbol === null) {
            if (node.symbol.isOver()) {
                semanticErrorModifierOverMissingBase(this.log, node.id.range, node.id.name);
            }
            return;
        }

        if (node.symbol.type.isError() || symbol.type.isError()) {
            return;
        }

        if (!(node instanceof FunctionDeclaration) || !(symbol.node instanceof FunctionDeclaration)) {
            semanticErrorOverrideNotFunctions(this.log, node.id.range, node.id.name, symbol.enclosingObject);
            return;
        }

        if (!TypeLogic.isValidOverride(node.symbol.type, symbol.type)) {
            semanticErrorOverrideDifferentTypes(this.log, node.id.range, node.id.name, symbol.type, node.symbol.type);
            return;
        }

        if (!node.symbol.isOver()) {
            semanticErrorModifierMissingOver(this.log, node.id.range, node.id.name);
            return;
        }

        // Mark the override
        symbol.isOverridden = true;
    };

    Resolver.prototype.initializeSymbol = function (symbol, range) {
        if (symbol.type === null) {
            assert(symbol.node !== null);
            this.pushContext(this.context.cloneWithScope(symbol.scope));
            this.ensureDeclarationIsInitialized(symbol.node);
            this.popContext();
            assert(symbol.type !== null);
        }

        if (symbol.type.isCircular()) {
            semanticErrorCircularType(this.log, range);
            symbol.type = SpecialType.ERROR.wrap(0);
        }

        return symbol;
    };

    Resolver.prototype.findSymbol = function (range, name) {
        var symbol = this.context.scope.lexicalFind(name);
        return symbol === null ? null : this.initializeSymbol(symbol, range);
    };

    Resolver.prototype.findMemberSymbol = function (type, id) {
        var symbol = type.scope.find(id.name);
        return symbol === null ? null : this.initializeSymbol(symbol, id.range);
    };

    Resolver.prototype.visitBlock = function (node) {
        var _this = this;
        if (node.scope === null) {
            node.scope = new Scope(this.context.scope);
        }

        // Resolve all statements
        this.pushContext(this.context.cloneWithScope(node.scope));
        this.initializeBlock(node);
        node.statements.forEach(function (n) {
            return n.acceptStatementVisitor(_this);
        });
        this.popContext();
    };

    // Ensures all symbols in this scope exist and are defined but does not resolve them
    Resolver.prototype.initializeBlock = function (node) {
        var _this = this;
        if (!this.isInitialized[node.uniqueID]) {
            this.isInitialized[node.uniqueID] = true;

            // Define all declarations that are direct children of this node
            node.statements.forEach(function (n) {
                if (n instanceof Declaration) {
                    _this.define(n);
                }
            });
        }
    };

    Resolver.prototype.visitExpressionStatement = function (node) {
        if (!this.context.inFunction()) {
            semanticErrorUnexpectedStatement(this.log, node.range, 'expression statement');
            return;
        }

        this.resolveAsExpression(node.value);
    };

    Resolver.prototype.visitIfStatement = function (node) {
        if (!this.context.inFunction()) {
            semanticErrorUnexpectedStatement(this.log, node.range, 'if statement');
            return;
        }

        this.resolveAsExpression(node.test);
        this.checkImplicitCast(SpecialType.BOOL.wrap(TypeModifier.INSTANCE), node.test);
        this.visitBlock(node.thenBlock);
        if (node.elseBlock !== null) {
            this.visitBlock(node.elseBlock);
        }
    };

    Resolver.prototype.visitWhileStatement = function (node) {
        if (!this.context.inFunction()) {
            semanticErrorUnexpectedStatement(this.log, node.range, 'while statement');
            return;
        }

        this.resolveAsExpression(node.test);
        this.checkImplicitCast(SpecialType.BOOL.wrap(TypeModifier.INSTANCE), node.test);
        this.pushContext(this.context.cloneForLoop());
        this.visitBlock(node.block);
        this.popContext();
    };

    Resolver.prototype.visitReturnStatement = function (node) {
        if (!this.context.inFunction()) {
            semanticErrorUnexpectedStatement(this.log, node.range, 'return statement');
            return;
        }

        var returnType = this.context.enclosingFunction.result;
        if (node.value !== null) {
            this.resolveAsExpression(node.value);
            this.checkImplicitCast(returnType, node.value);
            this.checkRValueToRawPointer(returnType, node.value);
        } else if (!returnType.isVoid()) {
            semanticErrorExpectedReturnValue(this.log, node.range, returnType);
        }
    };

    Resolver.prototype.visitBreakStatement = function (node) {
        if (!this.context.inLoop()) {
            semanticErrorUnexpectedStatement(this.log, node.range, 'break statement');
            return;
        }
    };

    Resolver.prototype.visitContinueStatement = function (node) {
        if (!this.context.inLoop()) {
            semanticErrorUnexpectedStatement(this.log, node.range, 'continue statement');
            return;
        }
    };

    Resolver.prototype.visitDeclaration = function (node) {
        node.acceptDeclarationVisitor(this);
    };

    Resolver.prototype.visitObjectDeclaration = function (node) {
        if (this.context.inObject() || this.context.inFunction()) {
            semanticErrorUnexpectedStatement(this.log, node.range, 'class declaration');
            return;
        }

        this.ensureDeclarationIsInitialized(node);
        this.pushContext(this.context.cloneForObject(node.symbol.type.asObject()));
        this.visitBlock(node.block);
        this.popContext();
    };

    Resolver.prototype.visitFunctionDeclaration = function (node) {
        var _this = this;
        if (this.context.inFunction()) {
            semanticErrorUnexpectedStatement(this.log, node.range, 'function declaration');
            return;
        }

        this.ensureDeclarationIsInitialized(node);
        node.args.forEach(function (n) {
            return n.acceptDeclarationVisitor(_this);
        });
        if (node.block !== null) {
            this.pushContext(this.context.cloneForFunction(node.symbol.type.asFunction()));
            this.visitBlock(node.block);
            this.popContext();
        }
    };

    Resolver.prototype.visitVariableDeclaration = function (node) {
        this.ensureDeclarationIsInitialized(node);

        if (node.value !== null) {
            this.resolveAsExpression(node.value);
            this.checkImplicitCast(node.symbol.type, node.value);
            this.checkRValueToRawPointer(node.symbol.type, node.value);
        }
    };

    Resolver.prototype.visitSymbolExpression = function (node) {
        // Search for the symbol
        node.symbol = this.findSymbol(node.range, node.name);
        if (node.symbol === null) {
            semanticErrorUnknownSymbol(this.log, node.range, node.name);
            return;
        }

        node.computedType = node.symbol.type;
    };

    Resolver.prototype.visitUnaryExpression = function (node) {
        this.resolveAsExpression(node.value);

        // Avoid reporting further errors
        var value = node.value.computedType;
        if (value.isError()) {
            return;
        }

        if (value.isPrimitive()) {
            var found = false;

            switch (node.op) {
                case '+':
                case '-':
                    found = value.isInt() || value.isDouble();
                    break;

                case '!':
                    found = value.isBool();
                    break;

                case '~':
                    found = value.isInt();
                    break;

                default:
                    assert(false);
            }

            if (found) {
                node.computedType = value.innerType.wrap(TypeModifier.INSTANCE);
                return;
            }
        }

        semanticErrorNoUnaryOperator(this.log, node.range, node.op, value);
    };

    Resolver.prototype.visitBinaryExpression = function (node) {
        this.resolveAsExpression(node.left);
        this.resolveAsExpression(node.right);

        // Avoid reporting further errors
        var left = node.left.computedType;
        var right = node.right.computedType;
        if (left.isError() || right.isError()) {
            return;
        }

        if (node.isAssignment()) {
            this.checkImplicitCast(left, node.right);
            this.checkRValueToRawPointer(left, node.right);
            this.checkStorage(node.left);
            return;
        }

        if ((node.op === '==' || node.op === '!=') && (TypeLogic.canImplicitlyConvert(left, right) || TypeLogic.canImplicitlyConvert(right, left))) {
            node.computedType = SpecialType.BOOL.wrap(TypeModifier.INSTANCE);
            return;
        }

        if (left.isPrimitive() && right.isPrimitive()) {
            var result = null;

            switch (node.op) {
                case '+':
                case '-':
                case '*':
                case '/':
                    if ((left.isInt() || left.isDouble()) && (right.isInt() || right.isDouble())) {
                        result = left.isInt() && right.isInt() ? SpecialType.INT : SpecialType.DOUBLE;
                    }
                    break;

                case '%':
                case '<<':
                case '>>':
                case '&':
                case '|':
                case '^':
                    if (left.isInt() && right.isInt()) {
                        result = SpecialType.INT;
                    }
                    break;

                case '&&':
                case '||':
                    if (left.isBool() && right.isBool()) {
                        result = SpecialType.BOOL;
                    }
                    break;

                case '<':
                case '>':
                case '<=':
                case '>=':
                    if ((left.isInt() || left.isDouble()) && (right.isInt() || right.isDouble())) {
                        result = SpecialType.BOOL;
                    }
                    break;
            }

            if (result !== null) {
                node.computedType = result.wrap(TypeModifier.INSTANCE);
                return;
            }
        }

        semanticErrorNoBinaryOperator(this.log, node.range, node.op, left, right);
    };

    Resolver.prototype.visitTernaryExpression = function (node) {
        this.resolveAsExpression(node.value);
        this.checkImplicitCast(SpecialType.BOOL.wrap(TypeModifier.INSTANCE), node.value);
        this.resolveAsExpression(node.trueValue);
        this.resolveAsExpression(node.falseValue);

        // Avoid reporting further errors
        var yes = node.trueValue.computedType;
        var no = node.falseValue.computedType;
        if (yes.isError() || no.isError()) {
            return;
        }

        // Ensure both branches can implicitly convert to a common type
        var commonType = TypeLogic.commonImplicitType(yes, no);
        if (commonType === null) {
            semanticErrorNoCommonType(this.log, spanRange(node.trueValue.range, node.falseValue.range), yes, no);
            return;
        }

        // Prevent immediate deletion
        this.checkRValueToRawPointer(commonType, node.trueValue);
        this.checkRValueToRawPointer(commonType, node.falseValue);

        node.computedType = commonType;
    };

    Resolver.prototype.visitMemberExpression = function (node) {
        this.resolveAsExpression(node.value);

        if (node.value.computedType.isError()) {
            return;
        }

        // Only objects have members
        var objectType = node.value.computedType.asObject();
        if (objectType === null) {
            semanticErrorNoMembers(this.log, node.value.range, node.value.computedType);
            return;
        }

        // Search for the symbol
        node.symbol = this.findMemberSymbol(objectType, node.id);
        if (node.symbol === null) {
            semanticErrorUnknownMemberSymbol(this.log, node.id.range, node.id.name, node.value.computedType);
            return;
        }

        // Substitute the type parameters from the object into the member
        node.computedType = TypeLogic.substitute(node.symbol.type, node.value.computedType.substitutions);
    };

    Resolver.prototype.visitIntExpression = function (node) {
        node.computedType = SpecialType.INT.wrap(TypeModifier.INSTANCE);
    };

    Resolver.prototype.visitBoolExpression = function (node) {
        node.computedType = SpecialType.BOOL.wrap(TypeModifier.INSTANCE);
    };

    Resolver.prototype.visitDoubleExpression = function (node) {
        node.computedType = SpecialType.DOUBLE.wrap(TypeModifier.INSTANCE);
    };

    Resolver.prototype.visitNullExpression = function (node) {
        node.computedType = SpecialType.NULL.wrap(TypeModifier.INSTANCE);
    };

    Resolver.prototype.visitThisExpression = function (node) {
        if (!this.context.inObject()) {
            semanticErrorUnexpectedStatement(this.log, node.range, 'this expression');
            return;
        }

        node.computedType = this.context.enclosingObject.wrap(TypeModifier.INSTANCE);
    };

    Resolver.prototype.visitCallExpression = function (node) {
        var _this = this;
        this.resolveAsExpression(node.value);
        node.args.forEach(function (n) {
            return _this.resolveAsExpression(n);
        });

        if (node.value.computedType.isError()) {
            return;
        }

        // Calls only work on function types
        var functionType = node.value.computedType.asFunction();
        if (functionType === null) {
            semanticErrorInvalidCall(this.log, node.range, node.value.computedType);
            return;
        }

        this.checkCallArguments(node.range, functionType, node.args);
        node.computedType = functionType.result;
    };

    Resolver.prototype.visitNewExpression = function (node) {
        var _this = this;
        this.resolveAsParameterizedType(node.type);
        node.args.forEach(function (n) {
            return _this.resolveAsExpression(n);
        });

        if (node.type.computedType.isError()) {
            return;
        }

        // New only works on raw object types
        var objectType = node.type.computedType.asObject();
        if (objectType === null || !node.type.computedType.isRawPointer()) {
            semanticErrorInvalidNew(this.log, node.type.range, node.type.computedType);
            return;
        }

        if (objectType.isAbstract) {
            semanticErrorAbstractNew(this.log, node.type);
            return;
        }

        this.checkCallArguments(node.range, objectType.constructorType(), node.args);
        node.computedType = node.type.computedType.wrapWith(TypeModifier.INSTANCE | TypeModifier.OWNED);
    };

    Resolver.prototype.visitTypeModifierExpression = function (node) {
        this.resolveAsParameterizedType(node.type);

        if (node.type.computedType.isError()) {
            return;
        }

        // Cannot use both owned and shared
        var all = node.modifiers & (TypeModifier.OWNED | TypeModifier.SHARED);
        if (all !== TypeModifier.OWNED && all !== TypeModifier.SHARED) {
            semanticErrorPointerModifierConflict(this.log, node.range);
            return;
        }

        if (all !== 0 && !node.type.computedType.isObject()) {
            semanticErrorInvalidPointerModifier(this.log, node.range, node.type.computedType);
            return;
        }

        node.computedType = node.type.computedType.wrapWith(node.modifiers);
    };

    Resolver.prototype.visitTypeParameterExpression = function (node) {
        var _this = this;
        this.resolveAsUnparameterizedType(node.type);
        node.parameters.forEach(function (n) {
            return _this.resolveAsParameterizedType(n);
        });

        if (node.type.computedType.isError() || node.parameters.some(function (p) {
            return p.computedType.isError();
        })) {
            return;
        }

        if (!TypeLogic.hasTypeParameters(node.type.computedType)) {
            semanticErrorCannotParameterize(this.log, node.type.range, node.type.computedType);
            return;
        }

        // Validate parameter count
        var type = node.type.computedType.innerType;
        if (node.parameters.length !== type.parameters.length) {
            semanticErrorParameterCount(this.log, node.range, type.parameters.length, node.parameters.length);
            return;
        }

        for (var i = 0; i < node.parameters.length; i++) {
            var n = node.parameters[i];
            if (!n.computedType.isObject()) {
                semanticErrorBadParameter(this.log, n.range, n.computedType);
                return;
            }
        }

        // Create the substitution environment
        var substitutions = type.parameters.map(function (p, i) {
            return new Substitution(p, node.parameters[i].computedType);
        });
        node.computedType = TypeLogic.substitute(node.type.computedType, substitutions);
    };
    return Resolver;
})();
var Compiler = (function () {
    function Compiler(input) {
        this.log = new Log();
        this.tokens = null;
        this.module = null;
        var source = new Source('<stdin>', input);

        // Tokenize
        this.tokens = prepareTokens(tokenize(this.log, source));
        if (this.log.hasErrors)
            return;

        // Parse
        this.module = parse(this.log, this.tokens);
        if (this.log.hasErrors)
            return;

        // Resolve
        Resolver.resolve(this.log, this.module);
        if (this.log.hasErrors)
            return;
    }
    return Compiler;
})();
var OutputJS = (function () {
    function OutputJS() {
        this.needExtendsPolyfill = false;
        this.needMultiplicationPolyfill = false;
    }
    OutputJS.generate = function (node) {
        return escodegen.generate(new OutputJS().visitModule(node), { format: { indent: { style: '  ' } } });
    };

    OutputJS.prototype.defaultForType = function (type) {
        var t = type.innerType;
        return {
            type: 'Literal',
            value: t === SpecialType.INT || t === SpecialType.DOUBLE ? 0 : t === SpecialType.BOOL ? false : null
        };
    };

    OutputJS.prototype.visitModule = function (node) {
        var _this = this;
        var result = {
            type: 'Program',
            body: flatten([
                flatten(node.sortedObjectDeclarations().map(function (n) {
                    return _this.generateObjectDeclaration(n);
                })),
                node.block.statements.filter(function (n) {
                    return n instanceof VariableDeclaration;
                }).map(function (n) {
                    return n.acceptStatementVisitor(_this);
                }),
                node.block.statements.filter(function (n) {
                    return n instanceof FunctionDeclaration;
                }).map(function (n) {
                    return n.acceptStatementVisitor(_this);
                })
            ])
        };

        if (this.needMultiplicationPolyfill) {
            result.body.unshift(esprima.parse([
                'if (!Math.imul) {',
                '  Math.imul = function(a, b) {',
                '    var al = a & 0xFFFF, bl = b & 0xFFFF;',
                '    return al * bl + ((a >>> 16) * bl + al * (b >>> 16) << 16) | 0;',
                '  };',
                '}'
            ].join('\n')));
        }

        if (this.needExtendsPolyfill) {
            result.body.unshift(esprima.parse([
                'function __extends(d, b) {',
                '  function c() {}',
                '  c.prototype = b.prototype;',
                '  d.prototype = new c();',
                '  d.prototype.constructor = d;',
                '}'
            ].join('\n')));
        }

        return result;
    };

    OutputJS.prototype.visitBlock = function (node) {
        var _this = this;
        return {
            type: 'BlockStatement',
            body: node.statements.map(function (n) {
                return n.acceptStatementVisitor(_this);
            })
        };
    };

    OutputJS.prototype.visitIdentifier = function (node) {
        return {
            type: 'Identifier',
            name: node.name
        };
    };

    OutputJS.prototype.visitExpressionStatement = function (node) {
        return {
            type: 'ExpressionStatement',
            expression: node.value.acceptExpressionVisitor(this)
        };
    };

    OutputJS.prototype.visitIfStatement = function (node) {
        var elseBlock = node.elseBlock !== null ? this.visitBlock(node.elseBlock) : null;
        return {
            type: 'IfStatement',
            test: node.test.acceptExpressionVisitor(this),
            consequent: this.visitBlock(node.thenBlock),
            alternate: elseBlock !== null && elseBlock.body.length === 1 && elseBlock.body[0].type === 'IfStatement' ? elseBlock.body[0] : elseBlock
        };
    };

    OutputJS.prototype.visitWhileStatement = function (node) {
        return {
            type: 'WhileStatement',
            test: node.test.acceptExpressionVisitor(this),
            body: this.visitBlock(node.block)
        };
    };

    OutputJS.prototype.visitReturnStatement = function (node) {
        return {
            type: 'ReturnStatement',
            argument: node.value !== null ? node.value.acceptExpressionVisitor(this) : null
        };
    };

    OutputJS.prototype.visitBreakStatement = function (node) {
        return {
            type: 'BreakStatement',
            label: null
        };
    };

    OutputJS.prototype.visitContinueStatement = function (node) {
        return {
            type: 'ContinueStatement',
            label: null
        };
    };

    OutputJS.prototype.visitDeclaration = function (node) {
        return node.acceptDeclarationVisitor(this);
    };

    OutputJS.prototype.getBaseVariables = function (node) {
        if (node instanceof SymbolExpression) {
            var base = (node).symbol.node;
            return this.getBaseVariables(base.base).concat(base.block.statements.filter(function (n) {
                return n instanceof VariableDeclaration;
            }));
        }
        return [];
    };

    OutputJS.prototype.generateConstructor = function (node) {
        var _this = this;
        var variables = node.block.statements.filter(function (n) {
            return n instanceof VariableDeclaration;
        });
        var baseVariables = this.getBaseVariables(node.base).filter(function (n) {
            return n.value === null;
        });

        // Create the constructor function
        var result = [
            {
                type: 'FunctionDeclaration',
                params: baseVariables.concat(variables.filter(function (n) {
                    return n.value === null;
                })).map(function (n) {
                    return _this.visitIdentifier(n.id);
                }),
                id: this.visitIdentifier(node.id),
                body: {
                    type: 'BlockStatement',
                    body: variables.map(function (n) {
                        return {
                            type: 'ExpressionStatement',
                            expression: {
                                type: 'AssignmentExpression',
                                operator: '=',
                                left: {
                                    type: 'MemberExpression',
                                    object: {
                                        type: 'ThisExpression'
                                    },
                                    property: _this.visitIdentifier(n.id),
                                    computed: false
                                },
                                right: n.value !== null ? n.value.acceptExpressionVisitor(_this) : _this.visitIdentifier(n.id)
                            }
                        };
                    })
                }
            }
        ];

        if (node.base !== null) {
            // Add a call to the constructor for the base class
            result[0].body.body.unshift({
                type: 'ExpressionStatement',
                expression: {
                    type: 'CallExpression',
                    callee: {
                        type: 'MemberExpression',
                        object: node.base.acceptExpressionVisitor(this),
                        property: { type: 'Identifier', name: 'call' }
                    },
                    arguments: [{ type: 'ThisExpression' }].concat(baseVariables.map(function (n) {
                        return _this.visitIdentifier(n.id);
                    }))
                }
            });

            // Add a call to __extends()
            this.needExtendsPolyfill = true;
            result.push({
                type: 'ExpressionStatement',
                expression: {
                    type: 'CallExpression',
                    callee: { type: 'Identifier', name: '__extends' },
                    arguments: [
                        this.visitIdentifier(node.id),
                        node.base.acceptExpressionVisitor(this)
                    ]
                }
            });
        }

        return result;
    };

    OutputJS.prototype.generateMemberFunctions = function (node) {
        var _this = this;
        return node.block.statements.filter(function (n) {
            return n instanceof FunctionDeclaration && n.block !== null;
        }).map(function (n) {
            var result = _this.visitFunctionDeclaration(n);
            result.type = 'FunctionExpression';
            result.id = null;
            return {
                type: 'ExpressionStatement',
                expression: {
                    type: 'AssignmentExpression',
                    operator: '=',
                    left: {
                        type: 'MemberExpression',
                        object: {
                            type: 'MemberExpression',
                            object: _this.visitIdentifier(node.id),
                            property: { type: 'Identifier', name: 'prototype' }
                        },
                        property: _this.visitIdentifier(n.id)
                    },
                    right: result
                }
            };
        });
    };

    OutputJS.prototype.generateObjectDeclaration = function (node) {
        return this.generateConstructor(node).concat(this.generateMemberFunctions(node));
    };

    OutputJS.prototype.visitObjectDeclaration = function (node) {
        assert(false);
        return null;
    };

    OutputJS.prototype.visitFunctionDeclaration = function (node) {
        var _this = this;
        return {
            type: 'FunctionDeclaration',
            params: node.args.map(function (n) {
                return _this.visitIdentifier(n.id);
            }),
            id: this.visitIdentifier(node.id),
            body: node.block !== null ? this.visitBlock(node.block) : { type: 'BlockStatement', body: [] }
        };
    };

    OutputJS.prototype.visitVariableDeclaration = function (node) {
        return {
            type: 'VariableDeclaration',
            kind: 'var',
            declarations: [
                {
                    type: 'VariableDeclarator',
                    id: this.visitIdentifier(node.id),
                    init: node.value !== null ? node.value.acceptExpressionVisitor(this) : this.defaultForType(node.symbol.type)
                }
            ]
        };
    };

    OutputJS.prototype.visitSymbolExpression = function (node) {
        var result = {
            type: 'Identifier',
            name: node.name
        };

        if (node.symbol.enclosingObject !== null) {
            return {
                type: 'MemberExpression',
                object: {
                    type: 'ThisExpression'
                },
                property: result
            };
        }

        return result;
    };

    OutputJS.prototype.wrapIntegerOperator = function (result) {
        if (result.type === 'UnaryExpression' && result.argument.type === 'Literal') {
            return result;
        }

        return {
            type: 'BinaryExpression',
            operator: '|',
            left: result,
            right: {
                type: 'Literal',
                value: 0
            }
        };
    };

    OutputJS.prototype.visitUnaryExpression = function (node) {
        var result = {
            type: 'UnaryExpression',
            operator: node.op,
            argument: node.value.acceptExpressionVisitor(this),
            prefix: true
        };

        if (!OutputJS.INTEGER_OPS[node.op] && node.computedType.innerType === SpecialType.INT) {
            result = this.wrapIntegerOperator(result);
        }

        return result;
    };

    OutputJS.prototype.visitBinaryExpression = function (node) {
        if (node.op === '*' && node.computedType.innerType === SpecialType.INT) {
            this.needMultiplicationPolyfill = true;
            return {
                type: 'CallExpression',
                callee: {
                    type: 'MemberExpression',
                    object: { type: 'Identifier', name: 'Math' },
                    property: { type: 'Identifier', name: 'imul' }
                },
                arguments: [
                    node.left.acceptExpressionVisitor(this),
                    node.right.acceptExpressionVisitor(this)
                ]
            };
        }

        var result = {
            type: node.op === '=' ? 'AssignmentExpression' : node.op === '&&' || node.op === '||' ? 'LogicalExpression' : 'BinaryExpression',
            operator: node.op,
            left: node.left.acceptExpressionVisitor(this),
            right: node.right.acceptExpressionVisitor(this)
        };

        if (!OutputJS.INTEGER_OPS[node.op] && node.computedType.innerType === SpecialType.INT) {
            result = this.wrapIntegerOperator(result);
        }

        return result;
    };

    OutputJS.prototype.visitTernaryExpression = function (node) {
        return {
            type: 'ConditionalExpression',
            test: node.value.acceptExpressionVisitor(this),
            consequent: node.trueValue.acceptExpressionVisitor(this),
            alternate: node.falseValue.acceptExpressionVisitor(this)
        };
    };

    OutputJS.prototype.visitMemberExpression = function (node) {
        if (node.value.computedType.innerType === NativeTypes.MATH) {
            switch (node.id.name) {
                case 'NAN':
                    return {
                        type: 'Identifier',
                        name: 'NaN'
                    };

                case 'INFINITY':
                    return {
                        type: 'Identifier',
                        name: 'Infinity'
                    };
            }
        }

        return {
            type: 'MemberExpression',
            object: node.value.acceptExpressionVisitor(this),
            property: this.visitIdentifier(node.id)
        };
    };

    OutputJS.prototype.visitIntExpression = function (node) {
        return {
            type: 'Literal',
            value: node.value
        };
    };

    OutputJS.prototype.visitBoolExpression = function (node) {
        return {
            type: 'Literal',
            value: node.value
        };
    };

    OutputJS.prototype.visitDoubleExpression = function (node) {
        return {
            type: 'Literal',
            value: node.value
        };
    };

    OutputJS.prototype.visitNullExpression = function (node) {
        return {
            type: 'Literal',
            value: null
        };
    };

    OutputJS.prototype.visitThisExpression = function (node) {
        return {
            type: 'ThisExpression'
        };
    };

    OutputJS.prototype.visitCallExpression = function (node) {
        var _this = this;
        if (node.value instanceof MemberExpression) {
            var member = node.value;
            if (member.value.computedType.innerType === NativeTypes.LIST) {
                switch (member.symbol) {
                    case NativeTypes.LIST_GET:
                        assert(node.args.length === 1);
                        return {
                            type: 'MemberExpression',
                            object: member.value.acceptExpressionVisitor(this),
                            property: node.args[0].acceptExpressionVisitor(this),
                            computed: true
                        };

                    case NativeTypes.LIST_SET:
                        assert(node.args.length === 2);
                        return {
                            type: 'AssignmentExpression',
                            operator: '=',
                            left: {
                                type: 'MemberExpression',
                                object: member.value.acceptExpressionVisitor(this),
                                property: node.args[0].acceptExpressionVisitor(this),
                                computed: true
                            },
                            right: node.args[1].acceptExpressionVisitor(this)
                        };

                    case NativeTypes.LIST_PUSH:
                        assert(node.args.length === 1);
                        return {
                            type: 'CallExpression',
                            callee: {
                                type: 'MemberExpression',
                                object: member.value.acceptExpressionVisitor(this),
                                property: { kind: 'Identifier', name: 'push' }
                            },
                            arguments: [node.args[0].acceptExpressionVisitor(this)]
                        };

                    case NativeTypes.LIST_POP:
                        assert(node.args.length === 0);
                        return {
                            type: 'CallExpression',
                            callee: {
                                type: 'MemberExpression',
                                object: member.value.acceptExpressionVisitor(this),
                                property: { kind: 'Identifier', name: 'pop' }
                            },
                            arguments: []
                        };

                    case NativeTypes.LIST_UNSHIFT:
                        assert(node.args.length === 1);
                        return {
                            type: 'CallExpression',
                            callee: {
                                type: 'MemberExpression',
                                object: member.value.acceptExpressionVisitor(this),
                                property: { kind: 'Identifier', name: 'unshift' }
                            },
                            arguments: [node.args[0].acceptExpressionVisitor(this)]
                        };

                    case NativeTypes.LIST_SHIFT:
                        assert(node.args.length === 0);
                        return {
                            type: 'CallExpression',
                            callee: {
                                type: 'MemberExpression',
                                object: member.value.acceptExpressionVisitor(this),
                                property: { kind: 'Identifier', name: 'shift' }
                            },
                            arguments: []
                        };

                    case NativeTypes.LIST_INDEX_OF:
                        assert(node.args.length === 1);
                        return {
                            type: 'CallExpression',
                            callee: {
                                type: 'MemberExpression',
                                object: member.value.acceptExpressionVisitor(this),
                                property: { kind: 'Identifier', name: 'indexOf' }
                            },
                            arguments: [node.args[0].acceptExpressionVisitor(this)]
                        };

                    case NativeTypes.LIST_INSERT:
                        assert(node.args.length === 2);
                        return {
                            type: 'CallExpression',
                            callee: {
                                type: 'MemberExpression',
                                object: member.value.acceptExpressionVisitor(this),
                                property: { kind: 'Identifier', name: 'splice' }
                            },
                            arguments: [
                                node.args[0].acceptExpressionVisitor(this),
                                { type: 'Literal', value: 0 },
                                node.args[1].acceptExpressionVisitor(this)
                            ]
                        };

                    case NativeTypes.LIST_REMOVE:
                        assert(node.args.length === 1);
                        return {
                            type: 'CallExpression',
                            callee: {
                                type: 'MemberExpression',
                                object: member.value.acceptExpressionVisitor(this),
                                property: { kind: 'Identifier', name: 'splice' }
                            },
                            arguments: [
                                node.args[0].acceptExpressionVisitor(this),
                                { type: 'Literal', value: 1 }
                            ]
                        };

                    default:
                        assert(false);
                }
            }
        }

        return {
            type: 'CallExpression',
            callee: node.value.acceptExpressionVisitor(this),
            arguments: node.args.map(function (n) {
                return n.acceptExpressionVisitor(_this);
            })
        };
    };

    OutputJS.prototype.visitNewExpression = function (node) {
        var _this = this;
        if (node.type.computedType.innerType === NativeTypes.LIST) {
            assert(node.args.length === 0);
            return {
                type: 'ArrayExpression',
                elements: []
            };
        }

        return {
            type: 'NewExpression',
            callee: node.type.acceptExpressionVisitor(this),
            arguments: node.args.map(function (n) {
                return n.acceptExpressionVisitor(_this);
            })
        };
    };

    OutputJS.prototype.visitTypeModifierExpression = function (node) {
        assert(false);
        return null;
    };

    OutputJS.prototype.visitTypeParameterExpression = function (node) {
        return node.type.acceptExpressionVisitor(this);
    };
    OutputJS.INTEGER_OPS = {
        '~': true,
        '|': true,
        '&': true,
        '^': true,
        '<<': true,
        '>>': true
    };
    return OutputJS;
})();
var OutputCPP = (function () {
    function OutputCPP() {
        this.needMemoryHeader = false;
        this.needVectorHeader = false;
        this.needMathHeader = false;
        this.needMathRandom = false;
        this.needAlgorithmHeader = false;
        this.needListPop = false;
        this.needListUnshift = false;
        this.needListShift = false;
        this.needListIndexOf = false;
        this.needListInsert = false;
        this.needListRemove = false;
        this.returnType = null;
    }
    OutputCPP.generate = function (node) {
        var output = new OutputCPP();
        var result = cppcodegen.generate(output.visitModule(node), { indent: '  ', cpp11: true }).trim();

        // Cheat for now since I don't feel like writing tons of JSON
        var listStuff = '';
        if (output.needListPop) {
            listStuff += [
                'template <typename T>',
                'T List_pop(std::vector<T> *list) {',
                '  T t = std::move(*(list->end() - 1));',
                '  list->pop_back();',
                '  return std::move(t);',
                '}'
            ].join('\n') + '\n';
        }
        if (output.needListUnshift) {
            listStuff += [
                'template <typename T>',
                'void List_unshift(std::vector<T> *list, T t) {',
                '  list->insert(list->begin(), std::move(t));',
                '}'
            ].join('\n') + '\n';
        }
        if (output.needListShift) {
            listStuff += [
                'template <typename T>',
                'T List_shift(std::vector<T> *list) {',
                '  T t = std::move(*list->begin());',
                '  list->erase(list->begin());',
                '  return std::move(t);',
                '}'
            ].join('\n') + '\n';
        }
        if (output.needListIndexOf) {
            listStuff += [
                'template <typename T, typename U>',
                'int List_indexOf(std::vector<std::unique_ptr<T>> *list, U *u) {',
                '  for (typename std::vector<std::unique_ptr<T>>::iterator i = list->begin(); i != list->end(); i++) {',
                '    if (i->get() == u) {',
                '      return i - list->begin();',
                '    }',
                '  }',
                '  return -1;',
                '}',
                'template <typename T, typename U>',
                'int List_indexOf(std::vector<std::shared_ptr<T>> *list, U *u) {',
                '  for (typename std::vector<std::shared_ptr<T>>::iterator i = list->begin(); i != list->end(); i++) {',
                '    if (i->get() == u) {',
                '      return i - list->begin();',
                '    }',
                '  }',
                '  return -1;',
                '}',
                'template <typename T, typename U>',
                'int List_indexOf(std::vector<T *> *list, U *u) {',
                '  for (typename std::vector<T *>::iterator i = list->begin(); i != list->end(); i++) {',
                '    if (*i == u) {',
                '      return i - list->begin();',
                '    }',
                '  }',
                '  return -1;',
                '}'
            ].join('\n') + '\n';
        }
        if (output.needListInsert) {
            listStuff += [
                'template <typename T>',
                'void List_insert(std::vector<T> *list, int offset, T t) {',
                '  list->insert(list->begin() + offset, std::move(t));',
                '}'
            ].join('\n') + '\n';
        }
        if (output.needListRemove) {
            listStuff += [
                'template <typename T>',
                'void List_remove(std::vector<T> *list, int offset) {',
                '  list->erase(list->begin() + offset);',
                '}'
            ].join('\n') + '\n';
        }
        return result.replace(/\n(?!#)/, '\n' + listStuff);
    };

    OutputCPP.prototype.defaultForType = function (type) {
        switch (type.innerType) {
            case SpecialType.INT:
                return {
                    kind: 'IntegerLiteral',
                    value: 0
                };

            case SpecialType.DOUBLE:
                return {
                    kind: 'DoubleLiteral',
                    value: 0
                };

            case SpecialType.BOOL:
                return {
                    kind: 'BooleanLiteral',
                    value: false
                };
        }

        return {
            kind: 'NullLiteral'
        };
    };

    OutputCPP.prototype.visitType = function (type) {
        switch (type.innerType) {
            case SpecialType.INT:
                return { kind: 'Identifier', name: 'int' };
            case SpecialType.VOID:
                return { kind: 'Identifier', name: 'void' };
            case SpecialType.BOOL:
                return { kind: 'Identifier', name: 'bool' };
            case SpecialType.DOUBLE:
                return { kind: 'Identifier', name: 'double' };
        }

        assert(type.innerType instanceof ObjectType);
        var objectType = type.innerType;
        var result = {
            kind: 'Identifier',
            name: objectType.name
        };

        if (objectType === NativeTypes.LIST) {
            this.needVectorHeader = true;
            assert(type.substitutions.length === 1);
            assert(type.substitutions[0].parameter === NativeTypes.LIST_T);
            result = {
                kind: 'SpecializeTemplate',
                template: {
                    kind: 'MemberType',
                    inner: { kind: 'Identifier', name: 'std' },
                    member: { kind: 'Identifier', name: 'vector' }
                },
                parameters: [this.visitType(type.substitutions[0].type)]
            };
        }

        if (type.isRawPointer()) {
            return {
                kind: 'PointerType',
                inner: result
            };
        }

        if (type.isOwned()) {
            this.needMemoryHeader = true;
            return {
                kind: 'SpecializeTemplate',
                template: {
                    kind: 'MemberType',
                    inner: { kind: 'Identifier', name: 'std' },
                    member: { kind: 'Identifier', name: 'unique_ptr' }
                },
                parameters: [result]
            };
        }

        if (type.isShared()) {
            this.needMemoryHeader = true;
            return {
                kind: 'SpecializeTemplate',
                template: {
                    kind: 'MemberType',
                    inner: { kind: 'Identifier', name: 'std' },
                    member: { kind: 'Identifier', name: 'shared_ptr' }
                },
                parameters: [result]
            };
        }

        return result;
    };

    OutputCPP.prototype.forwardDeclareObjectType = function (node) {
        return {
            kind: 'ObjectDeclaration',
            type: {
                kind: 'ObjectType',
                keyword: 'struct',
                id: this.visitIdentifier(node.id),
                bases: []
            }
        };
    };

    OutputCPP.prototype.createVariables = function (variables) {
        var _this = this;
        return variables.map(function (n) {
            return {
                kind: 'Variable',
                type: _this.visitType(n.type.computedType),
                id: _this.visitIdentifier(n.id)
            };
        });
    };

    OutputCPP.prototype.needsVirtualDestructor = function (node) {
        var type = node.symbol.type.asObject();
        return type.baseType === null && type.hasDerivedTypes;
    };

    OutputCPP.prototype.getBaseVariables = function (node) {
        if (node instanceof SymbolExpression) {
            var base = (node).symbol.node;
            return this.getBaseVariables(base.base).concat(base.block.statements.filter(function (n) {
                return n instanceof VariableDeclaration;
            }));
        }
        return [];
    };

    OutputCPP.prototype.createFunctionsForObjectType = function (node, ctor, dtor, memberFunction) {
        var _this = this;
        var variables = node.block.statements.filter(function (n) {
            return n instanceof VariableDeclaration;
        });
        var functions = node.block.statements.filter(function (n) {
            return n instanceof FunctionDeclaration;
        });
        var baseVariables = this.getBaseVariables(node.base).filter(function (n) {
            return n.value === null;
        });

        // Initialize member variables using an initialization list
        var initializations = variables.map(function (n) {
            return ({
                kind: 'CallExpression',
                callee: _this.visitIdentifier(n.id),
                arguments: [n.value !== null ? _this.insertImplicitConversion(n.value, n.symbol.type) : _this.visitIdentifier(n.id)]
            });
        });

        if (node.base !== null) {
            initializations.unshift({
                kind: 'CallExpression',
                callee: node.base.acceptExpressionVisitor(this),
                arguments: baseVariables.map(function (n) {
                    return _this.visitIdentifier(n.id);
                })
            });
        }

        // Create the constructor
        ctor({
            kind: 'FunctionDeclaration',
            type: {
                kind: 'FunctionType',
                arguments: this.createVariables(baseVariables.concat(variables.filter(function (n) {
                    return n.value === null;
                })))
            },
            id: {
                kind: 'MemberType',
                inner: this.visitIdentifier(node.id),
                member: this.visitIdentifier(node.id)
            },
            initializations: initializations,
            body: { kind: 'BlockStatement', body: [] }
        });

        // Create the destructor
        dtor({
            kind: 'FunctionDeclaration',
            type: { kind: 'FunctionType', arguments: [] },
            id: {
                kind: 'MemberType',
                inner: this.visitIdentifier(node.id),
                member: { kind: 'Identifier', name: '~' + node.id.name }
            },
            body: { kind: 'BlockStatement', body: [] }
        });

        // Create the member functions
        functions.forEach(function (n) {
            var result = _this.visitFunctionDeclaration(n);
            result.id = {
                kind: 'MemberType',
                inner: _this.visitIdentifier(node.id),
                member: result.id
            };
            memberFunction(n, result);
        });
    };

    OutputCPP.prototype.declareObjectType = function (node) {
        var _this = this;
        var variables = node.block.statements.filter(function (n) {
            return n instanceof VariableDeclaration;
        });

        // Create member variables
        var statements = this.createVariables(variables).map(function (n) {
            return {
                kind: 'VariableDeclaration',
                qualifiers: [],
                variables: [n]
            };
        });

        // Forward-declare the constructor, the destructor, and any member functions
        this.createFunctionsForObjectType(node, function (ctor) {
            ctor.id = ctor.id.member;
            ctor.body = ctor.initializations = null;
            statements.push(ctor);
        }, function (dtor) {
            if (_this.needsVirtualDestructor(node)) {
                dtor.id = dtor.id.member;
                dtor.qualifiers = [{ kind: 'Identifier', name: 'virtual' }];
                statements.push(dtor);
            }
        }, function (n, memberFunction) {
            memberFunction.id = memberFunction.id.member;
            memberFunction.body = null;
            if (n.symbol.isOverridden || n.symbol.isOver()) {
                memberFunction.qualifiers = [{ kind: 'Identifier', name: 'virtual' }];
                if (n.block === null) {
                    memberFunction.body = { kind: 'IntegerLiteral', value: 0 };
                }
            }
            statements.push(memberFunction);
        });

        // Bundle everything in a struct declaration
        return {
            kind: 'ObjectDeclaration',
            type: {
                kind: 'ObjectType',
                keyword: 'struct',
                id: this.visitIdentifier(node.id),
                bases: node.base === null ? [] : [node.base.acceptExpressionVisitor(this)],
                body: {
                    kind: 'BlockStatement',
                    body: statements
                }
            }
        };
    };

    OutputCPP.prototype.generateFunctionsForObjectType = function (node, callback) {
        var statements = [];

        // Implement the constructor, and any member functions
        this.createFunctionsForObjectType(node, function (ctor) {
            statements.push(ctor);
        }, function (dtor) {
            // The destructor is inline (and so is already implemented)
        }, function (n, memberFunction) {
            if (n.block !== null) {
                statements.push(memberFunction);
            }
        });

        return statements;
    };

    OutputCPP.prototype.insertImplicitConversion = function (from, to) {
        var _this = this;
        if (from.computedType.isOwned() && to.isOwned() && from.computedType.isStorage()) {
            return {
                kind: 'CallExpression',
                callee: {
                    kind: 'MemberType',
                    inner: { kind: 'Identifier', name: 'std' },
                    member: { kind: 'Identifier', name: 'move' }
                },
                arguments: [from.acceptExpressionVisitor(this)]
            };
        }

        if (from.computedType.isOwned() && to.isShared()) {
            if (from instanceof NewExpression) {
                var node = from;
                var functionType = node.type.computedType.asObject().constructorType();
                this.needMemoryHeader = true;
                return {
                    kind: 'CallExpression',
                    callee: {
                        kind: 'SpecializeTemplate',
                        template: {
                            kind: 'MemberType',
                            inner: { kind: 'Identifier', name: 'std' },
                            member: { kind: 'Identifier', name: 'make_shared' }
                        },
                        parameters: [{ kind: 'Identifier', name: to.asObject().name }]
                    },
                    arguments: node.args.map(function (n, i) {
                        return _this.insertImplicitConversion(n, functionType.args[i]);
                    })
                };
            }
            return {
                kind: 'CallExpression',
                callee: this.visitType(to),
                arguments: [
                    {
                        kind: 'CallExpression',
                        callee: {
                            kind: 'MemberExpression',
                            operator: '.',
                            object: from.acceptExpressionVisitor(this),
                            member: { kind: 'Identifier', name: 'release' }
                        },
                        arguments: []
                    }
                ]
            };
        }

        if ((from.computedType.isOwned() || from.computedType.isShared()) && to.isRawPointer()) {
            return {
                kind: 'CallExpression',
                callee: {
                    kind: 'MemberExpression',
                    operator: '.',
                    object: from.acceptExpressionVisitor(this),
                    member: { kind: 'Identifier', name: 'get' }
                },
                arguments: []
            };
        }

        return from.acceptExpressionVisitor(this);
    };

    OutputCPP.prototype.declareFunction = function (node) {
        var _this = this;
        return {
            kind: 'FunctionDeclaration',
            qualifiers: [],
            type: {
                kind: 'FunctionType',
                'return': this.visitType(node.result.computedType),
                arguments: node.args.map(function (n) {
                    return ({
                        kind: 'Variable',
                        type: _this.visitType(n.type.computedType),
                        id: _this.visitIdentifier(n.id)
                    });
                })
            },
            id: this.visitIdentifier(node.id),
            body: null
        };
    };

    OutputCPP.prototype.visitModule = function (node) {
        var _this = this;
        var objects = node.sortedObjectDeclarations();
        var result = {
            kind: 'Program',
            body: flatten([
                objects.map(function (n) {
                    return _this.forwardDeclareObjectType(n);
                }),
                objects.map(function (n) {
                    return _this.declareObjectType(n);
                }),
                node.block.statements.filter(function (n) {
                    return n instanceof VariableDeclaration;
                }).map(function (n) {
                    return n.acceptStatementVisitor(_this);
                }),
                node.block.statements.filter(function (n) {
                    return n instanceof FunctionDeclaration;
                }).map(function (n) {
                    return _this.declareFunction(n);
                }),
                flatten(objects.map(function (n) {
                    return _this.generateFunctionsForObjectType(n, function (n, o) {
                        return n.block !== null ? o : null;
                    });
                })),
                node.block.statements.filter(function (n) {
                    return n instanceof FunctionDeclaration && n.block !== null;
                }).map(function (n) {
                    return n.acceptStatementVisitor(_this);
                })
            ])
        };

        if (this.needMathRandom) {
            result.body.unshift({
                kind: 'FunctionDeclaration',
                qualifiers: [],
                type: {
                    kind: 'FunctionType',
                    'return': { kind: 'Identifier', name: 'double' },
                    arguments: []
                },
                id: { kind: 'Identifier', name: 'Math_random' },
                body: {
                    kind: 'BlockStatement',
                    body: [
                        {
                            kind: 'ReturnStatement',
                            argument: {
                                kind: 'BinaryExpression',
                                operator: '/',
                                left: {
                                    kind: 'CallExpression',
                                    callee: { kind: 'Identifier', name: 'rand' },
                                    arguments: []
                                },
                                right: {
                                    kind: 'CallExpression',
                                    callee: {
                                        kind: 'SpecializeTemplate',
                                        template: { kind: 'Identifier', name: 'static_cast' },
                                        parameters: [{ kind: 'Identifier', name: 'double' }]
                                    },
                                    arguments: [{ kind: 'Identifier', name: 'RAND_MAX' }]
                                }
                            }
                        }
                    ]
                }
            });
        }

        if (this.needMemoryHeader) {
            result.body.unshift({
                kind: 'IncludeStatement',
                text: '<memory>'
            });
        }
        if (this.needMathHeader) {
            result.body.unshift({
                kind: 'IncludeStatement',
                text: '<math.h>'
            });
        }
        if (this.needVectorHeader) {
            result.body.unshift({
                kind: 'IncludeStatement',
                text: '<vector>'
            });
        }
        if (this.needAlgorithmHeader) {
            result.body.unshift({
                kind: 'IncludeStatement',
                text: '<algorithm>'
            });
        }

        return result;
    };

    OutputCPP.prototype.visitBlock = function (node) {
        var _this = this;
        return {
            kind: 'BlockStatement',
            body: node.statements.map(function (n) {
                return n.acceptStatementVisitor(_this);
            })
        };
    };

    OutputCPP.prototype.visitIdentifier = function (node) {
        return {
            kind: 'Identifier',
            name: node.name
        };
    };

    OutputCPP.prototype.visitExpressionStatement = function (node) {
        return {
            kind: 'ExpressionStatement',
            expression: node.value.acceptExpressionVisitor(this)
        };
    };

    OutputCPP.prototype.visitIfStatement = function (node) {
        var elseBlock = node.elseBlock !== null ? this.visitBlock(node.elseBlock) : null;
        return {
            kind: 'IfStatement',
            test: node.test.acceptExpressionVisitor(this),
            consequent: this.visitBlock(node.thenBlock),
            alternate: elseBlock !== null && elseBlock.body.length === 1 && elseBlock.body[0].kind === 'IfStatement' ? elseBlock.body[0] : elseBlock
        };
    };

    OutputCPP.prototype.visitWhileStatement = function (node) {
        return {
            kind: 'WhileStatement',
            test: node.test.acceptExpressionVisitor(this),
            body: this.visitBlock(node.block)
        };
    };

    OutputCPP.prototype.visitReturnStatement = function (node) {
        return {
            kind: 'ReturnStatement',
            argument: node.value !== null ? this.insertImplicitConversion(node.value, this.returnType) : null
        };
    };

    OutputCPP.prototype.visitBreakStatement = function (node) {
        return {
            kind: 'BreakStatement'
        };
    };

    OutputCPP.prototype.visitContinueStatement = function (node) {
        return {
            kind: 'ContinueStatement'
        };
    };

    OutputCPP.prototype.visitDeclaration = function (node) {
        return node.acceptDeclarationVisitor(this);
    };

    OutputCPP.prototype.visitObjectDeclaration = function (node) {
        assert(false);
        return null;
    };

    OutputCPP.prototype.visitFunctionDeclaration = function (node) {
        var _this = this;
        this.returnType = node.symbol.type.asFunction().result;
        return {
            kind: 'FunctionDeclaration',
            qualifiers: [],
            type: {
                kind: 'FunctionType',
                'return': this.visitType(node.result.computedType),
                arguments: node.args.map(function (n) {
                    return ({
                        kind: 'Variable',
                        type: _this.visitType(n.type.computedType),
                        id: _this.visitIdentifier(n.id)
                    });
                })
            },
            id: this.visitIdentifier(node.id),
            body: node.block !== null ? this.visitBlock(node.block) : null
        };
    };

    OutputCPP.prototype.visitVariableDeclaration = function (node) {
        return {
            kind: 'VariableDeclaration',
            qualifiers: [],
            variables: [
                {
                    kind: 'Variable',
                    type: this.visitType(node.type.computedType),
                    id: this.visitIdentifier(node.id),
                    init: node.value !== null ? this.insertImplicitConversion(node.value, node.symbol.type) : this.defaultForType(node.symbol.type)
                }
            ]
        };
    };

    OutputCPP.prototype.visitSymbolExpression = function (node) {
        return {
            kind: 'Identifier',
            name: node.name
        };
    };

    OutputCPP.prototype.visitUnaryExpression = function (node) {
        return {
            kind: 'UnaryExpression',
            operator: node.op,
            argument: node.value.acceptExpressionVisitor(this)
        };
    };

    OutputCPP.prototype.visitBinaryExpression = function (node) {
        return {
            kind: node.op === '=' ? 'AssignmentExpression' : 'BinaryExpression',
            operator: node.op,
            left: node.left.acceptExpressionVisitor(this),
            right: node.op === '=' ? this.insertImplicitConversion(node.right, node.left.computedType) : node.right.acceptExpressionVisitor(this)
        };
    };

    OutputCPP.prototype.visitTernaryExpression = function (node) {
        return {
            kind: 'ConditionalExpression',
            test: node.value.acceptExpressionVisitor(this),
            consequent: this.insertImplicitConversion(node.trueValue, node.computedType),
            alternate: this.insertImplicitConversion(node.falseValue, node.computedType)
        };
    };

    OutputCPP.prototype.visitMemberExpression = function (node) {
        if (node.value.computedType.innerType === NativeTypes.MATH) {
            switch (node.id.name) {
                case 'E':
                    return {
                        kind: 'DoubleLiteral',
                        value: Math.E
                    };

                case 'PI':
                    return {
                        kind: 'DoubleLiteral',
                        value: Math.PI
                    };

                case 'NAN':
                case 'INFINITY':
                case 'cos':
                case 'sin':
                case 'tan':
                case 'acos':
                case 'asin':
                case 'atan':
                case 'atan2':
                case 'floor':
                case 'ceil':
                case 'exp':
                case 'log':
                case 'sqrt':
                case 'pow':
                    this.needMathHeader = true;
                    return this.visitIdentifier(node.id);

                case 'min':
                case 'max':
                case 'abs':
                    this.needMathHeader = true;
                    return {
                        kind: 'Identifier',
                        name: 'f' + node.id.name
                    };

                case 'random':
                    this.needMathHeader = true;
                    this.needMathRandom = true;
                    return {
                        kind: 'Identifier',
                        name: 'Math_random'
                    };

                default:
                    assert(false);
            }
        } else if (node.value.computedType.innerType === NativeTypes.LIST) {
            switch (node.symbol) {
                case NativeTypes.LIST_LENGTH:
                    return {
                        kind: 'CallExpression',
                        callee: {
                            kind: 'MemberExpression',
                            operator: '->',
                            object: node.value.acceptExpressionVisitor(this),
                            member: { kind: 'Identifier', name: 'size' }
                        },
                        arguments: []
                    };
            }
        }

        return {
            kind: 'MemberExpression',
            operator: node.value.computedType.isPointer() ? '->' : '.',
            object: node.value.acceptExpressionVisitor(this),
            member: this.visitIdentifier(node.id)
        };
    };

    OutputCPP.prototype.visitIntExpression = function (node) {
        return {
            kind: 'IntegerLiteral',
            value: node.value
        };
    };

    OutputCPP.prototype.visitBoolExpression = function (node) {
        return {
            kind: 'BooleanLiteral',
            value: node.value
        };
    };

    OutputCPP.prototype.visitDoubleExpression = function (node) {
        return {
            kind: 'DoubleLiteral',
            value: node.value
        };
    };

    OutputCPP.prototype.visitNullExpression = function (node) {
        return {
            kind: 'NullLiteral'
        };
    };

    OutputCPP.prototype.visitThisExpression = function (node) {
        return {
            kind: 'ThisExpression'
        };
    };

    OutputCPP.prototype.visitCallExpression = function (node) {
        var _this = this;
        var functionType = node.value.computedType.asFunction();
        var args = node.args.map(function (n, i) {
            return _this.insertImplicitConversion(n, functionType.args[i]);
        });

        if (node.value instanceof MemberExpression) {
            var member = node.value;
            if (member.value.computedType.innerType === NativeTypes.LIST) {
                switch (member.symbol) {
                    case NativeTypes.LIST_GET:
                        assert(args.length === 1);
                        var result = {
                            kind: 'BinaryExpression',
                            operator: '[]',
                            left: {
                                kind: 'UnaryExpression',
                                operator: '*',
                                argument: member.value.acceptExpressionVisitor(this)
                            },
                            right: args[0]
                        };
                        assert(member.value.computedType.substitutions.length === 1);
                        if (!member.value.computedType.substitutions[0].type.isRawPointer()) {
                            return {
                                kind: 'CallExpression',
                                callee: {
                                    kind: 'MemberExpression',
                                    operator: '.',
                                    object: result,
                                    member: { kind: 'Identifier', name: 'get' }
                                },
                                arguments: []
                            };
                        }
                        return result;

                    case NativeTypes.LIST_SET:
                        assert(args.length === 2);
                        return {
                            kind: 'AssignmentExpression',
                            operator: '=',
                            left: {
                                kind: 'BinaryExpression',
                                operator: '[]',
                                left: {
                                    kind: 'UnaryExpression',
                                    operator: '*',
                                    argument: member.value.acceptExpressionVisitor(this)
                                },
                                right: args[0]
                            },
                            right: args[1]
                        };

                    case NativeTypes.LIST_PUSH:
                        assert(args.length === 1);
                        return {
                            kind: 'CallExpression',
                            callee: {
                                kind: 'MemberExpression',
                                operator: '->',
                                object: member.value.acceptExpressionVisitor(this),
                                member: { kind: 'Identifier', name: 'push_back' }
                            },
                            arguments: args
                        };

                    case NativeTypes.LIST_POP:
                    case NativeTypes.LIST_UNSHIFT:
                    case NativeTypes.LIST_SHIFT:
                    case NativeTypes.LIST_INDEX_OF:
                    case NativeTypes.LIST_INSERT:
                    case NativeTypes.LIST_REMOVE:
                        switch (member.symbol) {
                            case NativeTypes.LIST_POP:
                                this.needListPop = true;
                                break;
                            case NativeTypes.LIST_UNSHIFT:
                                this.needListUnshift = true;
                                break;
                            case NativeTypes.LIST_SHIFT:
                                this.needListShift = true;
                                break;
                            case NativeTypes.LIST_INDEX_OF:
                                this.needListIndexOf = this.needAlgorithmHeader = true;
                                break;
                            case NativeTypes.LIST_INSERT:
                                this.needListInsert = true;
                                break;
                            case NativeTypes.LIST_REMOVE:
                                this.needListRemove = true;
                                break;
                            default:
                                assert(false);
                        }
                        return {
                            kind: 'CallExpression',
                            callee: { kind: 'Identifier', name: 'List_' + member.symbol.name },
                            arguments: [this.insertImplicitConversion(member.value, NativeTypes.LIST.wrap(0))].concat(args)
                        };

                    default:
                        assert(false);
                }
            }
        }

        return {
            kind: 'CallExpression',
            callee: node.value.acceptExpressionVisitor(this),
            arguments: args
        };
    };

    OutputCPP.prototype.visitNewExpression = function (node) {
        var _this = this;
        var functionType = node.type.computedType.asObject().constructorType();
        this.needMemoryHeader = true;
        return {
            kind: 'CallExpression',
            callee: {
                kind: 'SpecializeTemplate',
                template: {
                    kind: 'MemberType',
                    inner: { kind: 'Identifier', name: 'std' },
                    member: { kind: 'Identifier', name: 'unique_ptr' }
                },
                parameters: [this.visitType(node.type.computedType).inner]
            },
            arguments: [
                {
                    kind: 'NewExpression',
                    callee: this.visitType(node.type.computedType).inner,
                    arguments: node.args.map(function (n, i) {
                        return _this.insertImplicitConversion(n, functionType.args[i]);
                    })
                }
            ]
        };
    };

    OutputCPP.prototype.visitTypeModifierExpression = function (node) {
        assert(false);
        return null;
    };

    OutputCPP.prototype.visitTypeParameterExpression = function (node) {
        return node.type.acceptExpressionVisitor(this);
    };
    return OutputCPP;
})();
//# sourceMappingURL=compiled.js.map
