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

import { LNumber, LRational } from './index.js';

// -----------------------------------------------------------------------------
export default function LFloat(n) {
    if (typeof this !== 'undefined' && !(this instanceof LFloat) ||
        typeof this === 'undefined') {
        return new LFloat(n);
    }
    if (!LNumber.isNumber(n)) {
        throw new Error('Invalid constructor call for LFloat');
    }
    if (n instanceof LNumber) {
        return LFloat(n.valueOf());
    }
    if (typeof n === 'number') {
        this.value = n;
        this.type = 'float';
    }
}
// -----------------------------------------------------------------------------
LFloat.prototype = Object.create(LNumber.prototype);
LFloat.prototype.constructor = LFloat;
// -----------------------------------------------------------------------------
LFloat.prototype.toString = function() {
    var str = this.value.toString();
    if (!LNumber.isFloat(this.value) && !str.match(/e/i)) {
        return str + '.0';
    }
    return str.replace(/^([0-9]+)e/, '$1.0e');
};
// -----------------------------------------------------------------------------
LFloat.prototype._op = function(op, n) {
    if (n instanceof LNumber) {
        n = n.value;
    }
    const fn = LNumber._ops[op];
    if (op === '/' && this.value === 0 && n === 0) {
        return NaN;
    }
    return LFloat(fn(this.value, n), true);
};
// -----------------------------------------------------------------------------
// same aproximation as in guile scheme
LFloat.prototype.toRational = function(n = null) {
    if (n === null) {
        return toRational(this.value.valueOf());
    }
    return approxRatio(n.valueOf())(this.value.valueOf());
};

// -----------------------------------------------------------------------------
// based on https://rosettacode.org/wiki/Convert_decimal_number_to_rational
// -----------------------------------------------------------------------------
var toRational = approxRatio(1e-10);
function approxRatio(eps) {
    return function(n) {
        const gcde = (e, x, y) => {
                const _gcd = (a, b) => (b < e ? a : _gcd(b, a % b));
                return _gcd(Math.abs(x), Math.abs(y));
            },
            c = gcde(eps ? eps : (1 / 10000), 1, n);
        return LRational({ num: Math.floor(n / c), denom: Math.floor(1 / c) });
    };
}
