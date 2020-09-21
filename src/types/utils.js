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
    LString,
    LNumber,

    Macro,
    Syntax,
    Values
} from './index.js';

// -----------------------------------------------------------------------------
export function typeErrorMessage(fn, got, expected, position = null) {
    let postfix = fn ? ` in expression \`${fn}\`` : '';
    if (position !== null) {
        postfix += ` (argument ${position})`;
    }
    if (expected instanceof Array) {
        if (expected.length === 1) {
            expected = expected[0];
        } else {
            const last = expected[expected.length - 1];
            expected = expected.slice(0, -1).join(', ') + ' or ' + last;
        }
    }
    return `Expecting ${expected}, got ${got}${postfix}`;
}

// -----------------------------------------------------------------------------
export function type(obj) {
    var mapping = {
        'pair': Pair,
        'symbol': LSymbol,
        'character': LCharacter,
        'values': Values,
        'macro': Macro,
        'string': LString,
        'array': Array,
        'native-symbol': Symbol
    };
    if (Number.isNaN(obj)) {
        return 'NaN ';
    }
    if (obj === nil) {
        return 'nil';
    }
    if (obj === null) {
        return 'null';
    }
    if (obj instanceof Syntax) {
        return 'syntax';
    }
    for (let [key, value] of Object.entries(mapping)) {
        if (obj instanceof value) {
            return key;
        }
    }
    if (obj instanceof LNumber) {
        return 'number';
    }
    if (obj instanceof RegExp) {
        return "regex";
    }
    if (typeof obj === 'object') {
        if (obj.__instance__) {
            obj.__instance__ = false;
            if (obj.__instance__) {
                return 'instance';
            }
        }
        if (obj.constructor) {
            if (obj.constructor.__className) {
                return obj.constructor.__className;
            }
            if (obj.constructor === Object &&
                typeof obj[Symbol.iterator] === 'function') {
                return 'iterator';
            }
            return obj.constructor.name.toLowerCase();
        }
    }
    return typeof obj;
}

// -------------------------------------------------------------------------
export function typecheck(fn, arg, expected, position = null) {
    fn = fn.valueOf();
    const arg_type = type(arg).toLowerCase();
    var match = false;
    if (expected instanceof Pair) {
        expected = expected.toArray();
    }
    if (expected instanceof Array) {
        expected = expected.map(x => x.valueOf());
    }
    if (expected instanceof Array) {
        expected = expected.map(x => x.valueOf().toLowerCase());
        if (expected.includes(arg_type)) {
            match = true;
        }
    } else {
        expected = expected.valueOf().toLowerCase();
    }
    if (!match && arg_type !== expected) {
        throw new Error(typeErrorMessage(fn, arg_type, expected, position));
    }
}





