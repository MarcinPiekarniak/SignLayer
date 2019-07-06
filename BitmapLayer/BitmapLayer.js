// Copyright (c) 2015 - 2017 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.
import {Layer} from '@deck.gl/core';
import GL from 'luma.gl/constants';
import {Model, Geometry, fp64} from 'luma.gl';
import vs from './bitmap-layer-vertex.glsl';
import fs from './bitmap-layer-fragment.glsl';
import { makeTextTexture } from './makeTextTexture';

const {fp64LowPart} = fp64;
const DEFAULT_COLOR = [0, 0, 0, 255];
const DEFAULT_TEXTURE_MIN_FILTER = GL.LINEAR_MIPMAP_LINEAR;


// GL.LINEAR is the default value but explicitly set it here
const DEFAULT_TEXTURE_MAG_FILTER = GL.LINEAR;

/*
 * @param {object} props
 * @param {Texture2D | string} props.iconAtlas - atlas image url or texture
 * @param {object} props.iconMapping - icon names mapped to icon definitions
 * @param {object} props.iconMapping[icon_name].x - x position of icon on the atlas image
 * @param {object} props.iconMapping[icon_name].y - y position of icon on the atlas image
 * @param {object} props.iconMapping[icon_name].width - width of icon on the atlas image
 * @param {object} props.iconMapping[icon_name].height - height of icon on the atlas image
 * @param {object} props.iconMapping[icon_name].anchorX - x anchor of icon on the atlas image,
 *   default to width / 2
 * @param {object} props.iconMapping[icon_name].anchorY - y anchor of icon on the atlas image,
 *   default to height / 2
 * @param {object} props.iconMapping[icon_name].mask - whether icon is treated as a transparency
 *   mask. If true, user defined color is applied. If false, original color from the image is
 *   applied. Default to false.
 * @param {number} props.size - icon size in pixels
 * @param {func} props.getPosition - returns anchor position of the icon, in [lng, lat, z]
 * @param {func} props.getIcon - returns icon name as a string
 * @param {func} props.getSize - returns icon size multiplier as a number
 * @param {func} props.getColor - returns color of the icon in [r, g, b, a]. Only works on icons
 *   with mask: true.
 * @param {func} props.getAngle - returns rotating angle (in degree) of the icon.
 */
const defaultProps = {
  iconAtlas: null,
  iconMapping: {type: 'object', value: {}, async: true},
  sizeScale: {type: 'number', value: 1, min: 0},
  fp64: false,
  getText: {type: 'accessor', value: x => x.text},
  getPosition: {type: 'accessor', value: x => x.position},
  getPositionsSquare: {type: 'accessor', value: x => x.positionsSquare},
  getIcon: {type: 'accessor', value: x => x.icon},
  getColor: {type: 'accessor', value: DEFAULT_COLOR},
  getSize: {type: 'accessor', value: 1},
  getAngle: {type: 'accessor', value: 0}
};

class BitmapLayer extends Layer {
  getShaders() {
    const projectModule = this.use64bitProjection() ? 'project64' : 'project32';
    return {vs, fs, modules: [projectModule, 'picking']};
  }

  initializeState() {
    const attributeManager = this.getAttributeManager();

    /* eslint-disable max-len */
    attributeManager.addInstanced({
      instancePositions: {
        size: 3,
        transition: true,
        accessor: 'getPosition'
      },
      instancePositions1: {
        size: 3,
        transition: true,
        accessor: 'getPositionsSquare',
        update: this.calculateInstancePositions1,
      },
      instancePositions2: {
        size: 3,
        transition: true,
        accessor: 'getPositionsSquare',
        update: this.calculateInstancePositions2,
      },
      instancePositions3: {
        size: 3,
        transition: true,
        accessor: 'getPositionsSquare',
        update: this.calculateInstancePositions3,
      },
      instancePositions4: {
        size: 3,
        transition: true,
        accessor: 'getPositionsSquare',
        update: this.calculateInstancePositions4,
      },
      instancePositions64xyLow1: {
        size: 2,
        accessor: 'getPositionsSquare',
        transition: true,
        update: this.calculateInstancePositions64xyLow1
      },
      instancePositions64xyLow2: {
        size: 2,
        accessor: 'getPositionsSquare',
        transition: true,
        update: this.calculateInstancePositions64xyLow2
      },
      instancePositions64xyLow3: {
        size: 2,
        accessor: 'getPositionsSquare',
        transition: true,
        update: this.calculateInstancePositions64xyLow3
      },
      instancePositions64xyLow4: {
        size: 2,
        accessor: 'getPositionsSquare',
        transition: true,
        update: this.calculateInstancePositions64xyLow4
      },
      instanceSizes: {
        size: 1,
        transition: true,
        accessor: 'getSize',
        defaultValue: 1
      },
      instanceOffsets: {size: 2, accessor: 'getIcon', update: this.calculateInstanceOffsets},
      instanceIconFrames: {size: 4, accessor: 'getIcon', update: this.calculateInstanceIconFrames},
      instanceColorModes: {
        size: 1,
        type: GL.UNSIGNED_BYTE,
        accessor: 'getIcon',
        update: this.calculateInstanceColorMode
      },
      instanceColors: {
        size: 4,
        type: GL.UNSIGNED_BYTE,
        transition: true,
        accessor: 'getColor',
        defaultValue: DEFAULT_COLOR
      },
    });
    /* eslint-enable max-len */
  }

