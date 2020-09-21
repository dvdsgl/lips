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

import { LString } from '../index.js';
import { LBigInteger, LFloat, LComplex, LRational } from './index.js';

// -----------------------------------------------------------------------------
// :: Number wrapper that handle BigNumbers
// -----------------------------------------------------------------------------
export default function LNumber(n, force = false) {
    if (n instanceof LNumber) {
        return n;
    }
    if (typeof this !== 'undefined' && !(this instanceof LNumber) ||
        typeof this === 'undefined') {
        return new LNumber(n, force);
    }
    if (typeof n === 'undefined') {
        throw new Error('Invlaid LNumber constructor call');
    }
    var _type = LNumber.getType(n);
    if (LNumber.types[_type]) {
        return LNumber.types[_type](n, force);
    }
    var parsable = n instanceof Array && LString.isString(n[0]) &&
        LNumber.isNumber(n[1]);
    if (n instanceof LNumber) {
        return LNumber(n.value);
    }
    if (!LNumber.isNumber(n) && !parsable) {
        throw new Error(`You can't create LNumber from ${type(n)}`);
    }
    // prevent infite loop https://github.com/indutny/bn.js/issues/186
    if (n === null) {
        n = 0;
    }
    var value;
    if (parsable) {
        var [str, radix] = n;
        if (str instanceof LString) {
            str = str.valueOf();
        }
        if (radix instanceof LNumber) {
            radix = radix.valueOf();
        }
        var sign = str.match(/^([+-])/);
        var minus = false;
        if (sign) {
            str = str.replace(/^[+-]/, '');
            if (sign[1] === '-') {
                minus = true;
            }
        }
    }
    if (typeof BigInt !== 'undefined') {
        if (typeof n !== 'bigint') {
            if (parsable) {
                let prefix;
                // default number base (radix) supported by BigInt constructor
                switch (radix) {
                    case 8:
                        prefix = '0o';
                        break;
                    case 16:
                        prefix = '0x';
                        break;
                    case 2:
                        prefix = '0b';
                        break;
                    case 10:
                        prefix = '';
                        break;
                }
                if (typeof prefix === 'undefined') {
                    // non standard radix we convert by hand
                    var n_radix = BigInt(radix);
                    value = [...str].map((x, i) => {
                        return BigInt(parseInt(x, radix)) * (n_radix ** BigInt(i));
                    }).reduce((a, b) => a + b);
                } else {
                    value = BigInt(prefix + str);
                }
            } else {
                value = BigInt(n);
            }
            if (minus) {
                value *= BigInt(-1);
            }
        } else {
            value = n;
        }
        return LBigInteger(value, true);
    } else if (typeof BN !== 'undefined' && !(n instanceof BN)) {
        if (n instanceof Array) {
            return LBigInteger(new BN(...n));
        }
        return LBigInteger(new BN(n));
    } else if (parsable) {
        this.value = parseInt(str, radix);
    } else {
        this.value = n;
    }
}

// -----------------------------------------------------------------------------
LNumber.types = {
    float: function(n, force = false) {
        return new LFloat(n, force);
    },
    complex: function(n, force = false) {
        if (!LNumber.isComplex(n)) {
            n = { im: 0, re: n };
        }
        return new LComplex(n, force);
    },
    rational: function(n, force = false) {
        if (!LNumber.isRational(n)) {
            n = { num: n, denom: 1 };
        }
        return new LRational(n, force);
    }
};

// -----------------------------------------------------------------------------
LNumber.prototype.gcd = function(b) {
    // ref: https://rosettacode.org/wiki/Greatest_common_divisor#JavaScript
    var a = this.abs();
    b = b.abs();
    if (b.cmp(a) === 1) {
        var temp = a;
        a = b;
        b = temp;
    }
    while (true) {
        a = a.rem(b);
        if (a.cmp(0) === 0) {
            return b;
        }
        b = b.rem(a);
        if (b.cmp(0) === 0) {
            return a;
        }
    }
};

// -----------------------------------------------------------------------------
LNumber.isFloat = function isFloat(n) {
    return n instanceof LFloat || (Number(n) === n && n % 1 !== 0);
};

// -----------------------------------------------------------------------------
LNumber.isNumber = function(n) {
    return n instanceof LNumber ||
        (!Number.isNaN(n) && LNumber.isNative(n) || LNumber.isBN(n));
};

// -----------------------------------------------------------------------------
LNumber.isComplex = function(n) {
    var ret = n instanceof LComplex ||
        (LNumber.isNumber(n.im) && LNumber.isNumber(n.re));
    return ret;
};

// -----------------------------------------------------------------------------
LNumber.isRational = function(n) {
    return n instanceof LRational ||
        (LNumber.isNumber(n.num) && LNumber.isNumber(n.denom));
};

// -----------------------------------------------------------------------------
LNumber.isNative = function(n) {
    return typeof n === 'bigint' || typeof n === 'number';
};

