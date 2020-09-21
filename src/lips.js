/**@license
 *   __ __                          __
 *  / / \ \       _    _  ___  ___  \ \
 * | |   \ \     | |  | || . \/ __>  | |
 * | |    > \    | |_ | ||  _/\__ \  | |
 * | |   / ^ \   |___||_||_|  <___/  | |
 *  \_\ /_/ \_\                     /_/
 *
 * LIPS is Pretty Simple - Scheme based Powerful LISP in JavaScript
 *
 * Copyright (c) 2018-2020 Jakub T. Jankiewicz <https://jcubic.pl/me>
 * Released under the MIT license
 *
 * includes:
 *
 * unfetch by Jason Miller (@developit) MIT License
 *
 * includes:
 * contentloaded.js
 *
 * Author: Diego Perini (diego.perini at gmail.com)
 * Summary: cross-browser wrapper for DOMContentLoaded
 * Updated: 20101020
 * License: MIT
 * Version: 1.2
 *
 * URL:
 * http://javascript.nwbox.com/ContentLoaded/
 * http://javascript.nwbox.com/ContentLoaded/MIT-LICENSE
 *
 * The rationalize algorithm is by Per M.A. Bothner, Alan Bawden and Marc Feeley.
 * source: Kawa, C-Gambit
 *
 */
/*
 * TODO: consider using exec in env.eval or use different maybe_async code
 */
/* global jQuery, Map, Set, Symbol, importScripts */
import {
    nil,
    LCharacter,
    LSymbol,
    Pair,
    LString,

    LNumber,
    LFloat,
    LComplex,
    LRational,
    LBigInteger,

    Macro,
    Values,
    Stack,
    Syntax
} from './types/index.js';
import { type, typecheck, typeErrorMessage } from './types/utils.js';
import { doc, toArray } from './utils.js';
import { Thunk, trampoline } from './trampoline.js';

import {
    string_re,
    parse,
    specials,
    tokenize,
    is_symbol_string,
    number_to_string
} from './parser.js';

const root = typeof global !== 'undefined' ? global : self;
/*
  (function(root, factory) {
  if (typeof define === 'function' && define.amd) {
  // AMD. Register as an anonymous module.
  define(['bn.js'], function(BN) {
  return (root.lips = factory(root, BN));
  });
  } else if (typeof module === 'object' && module.exports) {
  // Node/CommonJS
  module.exports = factory(root, require('bn.js'));
  } else {
  root.lips = factory(root, root.BN);
  }
  })(typeof global !== 'undefined' ? global : self, function(root, BN, undefined) {
*/

/* eslint-disable */
/* istanbul ignore next */
function contentLoaded(win, fn) {
    var done = false, top = true,

        doc = win.document,
        root = doc.documentElement,
        modern = doc.addEventListener,

        add = modern ? 'addEventListener' : 'attachEvent',
        rem = modern ? 'removeEventListener' : 'detachEvent',
        pre = modern ? '' : 'on',

        init = function(e) {
            if (e.type == 'readystatechange' && doc.readyState != 'complete') return;
            (e.type == 'load' ? win : doc)[rem](pre + e.type, init, false);
            if (!done && (done = true)) fn.call(win, e.type || e);
        },

        poll = function() {
            try { root.doScroll('left'); } catch(e) { setTimeout(poll, 50); return; }
            init('poll');
        };

    if (doc.readyState == 'complete') fn.call(win, 'lazy');
    else {
        if (!modern && root.doScroll) {
            try { top = !win.frameElement; } catch(e) { }
            if (top) poll();
        }
        doc[add](pre + 'DOMContentLoaded', init, false);
        doc[add](pre + 'readystatechange', init, false);
        win[add](pre + 'load', init, false);
    }
}
// -------------------------------------------------------------------------
/* istanbul ignore next */
function log(x, regex = null) {
    var literal = arguments[1] === true;
    function msg(x) {
        var value = global_env.get('repr')(x);
        if (regex === null || regex instanceof RegExp && regex.test(value)) {
            console.log(global_env.get('type')(x) + ": " + value);
        }
        if (literal) {
            console.log(x);
        }
    }
    if (isPromise(x)) {
        x.then(msg);
    } else {
        msg(x);
    }
    return x;
}
/* istanbul ignore next */
if (!root.fetch && typeof window !== 'undefined') {
    root.fetch = function(url, options) {
        options = options || {};
        return new Promise( (resolve, reject) => {
            let request = new XMLHttpRequest();

            request.open(options.method || 'get', url, true);

            for (let i in options.headers) {
                request.setRequestHeader(i, options.headers[i]);
            }

            request.withCredentials = options.credentials=='include';

            request.onload = () => {
                resolve(response());
            };

            request.onerror = reject;

            request.send(options.body || null);

            function response() {
                let keys = [],
                    all = [],
                    headers = {},
                    header;

                request.getAllResponseHeaders().replace(/^(.*?):[^\S\n]*([\s\S]*?)$/gm, (m, key, value) => {
                    keys.push(key = key.toLowerCase());
                    all.push([key, value]);
                    header = headers[key];
                    headers[key] = header ? `${header},${value}` : value;
                });

                return {
                    ok: (request.status/100|0) == 2,    // 200-299
                    status: request.status,
                    statusText: request.statusText,
                    url: request.responseURL,
                    clone: response,
                    text: () => Promise.resolve(request.responseText),
                    json: () => Promise.resolve(request.responseText).then(JSON.parse),
                    blob: () => Promise.resolve(new Blob([request.response])),
                    headers: {
                        keys: () => keys,
                        entries: () => all,
                        get: n => headers[n.toLowerCase()],
                        has: n => n.toLowerCase() in headers
                    }
                };
            }
        });
    };
}
/* eslint-enable */

// ----------------------------------------------------------------------
function unpromise(value, fn = x => x, error = null) {
    if (value instanceof Array) {
        var anyPromise = value.filter(isPromise);
        if (anyPromise.length) {
            return unpromise(Promise.all(anyPromise), fn, error);
        }
        return fn(value);
    }
    if (isPromise(value)) {
        var ret = value.then(fn);
        if (error === null) {
            return ret;
        } else {
            return ret.catch(error);
        }
    }
    return fn(value);
}
// ----------------------------------------------------------------------
function matcher(name, arg) {
    if (arg instanceof RegExp) {
        return x => String(x).match(arg);
    } else if (typeof arg === 'function') {
        // it will alwasy be function
        return arg;
    }
}

