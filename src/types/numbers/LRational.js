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

import { LNumber, LFloat } from './index.js';

// -----------------------------------------------------------------------------
export default function LRational(n, force = false) {
    if (typeof this !== 'undefined' && !(this instanceof LRational) ||
        typeof this === 'undefined') {
        return new LRational(n, force);
    }
    if (!LNumber.isRational(n)) {
        throw new Error('Invalid constructor call for LRational');
    }
    var num = LNumber(n.num);
    var denom = LNumber(n.denom);
    if (!force && denom.cmp(0) !== 0) {
        var is_integer = num.op('%', denom).cmp(0) === 0;
        if (is_integer) {
            return LNumber(num.div(denom));
        }
    }
    this.num = num;
    this.denom = denom;
    this.type = 'rational';
}
// -----------------------------------------------------------------------------
LRational.prototype = Object.create(LNumber.prototype);
LRational.prototype.constructor = LRational;
// -----------------------------------------------------------------------------
LRational.prototype.pow = function(n) {
    var cmp = n.cmp(0);
    if (cmp === 0) {
        return LNumber(1);
    }
    if (cmp === -1) {
        n = n.sub();
        var num = this.denom.pow(n);
        var denom = this.num.pow(n);
        return LRational({ num, denom });
    }
    var result = this;
    n = n.valueOf();
    while (n > 1) {
        result = result.mul(this);
        n--;
    }
    return result;
};
// -----------------------------------------------------------------------------
LRational.prototype.sqrt = function() {
    const num = this.num.sqrt();
    const denom = this.denom.sqrt();
    if (num instanceof LFloat) {
        num = num.toRational();
    }
    if (denom instanceof LFloat) {
        denom = denom.toRational();
    }
    return LRational({ num, denom });
};
// -----------------------------------------------------------------------------
LRational.prototype.abs = function() {
    var num = this.num;
    var denom = this.denom;
    if (num.cmp(0) === -1) {
        num = num.sub();
    }
    if (denom.cmp(0) !== 1) {
        denom = denom.sub();
    }
    return LRational({ num, denom });
};
// -----------------------------------------------------------------------------
LRational.prototype.cmp = function(n) {
    return LNumber(this.valueOf(), true).cmp(n);
};
// -----------------------------------------------------------------------------
LRational.prototype.toString = function() {
    var gcd = this.num.gcd(this.denom);
    var num, denom;
    if (gcd.cmp(1) !== 0) {
        num = this.num.div(gcd);
        if (num instanceof LRational) {
            num = LNumber(num.valueOf(true));
        }
        denom = this.denom.div(gcd);
        if (denom instanceof LRational) {
            denom = LNumber(denom.valueOf(true));
        }
    } else {
        num = this.num;
        denom = this.denom;
    }
    const minus = this.cmp(0) < 0;
    if (minus) {
        if (num.abs().cmp(denom.abs()) === 0) {
            return num.toString();
        }
    } else if (num.cmp(denom) === 0) {
        return num.toString();
    }
    return num.toString() + '/' + denom.toString();
};
// -----------------------------------------------------------------------------
LRational.prototype.valueOf = function(exact) {
    if (this.denom.cmp(0) === 0) {
        if (this.num.cmp(0) < 0) {
            return Number.NEGATIVE_INFINITY;
        }
        return Number.POSITIVE_INFINITY;
    }
    if (exact) {
        return LNumber._ops['/'](this.num.value, this.denom.value);
    }
    return LFloat(this.num.valueOf()).div(this.denom.valueOf());
};
// -----------------------------------------------------------------------------
LRational.prototype.mul = function(n) {
    if (!(n instanceof LNumber)) {
        n = LNumber(n); // handle (--> 1/2 (mul 2))
    }
    if (LNumber.isRational(n)) {
        var num = this.num.mul(n.num);
        var denom = this.denom.mul(n.denom);
        return LRational({ num, denom });
    }
    const [a, b] = LNumber.coerce(this, n);
    return a.mul(b);
};
// -----------------------------------------------------------------------------
LRational.prototype.div = function(n) {
    if (!(n instanceof LNumber)) {
        n = LNumber(n); // handle (--> 1/2 (div 2))
    }
    if (LNumber.isRational(n)) {
        var num = this.num.mul(n.denom);
        var denom = this.denom.mul(n.num);
        return LRational({ num, denom });
    }
    const [a, b] = LNumber.coerce(this, n);
    const ret = a.div(b);
    return ret;
};
// -----------------------------------------------------------------------------
LRational.prototype._op = function(op, n) {
    return this[LNumber.rev_mapping[op]](n);
};
// -----------------------------------------------------------------------------
LRational.prototype.sub = function(n) {
    if (typeof n === 'undefined') {
        return this.mul(-1);
    }
    if (!(n instanceof LNumber)) {
        n = LNumber(n); // handle (--> 1/2 (sub 1))
    }
    if (LNumber.isRational(n)) {
        var num = n.num.sub();
        var denom = n.denom;
        return this.add(LRational({ num, denom }));
    }
    if (!(n instanceof LNumber)) {
        n = LNumber(n).sub();
    } else {
        n = n.sub();
    }
    const [a, b] = LNumber.coerce(this, n);
    return a.add(b);
};
// -----------------------------------------------------------------------------
LRational.prototype.add = function(n) {
    if (!(n instanceof LNumber)) {
        n = LNumber(n); // handle (--> 1/2 (add 1))
    }
    if (LNumber.isRational(n)) {
        const a_denom = this.denom;
        const b_denom = n.denom;
        const a_num = this.num;
        const b_num = n.num;
        let denom, num;
        if (a_denom !== b_denom) {
            num = b_denom.mul(a_num).add(b_num.mul(a_denom));
            denom = a_denom.mul(b_denom);
        } else {
            num = a_num.add(b_num);
            denom = a_denom;
        }
        return LRational({ num, denom });
    }
    if (LNumber.isFloat(n)) {
        return LFloat(this.valueOf()).add(n);
    }
    const [a, b] = LNumber.coerce(this, n);
    return a.add(b);
};