// -----------------------------------------------------------------------------
LNumber.isBigInteger = function(n) {
    return n instanceof LBigInteger || typeof n === 'bigint' ||
        LNumber.isBN(n);
};

// -----------------------------------------------------------------------------
LNumber.isBN = function(n) {
    return typeof BN !== 'undefined' && n instanceof BN;
};

// -----------------------------------------------------------------------------
LNumber.getArgsType = function(a, b) {
    if (a instanceof LFloat || b instanceof LFloat) {
        return LFloat;
    }
    if (a instanceof LBigInteger || b instanceof LBigInteger) {
        return LBigInteger;
    }
    return LNumber;
};

// -----------------------------------------------------------------------------
LNumber.prototype.toString = LNumber.prototype.toJSON = function(radix) {
    if (radix > 2 && radix < 36) {
        return this.value.toString(radix);
    }
    return this.value.toString();
};

// -----------------------------------------------------------------------------
LNumber.prototype.asType = function(n) {
    var _type = LNumber.getType(this);
    return LNumber.types[_type] ? LNumber.types[_type](n) : LNumber(n);
};

// -----------------------------------------------------------------------------
LNumber.prototype.isBigNumber = function() {
    return typeof this.value === 'bigint' ||
        typeof BN !== 'undefined' && !(this.value instanceof BN);
};

// -----------------------------------------------------------------------------
['floor', 'ceil', 'round'].forEach(fn => {
    LNumber.prototype[fn] = function() {
        if (this.float || LNumber.isFloat(this.value)) {
            return LNumber(Math[fn](this.value));
        } else {
            return LNumber(Math[fn](this.valueOf()));
        }
    };
});

// -----------------------------------------------------------------------------
LNumber.prototype.valueOf = function() {
    if (LNumber.isNative(this.value)) {
        return Number(this.value);
    } else if (LNumber.isBN(this.value)) {
        return this.value.toNumber();
    }
};

// -----------------------------------------------------------------------------
var matrix = (function() {
    var i = (a, b) => [a, b];
    return {
        bigint: {
            'bigint': i,
            'float': (a, b) => [LFloat(a.valueOf(), true), b],
            'rational': (a, b) => [{ num: a, denom: 1 }, b],
            'complex': (a, b) => [{ im: 0, re: a }, b]
        },
        float: {
            'bigint': (a, b) => [a, b && LFloat(b.valueOf(), true)],
            'float': i,
            'rational': (a, b) => [a, b && LFloat(b.valueOf(), true)],
            'complex': (a, b) => [{ re: a, im: LFloat(0, true) }, b]
        },
        complex: {
            bigint: complex('bigint'),
            float: complex('float'),
            rational: complex('rational'),
            complex: (a, b) => {
                const [a_re, b_re] = LNumber.coerce(a.re, b.re);
                const [a_im, b_im] = LNumber.coerce(a.im, b.im);
                return [
                    { im: a_im, re: a_re },
                    { im: b_im, re: b_re }
                ];
            }
        },
        rational: {
            bigint: (a, b) => [a, b && { num: b, denom: 1 }],
            float: (a, b) => [LFloat(a.valueOf()), b],
            rational: i,
            complex: (a, b) => {
                return [
                    {
                        im: coerce(a.type, b.im.type, 0),
                        re: coerce(a.type, b.re.type, a)
                    },
                    {
                        im: coerce(a.type, b.im.type, b.im),
                        re: coerce(a.type, b.re.type, b.re)
                    }
                ];
            }
        }
    };
    function complex(type) {
        return (a, b) => {
            return [
                {
                    im: coerce(type, a.im.type, a.im),
                    re: coerce(type, a.re.type, a.re)
                },
                {
                    im: coerce(type, a.im.type, 0),
                    re: coerce(type, b.type, b)
                }
            ];
        };
    }
})();

// -----------------------------------------------------------------------------
function coerce(type_a, type_b, a) {
    return matrix[type_a][type_b](a)[0];
}

// -----------------------------------------------------------------------------
LNumber.coerce = function(a, b) {
    function clean(type) {
        if (type === 'integer') {
            return 'bigint';
        }
        return type;
    }
    const a_type = clean(LNumber.getType(a));
    const b_type = clean(LNumber.getType(b));
    if (!matrix[a_type]) {
        throw new Error(`LNumber::coerce unknown lhs type ${a_type}`);
    } else if (!matrix[a_type][b_type]) {
        throw new Error(`LNumber::coerce unknown rhs type ${b_type}`);
    }
    return matrix[a_type][b_type](a, b).map(n => LNumber(n, true));
};

// -----------------------------------------------------------------------------
LNumber.prototype.coerce = function(n) {
    if (!(typeof n === 'number' || n instanceof LNumber)) {
        throw new Error(`LNumber: you can't coerce ${type(n)}`);
    }
    if (typeof n === 'number') {
        n = LNumber(n);
    }
    return LNumber.coerce(this, n);
};

