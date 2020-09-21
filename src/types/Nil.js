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

import Pair from './Pair.js';

function Nil() {}

// -----------------------------------------------------------------------------
Nil.prototype.toString = Nil.prototype.toJSON = function() {
    return '()';
};

// -----------------------------------------------------------------------------
Nil.prototype.valueOf = function() {
    return undefined;
};

// -----------------------------------------------------------------------------
Nil.prototype.append = function(x) {
    return new Pair(x, nil);
};

// -----------------------------------------------------------------------------
Nil.prototype.toArray = function() {
    return [];
};

// -----------------------------------------------------------------------------
Nil.prototype.toDry = function() {
    return {
        value: null
    };
};

// -----------------------------------------------------------------------------
Nil.unDry = function() {
    return nil;
};

// -----------------------------------------------------------------------------
const nil = new Nil();
export default nil;
