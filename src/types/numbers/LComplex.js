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
export default function LComplex(n, force = false) {
    if (typeof this !== 'undefined' && !(this instanceof LComplex) ||
        typeof this === 'undefined') {
        return new LComplex(n, force);
    }
    if (n instanceof LComplex) {
        return LComplex({ im: n.im, re: n.re });
    }
    if (LNumber.isNumber(n) && force) {
        n = { im: 0, re: n.valueOf() };
    } else if (!LNumber.isComplex(n)) {
        throw new Error('Invalid constructor call for LComplex');
    }
    var im = n.im instanceof LNumber ? n.im : LNumber(n.im);
    var re = n.re instanceof LNumber ? n.re : LNumber(n.re);
    //const [im, re] = LNumber.coerce(n.im, n.re);
    if (im.cmp(0) === 0 && !force) {
        return re;
    }
    this.im = im;
    this.re = re;
    this.type = 'complex';
}

// -----------------------------------------------------------------------------
LComplex.prototype = Object.create(LNumber.prototype);
LComplex.prototype.constructor = LComplex;

// -----------------------------------------------------------------------------
LComplex.prototype.toRational = function(n) {
    if (LNumber.isFloat(this.im) && LNumber.isFloat(this.re)) {
        const im = LFloat(this.im).toRational(n);
        const re = LFloat(this.re).toRational(n);
        return LComplex({ im, re });
    }
    return this;
};

// -----------------------------------------------------------------------------
LComplex.prototype.add = function(n) {
    return this.complex_op(n, function(a_re, b_re, a_im, b_im) {
        return {
            re: a_re.add(b_re),
            im: a_im.add(b_im)
        };
    });
};

// -----------------------------------------------------------------------------
// :: factor is used in / and modulus
// -----------------------------------------------------------------------------
LComplex.prototype.factor = function() {
    // fix rounding when calculating (/ 1.0 1/10+1/10i)
    if (this.im instanceof LFloat || this.im instanceof LFloat) {
        let { re, im } = this;
        let x, y;
        if (re instanceof LFloat) {
            x = re.toRational().mul(re.toRational());
        } else {
            x = re.mul(re);
        }
        if (im instanceof LFloat) {
            y = im.toRational().mul(im.toRational());
        } else {
            y = im.mul(im);
        }
        return x.add(y);
    } else {
        return this.re.mul(this.re).add(this.im.mul(this.im));
    }
};

// -----------------------------------------------------------------------------
LComplex.prototype.modulus = function() {
    return this.factor().sqrt();
};

// -----------------------------------------------------------------------------
LComplex.prototype.sqrt = function() {
    const r = this.modulus();
    // code based ok Kawa Scheme source code (file DComplex.java)
    // Copyright (c) 1997  Per M.A. Bothner.
    // Released under MIT License
    let re, im;
    if (r.cmp(0) === 0) {
        re = im = r;
    } else if (this.re.cmp(0) === 1) {
        re = LFloat(0.5).mul(r.add(this.re)).sqrt();
        im = this.im.div(re).div(2);
    } else {
        im = LFloat(0.5).mul(r.sub(this.re)).sqrt();
        if (this.im.cmp(0) === -1) {
            im = im.sub();
        }
        re = this.im.div(im).div(2);
    }
    return LComplex({ im, re });
};

// -----------------------------------------------------------------------------
LComplex.prototype.div = function(n) {
    if (LNumber.isNumber(n) && !LNumber.isComplex(n)) {
        n = LComplex({ im: 0, re: n });
    } else if (!LNumber.isComplex(n)) {
        throw new Error('[LComplex::add] Invalid value');
    }
    const [ a, b ] = this.coerce(n);
    const conj = LComplex({ re: b.re, im: b.im.sub() });
    const denom = b.factor().valueOf();
    const num = a.mul(conj);
    const re = num.re.op('/', denom);
    const im = num.im.op('/', denom);
    return LComplex({ re, im });
};

// -----------------------------------------------------------------------------
LComplex.prototype.sub = function(n) {
    return this.complex_op(n, function(a_re, b_re, a_im, b_im) {
        return {
            re: a_re.sub(b_re),
            im: a_im.sum(b_im)
        };
    });
};

// -----------------------------------------------------------------------------
LComplex.prototype.mul = function(n) {
    return this.complex_op(n, function(a_re, b_re, a_im, b_im) {
        var ret = {
            re: a_re.mul(b_re).sub(a_im.mul(b_im)),
            im: a_re.mul(b_im).add(b_re.mul(a_im))
        };
        return ret;
    });
};

// -----------------------------------------------------------------------------
LComplex.prototype.complex_op = function(n, fn) {
    if (LNumber.isNumber(n) && !LNumber.isComplex(n)) {
        if (!(n instanceof LNumber)) {
            n = LNumber(n);
        }
        const im = n.asType(0);
        n = { im, re: n };
    } else if (!LNumber.isComplex(n)) {
        throw new Error('[LComplex::add] Invalid value');
    }
    var re = n.re instanceof LNumber ? n.re : this.re.asType(n.re);
    var im = n.im instanceof LNumber ? n.im : this.im.asType(n.im);
    var ret = fn(this.re, re, this.im, im);
    if ('im' in ret && 're' in ret) {
        var x = LComplex(ret, true);
        return x;
    }
    return ret;
};

// -----------------------------------------------------------------------------
LComplex._op = {
    '+': 'add',
    '-': 'sub',
    '*': 'mul',
    '/': 'div'
};

// -----------------------------------------------------------------------------
LComplex.prototype._op = function(op, n) {
    const fn = LComplex._op[op];
    return this[fn](n);
};

// -----------------------------------------------------------------------------
LComplex.prototype.cmp = function(n) {
    const [a, b] = this.coerce(n);
    const [re_a, re_b] = a.re.coerce(b.re);
    const re_cmp = re_a.cmp(re_b);
    if (re_cmp !== 0) {
        return re_cmp;
    } else {
        const [im_a, im_b] = a.im.coerce(b.im);
        return im_a.cmp(im_b);
    }
};

// -----------------------------------------------------------------------------
LComplex.prototype.valueOf = function() {
};

// -----------------------------------------------------------------------------
LComplex.prototype.toString = function() {
    var result;
    if (this.re.cmp(0) !== 0) {
        result = [this.re.toString()];
    } else {
        result = [];
    }
    result.push(this.im.cmp(0) < 0 ? '-' : '+');
    result.push(this.im.toString().replace(/^-/, ''));
    result.push('i');
    return result.join('');
};