// -----------------------------------------------------------------------------
LNumber.getType = function(n) {
    if (n instanceof LNumber) {
        return n.type;
    }
    if (LNumber.isFloat(n)) {
        return 'float';
    }
    if (LNumber.isComplex(n)) {
        return 'complex';
    }
    if (LNumber.isRational(n)) {
        return 'rational';
    }
    if (typeof n === 'number') {
        return 'integer';
    }
    if ((typeof BigInt !== 'undefined' && typeof n !== 'bigint') ||
        (typeof BN !== 'undefined' && !(n instanceof BN))) {
        return 'bigint';
    }
};

// -----------------------------------------------------------------------------
LNumber.prototype.isFloat = function() {
    return !!(LNumber.isFloat(this.value) || this.float);
};

// -----------------------------------------------------------------------------
var mapping = {
    'add': '+',
    'sub': '-',
    'mul': '*',
    'div': '/',
    'rem': '%',
    'or': '|',
    'and': '&',
    'neg': '~',
    'shl': '>>',
    'shr': '<<'
};

LNumber.rev_mapping = {};
Object.keys(mapping).forEach((key) => {
    LNumber.rev_mapping[mapping[key]] = key;
    LNumber.prototype[key] = function(n) {
        return this.op(mapping[key], n);
    };
});

// -----------------------------------------------------------------------------
LNumber._ops = {
    '*': function(a, b) {
        return a * b;
    },
    '+': function(a, b) {
        return a + b;
    },
    '-': function(a, b) {
        if (typeof b === 'undefined') {
            return -a;
        }
        return a - b;
    },
    '/': function(a, b) {
        return a / b;
    },
    '%': function(a, b) {
        return a % b;
    },
    '|': function(a, b) {
        return a | b;
    },
    '&': function(a, b) {
        return a & b;
    },
    '~': function(a) {
        return ~a;
    },
    '>>': function(a, b) {
        return a >> b;
    },
    '<<': function(a, b) {
        return a << b;
    }
};

// -----------------------------------------------------------------------------
LNumber.prototype.op = function(op, n) {
    if (typeof n === 'undefined') {
        return LNumber(LNumber._ops[op](this.valueOf()));
    }
    const [a, b] = this.coerce(n);
    if (a._op) {
        return a._op(op, b);
    }
    return LNumber(LNumber._ops[op](a, b));
};

// -----------------------------------------------------------------------------
LNumber.prototype.sqrt = function() {
    var value = this.valueOf();
    if (this.cmp(0) < 0) {
        return LComplex({ re: 0, im: Math.sqrt(-value) });
    }
    return new LNumber(Math.sqrt(value));
};

// -----------------------------------------------------------------------------
// if browser doesn't support ** it will not parse the code so we use
// Function constructor for test
// -----------------------------------------------------------------------------
var pow = new Function('a,b', 'return a**b;');
var power_operator_suported = (function() {
    try {
        pow(1, 1);
        return true;
    } catch (e) {
        return false;
    }
})();

// -----------------------------------------------------------------------------
LNumber.prototype.pow = function(n) {
    if (LNumber.isNative(this.value)) {
        if (power_operator_suported) {
            n.value = pow(this.value, n.value);
        } else {
            throw new Error("Power operator not supported");
        }
    } else if (LNumber.isBN(this.value)) {
        n.value = this.value.pow(n.value);
    } else {
        n.value = Math.pow(this.value, n.value);
    }
    return n;
};

// -----------------------------------------------------------------------------
LNumber.prototype.abs = function() {
    var value = this.value;
    if (LNumber.isNative(this.value)) {
        if (value < 0) {
            value = -value;
        }
    } else if (LNumber.isBN(value)) {
        value.iabs();
    }
    return new LNumber(value);
};

// -----------------------------------------------------------------------------
LNumber.prototype.isOdd = function() {
    if (LNumber.isNative(this.value)) {
        if (this.isBigNumber()) {
            return this.value % BigInt(2) === BigInt(1);
        }
        return this.value % 2 === 1;
    } else if (LNumber.isBN(this.value)) {
        return this.value.isOdd();
    }
};

// -----------------------------------------------------------------------------
LNumber.prototype.isEven = function() {
    return !this.isOdd();
};

// -----------------------------------------------------------------------------
LNumber.prototype.cmp = function(n) {
    const [a, b] = this.coerce(n);
    function cmp(a, b) {
        if (a.value < b.value) {
            return -1;
        } else if (a.value === b.value) {
            return 0;
        } else {
            return 1;
        }
    }
    if (a.type === 'bigint') {
        if (LNumber.isNative(a.value)) {
            return cmp(a, b);
        } else if (LNumber.isBN(a.value)) {
            return this.value.cmp(b.value);
        }
    } else if (a instanceof LFloat) {
        return cmp(a, b);
    }
};
