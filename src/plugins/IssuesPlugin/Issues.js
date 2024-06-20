import {Marker} from "../../viewer/scene/marker/Marker.js";
import {Dot} from "../lib/html/Dot.js";
import {math} from "../../viewer/scene/math/math.js";
import {Component} from "../../viewer/scene/Component.js";

class Issues extends Component {

    /**
     * @private
     */
    constructor(plugin, cfg = {}) {

        super(plugin.viewer.scene, cfg);

        /**
         * The {@link IssuessPlugin} that owns this Issues.
         * @type {IssuessPlugin}
         */
        this.plugin = plugin;

        this._container = cfg.container;
        if (!this._container) {
            throw "config missing: container";
        }

        this._eventSubs = {};

        var scene = this.plugin.viewer.scene;
        this._originMarker = new Marker(scene, cfg.origin);
        this._targetMarker = new Marker(scene, cfg.target);

        this._originWorld = math.vec3();
        this._targetWorld = math.vec3();

        this._wp = new Float64Array(24); //world position
        this._vp = new Float64Array(24); //view position
        this._pp = new Float64Array(24);
        this._cp = new Float64Array(8); //canvas position

        this._color = cfg.color || this.plugin.defaultColor;

        const onMouseOver = cfg.onMouseOver ? (event) => {
            cfg.onMouseOver(event, this);
            this.plugin.viewer.scene.canvas.canvas.dispatchEvent(new MouseEvent('mouseover', event));
        } : null;

        const onMouseLeave = cfg.onMouseLeave ? (event) => {
            cfg.onMouseLeave(event, this);
            this.plugin.viewer.scene.canvas.canvas.dispatchEvent(new MouseEvent('mouseleave', event));
        } : null;

        const onMouseDown = (event) => {
            this.plugin.viewer.scene.canvas.canvas.dispatchEvent(new MouseEvent('mousedown', event));
        } ;

        const onMouseUp =  (event) => {
            this.plugin.viewer.scene.canvas.canvas.dispatchEvent(new MouseEvent('mouseup', event));
        };

        const onMouseMove =  (event) => {
            this.plugin.viewer.scene.canvas.canvas.dispatchEvent(new MouseEvent('mousemove', event));
        };

        const onContextMenu = cfg.onContextMenu ? (event) => {
            cfg.onContextMenu(event, this);
        } : null;

        const onMouseWheel = (event) => {
            this.plugin.viewer.scene.canvas.canvas.dispatchEvent(new WheelEvent('wheel', event));
        };

        this._originDot = new Dot(this._container, {
            fillColor: this._color,
            zIndex: plugin.zIndex !== undefined ? plugin.zIndex + 2 : undefined,
            onMouseOver,
            onMouseLeave,
            onMouseWheel,
            onMouseDown,
            onMouseUp,
            onMouseMove,
            onContextMenu
        });

        this._targetDot = new Dot(this._container, {
            fillColor: this._color,
            zIndex: plugin.zIndex !== undefined ? plugin.zIndex + 2 : undefined,
            onMouseOver,
            onMouseLeave,
            onMouseWheel,
            onMouseDown,
            onMouseUp,
            onMouseMove,
            onContextMenu
        });

        this._measurementOrientation = 'Horizontal';
        this._wpDirty = false;
        this._vpDirty = false;
        this._cpDirty = false;
        this._sectionPlanesDirty = true;

        this._visible = false;
        this._originVisible = false;
        this._targetVisible = false;
        this._wireVisible = false;
        this._axisVisible = false;
        this._xAxisVisible = false;
        this._yAxisVisible = false;
        this._zAxisVisible = false;
        this._axisEnabled = true;
        this._xLabelEnabled = false;
        this._yLabelEnabled = false;
        this._zLabelEnabled = false;
        this._lengthLabelEnabled = false;
        this._labelsVisible = false;
        this._labelsOnWires = false;
        this._clickable = false;

        this._originMarker.on("worldPos", (value) => {
            this._originWorld.set(value || [0,0,0]); 
            this._wpDirty = true;
            this._needUpdate(0); // No lag
        });

        this._targetMarker.on("worldPos", (value) => {
            this._targetWorld.set(value || [0,0,0]); 
            this._wpDirty = true;
            this._needUpdate(0); // No lag
        });

        this._onViewMatrix = scene.camera.on("viewMatrix", () => {
            this._vpDirty = true;
            this._needUpdate(0); // No lag
        });

        this._onProjMatrix = scene.camera.on("projMatrix", () => {
            this._cpDirty = true;
            this._needUpdate();
        });

        this._onCanvasBoundary = scene.canvas.on("boundary", () => {
            this._cpDirty = true;
            this._needUpdate(0); // No lag
        });

        this._onMetricsUnits = scene.metrics.on("units", () => {
            this._cpDirty = true;
            this._needUpdate();
        });

        this._onMetricsScale = scene.metrics.on("scale", () => {
            this._cpDirty = true;
            this._needUpdate();
        });

        this._onMetricsOrigin = scene.metrics.on("origin", () => {
            this._cpDirty = true;
            this._needUpdate();
        });

        this._onSectionPlaneUpdated = scene.on("sectionPlaneUpdated", () =>{
            this._sectionPlanesDirty = true;
            this._needUpdate();
        });

        this.approximate = cfg.approximate;
        this.visible = cfg.visible;
        this.originVisible = cfg.originVisible;
        this.targetVisible = cfg.targetVisible;
        this.wireVisible = cfg.wireVisible;
        this.axisVisible = cfg.axisVisible;
        this.xAxisVisible = cfg.xAxisVisible;
        this.yAxisVisible = cfg.yAxisVisible;
        this.zAxisVisible = cfg.zAxisVisible;
        this.xLabelEnabled = cfg.xLabelEnabled;
        this.yLabelEnabled = cfg.yLabelEnabled;
        this.zLabelEnabled = cfg.zLabelEnabled;
        this.lengthLabelEnabled = cfg.lengthLabelEnabled;
        this.labelsVisible = cfg.labelsVisible;
        this.labelsOnWires = cfg.labelsOnWires;
    }

