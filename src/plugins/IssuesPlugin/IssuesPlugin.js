import {Plugin} from "../../viewer/Plugin.js";
import {Issues} from "./Issues.js";
import {IssuesControl} from "./IssuesControl.js";

class IssuesPlugin extends Plugin {
    constructor(viewer, cfg = {}) {

        super("Issues", viewer);

        this._pointerLens = cfg.pointerLens;

        this._container = cfg.container || document.body;

        this._defaultControl = null;

        this._issues = {};

        this.labelMinAxisLength = cfg.labelMinAxisLength;
        this.defaultVisible = cfg.defaultVisible !== false;
        this.defaultOriginVisible = cfg.defaultOriginVisible !== false;
        this.defaultTargetVisible = cfg.defaultTargetVisible !== false;
        this.defaultWireVisible = cfg.defaultWireVisible !== false;
        this.defaultXLabelEnabled = cfg.defaultXLabelEnabled !== false;
        this.defaultYLabelEnabled = cfg.defaultYLabelEnabled !== false;
        this.defaultZLabelEnabled = cfg.defaultZLabelEnabled !== false;
        this.defaultLengthLabelEnabled = cfg.defaultLengthLabelEnabled !== false;
        this.defaultLabelsVisible = cfg.defaultLabelsVisible !== false;
        this.defaultAxisVisible = cfg.defaultAxisVisible !== false;
        this.defaultXAxisVisible = cfg.defaultXAxisVisible !== false;
        this.defaultYAxisVisible = cfg.defaultYAxisVisible !== false;
        this.defaultZAxisVisible = cfg.defaultZAxisVisible !== false;
        this.defaultColor = cfg.defaultColor !== undefined ? cfg.defaultColor : "#00BBFF";
        this.zIndex = cfg.zIndex || 10000;
        this.defaultLabelsOnWires = cfg.defaultLabelsOnWires !== false;

        this._onMouseOver = (event, issue) => {
            this.fire("mouseOver", {
                plugin: this,
                issues: issue,
                issue,
                event
            });
        }

        this._onMouseLeave = (event, issue) => {
            this.fire("mouseLeave", {
                plugin: this,
                issues: issue,
                issue,
                event
            });
        };

        this._onContextMenu = (event, issue) => {
            this.fire("contextMenu", {
                plugin: this,
                issues: issue,
                issue,
                event
            });
        };
    }

    /**
     * Gets the plugin's HTML container element, if any.
     * @returns {*|HTMLElement|HTMLElement}
     */
    getContainerElement() {
        return this._container;
    }

    /**
     * @private
     */
    send(name, value) {

    }

    /**
     * Gets the PointerLens attached to this IssuesPlugin.
     * @returns {PointerCircle}
     */
    get pointerLens() {
        return this._pointerLens;
    }

    /**
     * Gets the default {@link IssuesControl}.
     *
     * @type {IssuesControl}
     * @deprecated
     */
    get control() {
        if (!this._defaultControl) {
            this._defaultControl = new IssuesControl(this, {});
        }
        return this._defaultControl;
    }

    /**
     * Gets the existing {@link Issues}s, each mapped to its {@link Issues#id}.
     *
     * @type {{String:Issues}}
     */
    get measurements() {
        return this._issues;
    }

    /**
     * Sets the minimum length, in pixels, of an axis wire beyond which its label is shown.
     *
     * The axis wire's label is not shown when its length is less than this value.
     *
     * This is ````25```` pixels by default.
     *
     * Must not be less than ````1````.
     *
     * @type {number}
     */
    set labelMinAxisLength(labelMinAxisLength) {
        if (labelMinAxisLength < 1) {
            this.error("labelMinAxisLength must be >= 1; defaulting to 25");
            labelMinAxisLength = 25;
        }
        this._labelMinAxisLength = labelMinAxisLength || 25;
    }

    /**
     * Gets the minimum length, in pixels, of an axis wire beyond which its label is shown.
     * @returns {number}
     */
    get labelMinAxisLength() {
        return this._labelMinAxisLength;
    }

