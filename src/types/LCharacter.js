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

import { characters } from '../parser.js';
import { LString } from './index.js';

// -----------------------------------------------------------------------------
// :: character object representation
// -----------------------------------------------------------------------------
export default function LCharacter(chr) {
    if (typeof this !== 'undefined' && !(this instanceof LCharacter) ||
        typeof this === 'undefined') {
        return new LCharacter(chr);
    }
    if (chr instanceof LString) {
        chr = chr.valueOf();
    }
    if (LCharacter.names[chr]) {
        this.name = chr;
        this.char = LCharacter.names[chr];
    } else {
        this.char = chr;
        var name = LCharacter.rev_names[chr];
        if (name) {
            this.name = name;
        }
    }
}

// -----------------------------------------------------------------------------
LCharacter.names = characters;

// -----------------------------------------------------------------------------
LCharacter.rev_names = {};

// -----------------------------------------------------------------------------
Object.keys(LCharacter.names).forEach(key => {
    var value = LCharacter.names[key];
    LCharacter.rev_names[value] = key;
});

// -----------------------------------------------------------------------------
LCharacter.prototype.toUpperCase = function() {
    return LCharacter(this.char.toUpperCase());
};

// -----------------------------------------------------------------------------
LCharacter.prototype.toLowerCase = function() {
    return LCharacter(this.char.toLowerCase());
};

// -----------------------------------------------------------------------------
LCharacter.prototype.toString = function() {
    return '#\\' + (this.name || this.char);
};

// -----------------------------------------------------------------------------
LCharacter.prototype.valueOf = function() {
    return this.char;
};