// ----------------------------------------------------------------------
// return last S-Expression
// @param tokens - array of tokens (objects from tokenizer or strings)
// @param sexp - number of expression to look behind
// ----------------------------------------------------------------------
function previousSexp(tokens, sexp = 1) {
    var i = tokens.length;
    if (sexp <= 0) {
        throw Error(`previousSexp: Invlaid argument sexp = ${sexp}`);
    }
    outer: while (sexp-- && i >= 0) {
        var count = 1;
        while (count > 0) {
            var token = tokens[--i];
            if (!token) {
                break outer;
            }
            if (token === '(' || token.token === '(') {
                count--;
            } else if (token === ')' || token.token === ')') {
                count++;
            }
        }
        i--;
    }
    return tokens.slice(i + 1);
}
// ----------------------------------------------------------------------
// :: find number of spaces in line
// ----------------------------------------------------------------------
function lineIndent(tokens) {
    if (!tokens || !tokens.length) {
        return 0;
    }
    var i = tokens.length;
    if (tokens[i - 1].token === '\n') {
        return 0;
    }
    while (--i) {
        if (tokens[i].token === '\n') {
            var token = (tokens[i + 1] || {}).token;
            if (token) {
                return token.length;
            }
        }
    }
    return 0;
}
// ----------------------------------------------------------------------
// :: token based pattern matching (used by formatter)
// ----------------------------------------------------------------------
function match(pattern, input) {
    return inner_match(pattern, input) === input.length;
    function inner_match(pattern, input) {
        function empty_match() {
            return p > 0 && i > 0 && pattern[p - 1] === input[i - 1] &&
                pattern[p + 1] === input[i];
        }
        function not_symbol_match() {
            return pattern[p] === Symbol.for('symbol') && !is_symbol_string(input[i]);
        }
        function match_next() {
            var next_pattern = pattern[p + 1];
            var next_input = input[i + 1];
            if (next_pattern !== undefined && next_input !== undefined) {
                return inner_match([next_pattern], [next_input]);
            }
        }
        var p = 0;
        var glob = {};
        for (var i = 0; i < input.length; ++i) {
            if (typeof pattern[p] === 'undefined') {
                return i;
            }
            if (pattern[p] instanceof Pattern) {
                if (pattern[p].flag === '+') {
                    var m;
                    while (i < input.length) {
                        m = inner_match(pattern[p].pattern, input.slice(i));
                        if (m === -1) {
                            break;
                        }
                        i += m;
                    }
                    if (m === -1 && (input[i] && !pattern[p + 1])) {
                        return -1;
                    }
                    p++;
                    i -= 1;
                    continue;
                } else if (pattern[p].flag === '?') {
                    m = inner_match(pattern[p].pattern, input.slice(i));
                    if (m === -1) {
                        i -= 2; // if not found use same test same input again
                    } else {
                        p++;
                    }
                    continue;
                } else if (pattern[p].flag === '*') {
                    m = inner_match(pattern[p].pattern, input.slice(i));
                    if (m === -1) {
                        i -= 1;
                        p++;
                        continue;
                    }
                }
            }
            if (pattern[p] instanceof RegExp) {
                if (!input[i].match(pattern[p])) {
                    return -1;
                }
            } else if (lips.LString.isString(pattern[p])) {
                if (pattern[p].valueOf() !== input[i]) {
                    return -1;
                }
            } else if (typeof pattern[p] === 'symbol') {
                if (pattern[p] === Symbol.for('*')) {
                    // ignore S-expressions inside for case when next pattern is )
                    glob[p] = glob[p] || 0;
                    if (['(', '['].includes(input[i])) {
                        glob[p]++;
                    } else if ([')', ']'].includes(input[i])) {
                        glob[p]--;
                    }
                    if (empty_match()) {
                        i -= 1;
                    } else if ((typeof pattern[p + 1] !== 'undefined' &&
                                glob[p] === 0 && match_next() === -1) ||
                               glob[p] > 0) {
                        continue;
                    }
                } else if (not_symbol_match()) {
                    return -1;
                }
            } else if (pattern[p] instanceof Array) {
                var inc = inner_match(pattern[p], input.slice(i));
                if (inc === -1 || inc + i > input.length) {
                    // if no more input it's not match
                    return -1;
                }
                i += inc - 1;
                p++;
                continue;
            } else {
                return -1;
            }
            p++;
        }
        if (pattern.length !== p) {
            // if there are still patterns it's not match
            return -1;
        }
        return input.length;
    }
}
// ----------------------------------------------------------------------
// :: Code formatter class
// :: based on http://community.schemewiki.org/?scheme-style
// :: and GNU Emacs scheme mode
// :: it rely on meta data from tokenizer function
// ----------------------------------------------------------------------
function Formatter(code) {
    this._code = code.replace(/\r/g, '');
}
// ----------------------------------------------------------------------
Formatter.defaults = {
    offset: 0,
    indent: 2,
    exceptions: {
        specials: [
            /^(?:#:)?define/, /^(?:#:)?lambda/, /^(?:#:)?let*/,
            /^(?:#:)?(let|letrec)(-syntax)?$/, /(?:#:)?let-env/,
            /(?:#:)?syntax-rules/, /(?:#:)?try/, /(?:#:)?catch/,
            /(?:#:)?while/
        ],
        shift: {
            1: ['&', '#']
        }
    }
};
Formatter.match = match;
// ----------------------------------------------------------------------
// :: return indent for next line
// ----------------------------------------------------------------------
Formatter.prototype._options = function _options(options) {
    var defaults = Formatter.defaults;
    if (typeof options === 'undefined') {
        return Object.assign({}, defaults);
    }
    var exeptions = options && options.exceptions || {};
    var specials = exeptions.specials || [];
    var shift = exeptions.shift || { 1: [] };
    return {
        ...defaults,
        ...options,
        exceptions: {
            specials: [...defaults.exceptions.specials, ...specials],
            shift: {
                ...shift,
                1: [...defaults.exceptions.shift[1], ...shift[1]]
            }
        }
    };
};
// ----------------------------------------------------------------------
Formatter.prototype.indent = function indent(options) {
    var tokens = tokenize(this._code, true);
    return this._indent(tokens, options);
};
// ----------------------------------------------------------------------
Formatter.exception_shift = function(token, settings) {
    function match(list) {
        if (!list.length) {
            return false;
        }
        if (list.indexOf(token) !== -1) {
            return true;
        } else {
            var regexes = list.filter(s => s instanceof RegExp);
            if (!regexes.length) {
                return false;
            }
            for (let re of regexes) {
                if (token.match(re)) {
                    return true;
                }
            }
        }
        return false;
    }
    if (match(settings.exceptions.specials)) {
        return settings.indent;
    }
    var shift = settings.exceptions.shift;
    for (var [indent, tokens] of Object.entries(shift)) {
        if (match(tokens)) {
            return +indent;
        }
    }
    return -1;
};
// ----------------------------------------------------------------------
Formatter.prototype._indent = function _indent(tokens, options) {
    var settings = this._options(options);
    var spaces = lineIndent(tokens);
    var sexp = previousSexp(tokens);
    // one character before S-Expression
    var before_sexpr = tokens[tokens.length - sexp.length - 1];
    if (sexp && sexp.length) {
        if (sexp[0].line > 0) {
            settings.offset = 0;
        }
        if (sexp.toString() === tokens.toString() && balanced(sexp)) {
            return settings.offset + sexp[0].col;
        } else if (sexp.length === 1) {
            return settings.offset + sexp[0].col + 1;
        } else {
            // search for token before S-Expression for case like #(10 or &(:x
            var exeption = -1;
            if (before_sexpr) {
                var shift = Formatter.exception_shift(before_sexpr.token, settings);
                if (shift !== -1) {
                    exeption = shift;
                }
            }
            if (exeption === -1) {
                exeption = Formatter.exception_shift(sexp[1].token, settings);
            }
            if (exeption !== -1) {
                return settings.offset + sexp[0].col + exeption;
            } else if (sexp[0].line < sexp[1].line) {
                return settings.offset + sexp[0].col + 1;
            } else if (sexp.length > 3 && sexp[1].line === sexp[3].line) {
                if (sexp[1].token === '(' || sexp[1].token === '[') {
                    return settings.offset + sexp[1].col;
                }
                return settings.offset + sexp[3].col;
            } else if (sexp[0].line === sexp[1].line) {
                return settings.offset + settings.indent + sexp[0].col;
            } else {
                var next_tokens = sexp.slice(2);
                for (var i = 0; i < next_tokens.length; ++i) {
                    var token = next_tokens[i];
                    if (token.token.trim()) {
                        return token.col;
                    }
                }
            }
        }
    } else {
        return 0;
    }
    return spaces + settings.indent;
};
// ----------------------------------------------------------------------
function Ahead(pattern) {
    this.pattern = pattern;
}
// TODO: make it print
Ahead.prototype.toString = function() {
    return `#<pattern(${this.pattern})>`;
};
// ----------------------------------------------------------------------
Ahead.prototype.match = function(string) {
    return string.match(this.pattern);
};
// ----------------------------------------------------------------------
function Pattern(pattern, flag) {
    this.pattern = pattern;
    this.flag = flag;
}
// TODO: make it print
Pattern.prototype.toString = function() {
    return `#<pattern(${this.pattern} ${this.flag})>`;
};
// ----------------------------------------------------------------------
Formatter.Pattern = Pattern;
Formatter.Ahead = Ahead;
var p_o = /[[(]/;
var p_e = /[\])]/;
var not_p = /[^()[\]]/;
const not_close = new Ahead(/[^)\]]/);
const open = new Ahead(/[([]/);
const glob = Symbol.for('*');
const sexp = new Pattern([p_o, glob, p_e], '+');
const symbol = new Pattern([Symbol.for('symbol')], '?');
const symbols = new Pattern([Symbol.for('symbol')], '*');
const identifiers = [p_o, symbols, p_e];
const let_value = new Pattern([p_o, Symbol.for('symbol'), glob, p_e], '+');
// rules for breaking S-Expressions into lines
var def_lambda_re = keywords_re('define', 'lambda', 'syntax-rules');
/* eslint-disable */
var non_def = /^(?!.*\b(?:[()[\]]|define|let(?:\*|rec|-env|-syntax)?|lambda|syntax-rules)\b).*$/;
/* eslint-enable */
var let_re = /^(?:#:)?(let(?:\*|rec|-env|-syntax)?)$/;
function keywords_re(...args) {
    return new RegExp(`^(?:#:)?(?:${args.join('|')})$`);
}
// line breaking rules
Formatter.rules = [
    [[p_o, keywords_re('begin')], 1],
    //[[p_o, keywords_re('begin'), sexp], 1, not_close],
    [[p_o, let_re, symbol, p_o, let_value, p_e], 1],
    [[p_o, keywords_re('define-syntax'), /.+/], 1],
    [[p_o, keywords_re('syntax-rules'), symbol, identifiers], 1],
    [[p_o, keywords_re('syntax-rules'), symbol, identifiers, sexp], 1, not_close],
    //[[p_o, let_re, symbol, p_o, let_value], 2, not_close],
    //[[p_o, let_re, symbol, [p_o, let_value, p_e], sexp], 1, not_close],
    [[p_o, non_def, new Pattern([/[^([]/], '+'), sexp], 1, not_close],
    [[p_o, p_o, non_def, sexp, p_e], 1, open],
    //[[p_o, non_def, new Pattern([/[^([]/], '+')], 1, open],
    [[p_o, keywords_re('lambda'), p_o, p_e], 1, not_close], // no args
    [[p_o, keywords_re('lambda'), p_o, p_e, sexp], 1, not_close],
    [[p_o, keywords_re('lambda', 'if'), not_p], 1, not_close],
    [[p_o, keywords_re('while'), not_p, sexp], 1, not_close],
    //[[p_o, keywords_re('while'), [p_o, glob, p_e], sexp], 1, not_close],
    [[p_o, keywords_re('if'), not_p, glob], 1],
    //[[p_o, keywords_re('if', 'while'), [p_o, glob, p_e]], 1],
    //[[p_o, keywords_re('if'), [p_o, glob, p_e], not_p], 1],
    //[[p_o, keywords_re('if'), [p_o, glob, p_e], [p_o, glob, p_e]], 1, not_close],
    //[[p_o, [p_o, glob, p_e], string_re], 1],
    [[p_o, def_lambda_re, p_o, glob, p_e], 1, not_close],
    [[p_o, def_lambda_re, [p_o, glob, p_e], string_re, sexp], 1, not_close],
    [[p_o, def_lambda_re, [p_o, glob, p_e], sexp], 1, not_close]
];
// ----------------------------------------------------------------------
Formatter.prototype.break = function() {
    var code = this._code.replace(/\n[ \t]*/g, '\n ');
    const token = t => {
        if (t.token.match(string_re)) {
            return t.token;
        } else {
            return t.token.replace(/\s+/, ' ');
        }
    };
    var tokens = tokenize(code, true).map(token).filter(t => t !== '\n');
    const { rules } = Formatter;
    for (let i = 1; i < tokens.length; ++i) {
        if (!tokens[i].trim()) {
            continue;
        }
        var sub = tokens.slice(0, i);
        var sexp = {};
        rules.map(b => b[1]).forEach(count => {
            count = count.valueOf();
            if (!sexp[count]) {
                sexp[count] = previousSexp(sub, count);
            }
        });
        for (let [pattern, count, ext] of rules) {
            count = count.valueOf();
            var m = match(pattern, sexp[count].filter(t => t.trim()));
            var next = tokens.slice(i).find(t => t.trim());
            if (m && (ext instanceof Ahead && ext.match(next) || !ext)) {
                tokens.splice(i, 0, '\n');
                i++;
                continue;
            }
        }
    }
    this._code = tokens.join('');
    return this;
};
// ----------------------------------------------------------------------
Formatter.prototype._spaces = function(i) {
    return new Array(i + 1).join(' ');
};
// ----------------------------------------------------------------------
// :: auto formatting of code, it require to have newlines
// ----------------------------------------------------------------------
Formatter.prototype.format = function format(options) {
    // prepare code with single space after newline
    // so we have space token to align
    var code = this._code.replace(/[ \t]*\n[ \t]*/g, '\n ');
    var tokens = tokenize(code, true);
    var settings = this._options(options);
    var indent = 0;
    var offset = 0;
    for (var i = 0; i < tokens.length; ++i) {
        var token = tokens[i];
        if (token.token === '\n') {
            indent = this._indent(tokens.slice(0, i), settings);
            offset += indent;
            if (tokens[i + 1]) {
                tokens[i + 1].token = this._spaces(indent);
                // because we have single space as initial indent
                indent--;
                offset--;
                for (var j = i + 2; j < tokens.length; ++j) {
                    tokens[j].offset += offset;
                    tokens[j].col += indent;
                    if (tokens[j].token === '\n') {
                        // ++i is called after the loop
                        i = j - 1;
                        break;
                    }
                }
            }
        }
    }
    return tokens.map(token => {
        if (token.token.match(string_re)) {
            if (token.token.match(/\n/)) {
                var spaces = new Array(token.col + 1).join(' ');
                var lines = token.token.split('\n');
                token.token = [lines[0]].concat(lines.slice(1).map(line => {
                    return spaces + line;
                })).join('\n');
            }
        }
        return token.token;
    }).join('');
};

// ----------------------------------------------------------------------
// :: Nil constructor with only once instance
// ----------------------------------------------------------------------

/*
  function Nil() {}
  Nil.prototype.toString = Nil.prototype.toJSON = function() {
  return '()';
  };
  Nil.prototype.valueOf = function() {
  return undefined;
  };
  Nil.prototype.append = function(x) {
  return new Pair(x, nil);
  };
  Nil.prototype.toArray = function() {
  return [];
  };
  var nil = new Nil();
*/
var repr = new Map();
// ----------------------------------------------------------------------
function user_repr(obj) {
    var constructor = obj.constructor || Object;
    var plain_object = typeof obj === 'object' && constructor === Object;
    var fn;
    if (repr.has(constructor)) {
        fn = repr.get(constructor);
    } else {
        repr.forEach(function(value, key) {
            key = unbind(key);
            // if key is Object it should only work for plain_object
            // because otherwise it will match every object
            if (obj instanceof key &&
                (key === Object && plain_object || key !== Object)) {
                fn = value;
            }
        });
    }
    return fn;
}
// ----------------------------------------------------------------------
var str_mapping = new Map();
[
    [Number.NEGATIVE_INFINITY, '-inf.0'],
    [Number.POSITIVE_INFINITY, '+inf.0'],
    [true, '#t'],
    [false, '#f'],
    [null, 'null'],
    [undefined, '#<undefined>']
].forEach(([key, value]) => {
    str_mapping.set(key, value);
});
// ----------------------------------------------------------------------
// :: debug function that can be used with JSON.stringify
// :: that will show symbols
// ----------------------------------------------------------------------
/* istanbul ignore next */
function symbolize(obj) {
    if (obj && typeof obj === 'object') {
        var result = {};
        const symbols = Object.getOwnPropertySymbols(obj);
        symbols.forEach((key) => {
            const name = key.toString()
                .replace(/Symbol\(([^)]+)\)/, '$1');
            result[name] = toString(obj[key]);
        });
        const props = Object.getOwnPropertyNames(obj);
        props.forEach(key => {
            const o = obj[key];
            if (typeof o === 'object' && o.constructor === Object) {
                result[key] = symbolize(o);
            } else {
                result[key] = toString(o);
            }
        });
        return result;
    }
    return obj;
}
// ----------------------------------------------------------------------
function is_debug() {
    return user_env.get('DEBUG', { throwError: false });
}
// ----------------------------------------------------------------------
function get_props(obj) {
    return Object.keys(obj).concat(Object.getOwnPropertySymbols(obj));
}
// ----------------------------------------------------------------------
function toString(obj, quote, skip_cycles, ...pair_args) {
    if (typeof jQuery !== 'undefined' &&
        obj instanceof jQuery.fn.init) {
        return '#<jQuery(' + obj.length + ')>';
    }
    if (str_mapping.has(obj)) {
        return str_mapping.get(obj);
    }
    if (obj instanceof Pair) {
        // make sure that repr directly after update set the cycle ref
        if (!skip_cycles) {
            obj.markCycles();
        }
        return obj.toString(quote, ...pair_args);
    }
    if (obj === nil) {
        return obj.toString();
    }
    if (Number.isNaN(obj)) {
        return '+nan.0';
    }
    var types = [RegExp, LSymbol, LNumber, LCharacter, Values];
    for (let type of types) {
        if (obj instanceof type) {
            return obj.toString();
        }
    }
    if (typeof obj === 'function') {
        if (isNativeFunction(obj)) {
            return '#<procedure(native)>';
        }
        if (isNativeFunction(obj.toString)) {
            return '#<procedure>';
        } else {
            return obj.toString();
        }
    }
    if (obj instanceof LString) {
        obj = obj.toString();
    }
    if (obj === null || (typeof obj === 'string' && quote)) {
        return JSON.stringify(obj);
    }
    if (typeof obj === 'object') {
        // user defined representation
        if (typeof obj.toString === 'function' && obj.toString.__lambda__) {
            return obj.toString().valueOf();
        }
        var constructor = obj.constructor;
        if (!constructor) {
            // this is case of fs.constants in Node.js that is null constructor object
            // this object can be handled like normal object that have properties
            constructor = Object;
        }
        var name;
        if (typeof constructor.__className === 'string') {
            name = constructor.__className;
        } else {
            if (is_prototype(obj)) {
                return '#<prototype>';
            }
            var fn = user_repr(obj);
            if (fn) {
                if (typeof fn === 'function') {
                    return fn(obj, quote);
                } else {
                    throw new Error('toString: Invalid repr value');
                }
            }
            name = constructor.name;
        }
        if (type(obj) === 'instance' && !isNativeFunction(constructor)) {
            name = 'instance';
        }
        if (root.HTMLElement && obj instanceof root.HTMLElement) {
            return `#<HTMLElement(${obj.tagName.toLowerCase()})>`;
        }
        if (name !== '') {
            return '#<' + name + '>';
        }
        if (typeof obj[Symbol.iterator] === 'function') {
            return '#<iterator>';
        }
        return '#<Object>';
    }
    if (typeof obj !== 'string') {
        return obj.toString();
    }
    return obj;
}
// ----------------------------------------------------------------------------
function is_prototype(obj) {
    return obj &&
        typeof obj === 'object' &&
        obj.hasOwnProperty &&
        obj.hasOwnProperty("constructor") &&
        typeof obj.constructor === "function" &&
        obj.constructor.prototype === obj;
}
// ----------------------------------------------------------------------------
Pair.prototype.markCycles = function() {
    markCycles(this);
    return this;
};

// ----------------------------------------------------------------------------
Pair.prototype.haveCycles = function(name = null) {
    if (!name) {
        return this.haveCycles('car') || this.haveCycles('cdr');
    }
    return !!(this.cycles && this.cycles[name]);
};

// ----------------------------------------------------------------------------
function markCycles(pair) {
    var seen_pairs = [];
    var cycles = [];
    var refs = [];
    function visit(pair) {
        if (!seen_pairs.includes(pair)) {
            seen_pairs.push(pair);
        }
    }
    function set(node, type, child, parents) {
        if (child instanceof Pair) {
            if (parents.includes(child)) {
                if (!refs.includes(child)) {
                    refs.push(child);
                }
                if (!node.cycles) {
                    node.cycles = {};
                }
                node.cycles[type] = child;
                if (!cycles.includes(node)) {
                    cycles.push(node);
                }
                return true;
            }
        }
    }
    const detect = trampoline(function detect_thunk(pair, parents) {
        if (pair instanceof Pair) {
            delete pair.ref;
            delete pair.cycles;
            visit(pair);
            parents.push(pair);
            var car = set(pair, 'car', pair.car, parents);
            var cdr = set(pair, 'cdr', pair.cdr, parents);
            if (!car) {
                detect(pair.car, parents.slice());
            }
            if (!cdr) {
                const cdr_args = [pair.cdr, parents.slice()];
                return new Thunk(() => {
                    return detect_thunk(...cdr_args);
                });
            }
        }
    });
    function mark_node(node, type) {
        if (node.cycles[type] instanceof Pair) {
            const count = ref_nodes.indexOf(node.cycles[type]);
            node.cycles[type] = `#${count}#`;
        }
    }
    detect(pair, []);
    var ref_nodes = seen_pairs.filter(node => refs.includes(node));
    ref_nodes.forEach((node, i) => {
        node.ref = `#${i}=`;
    });
    cycles.forEach(node => {
        mark_node(node, 'car');
        mark_node(node, 'cdr');
    });
}

// ----------------------------------------------------------------------
// trampoline based recursive pair to string that don't overflow the stack
// ----------------------------------------------------------------------
/* istanbul ignore next */
const pair_to_string = (function() {
    const prefix = (pair, nested) => {
        var result = [];
        if (pair.ref) {
            result.push(pair.ref + '(');
        } else if (!nested) {
            result.push('(');
        }
        return result;
    };
    const postfix = (pair, nested) => {
        if (is_debug()) {
            console.log({ ref: pair.ref, nested });
        }
        if (!nested || pair.ref) {
            return [')'];
        }
        return [];
    };
    return trampoline(function pairToString(pair, quote, extra = {}) {
        const {
            nested = false,
            result = [],
            cont = () => {
                result.push(...postfix(pair, nested));
            }
        } = extra;
        result.push(...prefix(pair, nested));
        let car;
        if (pair.cycles && pair.cycles.car) {
            car = pair.cycles.car;
        } else {
            car = toString(pair.car, quote, true, { result, cont });
        }
        if (car !== undefined) {
            result.push(car);
        }
        return new Thunk(() => {
            if (pair.cdr instanceof Pair) {
                if (pair.cycles && pair.cycles.cdr) {
                    result.push(' . ');
                    result.push(pair.cycles.cdr);
                } else {
                    if (pair.cdr.ref) {
                        result.push(' . ');
                    } else {
                        result.push(' ');
                    }
                    return pairToString(pair.cdr, quote, {
                        nested: true,
                        result,
                        cont
                    });
                }
            } else if (pair.cdr !== nil) {
                result.push(' . ');
                result.push(toString(pair.cdr, quote));
            }
        }, cont);
    });
})();

// ----------------------------------------------------------------------
Pair.prototype.toString = function(quote, { nested = false } = {}) {
    if (is_debug()) {
        var result = [];
        pair_to_string(this, quote, { result });
        return result.join('');
    }
    var arr = [];
    if (this.ref) {
        arr.push(this.ref + '(');
    } else if (!nested) {
        arr.push('(');
    }
    var value;
    if (this.cycles && this.cycles.car) {
        value = this.cycles.car;
    } else {
        value = toString(this.car, quote, true);
    }
    if (value !== undefined) {
        arr.push(value);
    }
    if (this.cdr instanceof Pair) {
        if (this.cycles && this.cycles.cdr) {
            arr.push(' . ');
            arr.push(this.cycles.cdr);
        } else {
            if (this.cdr.ref) {
                arr.push(' . ');
            } else {
                arr.push(' ');
            }
            const cdr = this.cdr.toString(quote, { nested: true });
            arr.push(cdr);
        }
    } else if (this.cdr !== nil) {
        arr = arr.concat([' . ', toString(this.cdr, quote, true)]);
    }
    if (!nested || this.ref) {
        arr.push(')');
    }
    return arr.join('');
};

// ----------------------------------------------------------------------
Pair.prototype.set = function(prop, value) {
    this[prop] = value;
    if (value instanceof Pair) {
        this.markCycles();
    }
};

// ----------------------------------------------------------------------
Pair.prototype.append = function(arg) {
    if (arg instanceof Array) {
        return this.append(Pair.fromArray(arg));
    }
    var p = this;
    if (p.car === undefined) {
        if (arg instanceof Pair) {
            this.car = arg.car;
            this.cdr = arg.cdr;
        } else {
            this.car = arg;
        }
    } else if (arg !== nil) {
        while (true) {
            if (p instanceof Pair && p.cdr !== nil) {
                p = p.cdr;
            } else {
                break;
            }
        }
        p.cdr = arg;
    }
    return this;
};

// ----------------------------------------------------------------------
// :: abs that work on BigInt
// ----------------------------------------------------------------------
function abs(x) {
    return x < 0 ? -x : x;
}
// ----------------------------------------------------------------------
function seq_compare(fn, args) {
    var [a, ...rest] = args;
    while (rest.length > 0) {
        var [b] = rest;
        if (!fn(a, b)) {
            return false;
        }
        [a, ...rest] = rest;
    }
    return true;
}

// ----------------------------------------------------------------------
function equal(x, y) {
    if (typeof x === 'function' && typeof y === 'function') {
        return unbind(x) === unbind(y);
    } else if (x instanceof LNumber && y instanceof LNumber) {
        let type;
        if (x.type === y.type) {
            if (x.type === 'complex') {
                type = x.im.type === y.im.type &&
                    x.re.type === y.re.type;
            } else {
                type = true;
            }
            return type && x.cmp(y) === 0;
        }
        return false;
    } else if (typeof x === 'number' || typeof y === 'number') {
        x = LNumber(x);
        y = LNumber(y);
        return x.type === y.type && x.cmp(y) === 0;
    } else if (x instanceof LCharacter && y instanceof LCharacter) {
        return x.char === y.char;
    } else if (x instanceof LSymbol && y instanceof LSymbol) {
        return x.name === y.name;
    } else {
        return x === y;
    }
}
// ----------------------------------------------------------------------
function same_atom(a, b) {
    if (type(a) !== type(b)) {
        return false;
    }
    if (!is_atom(a)) {
        return false;
    }
    if (a instanceof RegExp) {
        return a.source === b.source;
    }
    if (a instanceof LString) {
        return a.valueOf() === b.valueOf();
    }
    return equal(a, b);
}
// ----------------------------------------------------------------------
function is_atom(obj) {
    return obj instanceof LSymbol ||
        LString.isString(obj) ||
        obj instanceof LCharacter ||
        obj instanceof LNumber ||
        obj === true ||
        obj === false;
}
// ----------------------------------------------------------------------
var truncate = (function() {
    if (Math.trunc) {
        return Math.trunc;
    } else {
        return function(x) {
            if (x < 0) {
                return Math.ceil(x);
            } else {
                return Math.floor(x);
            }
        };
    }
})();

// ----------------------------------------------------------------------
const macro = 'define-macro';
// ----------------------------------------------------------------------
const recur_guard = -10000;
function macro_expand(single) {
    return async function(code, args) {
        var env = args['env'] = this;
        async function traverse(node, n, env) {
            if (node instanceof Pair && node.car instanceof LSymbol) {
                if (node.data) {
                    return node;
                }
                var value = env.get(node.car, { throwError: false });
                if (value instanceof Macro && value.defmacro) {
                    var code = value instanceof Syntax ? node : node.cdr;
                    var result = await value.invoke(code, args, true);
                    if (value instanceof Syntax) {
                        const { expr, scope } = result;
                        if (expr instanceof Pair) {
                            if (n !== -1 && n <= 1 || n < recur_guard) {
                                return expr;
                            }
                            n = n - 1;
                            return traverse(expr, n, scope);
                        }
                        result = expr;
                    }
                    if (result instanceof LSymbol) {
                        return quote(result);
                    }
                    if (result instanceof Pair) {
                        if (n !== -1 && n <= 1 || n < recur_guard) {
                            return result;
                        }
                        n = n - 1;
                        return traverse(result, n, env);
                    }
                }
            }
            // TODO: CYCLE DETECT
            var car = node.car;
            if (car instanceof Pair) {
                car = await traverse(car, n, env);
            }
            var cdr = node.cdr;
            if (cdr instanceof Pair) {
                cdr = await traverse(cdr, n, env);
            }
            var pair = new Pair(car, cdr);
            return pair;
        }
        //var new_code = code;
        if (single) {
            return quote((await traverse(code, 1, env)).car);
        } else {
            return quote((await traverse(code, -1, env)).car);
        }
    };
}
// ----------------------------------------------------------------------
// :: for usage in syntax-rule when pattern match it will return
// :: list of bindings from code that match the pattern
// :: TODO detect cycles
// ----------------------------------------------------------------------
function extract_patterns(pattern, code, symbols, ellipsis_symbol, scope = {}) {
    var bindings = {
        '...': {
            symbols: { }, // symbols ellipsis (x ...)
            lists: [ ]
        }
    };
    const { expansion, define } = scope;
    // pattern_names parameter is used to distinguish
    // multiple matches of ((x ...) ...) agains ((1 2 3) (1 2 3))
    // in loop we add x to the list so we know that this is not
    // duplicated ellipsis symbol
    function log(x) {
        /* istanbul ignore next */
        if (is_debug()) {
            console.log(x);
        }
    }
    log(symbols);
    /* eslint-disable complexity */
    function traverse(pattern, code, pattern_names = [], ellipsis = false) {
        log({
            code: code && toString(code, true),
            pattern: pattern && toString(pattern, true)
        });
        if (is_atom(pattern) && !(pattern instanceof LSymbol)) {
            return same_atom(pattern, code);
        }
        if (pattern instanceof LSymbol &&
            symbols.includes(pattern.valueOf())) {
            const ref = expansion.ref(code);
            // shadowing the indentifier works only with lambda and let
            if (LSymbol.is(code, pattern)) {
                if (typeof ref === 'undefined') {
                    return true;
                }
                return ref === define || ref === global_env;
            }
            return false;
        }
        // pattern (a b (x ...)) and (x ...) match nil
        if (pattern instanceof Pair &&
            pattern.car instanceof Pair &&
            pattern.car.cdr instanceof Pair &&
            LSymbol.is(pattern.car.cdr.car, ellipsis_symbol)) {
            log('>> 0');
            if (code === nil) {
                log({ pattern: pattern.toString() });
                if (pattern.car.car instanceof LSymbol) {
                    if (pattern.car.cdr instanceof Pair &&
                        LSymbol.is(pattern.car.cdr.car, ellipsis_symbol)) {
                        let name = pattern.car.car.valueOf();
                        const last = pattern.lastPair();
                        if (LSymbol.is(last.car, ellipsis_symbol)) {
                            bindings['...'].symbols[name] = null;
                            return true;
                        } else {
                            return false;
                        }
                    }
                    let name = pattern.car.car.valueOf();
                    if (bindings['...'].symbols[name]) {
                        throw new Error('syntax: named ellipsis can only ' +
                                        'appear onces');
                    }
                    bindings['...'].symbols[name] = code;
                }
            }
        }
        if (pattern instanceof Pair &&
            pattern.cdr instanceof Pair &&
            LSymbol.is(pattern.cdr.car, ellipsis_symbol)) {
            // pattern (... ???) - SRFI-46
            if (pattern.cdr.cdr !== nil) {
                if (pattern.cdr.cdr instanceof Pair) {
                    // if we have (x ... a b) we need to remove two from the end
                    const list_len = pattern.cdr.cdr.length();
                    let code_len = code.length();
                    let list = code;
                    while (code_len - 1 > list_len) {
                        list = list.cdr;
                        code_len--;
                    }
                    const rest = list.cdr;
                    list.cdr = nil;
                    if (!traverse(pattern.cdr.cdr, rest, pattern_names, ellipsis)) {
                        return false;
                    }
                }
            }
            if (pattern.car instanceof LSymbol) {
                let name = pattern.car.name;
                if (bindings['...'].symbols[name] &&
                    !pattern_names.includes(name) && !ellipsis) {
                    throw new Error('syntax: named ellipsis can only appear onces');
                }
                log('>> 1');
                if (code === nil) {
                    log('>> 2');
                    if (ellipsis) {
                        log('NIL');
                        bindings['...'].symbols[name] = nil;
                    } else {
                        log('NULL');
                        bindings['...'].symbols[name] = null;
                    }
                } else if (code instanceof Pair &&
                           (code.car instanceof Pair || code.car === nil)) {
                    log('>> 3 ' + ellipsis);
                    if (ellipsis) {
                        if (bindings['...'].symbols[name]) {
                            const node = bindings['...'].symbols[name];
                            bindings['...'].symbols[name] = node.append(
                                new Pair(code, nil)
                            );
                        } else {
                            bindings['...'].symbols[name] = new Pair(code, nil);
                        }
                    } else {
                        log('>> 4');
                        bindings['...'].symbols[name] = new Pair(code, nil);
                    }
                } else {
                    log('>> 6');
                    if (code instanceof Pair) {
                        log('>> 7 ' + ellipsis);
                        pattern_names.push(name);
                        if (!bindings['...'].symbols[name]) {
                            bindings['...'].symbols[name] = new Pair(
                                code,
                                nil
                            );
                        } else {
                            const node = bindings['...'].symbols[name];
                            bindings['...'].symbols[name] = node.append(
                                new Pair(
                                    code,
                                    nil
                                )
                            );
                        }
                        log({ IIIIII: bindings['...'].symbols[name].toString() });
                    } else {
                        log('>> 8');
                        return false;
                        //bindings['...'].symbols[name] = code;
                    }
                }
                return true;
            } else if (pattern.car instanceof Pair) {
                var names = [...pattern_names];
                if (code === nil) {
                    log('>> 9');
                    bindings['...'].lists.push(nil);
                    return true;
                }
                log('>> 10');
                let node = code;
                while (node instanceof Pair) {
                    if (!traverse(pattern.car, node.car, names, true)) {
                        return false;
                    }
                    node = node.cdr;
                }
                return true;
            }
            return false;
        }
        if (pattern instanceof LSymbol) {
            if (LSymbol.is(pattern, ellipsis_symbol)) {
                throw new Error('syntax: invalid usage of ellipsis');
            }
            log('>> 11');
            const name = pattern.name;
            if (symbols.includes(name)) {
                return true;
            }
            log({ name, ellipsis });
            if (ellipsis) {
                bindings['...'].symbols[name] = bindings['...'].symbols[name] || [];
                bindings['...'].symbols[name].push(code);
            }
            if (!bindings[name]) {
                bindings[name] = code;
            }
            return true;
        }
        if (pattern instanceof Pair && code instanceof Pair) {
            log('>> 12');
            log({
                a: 12,
                code: code && code.toString(),
                pattern: pattern.toString()
            });
            if (code.cdr === nil) {
                // last item in in call using in recursive calls on
                // last element of the list
                // case of pattern (p . rest) and code (0)
                var rest_pattern = pattern.car instanceof LSymbol &&
                    pattern.cdr instanceof LSymbol;
                if (rest_pattern) {
                    log('>> 12 | 1');
                    let name = pattern.cdr.valueOf();
                    if (!bindings[name]) {
                        bindings[name] = nil;
                    }
                    name = pattern.car.valueOf();
                    if (!bindings[name]) {
                        bindings[name] = code.car;
                    }
                    return true;
                }
            }
            log('recur');
            if (traverse(pattern.car, code.car, pattern_names, ellipsis) &&
                traverse(pattern.cdr, code.cdr, pattern_names, ellipsis)) {
                return true;
            }
        } else if (pattern === nil && (code === nil || code === undefined)) {
            // undefined is case when you don't have body ...
            // and you do recursive call
            return true;
        } else if (pattern.car instanceof Pair &&
                   LSymbol.is(pattern.car.car, ellipsis_symbol)) {
            // pattern (...)
            throw new Error('syntax: invalid usage of ellipsis');
        } else {
            return false;
        }
    }
    /* eslint-enable complexity */
    if (traverse(pattern, code)) {
        return bindings;
    }
}
// ----------------------------------------------------------------------
/*
  async function expand(code, args) {
  async function traverse(node, args) {
  if (!(node instanceof Pair)) {
  return { code: node, scope: args.env };
  }
  var result;
  if (node instanceof Pair && node.car instanceof LSymbol) {
  if (node.data) {
  return node;
  }
  var value = args.env.get(node.car, { throwError: false });
  if (value instanceof Syntax && value.defmacro) {
  var {
  expr: result,
  scope
  } = await value.invoke(node, args, true);
  if (result instanceof LSymbol) {
  return { scope, code: result };
  }
  if (result instanceof Pair) {
  return traverse(result, { ...args, env: scope });
  }
  }
  }
  var car = node.car;
  var scopes = [];
  if (car instanceof Pair) {
  result = await traverse(car, args);
  car = result.code;
  if (args.env !== result.scope) {
  scopes.push(result.scope);
  }
  }
  var cdr = node.cdr;
  if (cdr instanceof Pair) {
  result = await traverse(cdr, args);
  cdr = result.code;
  if (args.env !== result.scope) {
  scopes.push(result.scope);
  }
  }
  if (scopes.length) {
  scope = scopes.reduce((acc, scope) => {
  return acc.merge(scope);
  });
  } else {
  scope = args.env;
  }
  var pair = new Pair(car, cdr);
  return { code: pair, scope };
  }
  return traverse(code, args);
  }
*/
// ----------------------------------------------------------------------
// :: This function is called after syntax-rules macro is evaluated
// :: and if there are any gensyms added by macro they need to restored
// :: to original symbols
// ----------------------------------------------------------------------
function clear_gensyms(node, gensyms) {
    function traverse(node) {
        if (node instanceof Pair) {
            if (!gensyms.length) {
                return node;
            }
            const car = traverse(node.car);
            const cdr = traverse(node.cdr);
            // TODO: check if it's safe to modify the list
            //       some funky modify of code can happen in macro
            return new Pair(car, cdr);
        } else if (node instanceof LSymbol) {
            var replacement = gensyms.find((gensym) => {
                return gensym.gensym === node;
            });
            if (replacement) {
                return LSymbol(replacement.name);
            }
            return node;
        } else {
            return node;
        }
    }
    return traverse(node);
}
// ----------------------------------------------------------------------
function transform_syntax(options = {}) {
    const {
        bindings,
        expr,
        scope,
        symbols,
        names,
        ellipsis: ellipsis_symbol } = options;
    var gensyms = {};
    function transform(symbol) {
        if (!(symbol instanceof LSymbol || typeof symbol === 'string')) {
            throw new Error('syntax: internal error, rename neeed to be symbol');
        }
        const name = symbol.valueOf();
        if (name === ellipsis_symbol) {
            throw new Error('syntax: internal error, ellipis not transformed');
        }
        // symbols are gensyms from nested syntax-rules
        var type = typeof name;
        if (['string', 'symbol'].includes(type) && name in bindings) {
            return bindings[name];
        }
        if (symbols.includes(name)) {
            return LSymbol(name);
        }
        return rename(name);
    }
    function log(x) {
        /* istanbul ignore next */
        if (is_debug()) {
            console.log(x);
        }
    }
    function rename(name) {
        if (!gensyms[name]) {
            var ref = scope.ref(name);
            const gensym_name = LSymbol.gensym(name);
            if (ref) {
                const value = scope.get(name);
                scope.set(gensym_name, value);
            }
            // keep names so they can be restored after evaluation
            // if there are free symbols as output
            // kind of hack
            names.push({
                name, gensym: gensym_name
            });
            gensyms[name] = gensym_name;
        }
        return gensyms[name];
    }
    function transform_ellipsis_expr(expr, bindings, state, next = () => {}) {
        const { nested } = state;
        log(' ==> ' + expr.toString());
        if (expr instanceof LSymbol) {
            const name = expr.valueOf();
            log('[t 1');
            if (bindings[name]) {
                if (bindings[name] instanceof Pair) {
                    const { car, cdr } = bindings[name];
                    if (nested) {
                        const { car: caar, cdr: cadr } = car;
                        if (cadr !== nil) {
                            next(name, new Pair(cadr, nil));
                        }
                        return caar;
                    }
                    if (cdr !== nil) {
                        next(name, cdr);
                    }
                    return car;
                } else if (bindings[name] instanceof Array) {
                    next(name, bindings[name].slice(1));
                    return bindings[name][0];
                }
            }
            return transform(name);
        }
        if (expr instanceof Pair) {
            if (expr.car instanceof LSymbol &&
                expr.cdr instanceof Pair &&
                LSymbol.is(expr.cdr.car, ellipsis_symbol)) {
                log('[t 2');
                const name = expr.car.valueOf();
                const item = bindings[name];
                if (item === null) {
                    return;
                } else if (item) {
                    log({ b: bindings[name].toString() });
                    if (item instanceof Pair) {
                        log('[t 2 Pair ' + nested);
                        log({ ______: item.toString() });
                        const { car, cdr } = item;
                        if (nested) {
                            if (cdr !== nil) {
                                next(name, cdr);
                            }
                            return car;
                        } else {
                            if (car.cdr !== nil) {
                                next(name, new Pair(car.cdr, cdr));
                            }
                            return car.car;
                        }
                    } else if (item instanceof Array) {
                        log('[t 2 Array ' + nested);
                        if (nested) {
                            next(name, item.slice(1));
                            return Pair.fromArray(item);
                        } else {
                            const rest = item.slice(1);
                            if (rest.length) {
                                next(name, rest);
                            }
                            return item[0];
                        }
                    } else {
                        return item;
                    }
                }
            }
            log('[t 3 recur ' + expr.toString());
            const head = transform_ellipsis_expr(expr.car, bindings, state, next);
            const rest = transform_ellipsis_expr(expr.cdr, bindings, state, next);
            return new Pair(
                head,
                rest
            );
        }
        return expr;
    }
    function have_binding(biding, skip_nulls) {
        const values = Object.values(biding);
        const symbols = Object.getOwnPropertySymbols(biding);
        if (symbols.length) {
            values.push(...symbols.map(x => biding[x]));
        }
        return values.length && values.every(x => {
            if (x === null) {
                return !skip_nulls;
            }
            return x instanceof Pair || x === nil ||
                (x instanceof Array && x.length);
        });
    }
    function get_names(object) {
        return Object.keys(object).concat(Object.getOwnPropertySymbols(object));
    }
    function traverse(expr, { disabled } = {}) {
        log('>> ' + expr.toString());
        if (expr instanceof Pair) {
            // escape ellispsis from R7RS e.g. (... ...)
            if (!disabled && expr.car instanceof Pair &&
                LSymbol.is(expr.car.car, ellipsis_symbol)) {
                return traverse(expr.car.cdr, { disabled: true });
            }
            if (expr.cdr instanceof Pair &&
                LSymbol.is(expr.cdr.car, ellipsis_symbol) && !disabled) {
                log('>> 1');
                const symbols = bindings['...'].symbols;
                var keys = get_names(symbols);
                // case of list as first argument ((x . y) ...)
                // we need to recursively process the list
                // if we have pattern (_ (x y z ...) ...) and code (foo (1 2) (1 2))
                // x an y will be arrays of [1 1] and [2 2] and z will be array
                // of rest, x will also have it's own mapping to 1 and y to 2
                // in case of usage outside of ellipsis list e.g.: (x y)
                if (expr.car instanceof Pair) {
                    // lists is free ellipsis on pairs ((???) ...)
                    // TODO: will this work in every case? Do we need to handle
                    // nesting here?
                    if (bindings['...'].lists[0] === nil) {
                        return nil;
                    }
                    log('>> 2');
                    let result;
                    if (keys.length) {
                        log('>> 2 (a)');
                        let bind = { ...symbols };
                        result = nil;
                        while (true) {
                            if (!have_binding(bind)) {
                                break;
                            }
                            const new_bind = {};
                            const next = (key, value) => {
                                // ellipsis decide it what should be the next value
                                // there are two cases ((a . b) ...) and (a ...)
                                new_bind[key] = value;
                            };
                            const car = transform_ellipsis_expr(
                                expr.car,
                                bind,
                                { nested: true },
                                next
                            );
                            // undefined can be null caused by null binding
                            // on empty ellipsis
                            if (car !== undefined) {
                                result = new Pair(
                                    car,
                                    result
                                );
                            }
                            bind = new_bind;
                        }
                        if (result !== nil) {
                            result = result.reverse();
                        }
                        return result;
                    } else {
                        log('>> 3');
                        const car = transform_ellipsis_expr(expr.car, symbols, {
                            nested: true
                        });
                        if (car) {
                            return new Pair(
                                car,
                                nil
                            );
                        }
                        return nil;
                    }
                } else if (expr.car instanceof LSymbol) {
                    log('>> 4');
                    // case: (x ...)
                    let name = expr.car.name;
                    let bind = { [name]: symbols[name] };
                    const is_null = symbols[name] === null;
                    let result = nil;
                    while (true) {
                        if (!have_binding(bind, true)) {
                            log({ bind });
                            break;
                        }
                        const new_bind = {};
                        const next = (key, value) => {
                            new_bind[key] = value;
                        };
                        const value = transform_ellipsis_expr(
                            expr,
                            bind,
                            { nested: false },
                            next
                        );
                        if (typeof value !== 'undefined') {
                            result = new Pair(
                                value,
                                result
                            );
                        }
                        bind = new_bind;
                    }
                    if (result !== nil) {
                        result = result.reverse();
                    }
                    // case if (x ... y ...) second spread is not processed
                    // and (??? . x) last symbol
                    // by ellipsis transformation
                    if (expr.cdr instanceof Pair) {
                        if (expr.cdr.cdr instanceof Pair ||
                            expr.cdr.cdr instanceof LSymbol) {
                            const node = traverse(expr.cdr.cdr, { disabled });
                            if (is_null) {
                                return node;
                            }
                            result.append(node);
                        }
                    }
                    return result;
                }
            }
            const head = traverse(expr.car, { disabled });
            const rest = traverse(expr.cdr, { disabled });
            log({
                a: true,
                head: head && head.toString(),
                rest: rest && rest.toString()
            });
            return new Pair(
                head,
                rest
            );
        }
        if (expr instanceof LSymbol) {
            if (disabled && LSymbol.is(expr, ellipsis_symbol)) {
                return expr;
            }
            const value = transform(expr, { disabled });
            if (typeof value !== 'undefined') {
                return value;
            }
        }
        return expr;
    }
    return traverse(expr, {});
}
// ----------------------------------------------------------------------
// :: check for nullish values
// ----------------------------------------------------------------------
function isNull(value) {
    return typeof value === 'undefined' || value === nil || value === null;
}
// ----------------------------------------------------------------------
function isPromise(o) {
    return o instanceof Promise ||
        (o && typeof o !== 'undefined' && typeof o.then === 'function');
}
// ----------------------------------------------------------------------
// :: Function utilities
// ----------------------------------------------------------------------
function box(object) {
    switch (typeof object) {
        case 'string':
            return LString(object);
        case 'number':
            if (!Number.isNaN(object)) {
                return LNumber(object);
            }
    }
    return object;
}
// ----------------------------------------------------------------------
function unbox(obj) {
    var lips_type = [LString, LCharacter, LNumber].some(x => obj instanceof x);
    if (lips_type) {
        return obj.valueOf();
    }
    return obj;
}
// ----------------------------------------------------------------------
function patchValue(value, context) {
    if (value instanceof Pair) {
        value.markCycles();
        return quote(value);
    }
    if (typeof value === 'function') {
        // original function can be restored using unbind function
        // only real JS function require to be bound
        if (context) {
            return bind(value, context);
        }
    }
    return box(value);
}
// ----------------------------------------------------------------------
// :: function get original function that was binded with props
// ----------------------------------------------------------------------
function unbind(obj) {
    if (is_bound(obj)) {
        return obj[__fn__];
    }
    return obj;
}
// ----------------------------------------------------------------------
// :: function bind with contex that can be optionaly unbind
// :: get original function with unbind
// ----------------------------------------------------------------------
function bind(fn, context) {
    if (fn[Symbol.for('__bound__')]) {
        return fn;
    }
    const bound = fn.bind(context);
    const props = Object.getOwnPropertyNames(fn).filter(filterFnNames);
    props.forEach(prop => {
        try {
            bound[prop] = fn[prop];
        } catch (e) {
            // ignore error from express.js while accessing bodyParser
        }
    });
    hiddenProp(bound, '__fn__', fn);
    hiddenProp(bound, '__context__', context);
    hiddenProp(bound, '__bound__', true);
    if (isNativeFunction(fn)) {
        hiddenProp(bound, '__native__', true);
    }
    bound.valueOf = function() {
        return fn;
    };
    return bound;
}
// ----------------------------------------------------------------------
function is_bound(obj) {
    return !!(typeof obj === 'function' && obj[__fn__]);
}
// ----------------------------------------------------------------------
function lips_context(obj) {
    if (typeof obj === 'function') {
        var context = obj[__context__];
        if (context && (context === lips ||
                        (context.constructor &&
                         context.constructor.__className))) {
            return true;
        }
    }
    return false;
}
// ----------------------------------------------------------------------
function is_port(obj) {
    function port(obj) {
        return obj instanceof InputPort || obj instanceof OutputPort;
    }
    if (typeof obj === 'function') {
        if (port(obj)) {
            return true;
        }
        if (port(obj[__context__])) {
            return true;
        }
    }
    return false;
}
// ----------------------------------------------------------------------
var __context__ = Symbol.for('__context__');
var __fn__ = Symbol.for('__fn__');
// ----------------------------------------------------------------------
// :: function bind fn with context but it also move all props
// :: mostly used for Object function
// ----------------------------------------------------------------------
var exludedNames = ['name', 'length', 'caller', 'callee', 'arguments', 'prototype'];
function filterFnNames(name) {
    return !exludedNames.includes(name);
}
// ----------------------------------------------------------------------
function hiddenProp(obj, name, value) {
    Object.defineProperty(obj, Symbol.for(name), {
        get: () => value,
        set: () => {},
        configurable: false,
        enumerable: false
    });
}
// ----------------------------------------------------------------------
function setFnLength(fn, length) {
    try {
        Object.defineProperty(fn, 'length', {
            get: function() {
                return length;
            }
        });
        return fn;
    } catch (e) {
        // hack that create function with specific length should work for browsers
        // that don't support Object.defineProperty like old IE
        var args = new Array(length).fill(0).map((_, i) => 'a' + i).join(',');
        var wrapper = new Function(`f`, `return function(${args}) {
                return f.apply(this, arguments);
            };`);
        return wrapper(fn);
    }
}
// ----------------------------------------------------------------------
function isNativeFunction(fn) {
    var native = Symbol.for('__native__');
    return typeof fn === 'function' &&
        fn.toString().match(/\{\s*\[native code\]\s*\}/) &&
        ((fn.name.match(/^bound /) && fn[native] === true) ||
         (!fn.name.match(/^bound /) && !fn[native]));
}
// ----------------------------------------------------------------------
// :: function that return macro for let, let* and letrec
// ----------------------------------------------------------------------
function let_macro(symbol) {
    var name;
    switch (symbol) {
        case Symbol.for('letrec'):
            name = 'letrec';
            break;
        case Symbol.for('let'):
            name = 'let';
            break;
        case Symbol.for('let*'):
            name = 'let*';
            break;
        default:
            throw new Error('Invalid let_macro value');
    }
    return Macro.defmacro(name, function(code, options) {
        var { dynamic_scope, error, macro_expand } = options;
        var args;
        // named let:
        // (let iter ((x 10)) (iter (- x 1))) -> (let* ((iter (lambda (x) ...
        if (code.car instanceof LSymbol) {
            if (!(code.cdr.car instanceof Pair || code.cdr.car === nil)) {
                throw new Error('let require list of pairs');
            }
            var params;
            if (code.cdr.car === nil) {
                args = nil;
                params = nil;
            } else {
                params = code.cdr.car.map(pair => pair.car);
                args = code.cdr.car.map(pair => pair.cdr.car);
            }
            return Pair.fromArray([
                LSymbol('letrec'),
                [[code.car, Pair(
                    LSymbol('lambda'),
                    Pair(params, code.cdr.cdr))]],
                Pair(code.car, args)
            ]);
        } else if (macro_expand) {
            // Macro.defmacro are special macros that should return lisp code
            // here we use evaluate, so we need to check special flag set by
            // macroexpand to prevent evaluation of code in normal let
            return;
        }
        var self = this;
        args = this.get('list->array')(code.car);
        var env = self.inherit(name);
        var values, var_body_env;
        if (name === 'let*') {
            var_body_env = env;
        } else if (name === 'let') {
            values = []; // collect potential promises
        }
        var i = 0;
        function exec() {
            var output = new Pair(new LSymbol('begin'), code.cdr);
            return evaluate(output, {
                env,
                dynamic_scope,
                error
            });
        }
        return (function loop() {
            var pair = args[i++];
            if (dynamic_scope) {
                dynamic_scope = name === 'let*' ? env : self;
            }
            if (!pair) {
                // resolve all promises
                if (values && values.length) {
                    var v = values.map(x => x.value);
                    var promises = v.filter(isPromise);
                    if (promises.length) {
                        return Promise.all(v).then((arr) => {
                            for (var i = 0, len = arr.length; i < len; ++i) {
                                env.set(values[i].name, arr[i]);
                            }
                        }).then(exec);
                    } else {
                        values.forEach(({ name, value }) => {
                            env.set(name, value);
                        });
                    }
                }
                return exec();
            } else {
                if (name === 'let') {
                    var_body_env = self;
                } else if (name === 'letrec') {
                    var_body_env = env;
                }
                var value = evaluate(pair.cdr.car, {
                    env: var_body_env,
                    dynamic_scope,
                    error
                });
                if (name === 'let*') {
                    var_body_env = env = var_body_env.inherit('let*[' + i + ']');
                }
                if (values) {
                    values.push({ name: pair.car, value });
                    return loop();
                } else {
                    return unpromise(value, function(value) {
                        env.set(pair.car, value);
                        return loop();
                    });
                }
            }
        })();
    });
}
// -------------------------------------------------------------------------
function pararel(name, fn) {
    return new Macro(name, function(code, { dynamic_scope, error } = {}) {
        var env = this;
        if (dynamic_scope) {
            dynamic_scope = this;
        }
        var node = code;
        var results = [];
        while (node instanceof Pair) {
            results.push(evaluate(node.car, { env, dynamic_scope, error }));
            node = node.cdr;
        }
        var havePromises = results.filter(isPromise).length;
        if (havePromises) {
            return Promise.all(results).then(fn.bind(this));
        } else {
            return fn.call(this, results);
        }
    });
}
// -------------------------------------------------------------------------
function guardMathCall(fn, ...args) {
    args.forEach(arg => {
        typecheck('', arg, 'number');
    });
    return fn(...args);
}
// ----------------------------------------------------------------------
function pipe(...fns) {
    fns.forEach((fn, i) => {
        typecheck('pipe', fn, 'function', i + 1);
    });
    return function(...args) {
        return fns.reduce((args, f) => [f(...args)], args)[0];
    };
}
// -------------------------------------------------------------------------
function compose(...fns) {
    fns.forEach((fn, i) => {
        typecheck('compose', fn, 'function', i + 1);
    });
    return pipe(...fns.reverse());
}
// -------------------------------------------------------------------------
// :: fold functions generator
// -------------------------------------------------------------------------
function fold(name, fold) {
    var self = this;
    return function recur(fn, init, ...lists) {
        typecheck(name, fn, 'function');
        if (lists.some(isNull)) {
            if (typeof init === 'number') {
                return LNumber(init);
            }
            return init;
        } else {
            return fold.call(self, recur, fn, init, ...lists);
        }
    };
}
// -------------------------------------------------------------------------
function limitMathOp(n, fn) {
    // + 1 so it inlcude function in guardMathCall
    return limit(n + 1, curry(guardMathCall, fn));
}
// -------------------------------------------------------------------------
// some functional magic
var singleMathOp = curry(limitMathOp, 1);
var binaryMathOp = curry(limitMathOp, 2);
// -------------------------------------------------------------------------
function reduceMathOp(fn, init = null) {
    return function(...args) {
        if (init !== null) {
            args = [init, ...args];
        }
        return args.reduce(binaryMathOp(fn));
    };
}
// -------------------------------------------------------------------------
function curry(fn, ...init_args) {
    typecheck('curry', fn, 'function');
    var len = fn.length;
    return function() {
        var args = init_args.slice();
        function call(...more_args) {
            args = args.concat(more_args);
            if (args.length >= len) {
                return fn.apply(this, args);
            } else {
                return call;
            }
        }
        return call.apply(this, arguments);
    };
}
// -------------------------------------------------------------------------
// return function with limited number of arguments
function limit(n, fn) {
    typecheck('limit', fn, 'function', 2);
    return function(...args) {
        return fn(...args.slice(0, n));
    };
}
// -------------------------------------------------------------------------------
var native_lambda = parse(tokenize(`(lambda ()
                                          "[native code]"
                                          (throw "Invalid Invocation"))`))[0];
// -------------------------------------------------------------------------------
var get = doc(function get(object, ...args) {
    if (typeof object === 'function') {
        object = unbind(object);
    }
    var value;
    var len = args.length;
    while (args.length) {
        var arg = args.shift();
        var name = unbox(arg);
        if (name === '__code__' && typeof object === 'function' &&
            typeof object.__code__ === 'undefined') {
            value = native_lambda.clone();
        } else {
            value = object[name];
        }
        if (typeof value === 'undefined') {
            if (args.length) {
                throw new Error(`Try to get ${args[0]} from undefined`);
            }
            return value;
        } else {
            var context;
            if (args.length - 1 < len) {
                context = object;
            }
            value = patchValue(value, context);
        }
        object = value;
    }
    return value;
}, `(. obj . args)
        (get obj . args)

        Function use object as based and keep using arguments to get the
        property of JavaScript object. Arguments need to be a strings.
        e.g. \`(. console "log")\` if you use any function inside LIPS is
        will be weakly bind (can be rebind), so you can call this log function
        without problem unlike in JavaScript when you use
       \`var log = console.log\`.
       \`get\` is an alias because . don't work in every place, you can't
        pass it as argument`);


// -------------------------------------------------------------------------
// :: source: Kawa gnu.math.RatNum.java
// :: This algorithm is by Alan Bawden. It has been transcribed
// :: with permission from Kawa copyright M.A. Bothner.
// :: which was transcribed from from C-Gambit, copyright Marc Feeley.
// -------------------------------------------------------------------------
function rationalize(x, y) {
    var a = x.sub(y);
    var b = x.add(y);
    var result;
    if (a.cmp(b) > 0) {
        result = simplest_rational2(b, a);
    } else if (b.cmp(a) <= 0) {
        result = a;
    } else if (a.cmp(0) > 0) {
        result = simplest_rational2(a, b);
    } else if (y.cmp(0) < 0) {
        result = LNumber(simplest_rational2(b.sub(), a.sub())).sub();
    } else {
        result = LNumber(0);
    }
    if (LNumber.isFloat(y) || LNumber.isFloat(x)) {
        return LFloat(result);
    }
    return result;
}
// -------------------------------------------------------------------------
function simplest_rational2(x, y) {
    var fx = LNumber(x).floor();
    var fy = LNumber(y).floor();
    if (x.cmp(fx) < 1) {
        return fx;
    } else if (fx.cmp(fy) === 0) {
        var n = LNumber(1).div(y.sub(fy));
        var d = LNumber(1).div(x.sub(fx));
        return fx.add(LNumber(1).div(simplest_rational2(n, d)));
    } else {
        return fx.add(LNumber(1));
    }
}

// -------------------------------------------------------------------------
// :: Port abstration (used only for it's type - old code used inline objects)
// -------------------------------------------------------------------------
function InputPort(read) {
    if (typeof this !== 'undefined' && !(this instanceof InputPort) ||
        typeof this === 'undefined') {
        return new InputPort(read);
    }
    typecheck('InputPort', read, 'function');
    this._index = 0;
    this._in_char = 0;
    this.read = read;
}
InputPort.prototype.read_line = function() {
    return this.read();
};
InputPort.prototype.get_next_tokens = function() {
    if (!this._tokens) {
        this._tokens = tokenize(this._string);
    }
    if (typeof this._tokens[this._index] === 'undefined') {
        return eof;
    }
    var balancer = 0;
    var result = [];
    var parens = ['(', ')', '[', ']'];
    if (!parens.includes(this._tokens[this._index])) {
        return this._tokens[this._index++];
    }
    do {
        var token = this._tokens[this._index];
        result.push(this._tokens[this._index]);
        if (token === ')' || token === ']') {
            balancer--;
        } else if (token === '(' || token === '[') {
            balancer++;
        }
        this._index++;
    } while (balancer !== 0);
    return result;
};
InputPort.prototype.read_char = function() {
    var char = this.peek_char();
    if (char !== eof) {
        this._in_char++;
    }
    return char;
};
InputPort.prototype.peek_char = function() {
    if (this._in_char >= this._string.length) {
        return eof;
    }
    return LCharacter(this._string[this._in_char]);
};
// -------------------------------------------------------------------------
function OutputPort(write) {
    if (typeof this !== 'undefined' && !(this instanceof OutputPort) ||
        typeof this === 'undefined') {
        return new OutputPort(write);
    }
    typecheck('OutputPort', write, 'function');
    this.write = write;
}
OutputPort.prototype.toString = function() {
    return '<#output-port>';
};
// -------------------------------------------------------------------------
function OutputStringPort(toString) {
    if (typeof this !== 'undefined' && !(this instanceof OutputStringPort) ||
        typeof this === 'undefined') {
        return new OutputStringPort(toString);
    }
    typecheck('OutputStringPort', toString, 'function');
    this._buffer = [];
    this.write = (x) => {
        if (!LString.isString(x)) {
            x = toString(x);
        } else {
            x = x.valueOf();
        }
        this._buffer.push(x);
    };
}
OutputStringPort.prototype = Object.create(OutputPort.prototype);
OutputStringPort.prototype.getString = function() {
    return this._buffer.map(x => x.valueOf()).join('');
};
OutputStringPort.prototype.constructor = OutputStringPort;
// -------------------------------------------------------------------------
function InputStringPort(string) {
    if (typeof this !== 'undefined' && !(this instanceof InputStringPort) ||
        typeof this === 'undefined') {
        return new InputStringPort(string);
    }
    typecheck('InputStringPort', string, 'string');
    this._string = string.valueOf();
    this._index = 0;
    this._in_char = 0;
    this.read = () => {
        return this.get_next_tokens();
    };
}
InputStringPort.prototype = Object.create(InputPort.prototype);
InputStringPort.prototype.constructor = InputStringPort;
InputStringPort.prototype.read_line = function() {
    var after = this._string.substring(this._in_char);
    if (!after) {
        return eof;
    }
    var line = after.match(/([^\n])(?:\n|$)/)[0];
    this._in_char += line.length;
    return line;
};
// -------------------------------------------------------------------------
var eof = new EOF();
function EOF() {}
EOF.prototype.toString = function() {
    return '<#eof>';
};
// -------------------------------------------------------------------------
// simpler way to create interpreter with interaction-environment
// -------------------------------------------------------------------------
function Interpreter(name, obj = {}) {
    if (typeof this !== 'undefined' && !(this instanceof Interpreter) ||
        typeof this === 'undefined') {
        return new Interpreter(name, obj);
    }
    if (typeof name === 'undefined') {
        name = 'anonymous';
    }
    this.env = user_env.inherit(name, obj);
    const defaults_name = '**interaction-environment-defaults**';
    this.env.set(defaults_name, get_props(obj).concat(defaults_name));
}
// -------------------------------------------------------------------------
Interpreter.prototype.exec = function(code, dynamic = false, env = null) {
    typecheck('Intepreter::exec', code, 'string', 1);
    typecheck('Intepreter::exec', dynamic, 'boolean', 2);
    // simple solution to overwrite this variable in each interpreter
    // before evaluation of user code
    global_env.set('**interaction-environment**', this.env);
    if (env === null) {
        env = this.env;
    }
    return exec(code, env, dynamic ? env : false);
};
// -------------------------------------------------------------------------
Interpreter.prototype.get = function(value) {
    return this.env.get(value).bind(this.env);
};
// -------------------------------------------------------------------------
Interpreter.prototype.set = function(name, value) {
    return this.env.set(name, value);
};
// -------------------------------------------------------------------------
// :: Environment constructor (parent and name arguments are optional)
// -------------------------------------------------------------------------
function Environment(obj, parent, name) {
    if (arguments.length === 1) {
        if (typeof arguments[0] === 'object') {
            obj = arguments[0];
            this.parent = null;
        } else if (typeof arguments[0] === 'string') {
            obj = {};
            parent = {};
            name = arguments[0];
        }
    }
    this.docs = new Map();
    this.env = obj;
    this.parent = parent;
    this.name = name || 'anonymous';
}
// -------------------------------------------------------------------------
Environment.prototype.list = function() {
    return get_props(this.env);
};
// -------------------------------------------------------------------------
Environment.prototype.unset = function(name) {
    if (name instanceof LSymbol) {
        name = name.valueOf();
    }
    if (name instanceof LString) {
        name = name.valueOf();
    }
    delete this.env[name];
};
// -------------------------------------------------------------------------
Environment.prototype.inherit = function(name, obj = {}) {
    if (typeof name === "object") {
        obj = name;
    }
    if (!name || typeof name === "object") {
        name = 'child of ' + (this.name || 'unknown');
    }
    return new Environment(obj || {}, this, name);
};
// -------------------------------------------------------------------------
// :: lookup function for variable doc strings
// -------------------------------------------------------------------------
Environment.prototype.doc = function(name, value = null) {
    if (name instanceof LSymbol) {
        name = name.name;
    }
    if (name instanceof LString) {
        name = name.valueOf();
    }
    if (value) {
        this.docs.set(name, value);
        return this;
    }
    if (this.docs.has(name)) {
        return this.docs.get(name);
    }
    if (this.parent) {
        return this.parent.doc(name);
    }
};
// -------------------------------------------------------------------------
// :: function create frame environment for usage in functions
// -------------------------------------------------------------------------
Environment.prototype.newFrame = function(fn, args) {
    var frame = this.inherit('__frame__');
    frame.set('parent.frame', doc(function(n = 1) {
        var scope = frame.parent;
        if (!(scope instanceof Environment)) {
            return nil;
        }
        if (n <= 0) {
            return scope;
        }
        var parent_frame = scope.get('parent.frame');
        return parent_frame(n - 1);
    }, global_env.env['parent.frame'].__doc__));
    args.callee = fn;
    frame.set('arguments', args);
    return frame;
};
// -------------------------------------------------------------------------
Environment.prototype._lookup = function(symbol) {
    if (symbol instanceof LSymbol) {
        symbol = symbol.name;
    }
    if (symbol instanceof LString) {
        symbol = symbol.valueOf();
    }
    if (this.env.hasOwnProperty(symbol)) {
        return Value(this.env[symbol]);
    }
    if (this.parent) {
        return this.parent._lookup(symbol);
    }
};
// -------------------------------------------------------------------------
Environment.prototype.toString = function() {
    return '<#env:' + this.name + '>';
};
// -------------------------------------------------------------------------
Environment.prototype.clone = function() {
    // duplicate refs
    var env = {};
    Object.keys(this.env).forEach(key => {
        env[key] = this.env[key];
    });
    return new Environment(env, this.parent, this.name);
};
Environment.prototype.merge = function(env, name = 'merge') {
    typecheck('Environment::merge', env, 'environment');
    return this.inherit(name, env.env);
};
// -------------------------------------------------------------------------
// value returned in lookup if found value in env
// -------------------------------------------------------------------------
function Value(value) {
    if (typeof this !== 'undefined' && !(this instanceof Value) ||
        typeof this === 'undefined') {
        return new Value(value);
    }
    this.value = value;
}
// -------------------------------------------------------------------------
Value.isUndefined = function(x) {
    return x instanceof Value && typeof x.value === 'undefined';
};
// -------------------------------------------------------------------------
Value.prototype.valueOf = function() {
    return this.value;
};

// -------------------------------------------------------------------------
Environment.prototype.get = function(symbol, options = {}) {
    // we keep original environment as context for bind
    // so print will get user stdout
    const { throwError = true } = options;
    var name = symbol;
    if (name instanceof LSymbol || name instanceof LString) {
        name = name.valueOf();
    }
    var value = this._lookup(name);
    if (value instanceof Value) {
        if (Value.isUndefined(value)) {
            return undefined;
        }
        return patchValue(value.valueOf());
    }
    if (typeof name === 'string') {
        var parts = name.split('.').filter(Boolean);
        if (parts.length > 0) {
            var [first, ...rest] = parts;
            value = this._lookup(first);
            if (rest.length) {
                try {
                    if (value instanceof Value) {
                        value = value.valueOf();
                    } else {
                        value = get(root, first);
                        if (typeof value === 'function') {
                            value = unbind(value);
                        }
                    }
                    return get(value, ...rest);
                } catch (e) {
                    // ignore symbols in expansion that look like
                    // property access e.g. %as.data
                }
            } else if (value instanceof Value) {
                return patchValue(value.valueOf());
            }
        }
        value = get(root, name);
    }
    if (typeof value !== 'undefined') {
        return value;
    }
    if (throwError) {
        throw new Error("Unbound variable `" + name.toString() + "'");
    }
};
// -------------------------------------------------------------------------
Environment.prototype.set = function(name, value, doc = null) {
    if (LNumber.isNumber(value)) {
        value = LNumber(value);
    }
    if (name instanceof LSymbol) {
        name = name.name;
    }
    if (name instanceof LString) {
        name = name.valueOf();
    }
    this.env[name] = value;
    if (doc) {
        this.doc(name, doc);
    }
    return this;
};
// -------------------------------------------------------------------------
Environment.prototype.has = function(name) {
    return this.env.hasOwnProperty(name);
};
// -------------------------------------------------------------------------
Environment.prototype.ref = function(name) {
    var env = this;
    while (true) {
        if (!env) {
            break;
        }
        if (env.has(name)) {
            return env;
        }
        env = env.parent;
    }
};
// -------------------------------------------------------------------------
Environment.prototype.parents = function() {
    var env = this;
    var result = [];
    while (env) {
        result.unshift(env);
        env = env.parent;
    }
    return result;
};
// -------------------------------------------------------------------------
// :: Quote funtion used to pause evaluation from Macro
// -------------------------------------------------------------------------
function quote(value) {
    if (isPromise(value)) {
        return value.then(quote);
    }
    if (value instanceof Pair || value instanceof LSymbol) {
        value.data = true;
    }
    return value;
}
// -------------------------------------------------------------------------
// :: Unquote is used for multiple backticks and unquote
// -------------------------------------------------------------------------
function Unquote(value, count, max) {
    this.value = value;
    this.count = count;
    this.max = max;
}
Unquote.prototype.toString = function() {
    return '<#unquote[' + this.count + '] ' + this.value + '>';
};
// -------------------------------------------------------------------------
var global_env = new Environment({
    nil: nil,
    'undefined': undefined,
    'true': true,
    'false': false,
    'null': null,
    'NaN': NaN,
    // ------------------------------------------------------------------
    stdout: new OutputPort(function(...args) {
        console.log(...args);
    }),
    // ------------------------------------------------------------------
    stdin: InputPort(function() {
        return new Promise((resolve) => {
            resolve(prompt(''));
        });
    }),
    // ------------------------------------------------------------------
    'open-input-string': doc(function(string) {
        typecheck('open-input-string', string, 'string');
        return InputStringPort(string);
    }, `(open-input-string string)

            Function create new string port as input that can be used to
            read S-exressions from this port using \`read\` function.`),
    // ------------------------------------------------------------------
    'output-port?': doc(function(x) {
        return x instanceof OutputPort;
    }, `(output-port? arg)

            Function return true if argument is output port.`),
    // ------------------------------------------------------------------
    'input-port?': doc(function(x) {
        return x instanceof InputPort;
    }, `(input-port? arg)

            Function return true if argument is input port.`),
    // ------------------------------------------------------------------
    'open-output-string': doc(function() {
        return OutputStringPort(this.get('repr'));
    }, `(open-output-string)

            Function create new output port that can used to write string into
            and after finish get the whole string using \`get-output-string\``),
    // ------------------------------------------------------------------
    'get-output-string': doc(function(port) {
        typecheck('get-output-string', port, 'output-string-port');
        return port.getString();
    }, `(get-output-string port)

            Function get full string from string port. If nothing was wrote
            to given port it will return empty string.`),
    // ------------------------------------------------------------------
    'eof-object?': doc(function(x) {
        return x === eof;
    }, `(eof-object? arg)

            Function check if value is eof object, returned from input string
            port when there are no more data to read.`),
    // ------------------------------------------------------------------
    'peek-char': doc(function(port) {
        typecheck('peek-char', port, ['input-port', 'input-string-port']);
        return port.peek_char();
    }, `(peek-char port)

            Function get character from string port or EOF object if no more
            data in string port.`),
    // ------------------------------------------------------------------
    'read-line': doc(function(port) {
        if (typeof port === 'undefined') {
            port = this.get('stdin');
        }
        typecheck('read-line', port, ['input-port', 'input-string-port']);
        return port.read_line();
    }, `(read-char port)

            Function read next character from input port.`),
    // ------------------------------------------------------------------
    'read-char': doc(function(port) {
        if (typeof port === 'undefined') {
            port = this.get('stdin');
        }
        typecheck('read-char', port, ['input-port', 'input-string-port']);
        return port.read_char();
    }, `(read-char port)

            Function read next character from input port.`),
    // ------------------------------------------------------------------
    read: doc(function read(arg) {
        if (LString.isString(arg)) {
            return parse(tokenize(arg.valueOf()))[0];
        }
        var port;
        if (arg instanceof InputPort) {
            port = arg;
        } else {
            port = this.get('stdin');
        }
        return unpromise(port.read(), function(result) {
            if (result === eof) {
                return eof;
            }
            return parse(result)[0];
        });
    }, `(read [string])

            Function if used with string will parse the string and return
            list structure of LIPS code. If called without an argument it
            will read string from standard input (using browser prompt or
            user defined way) and call itself with that string (parse is)
            function can be used together with eval to evaluate code from
            string`),
    // ------------------------------------------------------------------
    pprint: doc(function(arg) {
        if (arg instanceof Pair) {
            arg = new lips.Formatter(arg.toString(true)).break().format();
            this.get('display').call(this, arg);
        } else {
            this.get('write').call(this, arg);
        }
        this.get('newline').call(this);
    }, `(pprint expression)

           Pretty print list expression, if called with non-pair it just call
           print function with passed argument.`),
    // ------------------------------------------------------------------
    print: doc(function(...args) {
        const display = this.get('display');
        const newline = this.get('newline');
        args.forEach(arg => {
            display.call(this, arg);
            newline.call(this);
        });
    }, `(print . args)

            Function convert each argument to string and print the result to
            standard output (by default it's console but it can be defined
            it user code), the function call newline after printing each arg.`),
    // ------------------------------------------------------------------
    'format': doc(function format(str, ...args) {
        typecheck('format', str, 'string');
        const re = /(~[as%~])/g;
        let m = str.match(/(~[as])/g);
        if (m && m.length > args.length) {
            throw new Error('Not enough arguments');
        }
        var i = 0;
        var repr = this.get('repr');
        str = str.replace(re, (x) => {
            const chr = x[1];
            if (chr === '~') {
                return '~';
            } else if (chr === '%') {
                return '\n';
            } else {
                const arg = args[i++];
                if (chr === 'a') {
                    return repr(arg);
                } else {
                    return repr(arg, true);
                }
            }
        });
        m = str.match(/~([\S])/);
        if (m) {
            throw new Error(`format: Unrecognized escape seqence ${m[1]}`);
        }
        return str;
    }, `(format string n1 n2 ...)

            Function accepts string template and replacing any escape sequences
            by arguments:

            * ~a value as if printed with display
            * ~s value as if printed with write
            * ~% newline character
            * ~~ literal tilde '~' is inserted

            if there missing arguments or other escape character it throw exception.`),
    // ------------------------------------------------------------------
    display: doc(function(arg, port = null) {
        if (port === null) {
            port = this.get('stdout');
        }
        port.write.call(this, this.get('repr')(arg));
    }, `(display arg [port])

            Function send string to standard output or provied port.`),
    // ------------------------------------------------------------------
    error: doc(function(...args) {
        this.get('display').apply(this, args);
    }, `(error . args)

            Display error message.`),
    // ------------------------------------------------------------------
    '%same-functions': doc(function(a, b) {
        if (typeof a !== 'function') {
            return false;
        }
        if (typeof b !== 'function') {
            return false;
        }
        return unbind(a) === unbind(b);
    }, `(%same-functions a b)

            Helper function that check if two bound functions are the same`),
    // ------------------------------------------------------------------
    help: doc(new Macro('help', function(code, { dynamic_scope, error }) {
        var symbol;
        if (code.car instanceof LSymbol) {
            symbol = code.car;
        } else if (code.car instanceof Pair && code.car.car instanceof LSymbol) {
            symbol = code.car.car;
        } else {
            var env = this;
            if (dynamic_scope) {
                dynamic_scope = this;
            }
            var ret = evaluate(code.car, { env, error, dynamic_scope });
            if (ret && ret.__doc__) {
                return ret.__doc__;
            }
            return;
        }
        // TODO: print the string with display
        //       remove monkey patches in REPL
        var __doc__;
        var value = this.get(symbol);
        __doc__ = value && value.__doc__;
        if (__doc__) {
            return __doc__;
        }
        var ref = this.ref(symbol);
        if (ref) {
            __doc__ = ref.doc(symbol);
            if (__doc__) {
                return __doc__;
            }
        }
    }), `(help object)

             Macro returns documentation for function or macros including parser
             macros but only if called with parser macro symbol like (help \`).
             For normal functions and macros you can save the function in variable.`),
    // ------------------------------------------------------------------
    cons: doc(function(car, cdr) {
        return new Pair(car, cdr);
    }, `(cons left right)

            Function return new Pair out of two arguments.`),
    // ------------------------------------------------------------------
    car: doc(function(list) {
        typecheck('car', list, 'pair');
        return list.car;
    }, `(car pair)

            Function returns car (head) of the list/pair.`),
    // ------------------------------------------------------------------
    cdr: doc(function(list) {
        typecheck('cdr', list, 'pair');
        return list.cdr;
    }, `(cdr pair)

            Function returns cdr (tail) of the list/pair.`),
    // ------------------------------------------------------------------
    'set!': doc(new Macro('set!', function(code, { dynamic_scope, error } = {}) {
        if (dynamic_scope) {
            dynamic_scope = this;
        }
        var env = this;
        var ref;
        var value = evaluate(code.cdr.car, { env: this, dynamic_scope, error });
        value = resolvePromises(value);
        function set(object, key, value) {
            if (isPromise(object)) {
                return object.then(key => set(object, key, value));
            }
            if (isPromise(key)) {
                return key.then(key => set(object, key, value));
            }
            if (isPromise(value)) {
                return value.then(value => set(object, key, value));
            }
            env.get('set-obj!').call(env, object, key, value);
            return value;
        }
        if (code.car instanceof Pair && LSymbol.is(code.car.car, '.')) {
            var second = code.car.cdr.car;
            var thrid = code.car.cdr.cdr.car;
            var object = evaluate(second, { env: this, dynamic_scope, error });
            var key = evaluate(thrid, { env: this, dynamic_scope, error });
            return set(object, key, value);
        }
        if (!(code.car instanceof LSymbol)) {
            throw new Error('set! first argument need to be a symbol or ' +
                            'dot accessor that evaluate to object.');
        }
        var symbol = code.car.valueOf();
        ref = this.ref(code.car.name);
        // we don't return value because we only care about sync of set value
        // when value is a promise
        return unpromise(value, value => {
            if (!ref) {
                // case (set! fn.toString (lambda () "xxx"))
                var parts = symbol.split('.');
                if (parts.length > 1) {
                    var key = parts.pop();
                    var name = parts.join('.');
                    var obj = this.get(name, { throwError: false });
                    if (obj) {
                        set(obj, key, value);
                        return;
                    }
                }
                throw new Error('Unbound variable `' + symbol + '\'');
            }
            ref.set(symbol, value);
        });
    }), `(set! name value)

            Macro that can be used to set the value of the variable (mutate)
            it search the scope chain until it finds first non emtpy slot and set it.`),
    // ------------------------------------------------------------------
    'unset!': doc(new Macro('set!', function(code) {
        if (!(code.car instanceof LSymbol)) {
            throw new Error('unset! first argument need to be a symbol or ' +
                            'dot accessor that evaluate to object.');
        }
        const symbol = code.car;
        var ref = this.ref(symbol);
        if (ref) {
            delete ref.env[symbol.name];
        }
    }), `(unset! name)

            Function delete specified name from environment.`),
    // ------------------------------------------------------------------
    'set-car!': doc(function(slot, value) {
        typecheck('set-car!', slot, 'pair');
        slot.car = value;
    }, `(set-car! obj value)

            Function that set car (head) of the list/pair to specified value.
            It can destroy the list. Old value is lost.`),
    // ------------------------------------------------------------------
    'set-cdr!': doc(function(slot, value) {
        typecheck('set-cdr!', slot, 'pair');
        slot.cdr = value;
    }, `(set-cdr! obj value)

            Function that set cdr (tail) of the list/pair to specified value.
            It can destroy the list. Old value is lost.`),
    // ------------------------------------------------------------------
    'empty?': doc(function(x) {
        return typeof x === 'undefined' || x === nil;
    }, `(empty? object)

            Function return true if value is undfined empty list.`),
    // ------------------------------------------------------------------
    assoc: doc(function(key, list) {
        if (key instanceof Pair && !(list instanceof Pair)) {
            throw new Error('First argument to assoc ned to be a key');
        }
        typecheck('assoc', list, 'pair');
        var node = list;
        while (true) {
            if (!(node instanceof Pair) || this.get('empty?')(node)) {
                break;
            }
            var car = node.car.car;
            if (equal(car, key)) {
                return node.car;
            } else if (!node.haveCycles('cdr')) {
                node = node.cdr;
            }
        }
        return nil;
    }, `(assoc key alist)

            Function search Alist (list of pairs) until it find the one that
            have head set equal to key, and return found pair.`),
    // ------------------------------------------------------------------
    gensym: doc(
        LSymbol.gensym,
        `(gensym)

             Function generate unique symbol, to use with macros as meta name.`),
    // ------------------------------------------------------------------
    load: doc(function(file) {
        typecheck('load', file, 'string');
        var g_env = this;
        if (g_env.name === '__frame__') {
            g_env = g_env.parent;
        }
        var env;
        if (g_env === global_env) {
            env = g_env;
        } else {
            env = this.get('**interaction-environment**');
        }
        const PATH = '**module-path**';
        var module_path = global_env.get(PATH, { throwError: false });
        file = file.valueOf();
        if (!file.match(/.[^.]+$/)) {
            file += '.scm';
        }
        if (typeof this.get('global', { throwError: false }) !== 'undefined') {
            return Promise.all([import('path'), import('fs')]).then(([path, fs]) => {
                //var path = require('path');
                if (module_path) {
                    module_path = module_path.valueOf();
                    file = path.join(module_path, file);
                }
                global_env.set(PATH, path.dirname(file));
                return new Promise((resolve, reject) => {
                    fs.readFile(file, function(err, data) {
                        if (err) {
                            reject(err);
                            global_env.set(PATH, module_path);
                        } else {
                            exec(data.toString(), env).then(() => {
                                resolve();
                                global_env.set(PATH, module_path);
                            }).catch(reject);
                        }
                    });
                });
            }).catch(err => {
                console.log(err);
            });
        }
        console.log('browser');
        if (module_path) {
            module_path = module_path.valueOf();
            file = module_path + '/' + file.replace(/^\.?\/?/, '');
        }
        return root.fetch(file).then(res => res.text()).then((code) => {
            global_env.set(PATH, file.replace(/\/[^/]*$/, ''));
            return exec(code, env);
        }).then(() => {}).finally(() => {
            global_env.set(PATH, module_path);
        });
    }, `(load filename)

            Function fetch the file and evaluate its content as LIPS code.`),
    // ------------------------------------------------------------------
    'do': doc(new Macro('do', async function(code, { dynamic_scope, error }) {
        var self = this;
        if (dynamic_scope) {
            dynamic_scope = self;
        }
        var scope = self.inherit('do');
        var vars = code.car;
        var test = code.cdr.car;
        var body = code.cdr.cdr;
        if (body !== nil) {
            body = new Pair(LSymbol('begin'), body);
        }
        const eval_args = { env: scope, dynamic_scope, error };
        let node = vars;
        while (node !== nil) {
            const item = node.car;
            scope.set(item.car, await evaluate(item.cdr.car, eval_args));
            node = node.cdr;
        }
        while (!(await evaluate(test.car, eval_args))) {
            if (body !== nil) {
                await lips.evaluate(body, eval_args);
            }
            let node = vars;
            const next = {};
            while (node !== nil) {
                const item = node.car;
                if (item.cdr.cdr !== nil) {
                    const value = await evaluate(item.cdr.cdr.car, eval_args);
                    next[item.car.valueOf()] = value;
                }
                node = node.cdr;
            }
            Object.entries(next).forEach(([key, value]) => {
                scope.set(key, value);
            });
        }
        if (test.cdr !== nil) {
            return await evaluate(test.cdr.car, eval_args);
        }
    }), `(do ((<var> <init> <next>)) (test expression) . body)

             Iteration macro that evaluate the expression body in scope of the variables.
             On Eeach loop it increase the variables according to next expression and run
             test to check if the loop should continue. If test is signle call the macro
             will not return anything. If the test is pair of expression and value the
             macro will return that value after finish.`),
    // ------------------------------------------------------------------
    'if': doc(new Macro('if', function(code, { dynamic_scope, error }) {
        if (dynamic_scope) {
            dynamic_scope = this;
        }
        var env = this;
        var resolve = (cond) => {
            if (cond) {
                return evaluate(code.cdr.car, {
                    env,
                    dynamic_scope,
                    error
                });
            } else {
                return evaluate(code.cdr.cdr.car, {
                    env,
                    dynamic_scope,
                    error
                });
            }
        };
        if (code === nil) {
            throw new Error('too few expressions for `if`');
        }
        var cond = evaluate(code.car, { env, dynamic_scope, error });
        return unpromise(cond, resolve);
    }), `(if cond true-expr false-expr)

            Macro evaluate condition expression and if the value is true, it
            evaluate and return true expression if not it evaluate and return
            false expression`),
    // ------------------------------------------------------------------
    'let-env': new Macro('let-env', function(code, options = {}) {
        const { dynamic_scope, error } = options;
        typecheck('let-env', code, 'pair');
        var ret = evaluate(code.car, { env: this, dynamic_scope, error });
        return unpromise(ret, function(value) {
            if (!(value instanceof Environment)) {
                throw new Error('let-env: First argument need to be ' +
                                'environment');
            }
            return evaluate(Pair(LSymbol('begin'), code.cdr), {
                env: value, dynamic_scope, error
            });
        });
    }, `(let-env env . body)

            Special macro that evaluate body in context of given environment
            object.`),
    // ------------------------------------------------------------------
    'letrec': doc(
        let_macro(Symbol.for('letrec')),
        `(letrec ((a value-a) (b value-b)) body)

             Macro that creates new environment, then evaluate and assign values to
             names and then evaluate the body in context of that environment.
             Values are evaluated sequentialy and next value can access to
             previous values/names.`),
    // ---------------------------------------------------------------------
    'let*': doc(
        let_macro(Symbol.for('let*')),
        `(let* ((a value-a) (b value-b)) body)

             Macro similar to \`let\` but next argument get environment
             from previous let variable, so they you can define one variable,
             and use in next argument.`),
    // ---------------------------------------------------------------------
    'let': doc(
        let_macro(Symbol.for('let')),
        `(let ((a value-a) (b value-b)) body)

             Macro that creates new environment, then evaluate and assign values to
             names and then evaluate the body in context of that environment.
             Values are evaluated sequentialy but you can't access
             previous values/names when next are evaluated. You can only get them
             from body of let expression.`),
    // ------------------------------------------------------------------
    'begin*': doc(pararel('begin*', function(values) {
        return values.pop();
    }), `(begin* . expr)

             This macro is parallel version of begin. It evaluate each expression and
             if it's a promise it will evaluate it in parallel and return value
             of last expression.`),
    // ------------------------------------------------------------------
    'begin': doc(new Macro('begin', function(code, options) {
        var args = Object.assign({ }, options);
        var arr = this.get('list->array')(code);
        if (args.dynamic_scope) {
            args.dynamic_scope = this;
        }
        args.env = this;
        var result;
        return (function loop() {
            if (arr.length) {
                var code = arr.shift();
                var ret = evaluate(code, args);
                return unpromise(ret, value => {
                    result = value;
                    return loop();
                });
            } else {
                return result;
            }
        })();
    }), `(begin . args)

             Macro runs list of expression and return valuate of the list one.
             It can be used in place where you can only have single exression,
             like if expression.`),
    // ------------------------------------------------------------------
    'ignore': new Macro('ignore', function(code, { dynamic_scope, error }) {
        var args = { env: this, error };
        if (dynamic_scope) {
            args.dynamic_scope = this;
        }
        evaluate(new Pair(new LSymbol('begin'), code), args);
    }, `(ignore expression)

            Macro that will evaluate expression and swallow any promises that may
            be created. It wil run and ignore any value that may be returned by
            expression. The code should have side effects and/or when it's promise
            it should resolve to undefined.`),
    // ------------------------------------------------------------------
    define: doc(Macro.defmacro('define', function(code, eval_args) {
        var env = this;
        if (code.car instanceof Pair &&
            code.car.car instanceof LSymbol) {
            var new_code = new Pair(
                new LSymbol("define"),
                new Pair(
                    code.car.car,
                    new Pair(
                        new Pair(
                            new LSymbol("lambda"),
                            new Pair(
                                code.car.cdr,
                                code.cdr
                            )
                        )
                    )
                )
            );
            return new_code;
        } else if (eval_args.macro_expand) {
            // prevent evaluation in macroexpand
            return;
        }
        if (eval_args.dynamic_scope) {
            eval_args.dynamic_scope = this;
        }
        eval_args.env = env;
        var value = code.cdr.car;
        if (value instanceof Pair) {
            value = evaluate(value, eval_args);
        } else if (value instanceof LSymbol) {
            value = env.get(value);
        }
        typecheck('define', code.car, 'symbol');
        return unpromise(value, value => {
            if (env.name === Syntax.merge_env) {
                env = env.parent;
            }
            let __doc__;
            if (code.cdr.cdr instanceof Pair &&
                LString.isString(code.cdr.cdr.car)) {
                __doc__ = code.cdr.cdr.car.valueOf();
            }
            env.set(code.car, value, __doc__);
        });
    }), `(define name expression)
             (define (function-name . args) body)

             Macro for defining values. It can be used to define variables,
             or function. If first argument is list it will create function
             with name beeing first element of the list. The macro evalute
             code \`(define function (lambda args body))\``),
    // ------------------------------------------------------------------
    'set-obj!': doc(function(obj, key, value) {
        var obj_type = typeof obj;
        if (isNull(obj) || (obj_type !== 'object' && obj_type !== 'function')) {
            var msg = typeErrorMessage('set-obj!', type(obj), ['object', 'function']);
            throw new Error(msg);
        }
        obj = unbind(obj);
        key = key.valueOf();
        if (arguments.length === 2) {
            delete obj[key];
        } else if (is_prototype(obj) && typeof value === 'function') {
            obj[key] = unbind(value);
            obj[key].__prototype__ = true;
        } else if (typeof value === 'function') {
            obj[key] = value;
        } else {
            obj[key] = value ? value.valueOf() : value;
        }
    }, `(set-obj! obj key value)

            Function set property of JavaScript object`),
    // ------------------------------------------------------------------
    'null-environment': doc(function() {
        return global_env.inherit('null');
    }, `(null-environment)

            Function return new base environment with std lib.`),
    // ------------------------------------------------------------------
    'values': doc(function(...args) {
        return Values(args);
    }, `(values a1 a2 ...)

            If called with more then one elment it will create special
            Values object that can be used in call-with-values function`),
    // ------------------------------------------------------------------
    'call-with-values': doc(function(producer, consumer) {
        typecheck('call-with-values', producer, 'function', 1);
        typecheck('call-with-values', consumer, 'function', 2);
        var maybe = producer();
        if (maybe instanceof Values) {
            return consumer(...maybe.valueOf());
        }
        return consumer(maybe);
    }, `(call-with-values producer consumer)

            Calls its producer argument with no values and a continuation that,
            when passed some values, calls the consumer procedure with those
            values as arguments.`),
    // ------------------------------------------------------------------
    'current-environment': doc(function() {
        if (this.name === '__frame__') {
            return this.parent;
        }
        return this;
    }, `(current-environment)

            Function return current environement.`),
    // ------------------------------------------------------------------
    'parent.frame': doc(function() {
        return user_env;
    }, `(parent.frame)

            Return parent environment if called from inside function.
            If no parent frame found it return nil.`),
    // ------------------------------------------------------------------
    'eval': doc(function(code, env) {
        typecheck('eval', code, ['symbol', 'pair', 'array']);
        env = env || this;
        if (code instanceof LSymbol) {
            return env.get(code);
        }
        if (code instanceof Pair) {
            return evaluate(code, {
                env,
                //dynamic_scope: this,
                error: e => {
                    this.get('error').call(this, e.message);
                    if (e.code) {
                        var stack = e.code.map((line, i) => {
                            return `[${i + 1}]: ${line}`;
                        }).join('\n');
                        this.get('error').call(this, stack);
                    }
                }
            });
        }
        if (code instanceof Array) {
            var _eval = this.get('eval');
            return code.reduce((_, code) => {
                return _eval(code, env);
            });
        }
    }, `(eval list)

            Function evalute LIPS code as list structure.`),
    // ------------------------------------------------------------------
    lambda: new Macro('lambda', function(code, { dynamic_scope, error } = {}) {
        var self = this;
        var __doc__;
        if (code.cdr instanceof Pair &&
            LString.isString(code.cdr.car) &&
            code.cdr.cdr !== nil) {
            __doc__ = code.cdr.car.valueOf();
        }
        function lambda(...args) {
            var env;
            // this is function calling env
            // self is lexical scope when function was defined
            if (dynamic_scope) {
                if (!(this instanceof Environment)) {
                    env = self;
                } else {
                    env = this;
                }
            } else {
                env = self;
            }
            env = env.inherit('lambda');
            var name = code.car;
            var i = 0;
            var value;
            if (typeof this !== 'undefined') {
                env.set('this', this);
            }
            // arguments and arguments.callee inside lambda function
            if (this instanceof Environment) {
                var options = { throwError: false };
                env.set('arguments', this.get('arguments', options));
                env.set('parent.frame', this.get('parent.frame', options));
            } else {
                // this case is for lambda as callback function in JS; e.g. setTimeout
                var _args = args.slice();
                _args.callee = lambda;
                _args.env = env;
                env.set('arguments', _args);
            }
            if (name instanceof LSymbol || name !== nil) {
                while (true) {
                    if (name.car !== nil) {
                        if (name instanceof LSymbol) {
                            // rest argument,  can also be first argument
                            value = quote(Pair.fromArray(args.slice(i), false));
                            env.env[name.name] = value;
                            break;
                        } else {
                            value = args[i];
                            env.env[name.car.name] = value;
                        }
                    }
                    if (name.cdr === nil) {
                        break;
                    }
                    i++;
                    name = name.cdr;
                }
            }
            if (dynamic_scope) {
                dynamic_scope = env;
            }
            var rest = __doc__ ? code.cdr.cdr : code.cdr;
            var output = new Pair(new LSymbol('begin'), rest);
            return evaluate(output, { env, dynamic_scope, error });
        }
        var length = code.car instanceof Pair ? code.car.length() : null;
        lambda.__code__ = new Pair(new LSymbol('lambda'), code);
        lambda.__lambda__ = true;
        if (!(code.car instanceof Pair)) {
            return doc(lambda, __doc__, true); // variable arguments
        }
        // wrap and decorate with __doc__
        return doc(setFnLength(lambda, length), __doc__, true);
    }, `(lambda (a b) body)
            (lambda args body)
            (lambda (a b . rest) body)

            Macro lambda create new anonymous function, if first element of the body
            is string and there is more elements it will be documentation, that can
            be read using (help fn)`),
    'macroexpand': new Macro('macroexpand', macro_expand()),
    'macroexpand-1': new Macro('macroexpand-1', macro_expand(true)),
    // ------------------------------------------------------------------
    'define-macro': doc(new Macro(macro, function(macro, { dynamic_scope, error }) {
        if (macro.car instanceof Pair && macro.car.car instanceof LSymbol) {
            var name = macro.car.car.name;
            var __doc__;
            if (LString.isString(macro.cdr.car) && macro.cdr.cdr instanceof Pair) {
                __doc__ = macro.cdr.car.valueOf();
            }
            var makro_instance = Macro.defmacro(name, function(code) {
                var env = new Environment({}, this, 'defmacro');
                var name = macro.car.cdr;
                var arg = code;
                while (true) {
                    if (name === nil) {
                        break;
                    }
                    if (name instanceof LSymbol) {
                        env.env[name.name] = arg;
                        break;
                    } else if (name.car !== nil) {
                        if (arg === nil) {
                            env.env[name.car.name] = nil;
                        } else {
                            if (arg.car instanceof Pair) {
                                arg.car.data = true;
                            }
                            env.env[name.car.name] = arg.car;
                        }
                    }
                    if (name.cdr === nil) {
                        break;
                    }
                    if (arg !== nil) {
                        arg = arg.cdr;
                    }
                    name = name.cdr;
                }
                if (dynamic_scope) {
                    dynamic_scope = env;
                }
                var eval_args = {
                    env,
                    dynamic_scope,
                    error
                };
                // evaluate macro
                if (macro.cdr instanceof Pair) {
                    // this eval will return lips code
                    var rest = __doc__ ? macro.cdr.cdr : macro.cdr;
                    var result = rest.reduce(function(result, node) {
                        return evaluate(node, eval_args);
                    });
                    return unpromise(result, function(result) {
                        if (typeof result === 'object') {
                            delete result.data;
                        }
                        return result;
                    });
                }
            }, __doc__, true);
            makro_instance.__code__ = new Pair(new LSymbol('define-macro'), macro);
            this.set(name, makro_instance);
        }
    }), `(define-macro (name . args) body)

             Meta macro, macro that create new macros, if return value is list structure
             it will be evaluated when macro is invoked. You can use quasiquote \` and
             unquote , and unquote-splicing ,@ inside to create expression that will be
             evaluated on runtime. Macros works like this: if you pass any expression to
             macro the arguments will not be evaluated unless macro itself evaluate it.
             Because of this macro can manipulate expression (arguments) as lists.`),
    // ------------------------------------------------------------------
    'syntax-rules': new Macro('syntax-rules', function(macro, options) {
        var { dynamic_scope, error } = options;
        var env = this;
        function get_identifiers(node) {
            let symbols = [];
            while (node !== nil) {
                const x = node.car;
                symbols.push(x.valueOf());
                node = node.cdr;
            }
            return symbols;
        }
        function validate_identifiers(node) {
            while (node !== nil) {
                const x = node.car;
                if (!(x instanceof LSymbol)) {
                    throw new Error('syntax-rules: wrong identifier');
                }
                node = node.cdr;
            }
        }
        if (macro.car instanceof LSymbol) {
            validate_identifiers(macro.cdr.car);
        } else {
            validate_identifiers(macro.car);
        }
        const syntax = new Syntax(function(code, { macro_expand }) {
            var scope = env.inherit('syntax');
            if (dynamic_scope) {
                dynamic_scope = scope;
            }
            var var_scope = this;
            // for macros that define variables used in macro (2 levels nestting)
            if (var_scope.name === Syntax.merge_env) {
                // copy refs for defined gynsyms
                const props = Object.getOwnPropertySymbols(var_scope.env);
                props.forEach(symbol => {
                    var_scope.parent.set(symbol, var_scope.env[symbol]);
                });
                var_scope = var_scope.parent;
            }
            var eval_args = { env: scope, dynamic_scope, error };
            let ellipsis, rules, symbols;
            if (macro.car instanceof LSymbol) {
                ellipsis = macro.car;
                symbols = get_identifiers(macro.cdr.car);
                rules = macro.cdr.cdr;
            } else {
                ellipsis = '...';
                symbols = get_identifiers(macro.car);
                rules = macro.cdr;
            }
            while (rules !== nil) {
                var rule = rules.car.car;
                var expr = rules.car.cdr.car;

                var bindings = extract_patterns(rule, code, symbols, ellipsis, {
                    expansion: this, define: env
                });
                if (bindings) {
                    /* istanbul ignore next */
                    if (is_debug()) {
                        console.log(JSON.stringify(symbolize(bindings), true, 2));
                        console.log('PATTERN: ' + rule.toString(true));
                        console.log('MACRO: ' + code.toString(true));
                    }
                    // name is modified in transform_syntax
                    var names = [];
                    const new_expr = transform_syntax({
                        bindings,
                        expr,
                        symbols,
                        scope,
                        lex_scope: var_scope,
                        names,
                        ellipsis
                    });
                    if (new_expr) {
                        expr = new_expr;
                    }
                    var new_env = var_scope.merge(scope, Syntax.merge_env);
                    if (macro_expand) {
                        return { expr, scope: new_env };
                    }
                    var result = evaluate(expr, { ...eval_args, env: new_env });
                    // Hack: update the result if there are generated
                    //       gensyms that should be literal symbols
                    // TODO: maybe not the part move when literal elisps may
                    //       be generated, maybe they will need to be mark somehow
                    return clear_gensyms(result, names);
                }
                rules = rules.cdr;
            }
            throw new Error(`Invalid Syntax ${code}`);
        }, env);
        syntax.__code__ = macro;
        return syntax;
    }, `(syntax-rules () (pattern expression) ...)

            Base of Hygienic macro, it will return new syntax expander
            that works like lisp macros.`),
    // ------------------------------------------------------------------
    quote: doc(new Macro('quote', function(arg) {
        return quote(arg.car);
    }), `(quote expression)

             Macro that return single lips expression as data (it don't evaluate its
             argument). It will return list of pairs if put in front of lips code.
             And if put in fron of symbol it will return that symbol not value
             associated with that name.`),
    'unquote-splicing': doc(function() {
        throw new Error(`You can't call \`unquote-splicing\` outside of quasiquote`);
    }, `(unquote-splicing code)

            Special form to be used in quasiquote macro, parser is processing special
            characters ,@ and create call to this pseudo function. It can be used
            to evalute expression inside and return the value without parenthesis.
            the value will be joined to the output list structure.`),
    'unquote': doc(function() {
        throw new Error(`You can't call \`unquote\` outside of quasiquote`);
    }, `(unquote code)

            Special form to be used in quasiquote macro, parser is processing special
            characters , and create call to this pseudo function. It can be used
            to evalute expression inside and return the value, the output is inserted
            into list structure created by queasiquote.`),
    // ------------------------------------------------------------------
    quasiquote: Macro.defmacro('quasiquote', function(arg, env) {
        var { dynamic_scope, error } = env;
        var self = this;
        //var max_unquote = 1;
        if (dynamic_scope) {
            dynamic_scope = self;
        }
        function isPair(value) {
            return value instanceof Pair;
        }
        function resolve_pair(pair, fn, test = isPair) {
            if (pair instanceof Pair) {
                var car = pair.car;
                var cdr = pair.cdr;
                if (test(car)) {
                    car = fn(car);
                }
                if (test(cdr)) {
                    cdr = fn(cdr);
                }
                if (isPromise(car) || isPromise(cdr)) {
                    return Promise.all([car, cdr]).then(([car, cdr]) => {
                        return new Pair(car, cdr);
                    });
                } else {
                    return new Pair(car, cdr);
                }
            }
            return pair;
        }
        function join(eval_pair, value) {
            if (eval_pair === nil && value === nil) {
                //return nil;
            }
            if (eval_pair instanceof Pair) {
                if (value !== nil) {
                    eval_pair.append(value);
                }
            } else {
                eval_pair = new Pair(
                    eval_pair,
                    value
                );
            }
            return eval_pair;
        }
        function unquote_splice(pair, unquote_cnt, max_unq) {
            if (unquote_cnt < max_unq) {
                return new Pair(
                    new Pair(
                        pair.car.car,
                        recur(pair.car.cdr, unquote_cnt, max_unq)
                    ),
                    nil
                );
            }
            var eval_pair = evaluate(pair.car.cdr.car, {
                env: self,
                dynamic_scope,
                error
            });
            return unpromise(eval_pair, function(eval_pair) {
                if (!(eval_pair instanceof Pair)) {
                    if (pair.cdr instanceof Pair &&
                        LSymbol.is(pair.cdr.car, '.') &&
                        pair.cdr.cdr instanceof Pair &&
                        pair.cdr.cdr.cdr === nil) {
                        return pair.cdr.cdr.car;
                    }
                    if (pair.cdr !== nil) {
                        const msg = "You can't splice atom inside list";
                        throw new Error(msg);
                    }
                    return eval_pair;
                }
                // don't create Cycles
                if (splices.has(eval_pair)) {
                    eval_pair = eval_pair.clone();
                } else {
                    splices.add(eval_pair);
                }
                const value = recur(pair.cdr, 0, 1);
                if (value === nil && eval_pair === nil) {
                    return undefined;
                }
                return unpromise(value, value => join(eval_pair, value));
            });
        }
        var splices = new Set();
        function recur(pair, unquote_cnt, max_unq) {
            if (pair instanceof Pair) {
                if (LSymbol.is(pair.car.car, 'unquote-splicing')) {
                    return unquote_splice(pair, unquote_cnt + 1, max_unq);
                }
                if (LSymbol.is(pair.car, 'quasiquote')) {
                    var cdr = recur(pair.cdr, unquote_cnt, max_unq + 1);
                    return new Pair(pair.car, cdr);
                }
                if (LSymbol.is(pair.car.car, 'unquote')) {
                    // + 2 - one for unquote and one for unquote splicing
                    if (unquote_cnt + 2 === max_unq &&
                        pair.car.cdr instanceof Pair &&
                        pair.car.cdr.car instanceof Pair &&
                        LSymbol.is(pair.car.cdr.car.car, 'unquote-splicing')) {
                        return new Pair(
                            new LSymbol('unquote'),
                            unquote_splice(pair.car.cdr, unquote_cnt + 2, max_unq)
                        );
                    } else if (pair.car.cdr instanceof Pair &&
                               pair.car.cdr.cdr !== nil &&
                               !(pair.car.cdr.car instanceof Pair)) {
                        // same as in guile if (unquote 1 2 3) it should be
                        // spliced - scheme spec say it's unspecify but it
                        // work like in CL
                        return pair.car.cdr;
                    }
                }
                if (LSymbol.is(pair.car, 'quote')) {
                    return new Pair(
                        pair.car,
                        recur(pair.cdr, unquote_cnt, max_unq)
                    );
                }
                if (LSymbol.is(pair.car, 'unquote')) {
                    unquote_cnt++;
                    if (unquote_cnt < max_unq) {
                        return new Pair(
                            new LSymbol('unquote'),
                            recur(pair.cdr, unquote_cnt, max_unq)
                        );
                    }
                    if (unquote_cnt > max_unq) {
                        throw new Error("You can't call `unquote` outside " +
                                        "of quasiquote");
                    }
                    if (pair.cdr instanceof Pair) {
                        if (pair.cdr.cdr !== nil) {
                            if (pair.cdr.car instanceof Pair) {
                                let list = nil;
                                // evaluate all values in unquote
                                return (function recur(node) {
                                    if (node === nil) {
                                        return list;
                                    }
                                    return unpromise(evaluate(node.car, {
                                        env: self,
                                        dynamic_scope,
                                        error
                                    }), function(next) {
                                        list = new Pair(next, list);
                                        return recur(node.cdr);
                                    });
                                })(pair.cdr);
                            } else {
                                return pair.cdr;
                            }
                        } else {
                            return evaluate(pair.cdr.car, {
                                env: self,
                                dynamic_scope,
                                error
                            });
                        }
                    } else {
                        return pair.cdr;
                    }
                }
                return resolve_pair(pair, (pair) => {
                    return recur(pair, unquote_cnt, max_unq);
                });
            }
            return pair;
        }
        function clear(node) {
            if (node instanceof Pair) {
                delete node.data;
                if (!node.haveCycles('car')) {
                    clear(node.car);
                }
                if (!node.haveCycles('cdr')) {
                    clear(node.cdr);
                }
            }
        }
        var x = recur(arg.car, 0, 1);
        return unpromise(x, value => {
            // clear nested data for tests
            clear(value);
            return quote(value);
        });
    }, `(quasiquote list ,value ,@value)

            Similar macro to \`quote\` but inside it you can use special
            expressions unquote abbreviated to , that will evaluate expresion inside
            and return its value or unquote-splicing abbreviated to ,@ that will
            evaluate expression but return value without parenthesis (it will join)
            the list with its value. Best used with macros but it can be used outside`),
    // ------------------------------------------------------------------
    clone: doc(function(list) {
        typecheck('clone', list, 'pair');
        return list.clone();
    }, `(clone list)

            Function return clone of the list.`),
    // ------------------------------------------------------------------
    append: doc(function(list, item) {
        typecheck('append', list, ['nil', 'pair']);
        if (list instanceof Pair) {
            list = list.clone();
        }
        return this.get('append!').call(this, list, item);
    }, `(append list item)

            Function will create new list with value appended to the end. It return
            New list.`),
    // ------------------------------------------------------------------
    'append!': doc(function(list, item) {
        typecheck('append!', list, ['pair', 'nil']);
        if (!this.get('list?')(list)) {
            throw new Error('append!: Invalid argument, value is not a list');
        }
        if (isNull(item)) {
            return list;
        }
        if (list === nil) {
            if (item === nil) {
                return nil;
            }
            return item;
        }
        return list.append(item);
    }, `(append! name expression)

             Destructive version of append, it modify the list in place. It return
             original list.`),
    // ------------------------------------------------------------------
    reverse: doc(function(arg) {
        typecheck('reverse', arg, ['array', 'pair', 'nil']);
        if (arg === nil) {
            return nil;
        }
        if (arg instanceof Pair) {
            var arr = this.get('list->array')(arg).reverse();
            return this.get('array->list')(arr);
        } else if (!(arg instanceof Array)) {
            throw new Error(typeErrorMessage('reverse', type(arg), 'array or pair'));
        } else {
            return arg.reverse();
        }
    }, `(reverse list)

            Function will reverse the list or array. If value is not a list
            or array it will throw exception.`),
    // ------------------------------------------------------------------
    nth: doc(function(index, obj) {
        typecheck('nth', index, 'number');
        typecheck('nth', obj, ['array', 'pair']);
        if (obj instanceof Pair) {
            var node = obj;
            var count = 0;
            while (count < index) {
                if (!node.cdr || node.cdr === nil || node.haveCycles('cdr')) {
                    return nil;
                }
                node = node.cdr;
                count++;
            }
            return node.car;
        } else if (obj instanceof Array) {
            return obj[index];
        } else {
            throw new Error(typeErrorMessage('nth', type(obj), 'array or pair', 2));
        }
    }, `(nth index obj)

            Function return nth element of the list or array. If used with different
            value it will throw exception`),
    // ------------------------------------------------------------------
    list: doc(function(...args) {
        return args.reverse().reduce((list, item) => new Pair(item, list), nil);
    }, `(list . args)

            Function create new list out of its arguments.`),
    // ------------------------------------------------------------------
    substring: doc(function(string, start, end) {
        typecheck('substring', string, 'string');
        typecheck('substring', start, 'number');
        typecheck('substring', end, ['number', 'undefined']);
        return string.substring(start.valueOf(), end && end.valueOf());
    }, `(substring string start end)

            Function return part of the string starting at start ending with end.`),
    // ------------------------------------------------------------------
    concat: doc(function(...args) {
        args.forEach((arg, i) => typecheck('concat', arg, 'string', i + 1));
        return args.join('');
    }, `(concat . strings)

            Function create new string by joining its arguments`),
    // ------------------------------------------------------------------
    join: doc(function(separator, list) {
        typecheck('join', separator, 'string');
        typecheck('join', list, 'pair');
        return this.get('list->array')(list).join(separator);
    }, `(join separator list)

            Function return string by joining elements of the list`),
    // ------------------------------------------------------------------
    split: doc(function(separator, string) {
        typecheck('split', separator, ['regex', 'string']);
        typecheck('split', string, 'string');
        return this.get('array->list')(string.split(separator));
    }, `(split separator string)

            Function create list by splitting string by separatar that can
            be a string or regular expression.`),
    // ------------------------------------------------------------------
    replace: doc(function(pattern, replacement, string) {
        typecheck('replace', pattern, ['regex', 'string']);
        typecheck('replace', replacement, ['string', 'function']);
        typecheck('replace', string, 'string');
        return string.replace(pattern, replacement);
    }, `(replace pattern replacement string)

            Function change pattern to replacement inside string. Pattern can be string
            or regex and replacement can be function or string.`),
    // ------------------------------------------------------------------
    match: doc(function(pattern, string) {
        typecheck('match', pattern, ['regex', 'string']);
        typecheck('match', string, 'string');
        var m = string.match(pattern);
        return m ? this.get('array->list')(m) : nil;
    }, `(match pattern string)

            function return match object from JavaScript as list.`),
    // ------------------------------------------------------------------
    search: doc(function(pattern, string) {
        typecheck('search', pattern, ['regex', 'string']);
        typecheck('search', string, 'string');
        return string.search(pattern);
    }, `(search pattern string)

            Function return first found index of the pattern inside a string`),
    // ------------------------------------------------------------------
    repr: doc(function repr(obj, quote) {
        return toString(obj, quote);
    }, `(repr obj)

            Function return string LIPS representation of an object as string.`),
    // ------------------------------------------------------------------
    env: doc(function(env) {
        env = env || this;
        var names = Object.keys(env.env);
        var result;
        if (names.length) {
            result = Pair.fromArray(names);
        } else {
            result = nil;
        }
        if (env.parent !== undefined) {
            return this.get('env').call(this, env.parent).append(result);
        }
        return result;
    }, `(env obj)

            Function return list values (functions and variables) inside environment.`),
    // ------------------------------------------------------------------
    'new': doc(function(obj, ...args) {
        var instance = new (unbind(obj))(...args.map(x => unbox(x)));
        Object.defineProperty(instance, '__instance__', {
            enumerable: false,
            get: () => true,
            set: () => {},
            configurable: false
        });
        return instance;
    }, `(new obj . args)

            Function create new JavaScript instance of an object.`),
    // ------------------------------------------------------------------
    'typecheck': doc(
        typecheck,
        `(typecheck label value type [position])

             Function check type and throw exception if type don't match.
             Type can be string or list of strings. Position optional argument
             is used to created proper error message.`),
    // ------------------------------------------------------------------
    'unset-special!': doc(function(symbol) {
        typecheck('remove-special!', symbol, 'string');
        delete specials[symbol.valueOf()];
    }, `(unset-special! name)

            Function remove special symbol from parser. Added by \`set-special!\`,
            name must be a string.`),
    // ------------------------------------------------------------------
    'set-special!': doc(function(seq, name, type = specials.LITERAL) {
        typecheck('set-special!', seq, 'string', 1);
        typecheck('set-special!', name, 'symbol', 2);
        lips.specials.append(seq.valueOf(), name, type);
    }, `(set-special! symbol name [type])

            Add special symbol to the list of transforming operators by the parser.
            e.g.: \`(add-special! "#" 'x)\` will allow to use \`#(1 2 3)\` and it will be
            transformed into (x (1 2 3)) so you can write x macro that will process
            the list. 3rd argument is optional and it can be constant value
            lips.specials.SPLICE if this constant is used it will transform
            \`#(1 2 3)\` into (x 1 2 3) that is required by # that define vectors.`),
    // ------------------------------------------------------------------
    'get': get,
    '.': get,
    // ------------------------------------------------------------------
    'unbind': doc(
        unbind,
        `(unbind fn)

             Function remove bidning from function so you can get props from it.`),
    // ------------------------------------------------------------------
    type: doc(
        type,
        `(type object)

             Function return type of an object as string.`),
    // ------------------------------------------------------------------
    'debugger': doc(function() {
        /* eslint-disable */
        debugger;
        /* eslint-enable */
    }, `(debugger)

            Function stop JavaScript code in debugger.`),
    // ------------------------------------------------------------------
    'in': doc(function(a, b) {
        if (a instanceof LSymbol || a instanceof LString) {
            a = a.valueOf();
        }
        return a in b;
    }, `(in key value)

            Function use is in operator to check if value is in object.`),
    // ------------------------------------------------------------------
    'instanceof': doc(function(type, obj) {
        return obj instanceof unbind(type);
    }, `(instanceof type obj)

            Function check of object is instance of object.`),
    // ------------------------------------------------------------------
    'prototype?': doc(
        is_prototype,
        `(prototype? obj)

             Function check if value is JavaScript Object prototype.`),
    // ------------------------------------------------------------------
    'macro?': doc(function(obj) {
        return obj instanceof Macro;
    }, `(macro? expression)

            Function check if value is a macro.`),
    // ------------------------------------------------------------------
    'function?': doc(function(obj) {
        return typeof obj === 'function';
    }, `(function? expression)

            Function check if value is a function.`),
    // ------------------------------------------------------------------
    'real?': doc(function(value) {
        if (type(value) !== 'number') {
            return false;
        }
        if (value instanceof LNumber) {
            return value.isFloat();
        }
        return LNumber.isFloat(value);
    }, `(real? number)

            Function check if value is real number.`),
    // ------------------------------------------------------------------
    'number?': doc(
        LNumber.isNumber,
        `(number? expression)

             Function check if value is a number`),
    // ------------------------------------------------------------------
    'string?': doc(function(obj) {
        return LString.isString(obj);
    }, `(string? expression)

            Function check if value is a string.`),
    // ------------------------------------------------------------------
    'pair?': doc(function(obj) {
        return obj instanceof Pair;
    }, `(pair? expression)

            Function check if value is a pair or list structure.`),
    // ------------------------------------------------------------------
    'regex?': doc(function(obj) {
        return obj instanceof RegExp;
    }, `(regex? expression)

            Function check if value is regular expression.`),
    // ------------------------------------------------------------------
    'null?': doc(function(obj) {
        return isNull(obj);
    }, `(null? expression)

            Function check if value is nulish.`),
    // ------------------------------------------------------------------
    'boolean?': doc(function(obj) {
        return typeof obj === 'boolean';
    }, `(boolean? expression)

            Function check if value is boolean.`),
    // ------------------------------------------------------------------
    'symbol?': doc(function(obj) {
        return obj instanceof LSymbol;
    }, `(symbol? expression)

            Function check if value is LIPS symbol`),
    // ------------------------------------------------------------------
    'array?': doc(function(obj) {
        return obj instanceof Array;
    }, `(array? expression)

            Function check if value is an arrray.`),
    // ------------------------------------------------------------------
    'object?': doc(function(obj) {
        return obj !== nil && obj !== null &&
            !(obj instanceof LCharacter) &&
            !(obj instanceof RegExp) &&
            !(obj instanceof LString) &&
            !(obj instanceof Pair) &&
            !(obj instanceof LNumber) &&
            typeof obj === 'object' &&
            !(obj instanceof Array);
    }, `(object? expression)

            Function check if value is an plain object.`),
    // ------------------------------------------------------------------
    flatten: doc(function(list) {
        typecheck('flatten', list, 'pair');
        return list.flatten();
    }, `(flatten list)

            Return shallow list from tree structure (pairs).`),
    // ------------------------------------------------------------------
    'array->list': doc(function(array) {
        typecheck('array->list', array, 'array');
        return Pair.fromArray(array);
    }, `(array->list array)

            Function convert JavaScript array to LIPS list.`),
    // ------------------------------------------------------------------
    'tree->array': doc(
        toArray('tree->array', true),
        `(tree->array list)

             Function convert LIPS list structure into JavaScript array.`),
    // ------------------------------------------------------------------
    'list->array': doc(
        toArray('list->array'),
        `(list->array list)

             Function convert LIPS list into JavaScript array.`),
    // ------------------------------------------------------------------
    apply: doc(function(fn, ...list) {
        typecheck('apply', fn, 'function', 1);
        var last = list.pop();
        typecheck('apply', last, ['pair', 'nil'], list.length + 2);
        list = list.concat(this.get('list->array').call(this, last));
        return fn.apply(this, list);
    }, `(apply fn list)

            Function that call function with list of arguments.`),
    // ------------------------------------------------------------------
    'length': doc(function(obj) {
        if (!obj) {
            return LNumber(0);
        }
        if (obj instanceof Pair) {
            return LNumber(obj.length());
        }
        if ("length" in obj) {
            return LNumber(obj.length);
        }
    }, `(length expression)

            Function return length of the object, the object can be list
            or any object that have length property.`),
    // ------------------------------------------------------------------
    'string->number': doc(function(arg, radix = 10) {
        typecheck('string->number', arg, 'string', 1);
        typecheck('string->number', radix, 'number', 2);
        return number_to_string(arg, radix);
    }, `(string->number number [radix])

           Function convert string to number.`),
    // ------------------------------------------------------------------
    'try': doc(new Macro('try', function(code, { dynamic_scope, error }) {
        return new Promise((resolve) => {
            var args = {
                env: this,
                error: (e) => {
                    var env = this.inherit('try');
                    env.set(code.cdr.car.cdr.car.car, e);
                    var args = {
                        env,
                        error
                    };
                    if (dynamic_scope) {
                        args.dynamic_scope = this;
                    }
                    unpromise(evaluate(new Pair(
                        new LSymbol('begin'),
                        code.cdr.car.cdr.cdr
                    ), args), function(result) {
                        resolve(result);
                    });
                }
            };
            if (dynamic_scope) {
                args.dynamic_scope = this;
            }
            var ret = evaluate(code.car, args);
            if (isPromise(ret)) {
                ret.then(resolve).catch(args.error);
            } else {
                resolve(ret);
            }
        });
    }), `(try expr (catch (e) code)`),
    // ------------------------------------------------------------------
    'throw': doc(function(message) {
        throw new Error(message);
    }, `(throw string)

            Throw new expection.`),
    // ------------------------------------------------------------------
    find: doc(function find(arg, list) {
        typecheck('find', arg, ['regex', 'function']);
        typecheck('find', list, ['pair', 'nil']);
        if (isNull(list)) {
            return nil;
        }
        var fn = matcher('find', arg);
        return unpromise(fn(list.car), function(value) {
            if (value && value !== nil) {
                return list.car;
            }
            return find(arg, list.cdr);
        });
    }, `(find fn list)
            (find regex list)

            Higher order Function find first value for which function return true.
            If called with regex it will create matcher function.`),
    // ------------------------------------------------------------------
    'for-each': doc(function(fn, ...lists) {
        typecheck('for-each', fn, 'function');
        lists.forEach((arg, i) => {
            typecheck('for-each', arg, ['pair', 'nil'], i + 1);
        });
        // we need to use call(this because babel transpile this code into:
        // var ret = map.apply(void 0, [fn].concat(lists));
        // it don't work with weakBind
        var ret = this.get('map').call(this, fn, ...lists);
        if (isPromise(ret)) {
            return ret.then(() => {});
        }
    }, `(for-each fn . lists)

            Higher order function that call function \`fn\` by for each
            value of the argument. If you provide more then one list as argument
            it will take each value from each list and call \`fn\` function
            with that many argument as number of list arguments.`),
    // ------------------------------------------------------------------
    map: doc(function map(fn, ...lists) {
        typecheck('map', fn, 'function');
        var is_list = this.get('list?');
        lists.forEach((arg, i) => {
            typecheck('map', arg, ['pair', 'nil'], i + 1);
            // detect cycles
            if (arg instanceof Pair && !is_list.call(this, arg)) {
                throw new Error(`map: argument ${i + 1} is not a list`);
            }
        });
        if (lists.length === 0) {
            return nil;
        }
        if (lists.some(x => x === nil)) {
            return nil;
        }
        var args = lists.map(l => l.car);
        var parent_frame = this.get('parent.frame');
        var env = this.newFrame(fn, args);
        env.set('parent.frame', parent_frame);
        return unpromise(fn.call(env, ...args), (head) => {
            return unpromise(map.call(this, fn, ...lists.map(l => l.cdr)), (rest) => {
                return new Pair(head, rest);
            });
        });
    }, `(map fn . lists)

            Higher order function that call function \`fn\` by for each
            value of the argument. If you provide more then one list as argument
            it will take each value from each list and call \`fn\` function
            with that many argument as number of list arguments. The return
            values of the function call is acumulated in result list and
            returned by the call to map.`),
    // ------------------------------------------------------------------
    'list?': doc(function(obj) {
        var node = obj;
        while (true) {
            if (node === nil) {
                return true;
            }
            if (!(node instanceof Pair)) {
                return false;
            }
            if (node.haveCycles('cdr')) {
                return false;
            }
            node = node.cdr;
        }
    }, `(list? obj)

            Function test if value is proper linked list structure.
            The car of each pair can be any value. It return false on cycles."`),
    // ------------------------------------------------------------------
    some: doc(function some(fn, list) {
        typecheck('some', fn, 'function');
        typecheck('some', list, ['pair', 'nil']);
        if (isNull(list)) {
            return false;
        } else {
            return unpromise(fn(list.car), (value) => {
                return value || some(fn, list.cdr);
            });
        }
    }, `(some fn list)

            Higher order function that call argument on each element of the list.
            It stops when function fn return true for a value if so it will
            return true. If none of the values give true, the function return false`),
    // ------------------------------------------------------------------
    fold: doc(fold('fold', function(fold, fn, init, ...lists) {
        typecheck('fold', fn, 'function');
        lists.forEach((arg, i) => {
            typecheck('fold', arg, ['pair', 'nil'], i + 1);
        });
        if (lists.some(x => x === nil)) {
            return init;
        }
        const value = fold.call(this, fn, init, ...lists.map(l => l.cdr));
        return unpromise(value, value => {
            return fn(...lists.map(l => l.car), value);
        });
    }), `(fold fn init . lists)

             Function fold is reverse of the reduce. it call function \`fn\`
             on each elements of the list and return single value.
             e.g. it call (fn a1 b1 (fn a2 b2 (fn a3 b3 '())))
             for: (fold fn '() alist blist`),
    // ------------------------------------------------------------------
    pluck: doc(function(...keys) {
        return function(obj) {
            keys = keys.map(x => x instanceof LSymbol ? x.name : x);
            if (keys.length === 0) {
                return nil;
            } else if (keys.length === 1) {
                const [key] = keys;
                return obj[key];
            }
            var result = {};
            keys.forEach((key) => {
                result[key] = obj[key];
            });
            return result;
        };
    }, `(pluck . string)

            If called with single string it will return function that will return
            key from object. If called with more then one argument function will
            return new object by taking all properties from given object.`),
    // ------------------------------------------------------------------
    reduce: doc(fold('reduce', function(reduce, fn, init, ...lists) {
        typecheck('reduce', fn, 'function');
        lists.forEach((arg, i) => {
            typecheck('reduce', arg, ['pair', 'nil'], i + 1);
        });
        if (lists.some(x => x === nil)) {
            return init;
        }
        return unpromise(fn(...lists.map(l => l.car), init), (value) => {
            return reduce.call(this, fn, value, ...lists.map(l => l.cdr));
        });
    }), `(reduce fn init list . lists)

             Higher order function take each element of the list and call
             the function with result of previous call or init and next element
             on the list until each element is processed and return single value
             as result of last call to \`fn\` function.
             e.g. it call (fn a3 b3 (fn a2 b2 (fn a1 b1 init)))
             for (reduce fn init alist blist`),
    // ------------------------------------------------------------------
    filter: doc(function(arg, list) {
        typecheck('filter', arg, ['regex', 'function']);
        typecheck('filter', list, ['pair', 'nil']);
        var array = this.get('list->array')(list);
        var result = [];
        var fn = matcher('filter', arg);
        return (function loop(i) {
            function next(value) {
                if (value && value !== nil) {
                    result.push(item);
                }
                return loop(++i);
            }
            if (i === array.length) {
                return Pair.fromArray(result);
            }
            var item = array[i];
            return unpromise(fn(item, i), next);
        })(0);
    }, `(filter fn list)
            (filter regex list)

            Higher order function that call \`fn\` for each element of the list
            and return list for only those elements for which funtion return
            true value. If called with regex it will create matcher function.`),
    // ------------------------------------------------------------------
    range: doc(function(n) {
        typecheck('range', n, 'number');
        if (n instanceof LNumber) {
            n = n.valueOf();
        }
        const range = new Array(n).fill(0).map((_, i) => LNumber(i));
        return Pair.fromArray(range, false);
    }, `(range n)

            Function return list of n numbers from 0 to n - 1`),
    // ------------------------------------------------------------------
    compose: doc(
        compose,
        `(compose . fns)

             Higher order function and create new function that apply all functions
             From right to left and return it's value. Reverse of compose.
             e.g.:
             ((compose (curry + 2) (curry * 3)) 3)
             11
            `),
    pipe: doc(
        pipe,
        `(pipe . fns)

             Higher order function and create new function that apply all functions
             From left to right and return it's value. Reverse of compose.
             e.g.:
             ((pipe (curry + 2) (curry * 3)) 3)
             15`),
    curry: doc(
        curry,
        `(curry fn . args)

             Higher order function that create curried version of the function.
             The result function will have parially applied arguments and it
             will keep returning functions until all arguments are added

             e.g.:
             (define (add a b c d) (+ a b c d))
             (define add1 (curry add 1))
             (define add12 (add 2))
             (display (add12 3 4))`),
    'gcd': doc(function GCD(...args) {
        return args.reduce(function(result, item) {
            return result.gcd(item);
        });
    }, `(gcd n1 n2 ...)

            Function return the greatest common divisor of their arguments.`),
    // ------------------------------------------------------------------
    'lcm': doc(function(...args) {
        // implementation based on
        // https://rosettacode.org/wiki/Least_common_multiple#JavaScript
        var n = args.length, a = abs(args[0]);
        for (var i = 1; i < n; i++) {
            var b = abs(args[i]), c = a;
            while (a && b) {
                a > b ? a %= b : b %= a;
            }
            a = abs(c * args[i]) / (a + b);
        }
        return LNumber(a);
    }, `(lcm n1 n2 ...)

            Function return the least common multiple of their arguments.`),
    // ------------------------------------------------------------------
    'odd?': doc(singleMathOp(function(num) {
        return LNumber(num).isOdd();
    }), `(odd? number)

             Function check if number os odd.`),
    // ------------------------------------------------------------------
    'even?': doc(singleMathOp(function(num) {
        return LNumber(num).isEven();
    }), `(even? number)

             Function check if number is even.`),
    // ------------------------------------------------------------------
    // math functions
    '*': doc(reduceMathOp(function(a, b) {
        return LNumber(a).mul(b);
    }, LNumber(1)), `(* . numbers)

        Multiplicate all numbers passed as arguments. If single value is passed
        it will return that value.`),
    // ------------------------------------------------------------------
    '+': doc(reduceMathOp(function(a, b) {
        return LNumber(a).add(b);
    }, LNumber(0)), `(+ . numbers)

        Sum all numbers passed as arguments. If single value is passed it will
        return that value.`),
    // ------------------------------------------------------------------
    '-': doc(function(...args) {
        if (args.length === 1) {
            return LNumber(args[0]).sub();
        }
        if (args.length) {
            return args.reduce(binaryMathOp(function(a, b) {
                return LNumber(a).sub(b);
            }));
        }
        return LNumber(-1);
    }, `(- . numbers)
            (- number)

            Substract number passed as argument. If only one argument is passed
            it will negate the value.`),
    // ------------------------------------------------------------------
    '/': doc(reduceMathOp(function(a, b) {
        return LNumber(a).div(b);
    }), `(/ . numbers)

             Divide number passed as arguments one by one. If single argument
             is passed it will return that value.`),
    // ------------------------------------------------------------------
    'abs': doc(singleMathOp(function(n) {
        return LNumber(n).abs();
    }), `(abs number)

             Function create absolute value from number.`),
    // ------------------------------------------------------------------
    'truncate': doc(function(n) {
        if (LNumber.isFloat(n)) {
            if (n instanceof LNumber) {
                n = n.valueOf();
            }
            return LFloat(truncate(n));
        }
        return n;
    }, `(truncate n)

            Function return integer value from real number.`),
    // ------------------------------------------------------------------
    'sqrt': doc(singleMathOp(function(n) {
        return LNumber(n).sqrt();
    }), `(sqrt number)

             Function return square root of the number.`),
    // ------------------------------------------------------------------
    '**': doc(binaryMathOp(function(a, b) {
        return LNumber(a).pow(b);
    }), `(** a b)

            Function calculate number a to to the power of b. It can throw
            exception when ** native operator is not supported.`),
    // ------------------------------------------------------------------
    '1+': doc(singleMathOp(function(number) {
        return LNumber(number).add(1);
    }), `(1+ number)

             Function add 1 to the number and return result.`),
    // ------------------------------------------------------------------
    '1-': doc(singleMathOp(function(number) {
        return LNumber(number).sub(1);
    }), `(1- number)

             Function substract 1 from the number and return result.`),
    // ------------------------------------------------------------------
    '%': doc(function(a, b) {
        return LNumber(a).rem(b);
    }, `(% n1 n2)

             Function get reminder of it's arguments.`),
    // ------------------------------------------------------------------
    // Booleans
    '==': doc(function(...args) {
        return seq_compare((a, b) => LNumber(a).cmp(b) === 0, args);
    }, `(== x1 x2 x3 ...)

            Function compare its numerical arguments and check if they are equal`),
    // ------------------------------------------------------------------
    '>': doc(function(...args) {
        return seq_compare((a, b) => LNumber(a).cmp(b) === 1, args);
    }, `(> x1 x2 x3 ...)

            Function compare its numerical arguments and check if they are
            monotonically increasing`),
    // ------------------------------------------------------------------
    '<': doc(function(...args) {
        return seq_compare((a, b) => LNumber(a).cmp(b) === -1, args);
    }, `(< x1 x2 x3 ...)

            Function compare its numerical arguments and check if they are
            monotonically decreasing`),
    // ------------------------------------------------------------------
    '<=': doc(function(...args) {
        return seq_compare((a, b) => [0, -1].includes(LNumber(a).cmp(b)), args);
    }, `(<= x1 x2 x3 ...)

            Function compare its numerical arguments and check if they are
            monotonically nonincreasing`),
    // ------------------------------------------------------------------
    '>=': doc(function(...args) {
        return seq_compare((a, b) => [0, 1].includes(LNumber(a).cmp(b)), args);
    }, `(>= x1 x2 x3 ...)

            Function compare its numerical arguments and check if they are
            monotonically nondecreasing`),
    // ------------------------------------------------------------------
    'eq?': doc(
        equal,
        `(eq? a b)

             Function compare two values if they are identical.`),
    // ------------------------------------------------------------------
    or: doc(new Macro('or', function(code, { dynamic_scope, error }) {
        var args = this.get('list->array')(code);
        var self = this;
        if (dynamic_scope) {
            dynamic_scope = self;
        }
        var result;
        return (function loop() {
            function next(value) {
                result = value;
                if (result) {
                    return result;
                } else {
                    return loop();
                }
            }
            var arg = args.shift();
            if (typeof arg === 'undefined') {
                if (result) {
                    return result;
                } else {
                    return false;
                }
            } else {
                var value = evaluate(arg, { env: self, dynamic_scope, error });
                return unpromise(value, next);
            }
        })();
    }), `(or . expressions)

             Macro execute the values one by one and return the one that is truthy value.
             If there are no expression that evaluate to true it return false.`),
    // ------------------------------------------------------------------
    and: doc(new Macro('and', function(code, { dynamic_scope, error } = {}) {
        var args = this.get('list->array')(code);
        var self = this;
        if (dynamic_scope) {
            dynamic_scope = self;
        }
        if (!args.length) {
            return true;
        }
        var result;
        return (function loop() {
            function next(value) {
                result = value;
                if (!result) {
                    return false;
                } else {
                    return loop();
                }
            }
            var arg = args.shift();
            if (typeof arg === 'undefined') {
                if (result) {
                    return result;
                } else {
                    return false;
                }
            } else {
                var value = evaluate(arg, { env: self, dynamic_scope, error });
                return unpromise(value, next);
            }
        })();
    }), `(and . expressions)

             Macro evalute each expression in sequence if any value return false it will
             return false. If each value return true it will return the last value.
             If it's called without arguments it will return true.`),
    // bit operations
    '|': doc(function(a, b) {
        return LNumber(a).or(b);
    }, `(& a b)

            Function calculate or bit operation.`),
    '&': doc(function(a, b) {
        return LNumber(a).and(b);
    }, `(& a b)

            Function calculate and bit operation.`),
    '~': doc(function(a) {
        return LNumber(a).neg();
    }, `(~ number)

            Function negate the value.`),
    '>>': doc(function(a, b) {
        return LNumber(a).shr(b);
    }, `(>> a b)

            Function right shit the value a by value b.`),
    '<<': doc(function(a, b) {
        return LNumber(a).shl(b);
    }, `(<< a b)

            Function left shit the value a by value b.`),
    not: doc(function(value) {
        if (isNull(value)) {
            return true;
        }
        return !value;
    }, `(not object)

            Function return negation of the argument.`)
}, undefined, 'global');
var user_env = global_env.inherit('user-env');
global_env.set('**interaction-environment**', user_env);
// -------------------------------------------------------------------------
(function() {
    var map = { ceil: 'ceiling' };
    ['floor', 'round', 'ceil'].forEach(fn => {
        var name = map[fn] ? map[fn] : fn;
        global_env.set(name, doc(function(value) {
            typecheck(name, value, 'number');
            if (value instanceof LNumber) {
                return value[fn]();
            }
        }, `(${name} number)

                Function calculate ${name} of a number.`));
    });
})();
// -------------------------------------------------------------------------
// source: https://stackoverflow.com/a/4331218/387194
function allPossibleCases(arr) {
    if (arr.length === 1) {
        return arr[0];
    } else {
        var result = [];
        // recur with the rest of array
        var allCasesOfRest = allPossibleCases(arr.slice(1));
        for (var i = 0; i < allCasesOfRest.length; i++) {
            for (var j = 0; j < arr[0].length; j++) {
                result.push(arr[0][j] + allCasesOfRest[i]);
            }
        }
        return result;
    }
}

// -------------------------------------------------------------------------
function combinations(input, start, end) {
    var result = [];
    for (var i = start; i <= end; ++i) {
        var input_arr = [];
        for (var j = 0; j < i; ++j) {
            input_arr.push(input);
        }
        result = result.concat(allPossibleCases(input_arr));
    }
    return result;
}

// -------------------------------------------------------------------------
// cadr caddr cadadr etc.
combinations(['d', 'a'], 2, 5).forEach(spec => {
    const s = spec.split('');
    const chars = s.slice().reverse();
    const code = s.map(c => `(c${c}r`).join(' ') + ' arg' + ')'.repeat(s.length);
    const name = 'c' + spec + 'r';
    global_env.set(name, doc(function(arg) {
        return chars.reduce(function(list, type) {
            typecheck(name, list, 'pair');
            if (type === 'a') {
                return list.car;
            } else {
                return list.cdr;
            }
        }, arg);
    }, `(${name} arg)

            Function calculate ${code}`));
});

let nodeModuleFind;
// -----------------------------------------------------------------------------
if (typeof global !== 'undefined') {
    (async function() {
        const fs = await import('fs');
        const path = await import('path');
        // ---------------------------------------------------------------------
        function reversseFind(dir, fn) {
            var parts = dir.split(path.sep).filter(Boolean);
            for (var i = parts.length; i--;) {
                var p = path.join('/', ...parts.slice(0, i + 1));
                if (fn(p)) {
                    return p;
                }
            }
        }
        // ---------------------------------------------------------------------
        nodeModuleFind = function nodeModuleFind(dir) {
            return reversseFind(dir, function(dir) {
                return fs.existsSync(path.join(dir, 'node_modules'));
            });
        };
        // ---------------------------------------------------------------------
        global_env.set('global', global);
        // ---------------------------------------------------------------------
        global_env.set('require.resolve', doc(function(path) {
            typecheck('require.resolve', path, 'string');
            return require.resolve(path.valueOf());
        }, `(require.resolve path)

           Return path relative the current module.`));
        // ---------------------------------------------------------------------
        global_env.set('require', doc(async function(module) {
            typecheck('require', module, 'string');
            module = module.valueOf();
            const root = process.cwd();
            let value;
            try {
                if (module.match(/^\s*\./)) {
                    value = await import(path.join(root, module));
                } else {
                    var dir = nodeModuleFind(root);
                    if (dir) {
                        value = await import(path.join(dir, 'node_modules', module));
                    } else {
                        value = await import(module);
                    }
                }
            } catch (e) {
                value = await import(module);
            }
            // this is ES Module
            const result = 'default' in value ? value.default : {};
            Object.keys(value).forEach((name) => {
                result[name] = value[name];
            });
            return patchValue(result, global);
        }, `(require module)

                Function to be used inside Node.js to import the module.`));
    })();
    // ---------------------------------------------------------------------
} else if (typeof window !== 'undefined') {
    global_env.set('window', window);
}

// -------------------------------------------------------------------------
function selfEvaluated(obj) {
    var type = typeof obj;
    return ['string', 'function'].includes(type) ||
        obj instanceof LSymbol ||
        obj instanceof LNumber ||
        obj instanceof RegExp;
}
// -------------------------------------------------------------------------
// :; wrap tree of Promises with single Promise or return argument as is
// :: if tree have no Promises
// -------------------------------------------------------------------------
function resolvePromises(arg) {
    var promises = [];
    traverse(arg);
    if (promises.length) {
        return resolve(arg);
    }
    return arg;
    function traverse(node) {
        if (isPromise(node)) {
            promises.push(node);
        } else if (node instanceof Pair) {
            if (!node.haveCycles('car')) {
                traverse(node.car);
            }
            if (!node.haveCycles('cdr')) {
                traverse(node.cdr);
            }
        } else if (node instanceof Array) {
            node.forEach(traverse);
        }
    }
    async function promise(node) {
        var pair = new Pair(
            node.haveCycles('car') ? node.car : await resolve(node.car),
            node.haveCycles('cdr') ? node.cdr : await resolve(node.cdr)
        );
        if (node.data) {
            pair.data = true;
        }
        return pair;
    }
    function resolve(node) {
        if (node instanceof Array) {
            return Promise.all(node.map(resolve));
        }
        if (node instanceof Pair && promises.length) {
            return promise(node);
        }
        return node;
    }
}
function getFunctionArgs(rest, { env, dynamic_scope, error }) {
    var args = [];
    var node = rest;
    markCycles(node);
    while (true) {
        if (node instanceof Pair) {
            var arg = evaluate(node.car, { env, dynamic_scope, error });
            if (dynamic_scope) {
                arg = unpromise(arg, arg => {
                    if (typeof arg === 'function' && isNativeFunction(arg)) {
                        return arg.bind(dynamic_scope);
                    }
                    return arg;
                });
            }
            args.push(arg);
            if (node.haveCycles('cdr')) {
                break;
            }
            node = node.cdr;
        } else {
            break;
        }
    }
    return resolvePromises(args);
}
// -------------------------------------------------------------------------
function evaluateSyntax(macro, code, eval_args) {
    var value = macro.invoke(code, eval_args);
    return unpromise(resolvePromises(value), function(value) {
        if (value instanceof Pair) {
            value.markCycles();
        }
        return quote(value);
    });
}
// -------------------------------------------------------------------------
function evaluateMacro(macro, code, eval_args) {
    function finalize(result) {
        if (result instanceof Pair) {
            result.markCycles();
            return result;
        }
        return quote(result);
    }
    var value = macro.invoke(code, eval_args);
    return unpromise(resolvePromises(value), function ret(value) {
        if (value && value.data || !value || selfEvaluated(value)) {
            return value;
        } else {
            return unpromise(evaluate(value, eval_args), finalize);
        }
    });
}
// -------------------------------------------------------------------------
function evaluate(code, { env, dynamic_scope, error = () => {} } = {}) {
    try {
        if (dynamic_scope === true) {
            env = dynamic_scope = env || global_env;
        } else if (env === true) {
            env = dynamic_scope = global_env;
        } else {
            env = env || global_env;
        }
        var eval_args = { env, dynamic_scope, error };
        var value;
        if (isNull(code)) {
            return code;
        }
        if (code instanceof LSymbol) {
            return env.get(code);
        }
        var first = code.car;
        var rest = code.cdr;
        if (first instanceof Pair) {
            value = resolvePromises(evaluate(first, eval_args));
            if (isPromise(value)) {
                return value.then((value) => {
                    return evaluate(new Pair(value, code.cdr), eval_args);
                });
                // else is later in code
            } else if (typeof value !== 'function') {
                throw new Error(
                    type(value) + ' ' + env.get('repr')(value) +
                        ' is not a function while evaluating ' + code.toString()
                );
            }
        }
        if (first instanceof LSymbol) {
            value = env.get(first);
            if (value instanceof Syntax) {
                return evaluateSyntax(value, code, eval_args);
            } else if (value instanceof Macro) {
                return evaluateMacro(value, rest, eval_args);
            } else if (typeof value !== 'function') {
                if (value) {
                    var msg = `${type(value)} is not a function`;
                    throw new Error(msg);
                }
                throw new Error(`Unknown function \`${first.toString()}'`);
            }
        } else if (typeof first === 'function') {
            value = first;
        }
        if (typeof value === 'function') {
            var args = getFunctionArgs(rest, eval_args);
            return unpromise(args, function(args) {
                if (is_bound(value) && (!lips_context(value) || is_port(value))) {
                    args = args.map(unbox);
                }
                if (value.__lambda__ && !value.__prototype__ || is_port(value)) {
                    // lambda need environment as context
                    // normal functions are bound to their contexts
                    value = unbind(value);
                }
                var _args = args.slice();
                var scope = (dynamic_scope || env).newFrame(value, _args);
                var result = resolvePromises(value.apply(scope, args));
                return unpromise(result, (result) => {
                    if (result instanceof Pair) {
                        result.markCycles();
                        return quote(result);
                    }
                    if (Number.isNaN(result)) {
                        return result;
                    }
                    if (typeof result === 'number') {
                        return LNumber(result);
                    }
                    if (typeof result === 'string') {
                        return LString(result);
                    }
                    return result;
                }, error);
            });
        } else if (code instanceof LSymbol) {
            value = env.get(code);
            if (value === 'undefined') {
                throw new Error('Unbound variable `' + code.name + '\'');
            }
            return value;
        } else if (code instanceof Pair) {
            value = first && first.toString();
            throw new Error(`${type(first)} ${value} is not a function`);
        } else {
            return code;
        }
    } catch (e) {
        error && error.call(env, e, code);
    }
}
// -------------------------------------------------------------------------
async function exec(string, env, dynamic_scope) {
    if (dynamic_scope === true) {
        env = dynamic_scope = env || user_env;
    } else if (env === true) {
        env = dynamic_scope = user_env;
    } else {
        env = env || user_env;
    }
    var list = parse(string);
    var results = [];
    while (true) {
        if (!list.length) {
            return results;
        } else {
            var code = list.shift();
            var result = await evaluate(code, {
                env,
                dynamic_scope,
                error: (e, code) => {
                    if (code) {
                        // LIPS stack trace
                        if (!(e.code instanceof Array)) {
                            e.code = [];
                        }
                        e.code.push(code.toString(true));
                    }
                    throw e;
                }
            });
            results.push(result);
        }
    }
}
// -------------------------------------------------------------------------
function balanced(code) {
    var maching_pairs = {
        '[': ']',
        '(': ')'
    };
    var tokens;
    if (typeof code === 'string') {
        tokens = tokenize(code);
    } else {
        tokens = code.map(x => x && x.token ? x.token : x);
    }

    var open_tokens = Object.keys(maching_pairs);
    var brackets = Object.values(maching_pairs).concat(open_tokens);
    tokens = tokens.filter(token => brackets.includes(token));

    const stack = new Stack();
    for (const token of tokens) {
        if (open_tokens.includes(token)) {
            stack.push(token);
        } else if (!stack.is_empty()) { // closing token
            var last = stack.top();
            // last on stack need to match
            const closing_token = maching_pairs[last];
            if (token === closing_token) {
                stack.pop();
            } else {
                throw new Error(`Syntax error: missing closing ${closing_token}`);
            }
        } else {
            // closing bracket without opening
            throw new Error(`Syntax error: not matched closing ${token}`);
        }
    }
    return stack.is_empty();
}

// -------------------------------------------------------------------------
function fworker(fn) {
    // ref: https://stackoverflow.com/a/10372280/387194
    var str = '(' + fn.toString() + ')()';
    var URL = window.URL || window.webkitURL;
    var blob;
    try {
        blob = new Blob([str], { type: 'application/javascript' });
    } catch (e) { // Backwards-compatibility
        const BlobBuilder = window.BlobBuilder ||
              window.WebKitBlobBuilder ||
              window.MozBlobBuilder;
        blob = new BlobBuilder();
        blob.append(str);
        blob = blob.getBlob();
    }
    return new root.Worker(URL.createObjectURL(blob));
}

// -------------------------------------------------------------------------
function Worker(url) {
    this.url = url;
    const worker = this.worker = fworker(function() {
        var interpreter;
        var bootstrap;
        // string, numbers, booleans
        self.addEventListener('message', function(response) {
            var data = response.data;
            var id = data.id;
            if (data.type !== 'RPC' || id === null) {
                return;
            }
            function send_result(result) {
                self.postMessage({ id: id, type: 'RPC', result: result });
            }
            function send_error(message) {
                self.postMessage({ id: id, type: 'RPC', error: message });
            }
            if (data.method === 'eval') {
                if (!bootstrap) {
                    send_error('Worker RPC: LIPS not initilized, call init first');
                    return;
                }
                bootstrap.then(function() {
                    const [ code, dynamic ] = data.params;
                    interpreter.exec(code, dynamic).then(function(result) {
                        result = result.map(function(value) {
                            return value && value.valueOf();
                        });
                        send_result(result);
                    }).catch(error => {
                        send_error(error);
                    });
                });
            } else if (data.method === 'init') {
                const [ url ] = data.params;
                if (typeof url !== 'string') {
                    send_error('Worker RPC: url is not a string');
                } else {
                    importScripts(`${url}/dist/lips.min.js`);
                    interpreter = new lips.Interpreter('worker');
                    bootstrap = interpreter.exec(`(let-env lips.env.parent
                                                        (load "${url}/lib/bootstrap.scm")
                                                        (load "${url}/lib/R5RS.scm")
                                                        (load "${url}/lib/R7RS.scm"))`);
                    bootstrap.then(() => {
                        send_result(true);
                    });
                }
            }
        });
    });
    this.rpc = (function() {
        var id = 0;
        return function rpc(method, params) {
            var _id = ++id;
            return new Promise(function(resolve, reject) {
                worker.addEventListener('message', function handler(response) {
                    var data = response.data;
                    if (data && data.type === 'RPC' && data.id === _id) {
                        if (data.error) {
                            reject(data.error);
                        } else {
                            resolve(data.result);
                        }
                        worker.removeEventListener('message', handler);
                    }
                });
                worker.postMessage({
                    type: 'RPC',
                    method: method,
                    id: _id,
                    params: params
                });
            });
        };
    })();
    this.rpc('init', [url]).catch((error) => {
        console.error(error);
    });
    this.exec = function(code, dynamic = false) {
        return this.rpc('eval', [code, dynamic]);
    };
}

// -------------------------------------------------------------------------
function execError(e) {
    console.error(e.message || e);
    if (e.code) {
        console.error(e.code.map((line, i) => `[${i + 1}]: ${line}`));
    }
}
// -------------------------------------------------------------------------
function init() {
    var lips_mimes = ['text/x-lips', 'text/x-scheme'];
    if (!window.document) {
        return Promise.resolve();
    } else {
        return new Promise(function(resolve) {
            var scripts = Array.from(document.querySelectorAll('script'));
            return (function loop() {
                var script = scripts.shift();
                if (!script) {
                    resolve();
                } else {
                    var type = script.getAttribute('type');
                    if (lips_mimes.includes(type)) {
                        var src = script.getAttribute('src');
                        if (src) {
                            return root.fetch(src).then(res => res.text())
                                .then(exec).then(loop).catch((e) => {
                                    execError(e);
                                    loop();
                                });
                        } else {
                            return exec(script.innerHTML).then(loop).catch((e) => {
                                execError(e);
                                loop();
                            });
                        }
                    } else if (type && type.match(/lips|lisp/)) {
                        console.warn('Expecting ' + lips_mimes.join(' or ') +
                                     ' found ' + type);
                    }
                    return loop();
                }
            })();
        });
    }
}
// -------------------------------------------------------------------------
if (typeof window !== 'undefined') {
    contentLoaded(window, init);
}
// -------------------------------------------------------------------------
var banner = (function() {
    // Rollup tree-shaking is removing the variable if it's normal string because
    // obviously '{{/DATE}}' == '{{' + 'DATE}}'; can be removed
    // but disablig Tree-shaking is adding lot of not used code so we use this
    // hack instead
    var date = LString('{{DATE}}').valueOf();
    var _date = date === '{{' + 'DATE}}' ? new Date() : new Date(date);
    var _format = x => x.toString().padStart(2, '0');
    var _year = _date.getFullYear();
    var _build = [
        _year,
        _format(_date.getMonth() + 1),
        _format(_date.getDate())
    ].join('-');
    var banner = `
  __ __                          __
 / / \\ \\       _    _  ___  ___  \\ \\
| |   \\ \\     | |  | || . \\/ __>  | |
| |    > \\    | |_ | ||  _/\\__ \\  | |
| |   / ^ \\   |___||_||_|  <___/  | |
 \\_\\ /_/ \\_\\                     /_/

LIPS Interpreter {{VER}} (${_build}) <https://git.io/lips-scheme>
Copyright (c) 2018-${_year} Jakub T. Jankiewicz

Type (env) to see environment with functions macros and variables.
You can also use (help name) to display help for specic function or macro.
`.replace(/^.*\n/, '');
    return banner;
})();
// -------------------------------------------------------------------------
// to be used with string function when code is minified
// -------------------------------------------------------------------------
Ahead.__className = 'ahead';
Pattern.__className = 'pattern';
Formatter.__className = 'formatter';
Macro.__className = 'macro';
Syntax.__className = 'syntax';
Environment.__className = 'environment';
InputPort.__className = 'input-port';
OutputPort.__className = 'output-port';
OutputStringPort.__className = 'output-string-port';
InputStringPort.__className = 'input-string-port';
// types used for detect lips objects
LNumber.__className = 'number';
LCharacter.__className = 'character';
LString.__className = 'string';
// -------------------------------------------------------------------------
const version = '{{VER}}';
const date = '{{DATE}}';
const balanced_parenthesis = balanced;
const balancedParenthesis = balanced;
const env = user_env;
const lips = {
    version,
    banner,
    date,
    exec,
    parse,
    tokenize,
    evaluate,

    Environment,
    env,

    Worker,

    Interpreter,
    balanced_parenthesis,
    balancedParenthesis,
    balanced,

    Macro,
    Syntax,
    Pair,

    quote,

    InputPort,
    OutputPort,
    InputStringPort,
    OutputStringPort,

    Formatter,
    specials,
    repr,
    nil,

    LSymbol,
    LNumber,
    LFloat,
    LComplex,
    LRational,
    LBigInteger,
    LCharacter,
    LString,
    rationalize
};
export default lips;
export {
    version,
    banner,
    date,
    exec,
    parse,
    tokenize,
    evaluate,

    Environment,
    env,

    Worker,

    Interpreter,
    balanced_parenthesis,
    balancedParenthesis,
    balanced,

    Macro,
    Syntax,
    Pair,

    quote,

    InputPort,
    OutputPort,
    InputStringPort,
    OutputStringPort,

    Formatter,
    specials,
    repr,
    nil,

    LSymbol,
    LNumber,
    LFloat,
    LComplex,
    LRational,
    LBigInteger,
    LCharacter,
    LString,
    rationalize
};
// so it work when used with webpack where it will be not global
global_env.set('lips', lips);
