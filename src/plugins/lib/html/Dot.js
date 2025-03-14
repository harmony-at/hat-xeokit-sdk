import { os } from "../../../viewer/utils/os.js";
/** @private */
class Dot {

    constructor(parentElement, cfg = {}) {

        this._highlightClass = "viewer-ruler-dot-highlighted";

        this._x = 0;
        this._y = 0;

        this._dot = document.createElement('div');
        this._dot.className += this._dot.className ? ' viewer-ruler-dot' : 'viewer-ruler-dot';
        this._dot.id += cfg.id || '';

        this._dotClickable = document.createElement('div');
        this._dotClickable.className += this._dotClickable.className ? ' viewer-ruler-dot-clickable' : 'viewer-ruler-dot-clickable';

        this._visible = !!cfg.visible;
        this._culled = false;

        var dot = this._dot;
        var dotStyle = dot.style;
        dotStyle["border-radius"] = 25 + "px";
        dotStyle.border = "solid 2px white";
        dotStyle.background = "lightgreen";
        dotStyle.position = "absolute";
        dotStyle["z-index"] = cfg.zIndex === undefined ? "40000005" : cfg.zIndex ;
        dotStyle.width = cfg.isIssue ? 18 + 'px' : 8 + 'px';
        dotStyle.height = cfg.isIssue ? 18 + 'px' : 8 + 'px';
        dotStyle.visibility = cfg.visible !== false ? "visible" : "hidden";
        dotStyle.top = 0 + "px";
        dotStyle.left = 0 + "px";
        dotStyle["box-shadow"] = "0 2px 5px 0 #182A3D;";
        dotStyle["opacity"] = 1.0;
        dotStyle['pointer-events'] = cfg.isIssue ? 'auto' : 'none';
        if (cfg.onContextMenu) {
          //  dotStyle["cursor"] = "context-menu";
        }
        parentElement.appendChild(dot);

        var dotClickable = this._dotClickable;
        var dotClickableStyle = dotClickable.style;
        dotClickableStyle["border-radius"] = 35 + "px";
        dotClickableStyle.border = "solid 10px white";
        dotClickableStyle.position = "absolute";
        dotClickableStyle["z-index"] = cfg.zIndex === undefined ? "40000007" : (cfg.zIndex + 1);
        dotClickableStyle.width = 8 + "px";
        dotClickableStyle.height = 8 + "px";
        dotClickableStyle.visibility = "visible";
        dotClickableStyle.top = 0 + "px";
        dotClickableStyle.left = 0 + "px";
        dotClickableStyle["opacity"] = 0.0;
        dotClickableStyle["pointer-events"] = "none";
        //themmoi2012
        //themmoi2612
        if(cfg.isPoint) {
            this.origin = cfg.origin || new Float64Array(3);
    
            this._tooltip = document.createElement('div');
            this._tooltip.className = 'tooltip';
            this._tooltip.style.position = 'absolute';
            this._tooltip.style.backgroundColor = 'white';
            this._tooltip.style.border = '1px solid #ccc';
            this._tooltip.style.borderRadius = '5px';
            this._tooltip.style.padding = '5px';
            this._tooltip.style.visibility = 'hidden';
            this._tooltip.style.fontSize = '13px';
            parentElement.appendChild(this._tooltip);
    
            dot.addEventListener('mouseenter', this.showTooltip.bind(this));
            dot.addEventListener('mouseleave', this.hideTooltip.bind(this));
        }
        if (cfg.onContextMenu) {
          //  dotClickableStyle["cursor"] = "context-menu";
        }
        parentElement.appendChild(dotClickable);

        dotClickable.addEventListener('click', (event) => {
            parentElement.dispatchEvent(new MouseEvent('mouseover', event));
        });

        if (cfg.isIssue) {
            dot.addEventListener('click', (event) => {
              console.log('click');
              cfg.getId();
              parentElement.dispatchEvent(new MouseEvent('mouseover', event));
            });
            dot.addEventListener('mousemove', (event) => {
              console.log('mousemove');
              cfg.onMouseMove(event);
              parentElement.dispatchEvent(new MouseEvent('mouseover', event));
            });
        }

        if (cfg.onMouseOver) {
            dotClickable.addEventListener('mouseover', (event) => {
                cfg.onMouseOver(event, this);
                parentElement.dispatchEvent(new MouseEvent('mouseover', event));
            });
        }

        if (cfg.onMouseLeave) {
            dotClickable.addEventListener('mouseleave', (event) => {
                cfg.onMouseLeave(event, this);
            });
        }

        if (cfg.onMouseWheel) {
            dotClickable.addEventListener('wheel', (event) => {
                cfg.onMouseWheel(event, this);
            });
        }

        if (cfg.onMouseDown) {
            dotClickable.addEventListener('mousedown', (event) => {
                cfg.onMouseDown(event, this);
            });
        }

        if (cfg.onMouseUp) {
            dotClickable.addEventListener('mouseup', (event) => {
                cfg.onMouseUp(event, this);
            });
        }

        if (cfg.onMouseMove) {
            dotClickable.addEventListener('mousemove', (event) => {
                cfg.onMouseMove(event, this);
            });
        }

        if (cfg.onContextMenu) {
            if(os.isIphoneSafari()){
                dotClickable.addEventListener('touchstart', (event) => {
                    event.preventDefault();
                    if(this._timeout){
                        clearTimeout(this._timeout);
                        this._timeout = null;
                    }
                    this._timeout = setTimeout(() => {
                        event.clientX = event.touches[0].clientX;
                        event.clientY = event.touches[0].clientY;
                        cfg.onContextMenu(event, this);
                        clearTimeout(this._timeout);
                        this._timeout = null;
                    }, 500);
                })

                dotClickable.addEventListener('touchend', (event) => {
                    event.preventDefault();
                    //stops short touches from calling the timeout
                    if(this._timeout) {
                        clearTimeout(this._timeout);
                        this._timeout = null;
                    }
                } )

            }
            else {
                dotClickable.addEventListener('contextmenu', (event) => {
                    console.log(event);
                    cfg.onContextMenu(event, this);
                    event.preventDefault();
                    event.stopPropagation();
                    console.log("Label context menu")
                });
            }
            
        }
        
        this.setPos(cfg.x || 0, cfg.y || 0);
        this.setFillColor(cfg.fillColor);
        this.setBorderColor(cfg.borderColor);
    }

