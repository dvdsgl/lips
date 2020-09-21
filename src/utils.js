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

import { typecheck } from './types/utils.js';
import { nil, Pair } from './types/index.js';

// -----------------------------------------------------------------------------
function trim_lines(string) {
    return string.split('\n').map(line => {
        return line.trim();
    }).join('\n');
}

// -----------------------------------------------------------------------------
// :: documentaton decorator to LIPS functions if lines starts with :
// :: they are ignored (not trim) otherwise it trim so
// :: so you can have indent in source code
// -----------------------------------------------------------------------------
export function doc(fn, doc, dump) {
    if (doc) {
        if (dump) {
            fn.__doc__ = doc;
        } else {
            fn.__doc__ = trim_lines(doc);
        }
    }
    return fn;
}

// ------------------------------------------------------------------------------------
export function toArray(name, deep) {
    return function recur(list) {
        typecheck(name, list, ['pair', 'nil']);
        if (list === nil) {
            return [];
        }
        var result = [];
        var node = list;
        while (true) {
            if (node instanceof Pair) {
                if (node.haveCycles('cdr')) {
                    break;
                }
                var car = node.car;
                if (deep && car instanceof Pair) {
                    car = this.get(name).call(this, car);
                }
                result.push(car);
                node = node.cdr;
            } else {
                break;
            }
        }
        return result;
    };
}
