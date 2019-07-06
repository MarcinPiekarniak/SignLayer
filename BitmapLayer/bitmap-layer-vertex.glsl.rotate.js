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

export default `\
#define SHADER_NAME icon-layer-vertex-shader
attribute vec2 positions;
attribute vec3 instancePositions;
attribute vec3 instancePositions1;
attribute vec3 instancePositions2;
attribute vec3 instancePositions3;
attribute vec3 instancePositions4;
attribute vec2 instancePositions64xyLow;
attribute vec2 instancePositions64xyLow1;
attribute vec2 instancePositions64xyLow2;
attribute vec2 instancePositions64xyLow3;
attribute vec2 instancePositions64xyLow4;
attribute float instanceSizes;
attribute float instanceAngles;
attribute float instanceMeters;
attribute vec4 instanceColors;
attribute vec3 instancePickingColors;
attribute vec4 instanceIconFrames;
attribute float instanceColorModes;
attribute vec2 instanceOffsets;
uniform float sizeScale;
uniform vec2 iconsTextureDim;
varying float vColorMode;
varying vec4 vColor;
varying vec2 vTextureCoords;
vec2 rotate_by_angle(vec2 vertex, float angle) {
  float angle_radian = angle * PI / 180.0;
  float cos_angle = cos(angle_radian);
  float sin_angle = sin(angle_radian);
  mat2 rotationMatrix = mat2(cos_angle, -sin_angle, sin_angle, cos_angle);
  return rotationMatrix * vertex;
}
void main(void) {

  // width height
  vec2 iconSize = instanceIconFrames.zw;

  // scale square model (-1,-1,1,1) to rectangle
  vec2 pos = positions.xy;
  pos.x = pos.x * iconSize.x * 1.0 / iconSize.y;

  // rotate text in 2d - adjust it's initial position over map
  float angle = -23.25;
  pos = rotate_by_angle(pos, angle);

  // map lat/longitude to [x,y,z] - looks like it's in meters
  vec3 world_pos = project_position(instancePositions, instancePositions64xyLow);

  // assuming lat/long is center of model, get current model vertex position and evaluate
  // distance/offset in meters - 40 is some fixed value in this example
  vec2 worldOffset = pos * 40.;
  worldOffset.y *= -1.0;
  vec2 world_offset = project_scale(worldOffset);

  // add offset so we get model vertex in world position
  world_pos += vec3(world_offset.xy, 0.);

  // project world vertex to clipspace taking into consideration camera/perspective
  gl_Position = project_to_clipspace(vec4(world_pos, 1.0));

  // varyings for fragment shader
  vTextureCoords =   (positions.xy + 1.0) / 2.0;
  vTextureCoords.y = 1.0 - vTextureCoords.y;
  vColor = instanceColors / 255.;
  vColorMode = instanceColorModes;
  // Set color to be rendered to picking fbo (also used to check for selection highlight).
  picking_setPickingColor(instancePickingColors);

}
`;
