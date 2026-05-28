import assert from "assert";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { isRectRectIntersecting, isRangeIntersecting, calcDistance, isCircleCircleIntersecting } from "../imports/ui/pages/floorMapComponents/canvas/editor/utils/UnitCollisions";

describe("Collision math calculations", function () {
    it("test 'isRangeIntersecting' where A strictly < B", function () {
        // case: u---U
        //             v---V
        const intervalA = {lower: 0, upper: 100};
        const intervalB = {lower: 101, upper: 200};

        const result = isRangeIntersecting(intervalA, intervalB)
        const expected = false;

        assert.ok(result === expected, "the intervals " + intervalA + " and " + intervalB + "were expected to get overalapping=" + expected + ", but returned overalapping=" + result);
    });

    it("test 'isRangeIntersecting' where max A = min B (edge case)", function () {
        // case: u---U
        //           v---V
        const intervalA = {lower: 0, upper: 100};
        const intervalB = {lower: 100, upper: 200};

        const result = isRangeIntersecting(intervalA, intervalB)
        const expected = false;

        assert.ok(result === expected, "the intervals " + intervalA + " and " + intervalB + "were expected to get overalapping=" + expected + ", but returned overalapping=" + result);
    });

    it("test 'isRangeIntersecting' where max A > min B", function () {
        // case: u---U
        //          v---V
        const intervalA = {lower: 0, upper: 100};
        const intervalB = {lower: 99, upper: 200};

        const result = isRangeIntersecting(intervalA, intervalB)
        const expected = true;

        assert.ok(result === expected, "the intervals " + intervalA + " and " + intervalB + "were expected to get overalapping=" + expected + ", but returned overalapping=" + result);
    });
    
    it("test 'isRangeIntersecting' where min A < max B", function () {
        // case:    u---U
        //       v---V
        const intervalA = {lower: 199, upper: 300};
        const intervalB = {lower: 99, upper: 200};

        const result = isRangeIntersecting(intervalA, intervalB)
        const expected = true;

        assert.ok(result === expected, "the intervals " + intervalA + " and " + intervalB + "were expected to get overalapping=" + expected + ", but returned overalapping=" + result);
    });

    it("test 'isRangeIntersecting' where min A = max B (edge case)", function () {
        // case:     u---U
        //       v---V
        const intervalA = {lower: 200, upper: 300};
        const intervalB = {lower: 99, upper: 200};

        const result = isRangeIntersecting(intervalA, intervalB)
        const expected = false;

        assert.ok(result === expected, "the intervals " + intervalA + " and " + intervalB + "were expected to get overalapping=" + expected + ", but returned overalapping=" + result);
    });
    
    it("test 'isRangeIntersecting' where A strictly > B", function () {
        // case:    u---U
        //    v---V
        const intervalA = {lower: 200, upper: 300};
        const intervalB = {lower: 99, upper: 199};

        const result = isRangeIntersecting(intervalA, intervalB)
        const expected = false;

        assert.ok(result === expected, "the intervals " + intervalA + " and " + intervalB + "were expected to get overalapping=" + expected + ", but returned overalapping=" + result);
    });
    
    it("test 'isRangeIntersecting' where B is a subset of A", function () {
        // case: u------U
        //         v--V
        const intervalA = {lower: 98, upper: 200};
        const intervalB = {lower: 99, upper: 199};

        const result = isRangeIntersecting(intervalA, intervalB)
        const expected = true;

        assert.ok(result === expected, "the intervals " + intervalA + " and " + intervalB + "were expected to get overalapping=" + expected + ", but returned overalapping=" + result);
    });
    
    it("test 'isRangeIntersecting' where A is a subset of B", function () {
        // case:   u--U
        //       v------V
        const intervalA = {lower: 100, upper: 300};
        const intervalB = {lower: 99, upper: 301};

        const result = isRangeIntersecting(intervalA, intervalB)
        const expected = true;

        assert.ok(result === expected, "the intervals " + intervalA + " and " + intervalB + "were expected to get overalapping=" + expected + ", but returned overalapping=" + result);
    });

    it("test 'isRangeIntersecting' where A = B", function () {
        // case: u---U
        //       v---V
        const intervalA = {lower: 100, upper: 300};
        const intervalB = {lower: 100, upper: 300};

        const result = isRangeIntersecting(intervalA, intervalB)
        const expected = true;

        assert.ok(result === expected, "the intervals " + intervalA + " and " + intervalB + "were expected to get overalapping=" + expected + ", but returned overalapping=" + result);
    });

    it("test 'isRectRectIntersecting' BV corners and edges", function () {
        /** Cases:
         * +---++---++---+
         * | B || B || B |
         * +---++---++---+
         * +---++---++---+
         * | B || A || B |
         * +---++---++---+
         * | B || B || B |
         * +---++---++---+
         */
        const edits = [-1, 0, 1];
        const height = 100;
        const width = 50;
        
        const rectA = {
            dom: {lower: 50, upper: 50+width},
            ran: {lower: 75, upper: 75+height}
        };

        /**
         * editX: determines with testing the West (-1) or East (1) wall/corner or neither (0)
         * editY: determines if testing the North (-1) or South (1) wall/corner or neither (0)
         * bvTest: determines the boundary-value test type - inside (-1), on (0), outside (1)
         */
        const editsRectB = edits.flatMap(
            (x) => edits.flatMap(
                (y) => edits.map(
                    (bv) => ({editX: x, editY: y, bvTest: bv})
                ).filter((edit) => !(edit.editX == 0 && edit.editY == 0)) // handle equals separately
            )
        );

        const expectedEdits = 24;
        assert.ok(editsRectB.length == 24, "Expected " + expectedEdits + " border test cases between two rectangles but found " + editsRectB.length);

        editsRectB.forEach(({editX: x, editY: y, bvTest: bv}) => {
            const rectB = {
                dom: {
                    lower: rectA.dom.lower + (width + bv) * x,
                    upper: rectA.dom.upper + (width + bv) * x
                },
                ran: {
                    lower: rectA.ran.lower + (height + bv) * y,
                    upper: rectA.ran.upper + (height + bv) * y
                }
            };

            /**
             * NOTE: all inside tests (bvTest = -1) should return true
             * all other tests (bvTest = 0 or 1) should return false
             */
            const result = isRectRectIntersecting(rectA)(rectB);
            const expected = bv === -1

            assert.ok(result === expected, "the rectangles " + JSON.stringify(rectA) + " and " + JSON.stringify(rectB) + " were expected to get overalapping=" + expected + ", but returned overalapping=" + result);
        });
    });

    it("test 'isRectRectIntersecting' BV rect contains rect", function () {
        /** Cases:
         * +---------+
         * |         |
         * |   A=B   |
         * |         |
         * +---------+
         * 
         * +-----+
         * |  A  |
         * |+---+|
         * || B ||
         * |+---+|
         * +-----+
         * 
         * +-----+
         * |  B  |
         * |+---+|
         * || A ||
         * |+---+|
         * +-----+
         */
        const edits = [-1, 0, 1]; // when B is smaller (-1), equal to (0) and larger (+1)
        const rectA = {
            dom: {lower: 50, upper: 100},
            ran: {lower: 50, upper: 150}
        };

        edits.forEach((e) => {
            const rectB = {
                dom: {
                    lower: rectA.dom.lower - e, 
                    upper: rectA.dom.upper + e
                },
                ran: {
                    lower: rectA.ran.lower - e,
                    upper: rectA.ran.upper + e
                }
            };
            // should all be intersecting
            const result = isRectRectIntersecting(rectA)(rectB);
            const expected = true;
            
            assert.ok(result === expected, "the rectangles " + JSON.stringify(rectA) + " and " + JSON.stringify(rectB) + " were expected to get overalapping=" + expected + ", but returned overalapping=" + result);
        });
        
    });

    it("test 'calcDistance' for positive and negative numbers", function () {
        const pythagTriples = [
            {a: 3, b: 4, c: 5},
            {a: 8, b: 15, c: 17}
        ];
        const magnitudes = [1, 2, 7];
        const signs = [-1, 1];

        const x = 2;
        const y = -1;

        const allTriples = magnitudes.flatMap(
            (m) => signs.flatMap(
                (s1) => signs.flatMap(
                    (s2) => pythagTriples.map(
                        ({a, b, c}) => ({
                            a: a*m*s1,
                            b: b*m*s2,
                            x1: x,
                            x2: x + a*m*s1,
                            y1: y,
                            y2: y + b*m*s2,
                            c: c*m
                        })
                    )
                )
            )
        );

        allTriples.forEach(({x1: x1, x2: x2, y1: y1, y2: y2, c: c}) => {
            const result = calcDistance(x1, y1)(x2, y2);
            const expected = c;

            assert.ok(result === expected, "expected the distance between the points (" + x1 + ", " + y1 + ") and (" + x2 + ", " + y2 + ") to be " + expected + ", but calculated " + result);
        });
    });

    it("test 'isCircleCircleIntersecting' BV outside borders", function () {
        const circ1 = {centerX: 0, centerY: 50, radius: 100};
        const circ2 = {centerX: 110, centerY: 51, radius: 10};

        const result = isCircleCircleIntersecting(circ1)(circ2);
        const expected = false;

        assert.ok(result === expected, "the circles " + JSON.stringify(circ1) + " and " + JSON.stringify(circ2) + "were expected to get overalapping=" + expected + ", but returned overalapping=" + result);
    });

    it("test 'isCircleCircleIntersecting' BV touching borders", function () {
        const circ1 = {centerX: 0, centerY: 50, radius: 100};
        const circ2 = {centerX: 110, centerY: 50, radius: 10};
        
        const result = isCircleCircleIntersecting(circ1)(circ2);
        const expected = false;

        assert.ok(result === expected, "the circles " + JSON.stringify(circ1) + " and " + JSON.stringify(circ2) + "were expected to get overalapping=" + expected + ", but returned overalapping=" + result);
    });

    it("test 'isCircleCircleIntersecting' BV inside borders", function () {
        const circ1 = {centerX: 0, centerY: 50, radius: 100};
        const circ2 = {centerX: 109, centerY: 51, radius: 10};
        
        const result = isCircleCircleIntersecting(circ1)(circ2);
        const expected = true;

        assert.ok(result === expected, "the circles " + JSON.stringify(circ1) + " and " + JSON.stringify(circ2) + "were expected to get overalapping=" + expected + ", but returned overalapping=" + result);
    });

    it("test 'isCircleCircleIntersecting' BV circle contains circle", function () {
        const circ1 = {centerX: 50, centerY: 50, radius: 100};
        const circ2 = {centerX: 40, centerY: 40, radius: 89};
        
        const result = isCircleCircleIntersecting(circ1)(circ2);
        const expected = true;

        assert.ok(result === expected, "the circles " + JSON.stringify(circ1) + " and " + JSON.stringify(circ2) + "were expected to get overalapping=" + expected + ", but returned overalapping=" + result);
    });

    it("test 'isCircleCircleIntersecting' BV circle equals circle", function () {
        const circ1 = {centerX: 50, centerY: 50, radius: 100};
        const circ2 = {centerX: 50, centerY: 50, radius: 100};
        
        const result = isCircleCircleIntersecting(circ1)(circ2);
        const expected = true;

        assert.ok(result === expected, "the circles " + JSON.stringify(circ1) + " and " + JSON.stringify(circ2) + "were expected to get overalapping=" + expected + ", but returned overalapping=" + result);
    });
});