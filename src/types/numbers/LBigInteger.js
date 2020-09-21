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

import { LNumber, LRational, LComplex } from './index.js';

// -----------------------------------------------------------------------------
export default function LBigInteger(n, native) {
    if (typeof this !== 'undefined' && !(this instanceof LBigInteger) ||
        typeof this === 'undefined') {
        return new LBigInteger(n, native);
    }
    if (n instanceof LBigInteger) {
        return LBigInteger(n.value, n._native);
    }
    if (!LNumber.isBigInteger(n)) {
        throw new Error('Invalid constructor call for LBigInteger');
    }
    this.value = n;
    this._native = native;
    this.type = 'bigint';
}

// -----------------------------------------------------------------------------
LBigInteger.prototype = Object.create(LNumber.prototype);
LBigInteger.prototype.constructor = LBigInteger;

// -----------------------------------------------------------------------------
LBigInteger.bn_op = {
    '+': 'iadd',
    '-': 'isub',
    '*': 'imul',
    '/': 'idiv',
    '%': 'imod',
    '|': 'ior',
    '&': 'iand',
    '~': 'inot',
    '<<': 'ishrn',
    '>>': 'ishln'
};

// -----------------------------------------------------------------------------
LBigInteger.prototype._op = function(op, n) {
    if (typeof n === 'undefined') {
        if (LNumber.isBN(this.value)) {
            op = LBigInteger.bn_op[op];
            return LBigInteger(this.value.clone()[op](), false);
        }
        return LBigInteger(LNumber._ops[op](this.value), true);
    }
    if (LNumber.isBN(this.value) && LNumber.isBN(n.value)) {
        op = LBigInteger.bn_op[op];
        return LBigInteger(this.value.clone()[op](n), false);
    }
    const ret = LNumber._ops[op](this.value, n.value);
    if (op === '/') {
        var is_integer = this.op('%', n).cmp(0) === 0;
        if (is_integer) {
            return LNumber(ret);
        }
        return LRational({ num: this, denom: n });
    }
    // use native calucaltion becuase it's real bigint value
    return LBigInteger(ret, true);
};

// -----------------------------------------------------------------------------
LBigInteger.prototype.sqrt = function() {
    var value;
    var minus = this.cmp(0) < 0;
    if (LNumber.isNative(this.value)) {
        value = LNumber(Math.sqrt(minus ? -this.valueOf() : this.valueOf()));
    } else if (LNumber.isBN(this.value)) {
        value = minus ? this.value.neg().sqrt() : this.value.sqrt();
    }
    if (minus) {
        return LComplex({ re: 0, im: value });
    }
    return value;
};
