import {math} from "../../viewer/scene/math/math.js";
import {PointerCircle} from "../../extras/PointerCircle/PointerCircle.js";
import {IssuesControl} from "./IssuesControl.js";


const WAITING_FOR_ORIGIN_TOUCH_START = 0;
const WAITING_FOR_ORIGIN_QUICK_TOUCH_END = 1;
const WAITING_FOR_ORIGIN_LONG_TOUCH_END = 2;

const WAITING_FOR_TARGET_TOUCH_START = 3;
const WAITING_FOR_TARGET_QUICK_TOUCH_END = 4;
const WAITING_FOR_TARGET_LONG_TOUCH_END = 5;

const TOUCH_CANCELING = 7;

export class IssuesTouchControl extends IssuesControl {

    constructor(issuesPlugin, cfg = {}) {

        super(issuesPlugin.viewer.scene);

        this.pointerLens = cfg.pointerLens;
        this.pointerCircle = new PointerCircle(issuesPlugin.viewer);

        this._active = false;

        const markerDiv = document.createElement('div');
        const canvas = this.scene.canvas.canvas;
        canvas.parentNode.insertBefore(markerDiv, canvas);

        markerDiv.style.background = "black";
        markerDiv.style.border = "2px solid blue";
        markerDiv.style.borderRadius = "10px";
        markerDiv.style.width = "5px";
        markerDiv.style.height = "5px";
        markerDiv.style.margin = "-200px -200px";
        markerDiv.style.zIndex = "100";
        markerDiv.style.position = "absolute";
        markerDiv.style.pointerEvents = "none";

        this.markerDiv = markerDiv;

        this._currentDistanceMeasurement = null;

        this._currentDistanceMeasurementInitState = {
            wireVisible: null,
            axisVisible: null,
            xAxisVisible: null,
            yaxisVisible: null,
            zAxisVisible: null,
            targetVisible: null,
        }

        this._onCanvasTouchStart = null;
        this._onCanvasTouchEnd = null;
        this._longTouchTimeoutMs = 300;
        this._snapping = cfg.snapping !== false;
        this._touchState = WAITING_FOR_ORIGIN_TOUCH_START;

        this._attachPlugin(issuesPlugin, cfg);
    }

    _attachPlugin(issuesPlugin) {

        /**
         * The {@link DistanceMeasurementsPlugin} that owns this IssuesTouchControl.
         * @type {DistanceMeasurementsPlugin}
         */
        this.issuesPlugin = issuesPlugin;

        /**
         * The {@link DistanceMeasurementsPlugin} that owns this IssuesTouchControl.
         * @type {DistanceMeasurementsPlugin}
         */
        this.plugin = issuesPlugin;
    }

    /** Gets if this IssuesTouchControl is currently active, where it is responding to input.
     *
     * @returns {Boolean}
     */
    get active() {
        return this._active;
    }
    set snapping(snapping) {
        if (snapping !== this._snapping) {
            this._snapping = snapping;
            this.deactivate();
            this.activate();
        } else {
            this._snapping = snapping;
        }
    }

    /**
     * Gets whether snap-to-vertex and snap-to-edge are enabled for this IssuesTouchControl.
     *
     * This is `true` by default.
     *
     * @returns {boolean} Whether snap-to-vertex and snap-to-edge are enabled for this IssuesTouchControl.
     */
    get snapping() {
        return this._snapping;
    }

