#version 300 es
precision highp float;
precision lowp isampler2D;
#define PI 3.1415926535897932384626433832795

uniform sampler2D u_clocks;
uniform sampler2D u_elevations;
uniform sampler2D u_boundaryLimits;

uniform float longueurMaxi;
uniform sampler2D u_summits;
uniform sampler2D u_ned2ECEF0s;
uniform sampler2D u_ned2ECEF1s;
uniform sampler2D u_ned2ECEF2s;
uniform isampler2D u_withLimits;

uniform float threeRadius;
uniform float earthRadius;
uniform vec3 referenceEquiRectangular;
uniform float standardParallel1;
uniform float standardParallel2;
uniform int representationInit;
uniform int representationEnd;
uniform float percentRepresentation;

#pragma glslify: polar2Cartographic =require(./src/shaders/polar2Cartographic.glsl)
#pragma glslify: displayConversions =require(./src/shaders/displayConversions.glsl)
in vec2 pos;
layout(location = 0) out vec4 myOutputColor;
layout(location = 1) out vec4 uvs;
// pos.x => clock ; pos.y => town
void main() {
  ivec2 pos2=ivec2(pos);
  ivec2 townPos = ivec2(0, pos2.y);
  float clock = texelFetch(u_clocks, ivec2(pos2.x, 0), 0).r;
  float elevation = texelFetch(u_elevations, townPos, 0).r;
  float boundaryLimit = texelFetch(u_boundaryLimits, pos2, 0).r;
  vec3 summit = texelFetch(u_summits, townPos, 0).xyz;
  mat3 ned2ECEF = mat3(0.0);
  ned2ECEF[0] = texelFetch(u_ned2ECEF0s, townPos, 0).xyz;
  ned2ECEF[1] = texelFetch(u_ned2ECEF1s, townPos, 0).xyz;
  ned2ECEF[2] = texelFetch(u_ned2ECEF2s, townPos, 0).xyz;
  int withLimits = texelFetch(u_withLimits, townPos, 0).r;

  vec3 cartoPosition;
  if (clock < 0.0) {
    cartoPosition = summit;
  } else {
    float longueur = longueurMaxi;
    float cosEl = cos(elevation);
    if (withLimits > 0 && cosEl>0.0) {
      longueur = min(longueurMaxi, boundaryLimit / cosEl);
    }
    cartoPosition = polar2Cartographic(clock, elevation, longueur, summit,
                                       ned2ECEF, earthRadius);
  }
  vec3 modelPosition = displayConversions(
      cartoPosition, threeRadius, earthRadius, referenceEquiRectangular,standardParallel1,standardParallel2,
      representationInit, representationEnd, percentRepresentation);
  myOutputColor = vec4(modelPosition,0.0);
  uvs = vec4(cartoPosition.x / PI + 0.5, cartoPosition.x / (2.0 * PI) + 0.5, 0.0, 0.0);
}
