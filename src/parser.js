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
 */

import {
    nil,
    LCharacter,
    LSymbol,
    Pair,
    LNumber,
    LFloat,
    LComplex,
    LString,
    LRational
} from './types/index.js';
/* global Symbol */
/* eslint-disable max-len */
// functions generate regexes to match number rational, integer, complex, complex+ratioanl
function num_mnemicic_re(mnemonic) {
    return mnemonic ? `(?:#${mnemonic}(?:#[ie])?|#[ie]#${mnemonic})` : '(?:#[ie])?';
}
function gen_rational_re(mnemonic, range) {
    return `${num_mnemicic_re(mnemonic)}[+-]?${range}+/${range}+`;
}
// TODO: float complex
function gen_complex_re(mnemonic, range) {
    // [+-]i have (?=..) so it don't match +i from +inf.0
    return `${num_mnemicic_re(mnemonic)}(?:[+-]?(?:${range}+/${range}+|${range}+))?(?:[+-]i|[+-]?(?:${range}+/${range}+|${range}+)i)(?=[()[\\]\\s]|$)`;
}
function gen_integer_re(mnemonic, range) {
    return `${num_mnemicic_re(mnemonic)}[+-]?${range}+`;
}
var re_re = /^\/((?:\\\/|[^/]|\[[^\]]*\/[^\]]*\])+)\/([gimy]*)$/;
var float_stre = '(?:[-+]?(?:[0-9]+(?:[eE][-+]?[0-9]+)|(?:\\.[0-9]+|[0-9]+\\.[0-9]+)(?:[eE][-+]?[0-9]+)?)|[0-9]+\\.)';
// TODO: extend to ([+-]1/2|float)([+-]1/2|float)
var complex_float_stre = `(?:#[ie])?(?:[+-]?(?:[0-9]+/[0-9]+|${float_stre}|[+-]?[0-9]+))?(?:${float_stre}|[+-](?:[0-9]+/[0-9]+|[0-9]+))i`;
var float_re = new RegExp(`^(#[ie])?${float_stre}$`, 'i');
function make_complex_match_re(mnemonic, range) {
    // complex need special treatment of 10e+1i when it's hex or decimal
    var neg = mnemonic === 'x' ? `(?!\\+|${range})` : `(?!\\.|${range})`;
    var fl = '';
    if (mnemonic === '') {
        fl = '(?:[-+]?(?:[0-9]+(?:[eE][-+]?[0-9]+)|(?:\\.[0-9]+|[0-9]+\\.[0-9]+(?![0-9]))(?:[eE][-+]?[0-9]+)?))';
    }
    return new RegExp(`^((?:${fl}|[+-]?${range}+/${range}+(?!${range})|[+-]?${range}+${neg})?)(${fl}|[+-]?${range}+/${range}+|[+-]?${range}+|[+-])i$`, 'i');
}
var complex_list_re = (function() {
    var result = {};
    [
        [10, '', '[0-9]'],
        [16, 'x', '[0-9a-fA-F]'],
        [8, 'o', '[0-7]'],
        [2, 'b', '[01]']
    ].forEach(([radix, mnemonic, range]) => {
        result[radix] = make_complex_match_re(mnemonic, range);
    });
    return result;
})();
export const characters = {
    'alarm': '\x07',
    'backspace': '\x08',
    'delete': '\x7F',
    'escape': '\x1B',
    'newline': '\n',
    'null': '\x00',
    'return': '\r',
    'space': ' ',
    'tab': '\t'
};
const character_symbols = Object.keys(characters).join('|');
const char_sre_re = `#\\\\(?:x[0-9a-f]+|${character_symbols}|[\\s\\S])`;
const char_re = new RegExp(`^${char_sre_re}$`, 'i');
// complex with (int) (float) (rational)
function make_num_stre(fn) {
    const ranges = [
        ['o', '[0-7]'],
        ['x', '[0-9a-fA-F]'],
        ['b', '[01]'],
        ['', '[0-9]']
    ];
    // float exception that don't accept mnemonics
    let result = ranges.map(([m, range]) => fn(m, range)).join('|');
    if (fn === gen_complex_re) {
        result = complex_float_stre + '|' + result;
    }
    return result;
}
function make_type_re(fn) {
    return new RegExp('^(?:' + make_num_stre(fn) + ')$', 'i');
}
const complex_re = make_type_re(gen_complex_re);
const rational_re = make_type_re(gen_rational_re);
const int_re = make_type_re(gen_integer_re);