    /**
     * Activates this IssuesTouchControl, ready to respond to input.
     */
    activate() {

        if (this._active) {
            return;
        }

        const plugin = this.plugin;
        const scene = this.scene;
        const canvas = scene.canvas.canvas;
        const pointerLens = plugin.pointerLens;
        const pointerWorldPos = math.vec3();

        const touchTolerance = 20;

        let longTouchTimeout = null;

        this._touchState = WAITING_FOR_ORIGIN_TOUCH_START;

        const touchStartCanvasPos = math.vec2();
        const touchMoveCanvasPos = math.vec2();
        const touchEndCanvasPos = math.vec2();

        let touchId = null;

        const disableCameraNavigation = () => {
            this.plugin.viewer.cameraControl.active = false;
        }

        const enableCameraNavigation = () => {
            this.plugin.viewer.cameraControl.active = true;
        }

        const cancel = () => {
            if (longTouchTimeout) {
                clearTimeout(longTouchTimeout);
                longTouchTimeout = null;
            }
            if (this._currentDistanceMeasurement) {
                this._currentDistanceMeasurement.destroy();
                this._currentDistanceMeasurement = null;
            }
            enableCameraNavigation();
            this._touchState = WAITING_FOR_ORIGIN_TOUCH_START;
        }

        canvas.addEventListener("touchstart", this._onCanvasTouchStart = (event) => {

            const currentNumTouches = event.touches.length;

            if (currentNumTouches !== 1) {
                if (longTouchTimeout) {
                    clearTimeout(longTouchTimeout);
                    longTouchTimeout = null;
                }
                return;
            }

            const touch = event.touches[0];
            const touchX = touch.clientX;
            const touchY = touch.clientY;

            touchStartCanvasPos.set([touchX, touchY]);
            touchMoveCanvasPos.set([touchX, touchY]);

            switch (this._touchState) {

                case WAITING_FOR_ORIGIN_TOUCH_START:
                    if (currentNumTouches !== 1 && longTouchTimeout !== null) { // Two or more fingers down
                        cancel();
                        return;
                    }
                    const snapPickResult = scene.pick({
                        canvasPos: touchMoveCanvasPos,
                        snapping: this._snapping,
                        snapToEdge: this._snapping
                    });
                    if (snapPickResult && snapPickResult.snapped) {
                        pointerWorldPos.set(snapPickResult.worldPos);
                        this.pointerCircle.start(snapPickResult.snappedCanvasPos);
                    } else {
                        const pickResult = scene.pick({
                            canvasPos: touchMoveCanvasPos,
                            pickSurface: true
                        })
                        if (pickResult && pickResult.worldPos) {
                            pointerWorldPos.set(pickResult.worldPos);
                            this.pointerCircle.start(pickResult.canvasPos);
                        } else {
                            return;
                        }
                    }
                    longTouchTimeout = setTimeout(() => {
                        if (currentNumTouches !== 1 ||
                            touchMoveCanvasPos[0] > touchStartCanvasPos[0] + touchTolerance ||
                            touchMoveCanvasPos[0] < touchStartCanvasPos[0] - touchTolerance ||
                            touchMoveCanvasPos[1] > touchStartCanvasPos[1] + touchTolerance ||
                            touchMoveCanvasPos[1] < touchStartCanvasPos[1] - touchTolerance) {
                            return;   // Has moved
                        }
                        // Long touch
                        if (this.pointerLens) {
                            this.pointerLens.visible = true;
                            this.pointerLens.canvasPos = touchStartCanvasPos;
                            this.pointerLens.cursorPos = touchStartCanvasPos;
                        }
                        if (this.pointerLens) {
                            this.pointerLens.canvasPos = touchMoveCanvasPos;
                            this.pointerLens.snapped = false;
                        }
                        if (this.pointerLens) {
                            this.pointerLens.cursorPos = snapPickResult.canvasPos;
                            this.pointerLens.snapped = true;
                        }
                        // pointerWorldPos.set(snapPickResult.snappedWorldPos);
                        if (!this._currentDistanceMeasurement) {
                            this._currentDistanceMeasurement = plugin.createMeasurement({
                                id: math.createUUID(),
                                origin: {
                                    worldPos: pointerWorldPos,
                                    entity: snapPickResult.entity
                                },
                                target: {
                                    worldPos: pointerWorldPos,
                                    entity: snapPickResult.entity
                                }
                            });
                            this._currentDistanceMeasurement.labelsVisible = false;
                            this._currentDistanceMeasurement.xAxisVisible = false;
                            this._currentDistanceMeasurement.yAxisVisible = false;
                            this._currentDistanceMeasurement.zAxisVisible = false;
                            this._currentDistanceMeasurement.wireVisible = false;
                            this._currentDistanceMeasurement.originVisible = true;
                            this._currentDistanceMeasurement.targetVisible = false;
                            this._currentDistanceMeasurement.clickable = false;
                        } else {
                            this._currentDistanceMeasurement.origin.worldPos = pointerWorldPos;
                        }
                        this.issuesPlugin.fire("measurementStart", this._currentDistanceMeasurement);

                        this._touchState = WAITING_FOR_ORIGIN_LONG_TOUCH_END;
                        disableCameraNavigation();
                    }, this._longTouchTimeoutMs);
                    this._touchState = WAITING_FOR_ORIGIN_QUICK_TOUCH_END;

                    touchId = touch.identifier;

                    break;


                case WAITING_FOR_TARGET_TOUCH_START:

                    if (currentNumTouches !== 1 && longTouchTimeout !== null) { // Two or more fingers down
                        clearTimeout(longTouchTimeout);
                        longTouchTimeout = null;
                        return;
                    }
                    if (currentNumTouches === 1) { // One finger down
                        longTouchTimeout = setTimeout(() => {
                            longTouchTimeout = null;
                            if (currentNumTouches !== 1 ||
                                touchMoveCanvasPos[0] > touchStartCanvasPos[0] + touchTolerance ||
                                touchMoveCanvasPos[0] < touchStartCanvasPos[0] - touchTolerance ||
                                touchMoveCanvasPos[1] > touchStartCanvasPos[1] + touchTolerance ||
                                touchMoveCanvasPos[1] < touchStartCanvasPos[1] - touchTolerance) {
                                // Has moved
                                return;
                            }

                            // Long touch
                            if (this.pointerLens) {
                                this.pointerLens.visible = true;
                                this.pointerLens.canvasPos = touchStartCanvasPos;
                                this.pointerLens.snapped = false;
                            }

                            const snapPickResult = scene.pick({
                                canvasPos: touchMoveCanvasPos,
                                snapToVertex: this._snapping,
                                snapToEdge: this._snapping
                            });
                            if (snapPickResult && snapPickResult.snapped) {
                                if (this.pointerLens) {
                                    this.pointerLens.cursorPos = snapPickResult.snappedCanvasPos;
                                    this.pointerLens.snapped = true;
                                }
                                this.pointerCircle.start(snapPickResult.snappedCanvasPos);
                                pointerWorldPos.set(snapPickResult.worldPos);
                                this._currentDistanceMeasurement.target.worldPos = snapPickResult.worldPos;
                                this._currentDistanceMeasurement.target.entity = snapPickResult.entity;
                                this._currentDistanceMeasurement.targetVisible = true;
                                this._currentDistanceMeasurement.wireVisible = true;
                                this._currentDistanceMeasurement.labelsVisible = true;
                                this.issuesPlugin.fire("measurementStart", this._currentDistanceMeasurement);
                            } else {
                                const pickResult = scene.pick({
                                    canvasPos: touchMoveCanvasPos,
                                    pickSurface: true
                                })
                                if (pickResult && pickResult.worldPos) {
                                    if (this.pointerLens) {
                                        this.pointerLens.cursorPos = pickResult.canvasPos;
                                        this.pointerLens.snapped = false;
                                    }
                                    this.pointerCircle.start(pickResult.canvasPos);
                                    pointerWorldPos.set(pickResult.worldPos);
                                    this._currentDistanceMeasurement.target.worldPos = pickResult.worldPos;
                                    this._currentDistanceMeasurement.target.entity = pickResult.entity;
                                    this._currentDistanceMeasurement.targetVisible = true;
                                    this._currentDistanceMeasurement.wireVisible = true;
                                    this._currentDistanceMeasurement.labelsVisible = true;
                                    this.issuesPlugin.fire("measurementStart", this._currentDistanceMeasurement);
                                } else {
                                    if (this.pointerLens) {
                                        this.pointerLens.cursorPos = null;
                                        this.pointerLens.snapped = false;

                                    }
                                }
                            }
                            this._touchState = WAITING_FOR_TARGET_LONG_TOUCH_END;
                            // console.log("touchstart: this._touchState= WAITING_FOR_TARGET_TOUCH_START -> WAITING_FOR_TARGET_LONG_TOUCH_END")

                            disableCameraNavigation();

                        }, this._longTouchTimeoutMs);

                        this._touchState = WAITING_FOR_TARGET_QUICK_TOUCH_END;
                        // console.log("touchstart: this._touchState= WAITING_FOR_TARGET_TOUCH_START -> WAITING_FOR_TARGET_QUICK_TOUCH_END")
                    }

                    touchId = touch.identifier;

                    break;

                default:
                    if (longTouchTimeout !== null) {
                        clearTimeout(longTouchTimeout);
                        longTouchTimeout = null;
                    }
                    this._touchState = TOUCH_CANCELING;
                    // console.log("touchstart: this._touchState= default -> TOUCH_CANCELING")
                    return;
            }

        }, {passive: true});


        canvas.addEventListener("touchmove", (event) => {

            this.pointerCircle.stop();

            const currentNumTouches = event.touches.length;

            if (currentNumTouches !== 1 || event.changedTouches.length !== 1) {
                if (longTouchTimeout) {
                    clearTimeout(longTouchTimeout);
                    longTouchTimeout = null;
                }
                return;
            }

            const touch = event.touches[0];
            const touchX = touch.clientX;
            const touchY = touch.clientY;

            if (touch.identifier !== touchId) {
                return;
            }

            touchMoveCanvasPos.set([touchX, touchY]);

            let snapPickResult;
            let pickResult;

            switch (this._touchState) {

                case WAITING_FOR_ORIGIN_LONG_TOUCH_END:
                    if (this.pointerLens) {
                        this.pointerLens.canvasPos = touchMoveCanvasPos;
                    }
                    snapPickResult = scene.pick({
                        canvasPos: touchMoveCanvasPos,
                        snapToVertex: this._snapping,
                        snapToEdge: this._snapping
                    });
                    if (snapPickResult && (snapPickResult.snapped)) {
                        if (this.pointerLens) {
                            this.pointerLens.snappedCanvasPos = snapPickResult.snappedCanvasPos;
                            this.pointerLens.snapped = true;
                        }
                        pointerWorldPos.set(snapPickResult.worldPos);
                        if (!this._currentDistanceMeasurement) {
                            this._currentDistanceMeasurement = plugin.createMeasurement({
                                id: math.createUUID(),
                                origin: {
                                    worldPos: snapPickResult.worldPos,
                                    entity: snapPickResult.entity
                                },
                                target: {
                                    worldPos: snapPickResult.worldPos,
                                    entity: snapPickResult.entity
                                }
                            });
                            this._currentDistanceMeasurement.labelsVisible = false;
                            this._currentDistanceMeasurement.xAxisVisible = false;
                            this._currentDistanceMeasurement.yAxisVisible = false;
                            this._currentDistanceMeasurement.zAxisVisible = false;
                            this._currentDistanceMeasurement.wireVisible = false;
                            this._currentDistanceMeasurement.originVisible = true;
                            this._currentDistanceMeasurement.targetVisible = false;
                            this._currentDistanceMeasurement.clickable = false;
                        } else {
                            this._currentDistanceMeasurement.origin.worldPos = snapPickResult.worldPos;
                        }

                        this.issuesPlugin.fire("measurementStart", this._currentDistanceMeasurement);
                    } else {
                        pickResult = scene.pick({
                            canvasPos: touchMoveCanvasPos,
                            pickSurface: true
                        })
                        if (pickResult && pickResult.worldPos) {
                            if (this.pointerLens) {
                                this.pointerLens.cursorPos = pickResult.canvasPos;
                                this.pointerLens.snapped = false;
                            }
                            pointerWorldPos.set(pickResult.worldPos);
                            if (!this._currentDistanceMeasurement) {
                                this._currentDistanceMeasurement = plugin.createMeasurement({
                                    id: math.createUUID(),
                                    origin: {
                                        worldPos: pickResult.worldPos,
                                        entity: pickResult.entity
                                    },
                                    target: {
                                        worldPos: pickResult.worldPos,
                                        entity: pickResult.entity
                                    }
                                });
                                this._currentDistanceMeasurement.labelsVisible = false;
                                this._currentDistanceMeasurement.xAxisVisible = false;
                                this._currentDistanceMeasurement.yAxisVisible = false;
                                this._currentDistanceMeasurement.zAxisVisible = false;
                                this._currentDistanceMeasurement.wireVisible = false;
                                this._currentDistanceMeasurement.originVisible = true;
                                this._currentDistanceMeasurement.targetVisible = false;
                                this._currentDistanceMeasurement.clickable = false;
                            } else {
                                this._currentDistanceMeasurement.origin.worldPos = pickResult.worldPos;
                            }

                            this.issuesPlugin.fire("measurementStart", this._currentDistanceMeasurement);
                        } else {
                            if (this.pointerLens) {
                                this.pointerLens.cursorPos = null;
                                this.pointerLens.snapped = false;
                            }
                        }
                    }
                    this._touchState = WAITING_FOR_ORIGIN_LONG_TOUCH_END;
                    // console.log("touchmove: this._touchState= WAITING_FOR_ORIGIN_LONG_TOUCH_END -> WAITING_FOR_ORIGIN_LONG_TOUCH_END")
                    break;

                // case WAITING_FOR_TARGET_TOUCH_START:
                //     this._touchState = WAITING_FOR_TARGET_TOUCH_START;
                //     console.log("touchmove: this._touchState= WAITING_FOR_TARGET_TOUCH_START -> WAITING_FOR_TARGET_TOUCH_START")
                //     break;

                case WAITING_FOR_TARGET_LONG_TOUCH_END:
                    if (currentNumTouches !== 1 && longTouchTimeout !== null) { // Two or more fingers down
                        clearTimeout(longTouchTimeout);
                        longTouchTimeout = null;
                        if (this.pointerLens) {
                            this.pointerLens.visible = false;
                        }
                        this._touchState = TOUCH_CANCELING;
                        // console.log("touchmove: this._touchState= QUICK_TOUCH_FINDING_TARGET -> TOUCH_CANCELING")
                        return;
                    }
                    if (this.pointerLens) {
                        this.pointerLens.canvasPos = touchMoveCanvasPos;
                    }
                    snapPickResult = scene.pick({
                        canvasPos: touchMoveCanvasPos,
                        snapToVertex: this._snapping,
                        snapToEdge: this._snapping
                    });
                    if (snapPickResult && snapPickResult.worldPos) {
                        if (this.pointerLens) {
                            this.pointerLens.cursorPos = snapPickResult.snappedCanvasPos;
                            this.pointerLens.snapped = true;
                        }
                        this._currentDistanceMeasurement.target.worldPos = snapPickResult.worldPos;
                        this._currentDistanceMeasurement.target.entity = snapPickResult.entity;
                        this._currentDistanceMeasurement.targetVisible = true;
                        this._currentDistanceMeasurement.wireVisible = true;
                        this._currentDistanceMeasurement.labelsVisible = true;
                    } else {
                        pickResult = scene.pick({
                            canvasPos: touchMoveCanvasPos,
                            pickSurface: true
                        })
                        if (pickResult && pickResult.worldPos) {
                            if (this.pointerLens) {
                                this.pointerLens.cursorPos = pickResult.canvasPos;
                                this.pointerLens.snapped = false;
                            }
                            this._currentDistanceMeasurement.target.worldPos = pickResult.worldPos;
                            this._currentDistanceMeasurement.target.entity = pickResult.entity;
                            this._currentDistanceMeasurement.targetVisible = true;
                            this._currentDistanceMeasurement.wireVisible = true;
                            this._currentDistanceMeasurement.labelsVisible = true;

                        }
                    }
                    this._touchState = WAITING_FOR_TARGET_LONG_TOUCH_END;
                    break;

                default:
                    break;
            }
        }, {passive: true});

        canvas.addEventListener("touchend", this._onCanvasTouchEnd = (event) => {

            this.pointerCircle.stop();

            const numChangedTouches = event.changedTouches.length;

            if (numChangedTouches !== 1) {
                return;
            }

            const touch = event.changedTouches[0];
            const touchX = touch.clientX;
            const touchY = touch.clientY;

            if (touch.identifier !== touchId) {
                return;
            }

            if (longTouchTimeout) {
                clearTimeout(longTouchTimeout);
                longTouchTimeout = null;
            }

            touchEndCanvasPos.set([touchX, touchY]);

            switch (this._touchState) {

                case WAITING_FOR_ORIGIN_QUICK_TOUCH_END: {
                    if (numChangedTouches !== 1 ||
                        touchX > touchStartCanvasPos[0] + touchTolerance ||
                        touchX < touchStartCanvasPos[0] - touchTolerance ||
                        touchY > touchStartCanvasPos[1] + touchTolerance ||
                        touchY < touchStartCanvasPos[1] - touchTolerance) {
                        this._touchState = WAITING_FOR_ORIGIN_TOUCH_START;
                        return;
                    }
                    const pickResult = scene.pick({
                        canvasPos: touchMoveCanvasPos,
                        pickSurface: true
                    });
                    if (pickResult && pickResult.worldPos) {
                        this._currentDistanceMeasurement = plugin.createMeasurement({
                            id: math.createUUID(),
                            origin: {
                                worldPos: pickResult.worldPos,
                                entity: pickResult.entity
                            },
                            target: {
                                worldPos: pickResult.worldPos,
                                entity: pickResult.entity
                            }
                        });
                        this._currentDistanceMeasurement.labelsVisible = false;
                        this._currentDistanceMeasurement.xAxisVisible = false;
                        this._currentDistanceMeasurement.yAxisVisible = false;
                        this._currentDistanceMeasurement.zAxisVisible = false;
                        this._currentDistanceMeasurement.wireVisible = false;
                        this._currentDistanceMeasurement.originVisible = true;
                        this._currentDistanceMeasurement.targetVisible = false;
                        this._currentDistanceMeasurement.clickable = false;
                        this._touchState = WAITING_FOR_TARGET_TOUCH_START;
                        this.issuesPlugin.fire("measurementStart", this._currentDistanceMeasurement);
                        //  console.log("touchend: this._touchState= WAITING_FOR_ORIGIN_QUICK_TOUCH_END -> WAITING_FOR_ORIGIN_TOUCH_START")
                    } else {
                        if (this._currentDistanceMeasurement) {
                            this._currentDistanceMeasurement.destroy();
                        }
                        this._touchState = WAITING_FOR_ORIGIN_TOUCH_START;
                        //  console.log("touchend: this._touchState= WAITING_FOR_ORIGIN_QUICK_TOUCH_END -> WAITING_FOR_ORIGIN_TOUCH_START")
                    }
                }
                    enableCameraNavigation();
                    break;

                case WAITING_FOR_ORIGIN_LONG_TOUCH_END:
                    if (this.pointerLens) {
                        this.pointerLens.visible = false;
                    }
                    if (!this._currentDistanceMeasurement) {
                        if (this.pointerLens) {
                            this.pointerLens.snapped = false;
                            this.pointerLens.visible = false;
                        }
                        this._touchState = WAITING_FOR_ORIGIN_TOUCH_START;
                        //  console.log("touchend: this._touchState= WAITING_FOR_ORIGIN_LONG_TOUCH_END (no measurement) -> WAITING_FOR_ORIGIN_TOUCH_START")
                    } else {
                        this._touchState = WAITING_FOR_TARGET_TOUCH_START;
                        //  console.log("touchend: this._touchState= WAITING_FOR_ORIGIN_LONG_TOUCH_END (picked, begin measurement) -> WAITING_FOR_TARGET_TOUCH_START")
                    }
                    enableCameraNavigation();
                    break;

                case WAITING_FOR_TARGET_QUICK_TOUCH_END: {
                    if (numChangedTouches !== 1 ||
                        touchX > touchStartCanvasPos[0] + touchTolerance ||
                        touchX < touchStartCanvasPos[0] - touchTolerance ||
                        touchY > touchStartCanvasPos[1] + touchTolerance ||
                        touchY < touchStartCanvasPos[1] - touchTolerance) {
                        this._touchState = WAITING_FOR_TARGET_TOUCH_START;
                        return;
                    }
                    const pickResult = scene.pick({
                        canvasPos: touchMoveCanvasPos,
                        pickSurface: true
                    });
                    if (pickResult && pickResult.worldPos) {
                        this._currentDistanceMeasurement.target.worldPos = pickResult.worldPos;
                        this._currentDistanceMeasurement.target.entity = pickResult.entity;
                        this._currentDistanceMeasurement.targetVisible = true;
                        this._currentDistanceMeasurement.wireVisible = true;
                        this._currentDistanceMeasurement.labelsVisible = true;
                        this._currentDistanceMeasurement.xAxisVisible = true;
                        this._currentDistanceMeasurement.yAxisVisible = true;
                        this._currentDistanceMeasurement.zAxisVisible = true;
                        this._currentDistanceMeasurement.clickable = true;
                        this.issuesPlugin.fire("measurementEnd", this._currentDistanceMeasurement);
                        this._currentDistanceMeasurement = null;
                    } else {
                        if (this._currentDistanceMeasurement) {
                            this._currentDistanceMeasurement.destroy();
                            this._currentDistanceMeasurement = null;
                        }
                    }
                    this._touchState = WAITING_FOR_ORIGIN_TOUCH_START;
                    //  console.log("touchend: this._touchState= WAITING_FOR_TARGET_TOUCH_START -> WAITING_FOR_ORIGIN_TOUCH_START")
                }
                    enableCameraNavigation();
                    break;

                case WAITING_FOR_TARGET_LONG_TOUCH_END:
                    console.log('long touch');
                    if (this.pointerLens) {
                        this.pointerLens.visible = false;
                    }
                    if (!this._currentDistanceMeasurement || !this._currentDistanceMeasurement.targetVisible) {
                        if (this._currentDistanceMeasurement) {
                            this._currentDistanceMeasurement.destroy();
                            this._currentDistanceMeasurement = null;
                        }
                        this._touchState = WAITING_FOR_ORIGIN_TOUCH_START;
                        //  console.log("touchend: this._touchState= WAITING_FOR_TARGET_LONG_TOUCH_END (no target found) -> WAITING_FOR_ORIGIN_TOUCH_START")
                    } else {
                        this._currentDistanceMeasurement.clickable = true;
                        this.issuesPlugin.fire("measurementEnd", this._currentDistanceMeasurement);
                        this._currentDistanceMeasurement = null;
                        this._touchState = WAITING_FOR_ORIGIN_TOUCH_START;
                        //  console.log("touchend: this._touchState= WAITING_FOR_TARGET_LONG_TOUCH_END  -> WAITING_FOR_ORIGIN_TOUCH_START")
                    }
                    enableCameraNavigation();
                    break;
            }

        }, {passive: true});

        this._active = true;
    }