    //themmoi2012
    showTooltip(event) {
        this._tooltip.innerHTML = `x: ${this.origin[0].toFixed(2)}m | y:${-1*this.origin[2].toFixed(2)}m | z: ${this.origin[1].toFixed(2)}m`;
        this._tooltip.style.left = event.clientX + 'px';
        this._tooltip.style.top = event.clientY + 'px';
        this._tooltip.style.visibility = 'visible';
      }
    
    hideTooltip() {
    this._tooltip.style.visibility = 'hidden';
    }

    setPos(x, y) {
        this._x = x;
        this._y = y;
        var dotStyle = this._dot.style;
        dotStyle["left"] = (Math.round(x) - 4) + 'px';
        dotStyle["top"] = (Math.round(y) - 4) + 'px';

        var dotClickableStyle = this._dotClickable.style;
        dotClickableStyle["left"] = (Math.round(x) - 9) + 'px';
        dotClickableStyle["top"] = (Math.round(y) - 9) + 'px';
    }

    setFillColor(color) {
        this._dot.style.background = color || "lightgreen";
    }

    setBorderColor(color) {
        this._dot.style.border = "solid 2px" + (color || "black");
    }

    setOpacity(opacity) {
        this._dot.style.opacity = opacity;
    }

    setVisible(visible) {
        if (this._visible === visible) {
            return;
        }
        this._visible = !!visible;
        this._dot.style.visibility = this._visible && !this._culled ? "visible" : "hidden";
    }

    setCulled(culled) {
        if (this._culled === culled) {
            return;
        }
        this._culled = !!culled;
        this._dot.style.visibility = this._visible && !this._culled ? "visible" : "hidden";
    }

    setClickable(clickable) {
        this._dotClickable.style["pointer-events"] = (clickable) ? "all" : "none";
    }

    setHighlighted(highlighted) {
        if (this._highlighted === highlighted) {
            return;
        }
        this._highlighted = !!highlighted;
        if (this._highlighted) {
            this._dot.classList.add(this._highlightClass);
        } else {
            this._dot.classList.remove(this._highlightClass);
        }
    }
    
    destroy() {
        this.setVisible(false);
        if (this._dot.parentElement) {
            this._dot.parentElement.removeChild(this._dot);
        }
        if (this._dotClickable.parentElement) {
            this._dotClickable.parentElement.removeChild(this._dotClickable);
        }
    }
}

export {Dot};