  updateState({oldProps, props, changeFlags}) {
    super.updateState({props, oldProps, changeFlags});
    const { data } = props;
    if (this.state.iconsTexture == null) {
      let iconsTexture = makeTextTexture(
        this.context.gl,
        data.map((x) => {
          return {
            text: x.text,
            fontColor: x.fontColor,
          };
        })
      );
      iconsTexture.texture.setParameters({
        [GL.TEXTURE_MIN_FILTER]: DEFAULT_TEXTURE_MIN_FILTER,
        [GL.TEXTURE_MAG_FILTER]: DEFAULT_TEXTURE_MAG_FILTER
      });
      this.setState({
        iconsTexture: iconsTexture.texture,
        mapping: iconsTexture.mapping
      });
    }

    if (props.fp64 !== oldProps.fp64) {
      const {gl} = this.context;
      if (this.state.model) {
        this.state.model.delete();
      }
      this.setState({model: this._getModel(gl)});
      this.getAttributeManager().invalidateAll();
    }



    //const {iconAtlas, iconMapping} = props;

/*
    if (oldProps.iconMapping !== iconMapping) {
      const attributeManager = this.getAttributeManager();
      attributeManager.invalidate('instanceOffsets');
      attributeManager.invalidate('instanceIconFrames');
      attributeManager.invalidate('instanceColorModes');
    }

    if (oldProps.iconAtlas !== iconAtlas) {
      if (iconAtlas instanceof Texture2D) {
        iconAtlas.setParameters({
          [GL.TEXTURE_MIN_FILTER]: DEFAULT_TEXTURE_MIN_FILTER,
          [GL.TEXTURE_MAG_FILTER]: DEFAULT_TEXTURE_MAG_FILTER
        });
        this.setState({iconsTexture: iconAtlas});
      } else if (typeof iconAtlas === 'string') {
        loadTextures(this.context.gl, {
          urls: [iconAtlas]
        }).then(([texture]) => {
          texture.setParameters({
            [GL.TEXTURE_MIN_FILTER]: DEFAULT_TEXTURE_MIN_FILTER,
            [GL.TEXTURE_MAG_FILTER]: DEFAULT_TEXTURE_MAG_FILTER
          });
          this.setState({iconsTexture: texture});
        });
      }
    }

    if (props.fp64 !== oldProps.fp64) {
      const {gl} = this.context;
      if (this.state.model) {
        this.state.model.delete();
      }
      this.setState({model: this._getModel(gl)});
      this.getAttributeManager().invalidateAll();
    }
    */
  }

  draw({uniforms}) {
    const { sizeScale } = this.props;
    const { iconsTexture } = this.state;

    if (iconsTexture) {
      this.state.model.render(
        Object.assign({}, uniforms, {
          iconsTexture: iconsTexture,
          iconsTextureDim: [iconsTexture.width, iconsTexture.height],
          sizeScale
        })
      );
    }
  }

  _getModel(gl) {
    const positions = [-1, -1, 0, -1, 1, 0, 1, 1, 0, 1, -1, 0];

    return new Model(
      gl,
      Object.assign({}, this.getShaders(), {
        id: this.props.id,
        geometry: new Geometry({
          drawMode: GL.TRIANGLE_FAN,
          attributes: {
            positions: new Float32Array(positions)
          }
        }),
        isInstanced: true,
        shaderCache: this.context.shaderCache
      })
    );
  }

  calculateInstancePositions64xyLow(attribute) {
    const isFP64 = this.use64bitPositions();
    attribute.constant = !isFP64;
    if (!isFP64) {
      attribute.value = new Float32Array(2);
      return;
    }

    const {data, getPosition} = this.props;
    const {value} = attribute;
    let i = 0;
    for (const point of data) {
      const position = getPosition(point);
      value[i++] = fp64LowPart(position[0]);
      value[i++] = fp64LowPart(position[1]);
    }
  }

