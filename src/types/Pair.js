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
import { nil, LString, LSymbol, LNumber } from './index.js';

// -----------------------------------------------------------------------------
// :: Pair constructor
// -----------------------------------------------------------------------------
export default function Pair(car, cdr) {
    if (typeof this !== 'undefined' && this.constructor !== Pair ||
        typeof this === 'undefined') {
        return new Pair(car, cdr);
    }
    this.car = car;
    this.cdr = cdr;
}

// ----------------------------------------------------------------------
// :: flatten nested arrays
// :: source: https://stackoverflow.com/a/27282907/387194
// ----------------------------------------------------------------------
function flatten(array, mutable) {
    var toString = Object.prototype.toString;
    var arrayTypeStr = '[object Array]';

    var result = [];
    var nodes = (mutable && array) || array.slice();
    var node;

    if (!array.length) {
        return result;
    }

    node = nodes.pop();

    do {
        if (toString.call(node) === arrayTypeStr) {
            nodes.push.apply(nodes, node);
        } else {
            result.push(node);
        }
    } while (nodes.length && (node = nodes.pop()) !== undefined);

    result.reverse(); // we reverse result to restore the original order
    return result;
}

// -----------------------------------------------------------------------------
Pair.prototype.flatten = function() {
    return Pair.fromArray(flatten(this.toArray()));
};

// -----------------------------------------------------------------------------
Pair.prototype.length = function() {
    var len = 0;
    var node = this;
    while (true) {
        if (!node || node === nil || !(node instanceof Pair) ||
             node.haveCycles('cdr')) {
            break;
        }
        len++;
        node = node.cdr;
    }
    return len;
};

// -----------------------------------------------------------------------------
Pair.prototype.clone = function() {
    var visited = new Map();
    function clone(node) {
        if (node instanceof Pair) {
            if (visited.has(node)) {
                return visited.get(node);
            }
            var pair = new Pair();
            visited.set(node, pair);
            pair.car = clone(node.car);
            pair.cdr = clone(node.cdr);
            pair.cycles = node.cycles;
            return pair;
        }
        return node;
    }
    return clone(this);
};

// -----------------------------------------------------------------------------
Pair.prototype.lastPair = function() {
    let node = this;
    while (true) {
        if (node.cdr === nil) {
            return node;
        }
        node = node.cdr;
    }
};

// -----------------------------------------------------------------------------
Pair.prototype.toArray = function() {
    var result = [];
    if (this.car instanceof Pair) {
        result.push(this.car.toArray());
    } else {
        result.push(this.car.valueOf());
    }
    if (this.cdr instanceof Pair) {
        result = result.concat(this.cdr.toArray());
    }
    return result;
};

// -----------------------------------------------------------------------------
Pair.fromArray = function(array, deep = true) {
    if (array instanceof Pair) {
        return array;
    }
    if (deep === false) {
        var list = nil;
        for (let i = array.length; i--;) {
            list = new Pair(array[i], list);
        }
        return list;
    }
    if (array.length && !(array instanceof Array)) {
        array = [...array];
    }
    var result = nil;
    var i = array.length;
    while (i--) {
        let car = array[i];
        if (car instanceof Array) {
            car = Pair.fromArray(car);
        } else if (typeof car === 'string') {
            car = LString(car);
        } else if (typeof car === 'number' && !Number.isNaN(car)) {
            car = LNumber(car);
        }
        result = new Pair(car, result);
    }
    return result;
};

// -----------------------------------------------------------------------------
// by default toObject was created to create JavaScript objects,
// so it use valueOf to get native values
// literal parameter was a hack to allow create LComplex from LIPS code
// -----------------------------------------------------------------------------
Pair.prototype.toObject = function(literal = false) {
    var node = this;
    var result = {};
    while (true) {
        if (node instanceof Pair && node.car instanceof Pair) {
            var pair = node.car;
            var name = pair.car;
            if (name instanceof LSymbol) {
                name = name.name;
            }
            if (name instanceof String) {
                name = name.valueOf();
            }
            var cdr = pair.cdr;
            if (cdr instanceof Pair) {
                cdr = cdr.toObject(literal);
            }
            if (cdr instanceof LNumber ||
                cdr instanceof LString ||
                cdr instanceof LCharacter) {
                if (!literal) {
                    cdr = cdr.valueOf();
                }
            }
            result[name] = cdr;
            node = node.cdr;
        } else {
            break;
        }
    }
    return result;
};

// -----------------------------------------------------------------------------
Pair.fromPairs = function(array) {
    return array.reduce((list, pair) => {
        return new Pair(
            new Pair(
                new LSymbol(pair[0]),
                pair[1]
            ),
            list
        );
    }, nil);
};

// -----------------------------------------------------------------------------
Pair.fromObject = function(obj) {
    var array = Object.keys(obj).map((key) => [key, obj[key]]);
    return Pair.fromPairs(array);
};

// -----------------------------------------------------------------------------
Pair.prototype.reduce = function(fn) {
    var node = this;
    var result = nil;
    while (true) {
        if (node !== nil) {
            result = fn(result, node.car);
            node = node.cdr;
        } else {
            break;
        }
    }
    return result;
};

// -----------------------------------------------------------------------------
Pair.prototype.reverse = function() {
    if (this.haveCycles()) {
        throw new Error("You can't reverse list that have cycles");
    }
    var node = this;
    var prev = nil;
    while (node !== nil) {
        var next = node.cdr;
        node.cdr = prev;
        prev = node;
        node = next;
    }
    return prev;
};

// -----------------------------------------------------------------------------
Pair.prototype.transform = function(fn) {
    var visited = [];
    function recur(pair) {
        if (pair instanceof Pair) {
            if (pair.replace) {
                delete pair.replace;
                return pair;
            }
            var car = fn(pair.car);
            if (car instanceof Pair) {
                car = recur(car);
                visited.push(car);
            }
            var cdr = fn(pair.cdr);
            if (cdr instanceof Pair) {
                cdr = recur(cdr);
                visited.push(cdr);
            }
            return new Pair(car, cdr);
        }
        return pair;
    }
    return recur(this);
};

// -----------------------------------------------------------------------------
Pair.prototype.map = function(fn) {
    if (typeof this.car !== 'undefined') {
        return new Pair(fn(this.car), this.cdr === nil ? nil : this.cdr.map(fn));
    } else {
        return nil;
    }
};

// -----------------------------------------------------------------------------
Pair.unDry = function(value) {
    return new Pair(value.car, value.cdr);
};

// -----------------------------------------------------------------------------
Pair.prototype.toDry = function() {
    return {
        value: {
            car: this.car,
            cdr: this.cdr
        }
    };
};
