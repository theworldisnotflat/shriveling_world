#version 300 es
precision highp float;
precision lowp isampler2D;
#define PI 3.1415926535897932384626433832795

uniform sampler2D u_Positions;

uniform float threeRadius;
uniform float earthRadius;
uniform vec3 referenceEquiRectangular;
uniform float standardParallel1;
uniform float standardParallel2;
uniform int representationInit;
uniform int representationEnd;
uniform float percentRepresentation;
uniform int conesShape;
uniform float zCoeff;

#pragma glslify: displayConversions =require(./displayConversions.glsl)
in vec2 pos;
layout(location = 0) out vec4 myOutputColor;

void main() {
  ivec2 pos2 = ivec2(pos);
  vec3 cartoPosition = texelFetch(u_Positions, pos2, 0).xyz;

  vec3 modelPosition = displayConversions(
      cartoPosition, threeRadius, earthRadius, referenceEquiRectangular,standardParallel1,standardParallel2,
      representationInit, representationEnd, percentRepresentation, conesShape, zCoeff);
  myOutputColor = vec4(modelPosition, 0.0);
}