  calculateInstanceOffsets(attribute) {
    const {data, iconMapping, getIcon} = this.props;
    const {value} = attribute;
    let i = 0;
    for (const object of data) {
      const icon = getIcon(object);
      const rect = iconMapping[icon] || {};
      value[i++] = rect.width / 2 - rect.anchorX || 0;
      value[i++] = rect.height / 2 - rect.anchorY || 0;
    }
  }

  calculateInstanceColorMode(attribute) {
    const {data, iconMapping, getIcon} = this.props;
    const {value} = attribute;
    let i = 0;
    for (const object of data) {
      const icon = getIcon(object);
      const colorMode = iconMapping[icon] && iconMapping[icon].mask;
      value[i++] = colorMode ? 1 : 0;
    }
  }

  calculateInstanceIconFrames(attribute) {
    const {data} = this.props;
    const {value} = attribute;
    let i = 0;
    for (let j = 0; j < data.length; ++j) {
      const rect = this.state.mapping[j];
      value[i++] = rect.x || 0;
      value[i++] = rect.y || 0;
      value[i++] = rect.width || 0;
      value[i++] = rect.height || 0;
    }
  }

  calculateInstancePositions1(attribute) {
    const {data} = this.props;
    const {value} = attribute;
    let i = 0;
    for (let j = 0; j < data.length; ++j) {
      value[i++] = data[j].positionsSquare[0][0]
      value[i++] = data[j].positionsSquare[0][1]
      value[i++] = 0;
    }
  }

  calculateInstancePositions2(attribute) {
    const {data} = this.props;
    const {value} = attribute;
    let i = 0;
    for (let j = 0; j < data.length; ++j) {
      value[i++] = data[j].positionsSquare[1][0]
      value[i++] = data[j].positionsSquare[1][1]
      value[i++] = 0;
    }
  }

  calculateInstancePositions3(attribute) {
    const {data} = this.props;
    const {value} = attribute;
    let i = 0;
    for (let j = 0; j < data.length; ++j) {
      value[i++] = data[j].positionsSquare[2][0]
      value[i++] = data[j].positionsSquare[2][1]
      value[i++] = 0;
    }
  }

  calculateInstancePositions4(attribute) {
    const {data} = this.props;
    const {value} = attribute;
    let i = 0;
    for (let j = 0; j < data.length; ++j) {
      value[i++] = data[j].positionsSquare[3][0]
      value[i++] = data[j].positionsSquare[3][1]
      value[i++] = 0;
    }
  }

  calculateInstancePositions64xyLow1(attribute) {
    const isFP64 = this.use64bitPositions();
    attribute.constant = !isFP64;
    if (!isFP64) {
      attribute.value = new Float32Array(2);
      return;
    }

    const {data} = this.props;
    const {value} = attribute;
    let i = 0;
    for (const point of data) {
      value[i++] = fp64LowPart( point.positionsSquare[0][0]);
      value[i++] = fp64LowPart( point.positionsSquare[0][1]);
    }
  }

  calculateInstancePositions64xyLow2(attribute) {
    const isFP64 = this.use64bitPositions();
    attribute.constant = !isFP64;
    if (!isFP64) {
      attribute.value = new Float32Array(2);
      return;
    }

    const {data} = this.props;
    const {value} = attribute;
    let i = 0;
    for (const point of data) {
      value[i++] = fp64LowPart( point.positionsSquare[1][0]);
      value[i++] = fp64LowPart( point.positionsSquare[1][1]);
    }
  }

  calculateInstancePositions64xyLow3(attribute) {
    const isFP64 = this.use64bitPositions();
    attribute.constant = !isFP64;
    if (!isFP64) {
      attribute.value = new Float32Array(2);
      return;
    }

    const {data} = this.props;
    const {value} = attribute;
    let i = 0;
    for (const point of data) {
      value[i++] = fp64LowPart( point.positionsSquare[2][0]);
      value[i++] = fp64LowPart( point.positionsSquare[2][1]);
    }
  }

  calculateInstancePositions64xyLow4(attribute) {
    const isFP64 = this.use64bitPositions();
    attribute.constant = !isFP64;
    if (!isFP64) {
      attribute.value = new Float32Array(2);
      return;
    }

    const {data} = this.props;
    const {value} = attribute;
    let i = 0;
    for (const point of data) {
      value[i++] = fp64LowPart( point.positionsSquare[3][0]);
      value[i++] = fp64LowPart( point.positionsSquare[3][1]);
    }
  }

}

BitmapLayer.layerName = 'BitmapLayer';
BitmapLayer.defaultProps = defaultProps;

export { BitmapLayer };