    _update() {

        if (!this._visible) {
            return;
        }

        const scene = this.plugin.viewer.scene;

        if (this._vpDirty) {

            math.transformPositions4(scene.camera.viewMatrix, this._wp, this._vp);

            this._vp[3] = 1.0;
            this._vp[7] = 1.0;
            this._vp[11] = 1.0;
            this._vp[15] = 1.0;

            this._vpDirty = false;
            this._cpDirty = true;
        }

        if (this._sectionPlanesDirty) {

            if (this._isSliced(this._originWorld) || this._isSliced(this._targetWorld)) {
                this._originDot.setCulled(true);
                this._targetDot.setCulled(true);
                return;
            } else {
                this._originDot.setCulled(false);
                this._targetDot.setCulled(false);
            }

            this._sectionPlanesDirty = true;
        }

        const near = -0.3;
        const vpz1 = this._originMarker.viewPos[2];
        const vpz2 = this._targetMarker.viewPos[2];

        if (vpz1 > near || vpz2 > near) {
            this._originDot.setVisible(false);
            this._targetDot.setVisible(false);

            return;
        }

        if (this._cpDirty) {

            math.transformPositions4(scene.camera.project.matrix, this._vp, this._pp);

            var pp = this._pp;
            var cp = this._cp;

            var canvas = scene.canvas.canvas;
            var offsets = canvas.getBoundingClientRect();
            const containerOffsets = this._container.getBoundingClientRect();
            var top = offsets.top - containerOffsets.top;
            var left = offsets.left - containerOffsets.left;
            var aabb = scene.canvas.boundary;
            var canvasWidth = aabb[2];
            var canvasHeight = aabb[3];
            var j = 0;

            const metrics = this.plugin.viewer.scene.metrics;
            const scale = metrics.scale;
            const units = metrics.units;
            const unitInfo = metrics.unitsInfo[units];
            const unitAbbrev = unitInfo.abbrev;

            for (var i = 0, len = pp.length; i < len; i += 4) {
                cp[j] = left + Math.floor((1 + pp[i + 0] / pp[i + 3]) * canvasWidth / 2);
                cp[j + 1] = top + Math.floor((1 - pp[i + 1] / pp[i + 3]) * canvasHeight / 2);
                j += 2;
            }

            this._originDot.setPos(cp[0], cp[1]);
            this._targetDot.setPos(cp[6], cp[7]);

            this._originDot.setVisible(this._visible && this._originVisible);
            this._targetDot.setVisible(this._visible && this._targetVisible);

            this._cpDirty = false;
        }
    }