    /**
     * Deactivates this IssuesTouchControl, making it unresponsive to input.
     *
     * Destroys any {@link DistanceMeasurement} under construction.
     */
    deactivate() {
        if (!this._active) {
            return;
        }
        if (this.plugin.pointerLens) {
            this.plugin.pointerLens.visible = false;
        }
        this.reset();
        const canvas = this.plugin.viewer.scene.canvas.canvas;
        canvas.removeEventListener("touchstart", this._onCanvasTouchStart);
        canvas.removeEventListener("touchend", this._onCanvasTouchEnd);
        if (this._currentDistanceMeasurement) {
            this.issuesPlugin.fire("measurementCancel", this._currentDistanceMeasurement);
            this._currentDistanceMeasurement.destroy();
            this._currentDistanceMeasurement = null;
        }
        this._active = false;
        this.plugin.viewer.cameraControl.active = true;
    }

    /**
     * Resets this IssuesTouchControl.
     *
     * Destroys any {@link DistanceMeasurement} under construction.
     *
     * Does nothing if the IssuesTouchControl is not active.
     */
    reset() {
        if (!this._active) {
            return;
        }
        if (this._currentDistanceMeasurement) {
            this.issuesPlugin.fire("measurementCancel", this._currentDistanceMeasurement);
            this._currentDistanceMeasurement.destroy();
            this._currentDistanceMeasurement = null;
        }
        this._mouseState = WAITING_FOR_ORIGIN_TOUCH_START;
    }

    /**
     * Gets the {@link DistanceMeasurement} under construction by this IssuesTouchControl, if any.
     *
     * @returns {null|DistanceMeasurement}
     */
    get currentMeasurement() {
        return this._currentDistanceMeasurement;
    }

    /**
     * Destroys this IssuesTouchControl.
     */
    destroy() {
        this.deactivate();
        super.destroy();
    }
}
