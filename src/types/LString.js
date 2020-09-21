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

import { typecheck } from './utils.js';

// -----------------------------------------------------------------------------
// :: String wrapper that handle copy and in place change
// -----------------------------------------------------------------------------
export default function LString(string) {
    if (typeof this !== 'undefined' && !(this instanceof LString) ||
        typeof this === 'undefined') {
        return new LString(string);
    }
    if (string instanceof Array) {
        this._string = string.map((x, i) => {
            typecheck('LString', x, 'character', i + 1);
            return x.toString();
        }).join('');
    } else {
        this._string = string;
    }
}

// -----------------------------------------------------------------------------
const ignore = ['length', 'constructor'];
const _keys = Object.getOwnPropertyNames(String.prototype).filter(name => {
    return !ignore.includes(name);
});
const wrap = (fn) => function(...args) {
    return fn.apply(this._string, args);
};
for (let key of _keys) {
    LString.prototype[key] = wrap(String.prototype[key]);
}

// -----------------------------------------------------------------------------
LString.isString = function(x) {
    return x instanceof LString || typeof x === 'string';
};

// -----------------------------------------------------------------------------
LString.prototype.get = function(n) {
    return this._string[n];
};

// -----------------------------------------------------------------------------
LString.prototype.cmp = function(string) {
    typecheck('LStrign::cmp', string, 'string');
    var a = this.valueOf();
    var b = string.valueOf();
    if (a < b) {
        return -1;
    } else if (a === b) {
        return 0;
    } else {
        return 1;
    }
};

// -----------------------------------------------------------------------------
LString.prototype.lower = function() {
    return LString(this._string.toLowerCase());
};

// -----------------------------------------------------------------------------
LString.prototype.upper = function() {
    return LString(this._string.toUpperCase());
};

// -----------------------------------------------------------------------------
LString.prototype.set = function(n, char) {
    if (char instanceof LCharacter) {
        char = char.char;
    }
    var string = [];
    if (n > 0) {
        string.push(this._string.substring(0, n));
    }
    string.push(char);
    if (n < this._string.length - 1) {
        string.push(this._string.substring(n + 1));
    }
    this._string = string.join('');
};

// -----------------------------------------------------------------------------
Object.defineProperty(LString.prototype, "length", {
    get: function() {
        return this._string.length;
    }
});

// -----------------------------------------------------------------------------
LString.prototype.clone = function() {
    return LString(this.valueOf());
};

// -----------------------------------------------------------------------------
LString.prototype.fill = function(chr) {
    if (chr instanceof LCharacter) {
        chr = chr.toString();
    }
    var len = this._string.length;
    this._string = new Array(len + 1).join(chr);
};