    _isSliced(positions) {
       const sectionPlanes = this.scene._sectionPlanesState.sectionPlanes;
        for (let i = 0, len = sectionPlanes.length; i < len; i++) {
            const sectionPlane = sectionPlanes[i];
            if (math.planeClipsPositions3(sectionPlane.pos, sectionPlane.dir, positions, 4)) {
                return true
            }
        }
        return false;
    }

    /**
     * Sets whether this Issues indicates that its measurement is approximate.
     *
     * This is ````true```` by default.
     *
     * @type {Boolean}
     */
    set approximate(approximate) {
        approximate = approximate !== false;
        if (this._approximate === approximate) {
            return;
        }
        this._approximate = approximate;
        this._cpDirty = true;
        this._needUpdate(0);
    }

    /**
     * Gets whether this Issues indicates that its measurement is approximate.
     *
     * This is ````true```` by default.
     *
     * @type {Boolean}
     */
    get approximate() {
        return this._approximate;
    }

    /**
     * Gets the origin {@link Marker}.
     *
     * @type {Marker}
     */
    get origin() {
        return this._originMarker;
    }

    /**
     * Gets the target {@link Marker}.
     *
     * @type {Marker}
     */
    get target() {
        return this._targetMarker;
    }

    /**
     * Gets the World-space direct point-to-point distance between {@link Issues#origin} and {@link Issues#target}.
     *
     * @type {Number}
     */
    get length() {
        this._update();
        const scale = this.plugin.viewer.scene.metrics.scale;
        return this._length * scale;
    }

    get color() {
        return this._color;
    }

    set color(value) {
        this._color = value;
        this._originDot.setFillColor(value);
        this._targetDot.setFillColor(value);
        this._lengthLabel.setFillColor(value);
    }

    /**
     * Sets whether this Issues is visible or not.
     *
     * @type {Boolean}
     */
    set visible(value) {

        value = value !== undefined ? Boolean(value) : this.plugin.defaultVisible;

        this._visible = value;

        this._originDot.setVisible(this._visible && this._originVisible);
        this._targetDot.setVisible(this._visible && this._targetVisible);

        this._cpDirty = true;

        this._needUpdate();
    }

    /**
     * Gets whether this Issues is visible or not.
     *
     * @type {Boolean}
     */
    get visible() {
        return this._visible;
    }

    /**
     * Sets if the origin {@link Marker} is visible.
     *
     * @type {Boolean}
     */
    set originVisible(value) {
        value = value !== undefined ? Boolean(value) : this.plugin.defaultOriginVisible;
        this._originVisible = value;
        this._originDot.setVisible(this._visible && this._originVisible);
    }

    /**
     * Gets if the origin {@link Marker} is visible.
     *
     * @type {Boolean}
     */
    get originVisible() {
        return this._originVisible;
    }

    /**
     * Sets if the target {@link Marker} is visible.
     *
     * @type {Boolean}
     */
    set targetVisible(value) {
        value = value !== undefined ? Boolean(value) : this.plugin.defaultTargetVisible;
        this._targetVisible = value;
        this._targetDot.setVisible(this._visible && this._targetVisible);
    }

    /**
     * Gets if the target {@link Marker} is visible.
     *
     * @type {Boolean}
     */
    get targetVisible() {
        return this._targetVisible;
    }

    /**
     * Sets if the axis-aligned wires between {@link Issues#origin} and {@link Issues#target} are enabled.
     *
     * Wires are only shown if enabled and visible.
     *
     * @type {Boolean}
     */
    set axisEnabled(value) {
        value = value !== undefined ? Boolean(value) : this.plugin.defaultAxisVisible;
        this._axisEnabled = value;
        this._cpDirty = true;
        this._needUpdate();
    }

    /**
     * Gets if the axis-aligned wires between {@link Issues#origin} and {@link Issues#target} are enabled.
     *
     * Wires are only shown if enabled and visible.
     *
     * @type {Boolean}
     */
    get axisEnabled() {
        return this._axisEnabled;
    }

