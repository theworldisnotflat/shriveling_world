#version 300 es
precision highp float;
precision lowp isampler2D;
#define PI 3.1415926535897932384626433832795

uniform sampler2D u_clocks;
uniform sampler2D u_alphas;
uniform sampler2D u_boundaryLimits;

uniform float extrudedHeight;
uniform sampler2D u_summits;
uniform sampler2D u_ned2ECEF0s;
uniform sampler2D u_ned2ECEF1s;
uniform sampler2D u_ned2ECEF2s;
uniform sampler2D u_withLimits;

uniform float threeRadius;
uniform float earthRadius;
uniform vec3 referenceEquiRectangular;
uniform float standardParallel1;
uniform float standardParallel2;
uniform int projectionInit;
uniform int projectionEnd;
uniform float percentProjection;

#pragma glslify: polar2Cartographic = require(./polar2Cartographic.glsl)
#pragma glslify: displayConversions = require(./displayConversions.glsl)
in vec2 pos;
layout(location = 0) out vec4 myOutputColor;
layout(location = 1) out vec4 uvs;
layout(location = 2) out vec4 base;
// pos.x => clock ; pos.y => town
void main() {
  ivec2 pos2 = ivec2(pos);
  ivec2 cityPos = ivec2(0, pos2.y);
  float clock = texelFetch(u_clocks, ivec2(pos2.x, 0), 0).r;
  float alpha = texelFetch(u_alphas, pos2, 0).r;
  float boundaryLimit = texelFetch(u_boundaryLimits, pos2, 0).r;
  vec3 summit = texelFetch(u_summits, cityPos, 0).xyz;
  mat3 ned2ECEF = mat3(0.0);
  ned2ECEF[0] = texelFetch(u_ned2ECEF0s, cityPos, 0).xyz;
  ned2ECEF[1] = texelFetch(u_ned2ECEF1s, cityPos, 0).xyz;
  ned2ECEF[2] = texelFetch(u_ned2ECEF2s, cityPos, 0).xyz;
  float withLimits = texelFetch(u_withLimits, cityPos, 0).r;

  vec3 cartoPosition;
  float coneHeight = extrudedHeight;
  float cosAlpha = cos(alpha);
  float hauteurBase = coneHeight * sin(alpha);
  if (clock < 0.0) {
    cartoPosition = summit;
  } else {
    if (withLimits > 0.0 && cosAlpha > 0.0) {
      coneHeight = min(extrudedHeight, boundaryLimit / cosAlpha);
    }
    cartoPosition = polar2Cartographic(clock, alpha, coneHeight, summit,
                                       ned2ECEF, earthRadius);
  }
  vec3 modelPosition = displayConversions(
      cartoPosition, threeRadius, earthRadius, referenceEquiRectangular,
      standardParallel1, standardParallel2, projectionInit,
      projectionEnd, percentProjection);
  myOutputColor = vec4(modelPosition, 0.0);
  uvs = vec4(cartoPosition.x / (2.0 * PI) + 0.5, cartoPosition.y /  PI + 0.5,
             0.0, 0.0);
  cartoPosition.z = - hauteurBase;
  modelPosition = displayConversions(
      cartoPosition, threeRadius, earthRadius, referenceEquiRectangular,
      standardParallel1, standardParallel2, projectionInit,
      projectionEnd, percentProjection);
  base = vec4(modelPosition, 0.0);
}
