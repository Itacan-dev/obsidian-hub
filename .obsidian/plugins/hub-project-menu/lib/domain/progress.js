"use strict";

const HOME_MOMENTUM_C = 0.5;

function calculateHomeMomentum(scores) {
    const activeScores = scores.filter(
        score =>
            Number.isInteger(score) &&
            score >= 1 &&
            score <= 4
    );

    if (activeScores.length === 0) {
        return 0;
    }

    const maximum = Math.max(...activeScores);

    if (activeScores.length === 1 || maximum === 4) {
        return maximum;
    }

    const maximumIndex = activeScores.indexOf(maximum);
    let product = 1;

    for (let index = 0; index < activeScores.length; index++) {
        if (index !== maximumIndex) {
            product *= 1 - activeScores[index] / 4;
        }
    }

    const momentum =
        maximum +
        (4 - maximum) *
            HOME_MOMENTUM_C *
            (1 - product);

    return Math.max(0, Math.min(4, momentum));
}

module.exports = {
    calculateHomeMomentum
};