// regexes with full range but without mnemonics for string->number
const int_bare_re = new RegExp('^(?:' + gen_integer_re('', '[0-9a-f]') + ')$', 'i');
const rational_bare_re = new RegExp('^(?:' + gen_rational_re('', '[0-9a-f]') + ')$', 'i');
const complex_bare_re = new RegExp('^(?:' + gen_complex_re('', '[0-9a-f]') + ')$', 'i');

const complex_bare_match_re = make_complex_match_re('', '[0-9a-fA-F]');

//const big_num_re = /^([+-]?[0-9]+)[eE]([+-]?[0-9]+)$/;
const pre_num_parse_re = /((?:#[xobie]){0,2})(.*)/i;
const pre_parse_re = /("(?:\\[\S\s]|[^"])*"?|\/(?! )[^\n/\\]*(?:\\[\S\s][^\n/\\]*)*\/[gimy]*(?=[\s[\]()]|$)|\|[^|\s\n]+\||#;|;.*|#\|(?!\|#)[\s\S]*\|#)/g;
export var string_re = /"(?:\\[\S\s]|[^"])*"?/g;
// generate regex for all number literals
var num_stre = [
    gen_complex_re,
    gen_rational_re,
    gen_integer_re
].map(make_num_stre).join('|');
function num_pre_parse(arg) {
    var parts = arg.match(pre_num_parse_re);
    var options = {};
    if (parts[1]) {
        var type = parts[1].replace(/#/g, '').toLowerCase().split('');
        if (type.includes('x')) {
            options.radix = 16;
        } else if (type.includes('o')) {
            options.radix = 8;
        } else if (type.includes('b')) {
            options.radix = 2;
        }
        if (type.includes('i')) {
            options.inexact = true;
        }
        if (type.includes('e')) {
            options.exact = true;
        }
    }
    options.number = parts[2];
    return options;
}
// ----------------------------------------------------------------------
function parse_rational(arg, radix = 10) {
    var parse = num_pre_parse(arg);
    var parts = parse.number.split('/');
    var num = LRational({
        num: LNumber([parts[0], parse.radix || radix]),
        denom: LNumber([parts[1], parse.radix || radix])
    });
    if (parse.inexact) {
        return num.valueOf();
    } else {
        return num;
    }
}
// ----------------------------------------------------------------------
function parse_integer(arg, radix = 10) {
    var parse = num_pre_parse(arg);
    if (parse.inexact) {
        return LFloat(parseInt(parse.number, parse.radix || radix), true);
    }
    return LNumber([parse.number, parse.radix || radix]);
}
// ----------------------------------------------------------------------
function parse_character(arg) {
    var m = arg.match(/#\\x([0-9a-f]+)$/i);
    var char;
    if (m) {
        var ord = parseInt(m[1], 16);
        char = String.fromCodePoint(ord);
    } else {
        m = arg.match(/#\\(.+)$/);
        if (m) {
            char = m[1];
        }
    }
    if (char) {
        return LCharacter(char);
    }
}
// ----------------------------------------------------------------------
function parse_complex(arg, radix = 10) {
    function parse_num(n) {
        var value;
        if (n === '+') {
            value = LNumber(1);
        } else if (n === '-') {
            value = LNumber(-1);
        } else if (n.match(int_bare_re)) {
            value = LNumber([n, radix]);
        } else if (n.match(rational_bare_re)) {
            var parts = n.split('/');
            value = LRational({
                num: LNumber([parts[0], radix]),
                denom: LNumber([parts[1], radix])
            });
        } else if (n.match(float_re)) {
            var float = LFloat(parseFloat(n));
            if (parse.exact) {
                return float.toRational();
            }
            return float;
        } else {
            throw new Error('Internal Parser Error');
        }
        if (parse.inexact) {
            return LFloat(value.valueOf(), true);
        }
        return value;
    }
    var parse = num_pre_parse(arg);
    radix = parse.radix || radix;
    var parts;
    var bare_match = parse.number.match(complex_bare_match_re);
    if (radix !== 10 && bare_match) {
        parts = bare_match;
    } else {
        parts = parse.number.match(complex_list_re[radix]);
    }
    var re, im;
    im = parse_num(parts[2]);
    if (parts[1]) {
        re = parse_num(parts[1]);
    } else if (im instanceof LFloat) {
        re = LFloat(0, true);
    } else {
        re = LNumber(0);
    }
    return LComplex({ im, re });
}

// ----------------------------------------------------------------------
function parse_big_int(str) {
    var num_match = str.match(/^(([-+]?[0-9]*)(?:\.([0-9]+))?)e([-+]?[0-9]+)/i);
    if (num_match) {
        var exponent = parseInt(num_match[4], 10);
        var mantisa;// = parseFloat(num_match[1]);
        var digits = num_match[1].replace(/[-+]?([0-9]*)\..+$/, '$1').length;
        var decimal_points = num_match[3] && num_match[3].length;
        if (digits < Math.abs(exponent)) {
            mantisa = LNumber([num_match[1].replace(/\./, ''), 10]);
            if (decimal_points) {
                exponent -= decimal_points;
            }
        }
    }
    return { exponent, mantisa };
}
// ----------------------------------------------------------------------
function parse_float(arg) {
    var parse = num_pre_parse(arg);
    var value = parseFloat(parse.number);
    var simple_number = (parse.number.match(/\.0$/) ||
                         !parse.number.match(/\./)) && !parse.number.match(/e/i);
    if (!parse.inexact) {
        if (parse.exact && simple_number) {
            return LNumber(value);
        }
        // positive big num that eval to int e.g.: 1.2e+20
        if (is_int(value) && parse.number.match(/e\+?[0-9]/i)) {
            return LNumber(value);
        }
        // calculate big int and big fration by hand - it don't fit into JS float
        var { mantisa, exponent } = parse_big_int(parse.number);
        if (mantisa !== undefined && exponent !== undefined) {
            var factor = LNumber(10).pow(LNumber(Math.abs(exponent)));
            if (parse.exact && exponent < 0) {
                return LRational({ num: mantisa, denom: factor });
            } else if (exponent > 0) {
                return LNumber(mantisa).mul(factor);
            }
        }
    }
    value = LFloat(value, true);
    if (parse.exact) {
        return value.toRational();
    }
    return value;
}
// ----------------------------------------------------------------------
function parse_string(string) {
    // handle non JSON escapes and skip unicode escape \u (even partial)
    var re = /([^\\\n])(\\(?:\\{2})*)(?!x[0-9A-F]+)(?!u[0-9A-F]{2,4})(.)/gi;
    string = string.replace(re, function(_, before, slashes, chr) {
        if (!['"', '/', 'b', 'f', 'n', '\\', 'r', 't', 'x'].includes(chr)) {
            slashes = slashes.substring(1).replace(/\\\\/, '\\');
            //return before + slashes + chr;
        }
        return _;
    }).replace(/\\x([0-9a-f]+);/ig, function(_, hex) {
        return "\\u" + hex.padStart(4, '0');
    }).replace(/\n/g, '\\n'); // in LIPS strings can be multiline
    var m = string.match(/(\\*)(\\x[0-9A-F])/i);
    if (m && m[1].length % 2 === 0) {
        throw new Error(`Invalid string literal, unclosed ${m[2]}`);
    }
    try {
        return LString(JSON.parse(string));
    } catch (e) {
        throw new Error('Invalid string literal');
    }
}
// ----------------------------------------------------------------------
function parse_symbol(arg) {
    if (arg.match(/^\|.*\|$/)) {
        arg = arg.replace(/(^\|)|(\|$)/g, '');
        var chars = {
            t: '\t',
            r: '\r',
            n: '\n'
        };
        arg = arg.replace(/\\(x[^;]+);/g, function(_, chr) {
            return String.fromCharCode(parseInt('0' + chr, 16));
        }).replace(/\\(.)/g, function(_, chr) {
            return chars[chr] || chr;
        });
    }
    return new LSymbol(arg);
}
// ----------------------------------------------------------------------
function parse_argument(arg) {
    var regex = arg.match(re_re);
    if (regex) {
        return new RegExp(regex[1], regex[2]);
    } else if (arg.match(/^"/)) {
        return parse_string(arg);
    } else if (arg.match(char_re)) {
        return parse_character(arg);
    } else if (arg.match(rational_re)) {
        return parse_rational(arg);
    } else if (arg.match(complex_re)) {
        return parse_complex(arg);
    } else if (arg.match(int_re)) {
        return parse_integer(arg);
    } else if (arg.match(float_re)) {
        return parse_float(arg);
    } else if (arg === 'nil') {
        return nil;
    } else if (['true', '#t'].includes(arg)) {
        return true;
    } else if (['false', '#f'].includes(arg)) {
        return false;
    } else {
        return parse_symbol(arg);
    }
}
// ----------------------------------------------------------------------
export function is_symbol_string(str) {
    return !(['(', ')'].includes(str) || str.match(re_re) ||
             str.match(/^"[\s\S]+"$/) || str.match(int_re) ||
             str.match(float_re) || str.match(complex_re) ||
             str.match(rational_re) ||
             ['#t', '#f', 'nil', 'true', 'false'].includes(str));
}

// ----------------------------------------------------------------------
function make_tokens_re() {
    const tokens = specials.names()
        .sort((a, b) => b.length - a.length || a.localeCompare(b))
        .map(escape_regex).join('|');
    return new RegExp(`(${char_sre_re}|#f|#t|#;|(?:${num_stre})(?=$|[\\n\\s()[\\]])|\\[|\\]|\\(|\\)|\\|[^|]+\\||;.*|(?:#[ei])?${float_stre}(?=$|[\\n\\s()[\\]])|\\n|\\.{2,}|'(?=#[ft]|(?:#[xiobe]){1,2}|#\\\\)|(?!#:)(?:${tokens})|[^(\\s)[\\]]+)`, 'gim');
}

// ----------------------------------------------------------------------
function escape_regex(str) {
    if (typeof str === 'string') {
        var special = /([-\\^$[\]()+{}?*.|])/g;
        return str.replace(special, '\\$1');
    }
}

// ----------------------------------------------------------------------
export function tokenize(str, extra, formatter = multiline_formatter) {
    if (str instanceof LString) {
        str = str.toString();
    }
    if (extra) {
        return tokens(str).map(formatter);
    } else {
        var result = tokens(str).map(function(token) {
            var ret = formatter(token);
            if (!ret || typeof ret.token !== 'string') {
                throw new Error('[tokenize] Invalid formatter wrong return object');
            }
            // we don't want literal space character to be trimmed
            if (ret.token === '#\\ ') {
                return ret.token;
            }
            return ret.token.trim();
        }).filter(function(token) {
            return token && !token.match(/^;/) && !token.match(/^#\|[\s\S]*\|#$/);
        });
        return strip_s_comments(result);
    }
}

// ----------------------------------------------------------------------
function is_int(value) {
    return parseInt(value.toString(), 10) === value;
}

// ----------------------------------------------------------------------
function strip_s_comments(tokens) {
    var s_count = 0;
    var s_start = null;
    var remove_list = [];
    for (let i = 0; i < tokens.length; ++i) {
        const token = tokens[i];
        if (token === '#;') {
            if (['(', '['].includes(tokens[i + 1])) {
                s_count = 1;
                s_start = i;
            } else {
                remove_list.push([i, i + 2]);
            }
            i += 1;
            continue;
        }
        if (s_start !== null) {
            if ([')', ']'].includes(token)) {
                s_count--;
            } else if (['(', '['].includes(token)) {
                s_count++;
            }
            if (s_count === 0) {
                remove_list.push([s_start, i + 1]);
                s_start = null;
            }
        }
    }
    tokens = tokens.slice();
    remove_list.reverse();
    for (const [begin, end] of remove_list) {
        tokens.splice(begin, end - begin);
    }
    return tokens;
}

// ----------------------------------------------------------------------
// :: Parser macros transformers
// ----------------------------------------------------------------------
export const specials = {
    LITERAL: Symbol.for('literal'),
    SPLICE: Symbol.for('splice'),
    names: function() {
        return Object.keys(this._specials);
    },
    type: function(name) {
        return this.get(name).type;
    },
    get: function(name) {
        return this._specials[name];
    },
    append: function(name, value, type) {
        this._specials[name] = {
            seq: name,
            symbol: value,
            type
        };
    },
    _specials: {}
};

// ----------------------------------------------------------------------
function is_literal(special) {
    return specials.type(special) === specials.LITERAL;
}

// ----------------------------------------------------------------------
var defined_specials = [
    ["'", new LSymbol('quote'), specials.LITERAL],
    ['`', new LSymbol('quasiquote'), specials.LITERAL],
    [',@', new LSymbol('unquote-splicing'), specials.LITERAL],
    [',', new LSymbol('unquote'), specials.LITERAL]
];
defined_specials.forEach(([seq, symbol, type]) => {
    specials.append(seq, symbol, type);
});

// ----------------------------------------------------------------------
function last_item(array, n = 1) {
    return array[array.length - n];
}

// ----------------------------------------------------------------------
// :: tokens are the array of strings from tokenizer
// :: the return value is array of lisp code created out of Pair class
// ----------------------------------------------------------------------
export function parse(tokens) {
    // usage in LIPS code
    if (tokens instanceof LString) {
        tokens = tokens.toString();
    }
    if (typeof tokens === 'string') {
        tokens = tokenize(tokens);
    }

    var stack = [];
    var result = [];
    var special = null;
    var special_tokens = specials.names();
    var special_forms = special_tokens.map(s => specials.get(s).symbol.name);
    var parents = 0;
    var first_value = false;
    var specials_stack = [];
    var single_list_specials = [];
    var special_count = 0;
    var __SPLICE__ = LSymbol(Symbol.for('__splice__'));
    function is_open(token) {
        return token === '(' || token === '[';
    }
    function is_close(token) {
        return token === ')' || token === ']';
    }
    function pop_join() {
        var top = stack[stack.length - 1];
        if (top instanceof Array && top[0] instanceof LSymbol &&
            special_forms.includes(top[0].name) &&
            stack.length > 1 && !top[0].literal) {
            stack.pop();
            if (stack[stack.length - 1].length === 1 &&
                stack[stack.length - 1][0] instanceof LSymbol) {
                stack[stack.length - 1].push(top);
            } else if (false && stack[stack.length - 1].length === 0) {
                stack[stack.length - 1] = top;
            } else if (stack[stack.length - 1] instanceof Pair) {
                if (stack[stack.length - 1].cdr instanceof Pair) {
                    stack[stack.length - 1] = new Pair(
                        stack[stack.length - 1],
                        Pair.fromArray(top)
                    );
                } else {
                    stack[stack.length - 1].cdr = Pair.fromArray(top);
                }
            } else {
                stack[stack.length - 1].push(top);
            }
        }
    }
    tokens.forEach(function(token) {
        var top = stack[stack.length - 1];
        if (special_tokens.indexOf(token) !== -1) {
            special_count++;
            special = token;
            stack.push([specials.get(special).symbol]);
            if (!special) {
                single_list_specials = [];
            }
            single_list_specials.push(special);
        } else {
            if (special) {
                specials_stack.push(single_list_specials);
                single_list_specials = [];
            }
            if (is_open(token)) {
                first_value = true;
                parents++;
                const arr = [];
                if (special && !is_literal(special)) {
                    arr.push(__SPLICE__);
                }
                stack.push(arr);
                special = null;
                special_count = 0;
            } else if (token === '.' && !first_value) {
                stack[stack.length - 1] = Pair.fromArray(top);
            } else if (is_close(token)) {
                parents--;
                if (!stack.length) {
                    throw new Error('Unbalanced parenthesis');
                }
                if (stack.length === 1) {
                    var arg = stack.pop();
                    if (arg instanceof Array && arg.length === 0) {
                        arg = nil;
                    }
                    result.push(arg);
                } else if (stack.length > 1) {
                    var list = stack.pop();
                    top = stack[stack.length - 1];
                    if (top instanceof Array) {
                        if (list.length === 0) {
                            top.push(nil);
                        } else if (list instanceof Array &&
                                   list[0] === __SPLICE__) {
                            top.push(...list.slice(1));
                        } else {
                            top.push(list);
                        }
                    } else if (top instanceof Pair) {
                        if (list.length === 0) {
                            top.append(nil);
                        } else {
                            top.append(Pair.fromArray(list));
                        }
                    }
                    if (specials_stack.length) {
                        single_list_specials = specials_stack.pop();
                        while (single_list_specials.length) {
                            pop_join();
                            single_list_specials.pop();
                        }
                    } else {
                        pop_join();
                    }
                }
                if (parents === 0 && stack.length) {
                    result.push(stack.pop());
                }
            } else {
                first_value = false;
                var value = parse_argument(token);
                if (special) {
                    // special without list like ,foo
                    while (special_count--) {
                        stack[stack.length - 1].push(value);
                        value = stack.pop();
                    }
                    specials_stack.pop();
                    special_count = 0;
                    special = false;
                } else if (value instanceof LSymbol &&
                           special_forms.includes(value.name)) {
                    // handle parsing os special forms as literal symbols
                    // (values they expand into)
                    value.literal = true;
                }
                top = stack[stack.length - 1];
                if (top instanceof Pair) {
                    var node = top;
                    while (true) {
                        if (node.cdr === nil) {
                            if (value instanceof Array) {
                                node.cdr = Pair.fromArray(value);
                            } else {
                                node.cdr = value;
                            }
                            break;
                        } else {
                            node = node.cdr;
                        }
                    }
                } else if (!stack.length) {
                    result.push(value);
                } else {
                    top.push(value);
                }
            }
        }
    });
    if (!tokens.filter(t => t.match(/^[[\]()]$/)).length && stack.length) {
        // list of parser macros
        result = result.concat(stack);
        stack = [];
    }
    if (stack.length) {
        dump(result);
        throw new Error('Unbalanced parenthesis 2');
    }
    return result.map((arg) => {
        if (arg instanceof Array) {
            return Pair.fromArray(arg);
        }
        return arg;
    });
}

// ----------------------------------------------------------------------
function tokens(str) {
    var tokens_re = make_tokens_re();
    str = str.replace(/\n\r|\r/g, '\n');
    var count = 0;
    var line = 0;
    var tokens = [];
    var current_line = [];
    var col = 0;
    str.split(pre_parse_re).filter(Boolean).forEach(function(string) {
        if (string.match(pre_parse_re)) {
            col = 0;
            if (current_line.length) {
                var last_token = last_item(current_line);
                if (last_token.token.match(/\n/)) {
                    var last_line = last_token.token.split('\n').pop();
                    col += last_line.length;
                } else {
                    col += last_token.token.length;
                }
                col += last_token.col;
            }
            var token = {
                col,
                line,
                token: string,
                offset: count
            };
            tokens.push(token);
            current_line.push(token);
            count += string.length;
            col += string.length;
            line += (string.match("\n") || []).length;
            return;
        }
        var parts = string.split(tokens_re).filter(Boolean);
        parts.forEach(function(string) {
            var token = {
                col,
                line,
                token: string,
                offset: count
            };
            col += string.length;
            count += string.length;
            tokens.push(token);
            current_line.push(token);
            if (string === '\n') {
                ++line;
                current_line = [];
                col = 0;
            }
        });
    });
    return tokens;
}

// ----------------------------------------------------------------------
function multiline_formatter(meta) {
    var { token, ...rest } = meta;
    if (token.match(/^"[\s\S]+"$/) && token.match(/\n/)) {
        var re = new RegExp('^ {1,' + (meta.col + 1) + '}', 'mg');
        token = token.replace(re, '');
    }
    return {
        token,
        ...rest
    };
}

export function number_to_string(arg, radix = 10) {
    arg = arg.valueOf();
    radix = radix.valueOf();
    if (arg.match(rational_bare_re) || arg.match(rational_re)) {
        return parse_rational(arg, radix);
    } else if (arg.match(complex_bare_re) || arg.match(complex_re)) {
        return parse_complex(arg, radix);
    } else {
        const valid_bare = (radix === 10 && !arg.match(/e/i)) || radix === 16;
        if (arg.match(int_bare_re) && valid_bare || arg.match(int_re)) {
            return parse_integer(arg, radix);
        }
        if (arg.match(float_re)) {
            return parse_float(arg);
        }
    }
    return false;
}

// ----------------------------------------------------------------------
/* istanbul ignore next */
function dump(arr) {
    if (false) {
        console.log(arr.map((arg) => {
            if (arg instanceof Array) {
                return Pair.fromArray(arg);
            }
            return arg;
        }).toString());
    }
}