    /**
     * Sets if the axis-aligned wires between {@link Issues#origin} and {@link Issues#target} are visible.
     *
     * Wires are only shown if enabled and visible.
     *
     * @type {Boolean}
     */
    set axisVisible(value) {
        value = value !== undefined ? Boolean(value) : this.plugin.defaultAxisVisible;
        this._axisVisible = value;
        var axisVisible = this._visible && this._axisVisible && this._axisEnabled;
        this._cpDirty = true;
        this._needUpdate();
    }

    /**
     * Gets if the axis-aligned wires between {@link Issues#origin} and {@link Issues#target} are visible.
     *
     * Wires are only shown if enabled and visible.
     *
     * @type {Boolean}
     */
    get axisVisible() {
        return this._axisVisible;
    }

    /**
     * Sets if the X-axis-aligned wire between {@link Issues#origin} and {@link Issues#target} is visible.
     *
     * Wires are only shown if enabled and visible.
     *
     * @type {Boolean}
     */
    set xAxisVisible(value) {
        value = value !== undefined ? Boolean(value) : this.plugin.defaultAxisVisible;
        this._xAxisVisible = value;
        this._cpDirty = true;
        this._needUpdate();
    }

    /**
     * Gets if the X-axis-aligned wires between {@link Issues#origin} and {@link Issues#target} are visible.
     *
     * Wires are only shown if enabled and visible.
     *
     * @type {Boolean}
     */
    get xAxisVisible() {
        return this._xAxisVisible;
    }

    /**
     * Sets if the Y-axis-aligned wire between {@link Issues#origin} and {@link Issues#target} is visible.
     *
     * Wires are only shown if enabled and visible.
     *
     * @type {Boolean}
     */
    set yAxisVisible(value) {
        value = value !== undefined ? Boolean(value) : this.plugin.defaultAxisVisible;
        this._yAxisVisible = value;
        this._cpDirty = true;
        this._needUpdate();
    }

    /**
     * Gets if the Y-axis-aligned wires between {@link Issues#origin} and {@link Issues#target} are visible.
     *
     * Wires are only shown if enabled and visible.
     *
     * @type {Boolean}
     */
    get yAxisVisible() {
        return this._yAxisVisible;
    }

    /**
     * Sets if the Z-axis-aligned wire between {@link Issues#origin} and {@link Issues#target} is visible.
     *
     * Wires are only shown if enabled and visible.
     *
     * @type {Boolean}
     */
    set zAxisVisible(value) {
        value = value !== undefined ? Boolean(value) : this.plugin.defaultAxisVisible;
        this._zAxisVisible = value;
        this._cpDirty = true;
        this._needUpdate();
    }

    /**
     * Gets if the Z-axis-aligned wires between {@link Issues#origin} and {@link Issues#target} are visible.
     *
     * Wires are only shown if enabled and visible.
     *
     * @type {Boolean}
     */
    get zAxisVisible() {
        return this._zAxisVisible;
    }

    /**
     * Sets if the direct point-to-point wire between {@link Issues#origin} and {@link Issues#target} is visible.
     *
     * @type {Boolean}
     */
    set wireVisible(value) {
        value = value !== undefined ? Boolean(value) : this.plugin.defaultWireVisible;
    }

    /**
     * Gets if the direct point-to-point wire between {@link Issues#origin} and {@link Issues#target} is visible.
     *
     * @type {Boolean}
     */
    get wireVisible() {
        return this._wireVisible;
    }

    /**
     * Sets if the labels are visible except the length label.
     *
     * @type {Boolean}
     */
    set labelsVisible(value) {
        value = value !== undefined ? Boolean(value) : this.plugin.defaultLabelsVisible;
        this._cpDirty = true;
        this._needUpdate();
    }

    /**
     * Gets if the labels are visible.
     *
     * @type {Boolean}
     */
    get labelsVisible() {
        return this._labelsVisible;
    }

    /**
     * Sets if the x label is enabled.
     *
     * @type {Boolean}
     */
    set xLabelEnabled(value) {
        value = value !== undefined ? Boolean(value) : this.plugin.defaultXLabelEnabled;
        this._xLabelEnabled = value;
        var labelsVisible = this._visible && this._labelsVisible;
        this._xAxisLabel.setVisible(labelsVisible && !this._xAxisLabelCulled && this._clickable && this._axisEnabled && this._xLabelEnabled);
        this._cpDirty = true;
        this._needUpdate();
    }