    createMeasurement(params = {}) {
        if (this.viewer.scene.components[params.id]) {
            this.error("Viewer scene component with this ID already exists: " + params.id);
            delete params.id;
        }
        const origin = params.origin;
        const target = params.target;
        const issue = new Issues(this, {
            id: params.id,
            plugin: this,
            container: this._container,
            origin: {
                entity: origin.entity,
                worldPos: origin.worldPos
            },
            target: {
                entity: target.entity,
                worldPos: target.worldPos
            },
            visible: params.visible,
            wireVisible: params.wireVisible,
            axisVisible: params.axisVisible !== false && this.defaultAxisVisible !== false,
            xAxisVisible: params.xAxisVisible !== false && this.defaultXAxisVisible !== false,
            yAxisVisible: params.yAxisVisible !== false && this.defaultYAxisVisible !== false,
            zAxisVisible: params.zAxisVisible !== false && this.defaultZAxisVisible !== false,
            xLabelEnabled: params.xLabelEnabled !== false && this.defaultXLabelEnabled !== false,
            yLabelEnabled: params.yLabelEnabled !== false && this.defaultYLabelEnabled !== false,
            zLabelEnabled: params.zLabelEnabled !== false && this.defaultZLabelEnabled !== false,
            lengthLabelEnabled: params.lengthLabelEnabled !== false && this.defaultLengthLabelEnabled !== false,
            labelsVisible: params.labelsVisible !== false && this.defaultLabelsVisible !== false,
            originVisible: params.originVisible,
            targetVisible: params.targetVisible,
            color: params.color,
            labelsOnWires: params.labelsOnWires !== false && this.defaultLabelsOnWires !== false,
            onMouseOver: this._onMouseOver,
            onMouseLeave: this._onMouseLeave,
            onContextMenu: this._onContextMenu
        });
        this._issues[issue.id] = issue;
        issue.clickable = true;
        issue.on("destroyed", () => {
            delete this._issues[issue.id];
        });
        this.fire("measurementCreated", issue);
        return issue;
    }

    createIssue(params = {}) {
        // Kiểm tra xem vấn đề có tồn tại không
        if (this._issues[params.id]) {
            console.warn("Issue with this ID already exists:", params.id);
            // Có thể xử lý nếu cần
            return null;
        }

        // Tạo một instance mới của vấn đề
        const issue = new Issue(this, {
            id: params.id,
            plugin: this,
            // Các thuộc tính khác của vấn đề như vị trí, thể hiện, ...
            worldPos: params.worldPos,
            entity: params.entity,
            // Các thuộc tính khác tùy chọn
        });

        // Lưu vấn đề vào danh sách các vấn đề
        this._issues[issue.id] = issue;

        // Phát sự kiện issueCreated để thông báo rằng đã tạo một vấn đề mới
        this.fire("issueCreated", issue);

        // Trả về instance của vấn đề đã tạo
        return issue;
    }

    /**
     * Destroys a {@link Issues}.
     *
     * @param {String} id ID of Issues to destroy.
     */
    destroyMeasurement(id) {
        const issue = this._issues[id];
        if (!issue) {
            this.log("Issues not found: " + id);
            return;
        }
        issue.destroy();
        this.fire("measurementDestroyed", issue);
    }

    /**
     * Shows all or hides the distance label of each {@link Issues}.
     *
     * @param {Boolean} labelsShown Whether or not to show the labels.
     */
    setLabelsShown(labelsShown) {
        for (const [key, issue] of Object.entries(this.measurements)) {
            issue.labelShown = labelsShown;
        }
    }

    /**
     * Shows all or hides the axis wires of each {@link Issues}.
     *
     * @param {Boolean} labelsShown Whether or not to show the axis wires.
     */
    setAxisVisible(axisVisible) {
        for (const [key, issue] of Object.entries(this.measurements)) {
            issue.axisVisible = axisVisible;
        }
        this.defaultAxisVisible = axisVisible;
    }

    /**
     * Gets if the axis wires of each {@link Issues} are visible.
     *
     * @returns {Boolean} Whether or not the axis wires are visible.
     */
    getAxisVisible() {
        return this.defaultAxisVisible;
    }

    /**
     * Destroys all {@link Issues}s.
     */
    clear() {
        const ids = Object.keys(this._issues);
        for (var i = 0, len = ids.length; i < len; i++) {
            this.destroyMeasurement(ids[i]);
        }
    }

    /**
     * Destroys this IssuesPlugin.
     *
     * Destroys all {@link Issues}s first.
     */
    destroy() {
        this.clear();
        super.destroy();
    }
}

export {IssuesPlugin}