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

// -----------------------------------------------------------------------------
// :: differnt object than value used as object for (values)
// -----------------------------------------------------------------------------
export default function Values(values) {
    if (values.length) {
        if (values.length === 1) {
            return values[0];
        }
    }
    if (typeof this !== 'undefined' && !(this instanceof Values) ||
        typeof this === 'undefined') {
        return new Values(values);
    }
    this.values = values;
}

// -----------------------------------------------------------------------------
Values.prototype.toString = function() {
    return this.values.map(x => toString(x)).join('\n');
};

// -----------------------------------------------------------------------------
Values.prototype.valueOf = function() {
    return this.values;
};
