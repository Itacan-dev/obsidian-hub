"use strict";

// ---------- MOMENTUM COLORS ----------

const PROGRESS_COLOR =
    "#0dc94f";


/*
 * Opacity at scores:
 *
 * 1 → 25%
 * 2 → 50%
 * 3 → 75%
 * 4 → 100%
 *
 * Change these four numbers freely.
 */
const PROGRESS_OPACITY = [
    25,
    50,
    75,
    100
];


function hexToRgb(
    hex
) {

    const value =
        parseInt(
            hex.slice(1),
            16
        );


    return [
        (value >> 16) & 255,
        (value >> 8) & 255,
        value & 255
    ];
}


function momentumRgba(
    opacity
) {

    const [
        red,
        green,
        blue
    ] =
        hexToRgb(
            PROGRESS_COLOR
        );


    return (
        `rgba(${red}, ${green}, ${blue}, ${opacity})`
    );
}


/*
 * Home Momentum is displayed in
 * quarter-point steps.
 */
function progressVisualScore(
    score
) {

    if (
        score >= 4
    ) {
        return 4;
    }


    return Math.max(
        1,
        Math.floor(
            score * 4
        ) / 4
    );
}


function progressOpacity(
    score
) {

    const visualScore =
        progressVisualScore(
            score
        );


    const position =
        visualScore - 1;


    const lowerIndex =
        Math.floor(
            position
        );


    if (
        lowerIndex >= 3
    ) {

        return (
            PROGRESS_OPACITY[3] /
            100
        );
    }


    const fraction =
        position -
        lowerIndex;


    const lowerOpacity =
        PROGRESS_OPACITY[
            lowerIndex
        ];


    const upperOpacity =
        PROGRESS_OPACITY[
            lowerIndex + 1
        ];


    return (
        (
            lowerOpacity +
            (
                upperOpacity -
                lowerOpacity
            ) *
            fraction
        ) /
        100
    );
}


function progressColor(
    score
) {

    return momentumRgba(
        progressOpacity(
            score
        )
    );
}


/*
 * Base colors required by the
 * Heatmap Calendar plugin.
 */
const progressColors = {
    green:
        PROGRESS_OPACITY
            .map(
                opacity =>
                    momentumRgba(
                        opacity / 100
                    )
            )
};

module.exports = { progressColors, progressColor };