    /**
     * Gets if the x label is enabled.
     *
     * @type {Boolean}
     */
    get xLabelEnabled(){
        return this._xLabelEnabled;
    }

    /**
     * Sets if the y label is enabled.
     *
     * @type {Boolean}
     */
    set yLabelEnabled(value) {
        value = value !== undefined ? Boolean(value) : this.plugin.defaultYLabelEnabled;
        this._cpDirty = true;
        this._needUpdate();
    }

    /**
     * Gets if the y label is enabled.
     *
     * @type {Boolean}
     */
    get yLabelEnabled(){
        return this._yLabelEnabled;
    }

    /**
     * Sets if the z label is enabled.
     *
     * @type {Boolean}
     */
    set zLabelEnabled(value) {
        value = value !== undefined ? Boolean(value) : this.plugin.defaultZLabelEnabled;
        this._cpDirty = true;
        this._needUpdate();
    }

    /**
     * Gets if the z label is enabled.
     *
     * @type {Boolean}
     */
    get zLabelEnabled(){
        return this._zLabelEnabled;
    }

    /**
     * Sets if the length label is enabled.
     *
     * @type {Boolean}
     */
    set lengthLabelEnabled(value) {
        value = value !== undefined ? Boolean(value) : this.plugin.defaultLengthLabelEnabled;
        this._lengthLabelEnabled = value;
        var labelsVisible = this._visible && this._labelsVisible;
        this._lengthLabel.setVisible(labelsVisible && !this._lengthAxisLabelCulled && this._clickable && this._axisEnabled && this._lengthLabelEnabled);
        this._cpDirty = true;
        this._needUpdate();
    }

    /**
     * Gets if the length label is enabled.
     *
     * @type {Boolean}
     */
    get lengthLabelEnabled(){
        return this._lengthLabelEnabled;
    }

    /**
     * Sets if labels should be positioned on the wires.
     *
     * @type {Boolean}
     */
    set labelsOnWires(value) {
        value = value !== undefined ? Boolean(value) : this.plugin.defaultLabelsOnWires;
        this._labelsOnWires = value;
    }

    /**
     * Gets if labels should be positioned on the wires.
     *
     * @type {Boolean}
     */
    get labelsOnWires() {
        return this._labelsOnWires;
    }

    /**
     * Sets if this Issues appears highlighted.
     * @param highlighted
     */
    setHighlighted(highlighted) {
        this._originDot.setHighlighted(highlighted);
        this._targetDot.setHighlighted(highlighted);
    }

    /**
     * Sets if the wires, dots ad labels will fire "mouseOver" "mouseLeave" and "contextMenu" events, or ignore mouse events altogether.
     *
     * @type {Boolean}
     */
    set clickable(value) {
        value = !!value;
        this._clickable = value;
        this._originDot.setClickable(this._clickable);
        this._targetDot.setClickable(this._clickable);
    }

    /**
     * Gets if the wires, dots ad labels will fire "mouseOver" "mouseLeave" and "contextMenu" events.
     *
     * @type {Boolean}
     */
    get clickable() {
        return this._clickable;
    }

    /**
     * @private
     */
    destroy() {

        const scene = this.plugin.viewer.scene;
        const metrics = scene.metrics;

        if (this._onViewMatrix) {
            scene.camera.off(this._onViewMatrix);
        }
        if (this._onProjMatrix) {
            scene.camera.off(this._onProjMatrix);
        }
        if (this._onCanvasBoundary) {
            scene.canvas.off(this._onCanvasBoundary);
        }
        if (this._onMetricsUnits) {
            metrics.off(this._onMetricsUnits);
        }
        if (this._onMetricsScale) {
            metrics.off(this._onMetricsScale);
        }
        if (this._onMetricsOrigin) {
            metrics.off(this._onMetricsOrigin);
        }
        if (this._onSectionPlaneUpdated) {
            scene.off(this._onSectionPlaneUpdated);
        }

        this._originDot.destroy();
        this._targetDot.destroy();

        super.destroy();
    }
}

export {Issues};